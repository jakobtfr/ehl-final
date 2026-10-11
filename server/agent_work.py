"""Specialist agent outputs (MULTI_AGENT_PLAN.md step 3): challenges, research briefs, audience drafts and the
morning brief, each an immutable `agent_artifacts` row tied to the exact requirement version and score it used.

Counts, checks and links come from code; OpenAI only argues (challenger) or writes prose (comms drafter), and
every quote it cites is grounded in the linked evidence before anything is stored. Drafts are internal: there is
no send operation. None of these capabilities decides, edits or rescores a requirement.
"""

import json
import re
from contextlib import closing
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from database.store import audit, connect, decode, encode, new_id, now, transaction
from server.analysis_engine import ProviderUnavailable
from server.evidence import scope_filters
from server.llm import LLMOutputInvalid, locate_quote, resolve_provider
from server.models import Scope, Text
from server.platform import Capability, record_run, register_capability
from server.public_sources import requirement_mix, source_mix
from server.requirements import requirement_detail

router = APIRouter(prefix="/artifacts", tags=["agents"])

CHALLENGE_METHOD = "challenge-rules-v1"
CHALLENGE_PROMPT = "requirement-challenge-v1"
BRIEF_METHOD = "research-gaps-v1"
DRAFT_METHOD = "audience-templates-v1"
DRAFT_PROMPT = "audience-drafts-v1"
MORNING_METHOD = "morning-brief-v1"
OUT_OF_SCOPE = re.compile(r"\b(price|pricing|cost|€|\$\d|supplier|homologation|regulat\w*|business case|ROI|ECU|"
                          r"wiring|architecture|component spec\w*)\b", re.IGNORECASE)
AUDIENCES = ("engineering", "market", "board", "sales")
Provider = Literal["openai", "deterministic"]


class RequirementTask(Scope):
    requirement_id: Text = Field(max_length=80)
    provider: Provider = "deterministic"
    actor: Text = Field(default="ai:agent:challenger", max_length=200)
    session_id: Text | None = Field(default=None, max_length=80)


class ScopeTask(Scope):
    provider: Provider = "deterministic"
    actor: Text = Field(default="ai:agent:research-planner", max_length=200)
    session_id: Text | None = Field(default=None, max_length=80)
    since_hours: int = Field(default=24, ge=1, le=24 * 30)


# Shared ---------------------------------------------------------------------------------------------

def _requirement(requirement_id: str, vehicle: str, market: str) -> dict:
    with closing(connect()) as connection:
        detail = requirement_detail(connection, requirement_id)
        key = connection.execute("SELECT key FROM requirements WHERE id=?", (requirement_id,)).fetchone()
    if (detail["vehicle"], detail["market"]) != (vehicle, market):
        raise HTTPException(422, "Requirement belongs to another vehicle and market")
    detail["key"] = key[0] if key else requirement_id[:8]
    return detail


def store_artifact(*, vehicle, market, kind, content, created_by, provider, method_version, run_id,
                   requirement_id=None, version_id=None, score_id=None, session_id=None) -> dict:
    row = {"id": new_id(), "vehicle": vehicle, "market": market, "kind": kind, "requirement_id": requirement_id,
           "version_id": version_id, "score_id": score_id, "session_id": session_id, "run_id": run_id,
           "created_by": created_by, "provider": provider, "method_version": method_version,
           "content": encode(content), "created_at": now()}
    with transaction() as connection:
        connection.execute(f"INSERT INTO agent_artifacts ({','.join(row)}) VALUES ({','.join('?' for _ in row)})",
                           list(row.values()))
        audit(connection, "agent_artifact", row["id"], f"artifact.{kind}", created_by,
              f"Agent {kind.replace('_', ' ')} recorded; no decision", after={**row, "content": content},
              metadata={"run_id": run_id, "session_id": session_id})
    return {**row, "content": content}


def _excerpts(version: dict, limit: int = 14) -> list[dict]:
    """Linked records for the model: public and conflicting ones first, then supporting BMW records."""
    with closing(connect()) as connection:
        rows = connection.execute(
            "SELECT e.id, e.content, e.observed_at, s.title AS source, s.kind, fe.relation FROM requirement_findings rf "
            "JOIN finding_evidence fe ON fe.finding_id=rf.finding_id JOIN evidence e ON e.id=fe.evidence_id "
            "JOIN sources s ON s.id=e.source_id WHERE rf.version_id=? "
            "ORDER BY (s.kind='web') DESC, (fe.relation='conflicts') DESC, length(e.content) DESC, e.id",
            (version["id"],)).fetchall()
    picked, seen = [], set()
    for row in rows:
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        picked.append({"evidence_id": row["id"], "source": row["source"], "relation": row["relation"],
                       "observed_at": row["observed_at"], "text": row["content"][:700]})
        if len(picked) >= limit:
            break
    return picked


# Challenger -----------------------------------------------------------------------------------------

class _Counter(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim: str
    evidence_id: str
    quote: str


class _Challenge(BaseModel):
    model_config = ConfigDict(extra="forbid")
    counterarguments: list[_Counter]
    missing_evidence: list[str]
    target_realism: str


CHALLENGE_INSTRUCTIONS = (
    "You are the challenger on a BMW product-management agent team. Argue against the draft requirement as a "
    "sceptical senior PM would: where the evidence is weak, contradicting, unrepresentative or out of date, where the "
    "target is unrealistic or unmeasurable, and where it drifts into pricing, business cases, suppliers or engineering "
    "specifications. Cite only the provided evidence: each counterargument names one evidence_id and quotes at most "
    "25 consecutive words copied exactly from that record's text. List missing evidence a PM should request. Be "
    "specific and brief; do not restate the requirement.")


def _checks(detail: dict, mix: dict, coverage: list[dict]) -> list[dict]:
    version, score = detail["current_version"], detail["current_version"]["score"] or {}
    explanation = score.get("explanation", {})
    evidence = explanation.get("evidence_count", 0)
    supporting = sum(source["supporting"] for source in mix["sources"]) or 1
    top = max(mix["sources"], key=lambda source: source["supporting"], default=None)
    objections = []

    def add(code, severity, claim, action, **numbers):
        objections.append({"code": code, "severity": severity, "claim": claim, "suggested_action": action,
                           "numbers": numbers})

    if top and top["supporting"] / supporting >= 0.7:
        add("single_source_concentration", "high",
            f"{top['supporting'] / supporting:.0%} of the linked records come from one source ({top['title']}).",
            "Weigh corroborating sources separately before approving.", share=round(top["supporting"] / supporting, 4))
    public = [source for source in mix["sources"] if source["origin"] != "bmw_internal"]
    if not public:
        add("no_public_corroboration", "medium", "No public record (NHTSA, owner forums, press) supports this need.",
            "Run the public data connectors or treat the need as BMW-sample only.")
    conflicts = explanation.get("conflict_count", 0)
    if conflicts:
        add("conflicting_evidence", "high" if evidence and conflicts / evidence >= 0.3 else "medium",
            f"{conflicts} linked records point the other way (praise versus complaints on the same topic).",
            "Separate what to preserve from what to fix; the requirement may need splitting.", conflicts=conflicts,
            evidence=evidence)
    dated = explanation.get("dated_evidence_count", 0)
    if evidence and dated / evidence < 0.5:
        add("undated_evidence", "medium", f"Only {dated} of {evidence} linked records carry an observation date.",
            "Trends cannot be shown; request dated feedback or rely on the dated public records.",
            dated=dated, evidence=evidence)
    criteria = version["acceptance_criteria"]
    if criteria and all(criterion["basis"] == "PM assumption" for criterion in criteria):
        add("assumed_targets", "medium", "Every acceptance target is a PM assumption, not a measured or sourced value.",
            "Agree the evaluation protocol and target with the research owner before G1.")
    if version["title"].lower().startswith("improve "):
        add("not_specific", "medium", "The title states a direction, not a specific customer outcome.",
            "Edit into a SMART outcome (who, what, measured how, by when).")
    grade = score.get("evidence_grade")
    if grade in ("C", "D"):
        add("low_evidence_grade", "medium" if grade == "C" else "high", f"Evidence grade {grade}.",
            "See the conflicting and undated findings above.")
    for factor in explanation.get("not_measured", []):
        add("factor_not_measured", "low", f"Scoring factor {factor} is not measured and uses the neutral 2.5.",
            "Treat the priority as provisional on this factor.", factor=factor)
    text = " ".join([version["title"], version["statement"], *version["assumptions"]])
    if match := OUT_OF_SCOPE.search(text):
        add("scope_drift", "high", f"Mentions '{match.group(0)}', which is outside the challenge scope.",
            "Remove pricing, business-case, supplier and engineering detail.")
    for warning in coverage:
        if warning.get("code") == "single_source_dominance":
            add("market_sample_bias", "low", warning["message"], "Name the sample limitation in the decision rationale.")
    return objections


def challenge_requirement(command: RequirementTask, actor: str | None = None) -> dict:
    actor = actor or command.actor
    try:
        client, method = resolve_provider(command.provider, prompt_version=CHALLENGE_PROMPT,
                                          deterministic_method=CHALLENGE_METHOD)
    except ProviderUnavailable as exc:
        raise HTTPException(503, str(exc)) from None
    with record_run(None, "agents.challenge_requirement", actor, method, command.model_dump(),
                    vehicle=command.vehicle, market=command.market) as run:
        detail = _requirement(command.requirement_id, command.vehicle, command.market)
        version = detail["current_version"]
        mix = requirement_mix(command.requirement_id, version["id"])
        with closing(connect()) as connection:
            row = connection.execute("SELECT warnings FROM coverage_reports WHERE vehicle=? AND market=? AND "
                                     "status='current' ORDER BY rowid DESC LIMIT 1",
                                     (command.vehicle, command.market)).fetchone()
        objections = _checks(detail, mix, json.loads(row[0]) if row else [])
        argued, rejected = [], 0
        missing, realism = [], None
        if client is not None:
            excerpts = _excerpts(version)
            texts = {item["evidence_id"]: item["text"] for item in excerpts}
            answer = client.structured(task="challenge_requirement", prompt_version=CHALLENGE_PROMPT,
                                       instructions=CHALLENGE_INSTRUCTIONS, schema=_Challenge, run=run, input={
                                           "requirement": {k: version[k] for k in ("title", "statement", "customer_need",
                                                                                   "acceptance_criteria", "assumptions")},
                                           "score": {"total": version["score"]["total"],
                                                     "evidence_grade": version["score"]["evidence_grade"]},
                                           "evidence": excerpts})
            for item in answer.counterarguments[:6]:
                if item.evidence_id in texts and locate_quote(texts[item.evidence_id], item.quote):
                    argued.append(item.model_dump())
                else:
                    rejected += 1
            missing, realism = answer.missing_evidence[:5], answer.target_realism
        severities = [o["severity"] for o in objections]
        verdict = ("hold_for_evidence" if severities.count("high") >= 2 else
                   "proceed_with_caveats" if objections or argued else "no_objection")
        content = {"requirement_key": detail["key"], "title": version["title"], "version": version["version"],
                   "score_total": version["score"]["total"], "evidence_grade": version["score"]["evidence_grade"],
                   "verdict": verdict, "objections": objections, "counterarguments": argued,
                   "rejected_ungrounded": rejected, "missing_evidence": missing, "target_realism": realism,
                   "source_mix": mix["sources"], "note": "A PM resolves each challenge; the requirement is unchanged."}
        if rejected and not argued and client is not None:
            raise LLMOutputInvalid("No challenger quote could be grounded in the linked evidence")
        artifact = store_artifact(vehicle=command.vehicle, market=command.market, kind="challenge", content=content,
                                  created_by=actor, provider=command.provider, method_version=method, run_id=run.id,
                                  requirement_id=detail["id"], version_id=version["id"],
                                  score_id=version["score"]["id"], session_id=command.session_id)
        run.outputs.update(artifact_id=artifact["id"], requirement_key=detail["key"], verdict=verdict,
                           objections=len(objections), counterarguments=len(argued), rejected_ungrounded=rejected)
    return {**run.outputs, "run_id": run.id, "awaiting_human": True}


# Research planner -----------------------------------------------------------------------------------

METHODS = {
    "single_source_concentration": "Corroborate with a second channel (dated owner survey or dealer feedback) before G1.",
    "no_public_corroboration": "Run NHTSA and web research; if still absent, add the topic to the next customer clinic.",
    "conflicting_evidence": "Moderated clinic separating preserve versus fix, n >= 12 per segment.",
    "undated_evidence": "Request dated feedback exports so trends can be measured.",
    "assumed_targets": "Benchmark study to set the acceptance target (task success or preference threshold).",
    "factor_not_measured": "Produce requirements for a second sales market so market demand can be derived.",
}


def research_brief(command: ScopeTask, actor: str | None = None) -> dict:
    actor = actor or command.actor
    with record_run(None, "agents.research_brief", actor, BRIEF_METHOD, command.model_dump(),
                    vehicle=command.vehicle, market=command.market) as run:
        with closing(connect()) as connection:
            rows = connection.execute(
                "SELECT a.requirement_id, a.version_id, a.content FROM agent_artifacts a JOIN requirements r "
                "ON r.id=a.requirement_id AND r.current_version_id=a.version_id WHERE a.kind='challenge' AND "
                "a.vehicle=? AND a.market=? ORDER BY a.created_at", (command.vehicle, command.market)).fetchall()
            coverage = connection.execute("SELECT warnings FROM coverage_reports WHERE vehicle=? AND market=? AND "
                                          "status='current' ORDER BY rowid DESC LIMIT 1",
                                          (command.vehicle, command.market)).fetchone()
        latest = {row["requirement_id"]: json.loads(row["content"]) for row in rows}
        gaps = {}
        for requirement_id, challenge in latest.items():
            for objection in challenge["objections"]:
                if objection["code"] in METHODS:
                    gap = gaps.setdefault(objection["code"], {"code": objection["code"], "method": METHODS[objection["code"]],
                                                              "requirements": []})
                    gap["requirements"].append({"requirement_id": requirement_id, "key": challenge["requirement_key"],
                                                "severity": objection["severity"]})
        items = sorted(gaps.values(), key=lambda gap: (-sum(r["severity"] == "high" for r in gap["requirements"]),
                                                       -len(gap["requirements"])))
        content = {"challenged_requirements": len(latest), "items": items,
                   "coverage_warnings": json.loads(coverage[0]) if coverage else [],
                   "note": "Proposed studies only; a PM and the research owner decide what to commission."}
        artifact = store_artifact(vehicle=command.vehicle, market=command.market, kind="research_brief", content=content,
                                  created_by=actor, provider="deterministic", method_version=BRIEF_METHOD,
                                  run_id=run.id, session_id=command.session_id)
        run.outputs.update(artifact_id=artifact["id"], gaps=len(items), challenged_requirements=len(latest))
    return {**run.outputs, "run_id": run.id, "awaiting_human": bool(items)}


# Comms drafter --------------------------------------------------------------------------------------

class _Draft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    audience: Literal["engineering", "market", "board", "sales"]
    subject: str
    body: str


class _Drafts(BaseModel):
    model_config = ConfigDict(extra="forbid")
    drafts: list[_Draft]


DRAFT_INSTRUCTIONS = (
    "You draft internal BMW product-management communications from one recorded requirement decision state. Write "
    "four short drafts: engineering (handoff: need, acceptance test, open assumptions; no component specifications), "
    "market (response to the national sales company: what was decided for their market and why), board (gate-pack "
    "paragraph: priority, evidence strength, risks) and sales (customer-facing 'why it matters', no promises or "
    "dates). Use only the facts given, keep each under 120 words, state the decision status exactly as given, and "
    "never invent numbers, prices or launch dates.")


def _template(audience: str, facts: dict) -> dict:
    status, title, key = facts["decision_status"], facts["title"], facts["key"]
    target = "; ".join(f"{c['metric']}: {c['target']} ({c['basis']})" for c in facts["acceptance_criteria"])
    bodies = {
        "engineering": f"{key} ({status}). Customer need: {facts['customer_need']} Acceptance test: {target}. "
                       f"Open assumptions: {' '.join(facts['assumptions'][:2])}",
        "market": f"For {facts['vehicle']} / {facts['market']}: {title} is {status} with priority "
                  f"{facts['priority']:.1f} and evidence grade {facts['evidence_grade']}. Evidence: "
                  f"{facts['evidence_summary']}.",
        "board": f"{key} · priority {facts['priority']:.1f}, evidence grade {facts['evidence_grade']}, {status}. "
                 f"Basis: {facts['evidence_summary']}. Risks: {facts['risks']}.",
        "sales": f"What customers told us: {facts['customer_need']} The successor plan addresses this; details follow "
                 "once validated.",
    }
    return {"audience": audience, "subject": f"{key}: {title} ({status})", "body": bodies[audience]}


def draft_communications(command: RequirementTask, actor: str | None = None) -> dict:
    actor = actor or command.actor
    try:
        client, method = resolve_provider(command.provider, prompt_version=DRAFT_PROMPT, deterministic_method=DRAFT_METHOD)
    except ProviderUnavailable as exc:
        raise HTTPException(503, str(exc)) from None
    with record_run(None, "agents.draft_communications", actor, method, command.model_dump(),
                    vehicle=command.vehicle, market=command.market) as run:
        detail = _requirement(command.requirement_id, command.vehicle, command.market)
        approved = detail["approved_version"]
        version = approved or detail["current_version"]
        score = version["score"]
        with closing(connect()) as connection:
            decision = connection.execute("SELECT id, action, actor, created_at FROM decisions WHERE version_id=? "
                                          "ORDER BY created_at DESC LIMIT 1", (version["id"],)).fetchone()
        status = (f"{decision['action']}d by {decision['actor']}" if decision and decision["action"] != "challenge"
                  else "a proposal awaiting a PM decision")
        mix = requirement_mix(detail["id"], version["id"])
        facts = {"key": detail["key"], "vehicle": detail["vehicle"], "market": detail["market"], "title": version["title"],
                 "customer_need": version["customer_need"], "statement": version["statement"],
                 "acceptance_criteria": version["acceptance_criteria"], "assumptions": version["assumptions"],
                 "priority": score["total"], "evidence_grade": score["evidence_grade"], "decision_status": status,
                 "evidence_summary": ", ".join(f"{s['supporting']} records from {s['title']}" for s in mix["sources"][:4]),
                 "risks": "; ".join(score["explanation"].get("limitations", [])[:3])}
        if client is None:
            drafts = [_template(audience, facts) for audience in AUDIENCES]
        else:
            answer = client.structured(task="draft_communications", prompt_version=DRAFT_PROMPT,
                                       instructions=DRAFT_INSTRUCTIONS, input=facts, schema=_Drafts, run=run)
            drafts = {draft.audience: draft.model_dump() for draft in answer.drafts}
            if set(drafts) != set(AUDIENCES):
                raise LLMOutputInvalid("The drafter must return exactly one draft per audience")
            drafts = [drafts[audience] for audience in AUDIENCES]
        content = {"requirement_key": detail["key"], "title": version["title"], "version": version["version"],
                   "decision_status": status, "decision_id": decision["id"] if decision else None,
                   "drafts": [{**draft, "sent": False} for draft in drafts],
                   "note": "Internal drafts citing this exact version and score. Nothing is sent."}
        artifact = store_artifact(vehicle=command.vehicle, market=command.market, kind="audience_drafts",
                                  content=content, created_by=actor, provider=command.provider, method_version=method,
                                  run_id=run.id, requirement_id=detail["id"], version_id=version["id"],
                                  score_id=score["id"], session_id=command.session_id)
        run.outputs.update(artifact_id=artifact["id"], requirement_key=detail["key"], drafts=len(drafts),
                           decision_status=status)
    return {**run.outputs, "run_id": run.id, "awaiting_human": False}


# Morning brief --------------------------------------------------------------------------------------

def morning_brief(command: ScopeTask, actor: str | None = None) -> dict:
    actor = actor or command.actor
    scope = (command.vehicle, command.market)
    with record_run(None, "agents.morning_brief", actor, MORNING_METHOD, command.model_dump(),
                    vehicle=command.vehicle, market=command.market) as run:
        since = datetime.fromisoformat(now().replace("Z", "+00:00")) - timedelta(hours=command.since_hours)
        since_iso = since.isoformat().replace("+00:00", "Z")
        mix = source_mix(*scope)
        with closing(connect()) as connection:
            new_sources = [dict(row) for row in connection.execute(
                "SELECT s.id, s.title, s.kind, json_extract(s.metadata,'$.connector') AS connector, count(e.id) AS records "
                "FROM sources s LEFT JOIN evidence e ON e.source_id=s.id WHERE s.vehicle=? AND s.market=? AND "
                "s.created_at>=? GROUP BY s.id ORDER BY s.created_at", (*scope, since_iso))]
            requirements = [dict(row) for row in connection.execute(
                "SELECT requirement_id AS id, key, title, score_total AS priority, evidence_grade, "
                "approved_version_id IS NOT NULL AS approved FROM v_requirement_list WHERE vehicle=? AND market=? "
                "ORDER BY score_total DESC", scope)]
            reviews = connection.execute("SELECT count(*) FROM review_items q JOIN requirements r ON r.id=q.requirement_id "
                                         "WHERE q.status='open' AND r.vehicle=? AND r.market=?", scope).fetchone()[0]
            challenges = {row["requirement_id"]: json.loads(row["content"])["verdict"] for row in connection.execute(
                "SELECT a.requirement_id, a.content FROM agent_artifacts a JOIN requirements r ON r.id=a.requirement_id "
                "AND r.current_version_id=a.version_id WHERE a.kind='challenge' AND a.vehicle=? AND a.market=? "
                "ORDER BY a.created_at", scope)}
            failed = connection.execute("SELECT count(*) FROM tasks WHERE vehicle=? AND market=? AND status='failed' "
                                        "AND updated_at>=?", (*scope, since_iso)).fetchone()[0]
            brief = connection.execute("SELECT content FROM agent_artifacts WHERE kind='research_brief' AND vehicle=? "
                                       "AND market=? ORDER BY created_at DESC LIMIT 1", scope).fetchone()
        base = f"/{command.vehicle.lower()}/{command.market.lower()}"
        awaiting = [r for r in requirements if not r["approved"]]
        lines = []
        if new_sources:
            lines.append({"kind": "evidence", "text": f"{sum(s['records'] for s in new_sources)} new records from "
                          f"{len(new_sources)} sources in the last {command.since_hours} h: "
                          + ", ".join(f"{s['title']} ({s['records']})" for s in new_sources[:4]) + ".",
                          "href": f"{base}/sources"})
        if reviews:
            lines.append({"kind": "review", "text": f"{reviews} approved decision(s) touched by new evidence need review.",
                          "href": f"{base}/reviews"})
        held = [r for r in requirements if challenges.get(r["id"]) == "hold_for_evidence"]
        for requirement in requirements[:3]:
            verdict = challenges.get(requirement["id"])
            lines.append({"kind": "decision", "requirement_id": requirement["id"],
                          "text": f"{requirement['key']} {requirement['title']}: priority {requirement['priority']:.1f}, "
                                  f"grade {requirement['evidence_grade']}, "
                                  f"{'approved' if requirement['approved'] else 'awaiting your decision'}"
                                  + (f"; challenger: {verdict.replace('_', ' ')}" if verdict else "") + ".",
                          "href": f"{base}/requirements?requirement={requirement['id']}"})
        if held:
            lines.append({"kind": "challenge", "text": f"Challenger asks to hold {len(held)} proposal(s) for more evidence: "
                          + ", ".join(r["key"] for r in held[:5]) + ".", "href": f"{base}/requirements"})
        if brief:
            items = json.loads(brief[0])["items"]
            if items:
                lines.append({"kind": "research", "text": f"Research planner proposes {len(items)} studies; first: "
                              f"{items[0]['method']}", "href": f"{base}/agents"})
        if failed:
            lines.append({"kind": "error", "text": f"{failed} agent task(s) failed in the window; see the task board.",
                          "href": f"{base}/agents"})
        content = {"as_of": now(), "window_hours": command.since_hours, "headline":
                   f"{len(awaiting)} of {len(requirements)} requirements await a decision; {reviews} review(s) open; "
                   f"{mix['totals']['sources']} sources ({mix['totals']['records']} records), "
                   f"{mix['totals']['requirements_with_public_evidence']} requirements corroborated by public data.",
                   "lines": lines, "counts": {"requirements": len(requirements), "awaiting_decision": len(awaiting),
                                              "open_reviews": reviews, "new_sources": len(new_sources),
                                              "challenged": len(challenges), "held": len(held), "failed_tasks": failed},
                   "source_totals": mix["totals"], "by_origin": mix["by_origin"],
                   "note": "Counts and links come from recorded data; nothing is decided or sent."}
        artifact = store_artifact(vehicle=command.vehicle, market=command.market, kind="morning_brief", content=content,
                                  created_by=actor, provider="deterministic", method_version=MORNING_METHOD,
                                  run_id=run.id, session_id=command.session_id)
        run.outputs.update(artifact_id=artifact["id"], lines=len(lines), **content["counts"])
    return {**run.outputs, "run_id": run.id, "awaiting_human": False}


# Read API -------------------------------------------------------------------------------------------

@router.get("")
def list_artifacts(vehicle: str | None = None, market: str | None = None,
                   kind: Literal["challenge", "research_brief", "audience_drafts", "morning_brief"] | None = None,
                   requirement_id: str | None = None, session_id: str | None = None,
                   limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)):
    vehicle, market = scope_filters(vehicle, market)
    clauses, params = [], []
    for name, value in (("vehicle", vehicle), ("market", market), ("kind", kind), ("requirement_id", requirement_id),
                        ("session_id", session_id)):
        if value is not None:
            clauses.append(f"{name}=?")
            params.append(value)
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    with closing(connect()) as connection:
        total = connection.execute("SELECT count(*) FROM agent_artifacts" + where, params).fetchone()[0]
        rows = connection.execute("SELECT * FROM agent_artifacts" + where + " ORDER BY created_at DESC, rowid DESC "
                                  "LIMIT ? OFFSET ?", [*params, limit, offset]).fetchall()
    return {"items": [decode(row, ("content",)) for row in rows], "total": total, "limit": limit, "offset": offset}


@router.get("/{artifact_id}")
def get_artifact(artifact_id: str):
    with closing(connect()) as connection:
        row = connection.execute("SELECT * FROM agent_artifacts WHERE id=?", (artifact_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Artifact not found")
    return decode(row, ("content",))


for _capability in (
    Capability("agents.challenge_requirement", "Argue against the current version of one requirement: source "
               "concentration, conflicts, undated evidence, assumed targets, unmeasured factors and scope drift, plus "
               "(OpenAI) counterarguments with grounded quotes. Records a challenge; a PM resolves it.",
               RequirementTask, challenge_requirement, "A2", ("agent_artifacts",)),
    Capability("agents.research_brief", "Turn the latest challenges and coverage warnings in a scope into proposed "
               "studies (method, affected requirements). Proposals only.", ScopeTask, research_brief, "A1",
               ("agent_artifacts",)),
    Capability("agents.draft_communications", "Draft engineering, market, board and sales messages from one "
               "requirement's recorded decision state, citing its exact version and score. Never sent.",
               RequirementTask, draft_communications, "A3", ("agent_artifacts",)),
    Capability("agents.morning_brief", "Compile the PM's morning brief for a scope from recorded counts: new "
               "sources, open reviews, decisions awaiting, challenges and research gaps, each with a link.",
               ScopeTask, morning_brief, "A0", ("agent_artifacts",)),
):
    register_capability(_capability)
