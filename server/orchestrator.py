"""Orchestrator sessions (MULTI_AGENT_PLAN.md step 2): the PM's chief-of-staff agent plans the work for one
vehicle and market and delegates each step to a roster agent through the task runtime.

- A human starts a session with a goal; the orchestrator (`ai:agent:orchestrator`) then acts. Every delegation
  is a real task assigned to the named agent and executed by server.agent_runtime, so agent permissions, pauses
  and the parent-agent hierarchy apply exactly as for any other task, and every run is recorded and audited.
- Planner: `openai` plans each next step with strict Structured Outputs from recorded scope context;
  `reference` is a labelled deterministic plan for offline use. Code validates every proposed step (agent
  exists and is active, capability granted, input is an object without actor or another scope) and enforces the
  step and model-call budgets. Rejected proposals are recorded and fed back to the planner.
- Decisions are not capabilities: no agent can approve, reject, switch a rubric or send anything. The session
  ends with a morning brief; proposals wait for the PM.
- Steps are append-only. A human can stop a running session; it stops before its next step.
"""

import json
import threading
import traceback
from contextlib import closing
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from database.store import audit, connect, decode, encode, new_id, now, transaction
from server.agent_runtime import TaskCreate, create_task, execute
from server.analysis_engine import ProviderUnavailable
from server.evidence import scope_filters
from server.llm import llm_client
from server.models import Scope, Text
from server.platform import CAPABILITIES, record_run, require_human
from server.public_sources import catalog, source_mix

router = APIRouter(prefix="/sessions", tags=["agents"])

ORCHESTRATOR = "ai:agent:orchestrator"
PLANNER_PROMPT = "orchestrator-plan-v1"
REFERENCE_METHOD = "reference-plan-v1"
MAX_RESULT_CHARS = 1500
# Specialists whose provider follows the session setting, whatever the planner proposes.
SESSION_PROVIDER_CAPABILITIES = ("agents.challenge_requirement", "agents.draft_communications")
DEFAULT_GOAL = "Prepare today's planning review: refresh evidence, update the proposals, challenge the top ones and brief me."


class SessionStart(Scope):
    goal: Text = Field(default=DEFAULT_GOAL, max_length=2000)
    provider: Literal["openai", "reference"] = "reference"
    started_by: Text = Field(max_length=200)
    max_steps: int = Field(default=12, ge=1, le=25)
    challenge_top: int = Field(default=3, ge=0, le=8)
    agent_provider: Literal["openai", "deterministic"] | None = Field(
        default=None, description="Provider for the challenger and drafter; defaults to the planner's")


class SessionStop(BaseModel):
    model_config = ConfigDict(extra="forbid")
    actor: Text = Field(max_length=200)


class _Step(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reasoning: str
    action: Literal["delegate", "finish"]
    agent: str | None
    capability: str | None
    input_json: str | None
    summary: str | None


PLANNER_INSTRUCTIONS = (
    "You are the orchestrator of a BMW product-management agent team, the PM's chief of staff. Plan the next single "
    "step toward the PM's goal for this vehicle and market, using only the roster below: delegate one granted "
    "capability to one agent with a JSON object input (never include actor, vehicle or market; the session scope is "
    "applied). Read the history and results before choosing; do not repeat a step that already succeeded unless new "
    "evidence requires it. Agents prepare and propose; only the PM decides, so never try to approve, reject or send "
    "anything. A good session refreshes evidence where useful, updates proposals (pipeline.assess_updates when "
    "requirements exist, otherwise pipeline.analyze then pipeline.generate_requirements with the analysis_id it "
    "returned) with provider 'deterministic' for pipeline steps unless the goal asks for AI analysis (whole-scope AI reanalysis is "
    "slow and costly), derives priority inputs once, challenges the top proposals by requirement_id, plans research "
    "for the gaps, drafts communications for the top requirement, and ends with agents.morning_brief. Finish when the brief "
    "is done or the budget is nearly used. Keep reasoning to one or two sentences the PM can read.")


# Records --------------------------------------------------------------------------------------------

def _session(connection, session_id: str) -> dict:
    row = connection.execute("SELECT * FROM agent_sessions WHERE id=?", (session_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Session not found")
    return decode(row, ("budgets", "usage"))


def _steps(connection, session_id: str) -> list[dict]:
    return [decode(row, ("detail", "run_ids")) for row in connection.execute(
        "SELECT * FROM session_steps WHERE session_id=? ORDER BY seq", (session_id,))]


def _add_step(session_id: str, agent_id: str, kind: str, title: str, status: str, detail: dict | None = None,
              task_id: str | None = None, run_ids: list[str] | None = None) -> dict:
    with transaction() as connection:
        seq = connection.execute("SELECT coalesce(max(seq), 0) + 1 FROM session_steps WHERE session_id=?",
                                 (session_id,)).fetchone()[0]
        row = {"id": new_id(), "session_id": session_id, "seq": seq, "agent_id": agent_id, "kind": kind,
               "title": title[:300], "detail": encode(detail or {}), "task_id": task_id,
               "run_ids": encode(run_ids or []), "status": status, "created_at": now()}
        connection.execute(f"INSERT INTO session_steps ({','.join(row)}) VALUES ({','.join('?' for _ in row)})",
                           list(row.values()))
        connection.execute("UPDATE agent_sessions SET updated_at=? WHERE id=?", (row["created_at"], session_id))
    return row


def _finish(session_id: str, status: str, summary: str | None = None, error: str | None = None,
            usage: dict | None = None) -> None:
    with transaction() as connection:
        session = _session(connection, session_id)
        if session["status"] != "running":
            return
        timestamp = now()
        connection.execute("UPDATE agent_sessions SET status=?, summary=?, error=?, usage=?, updated_at=?, finished_at=? "
                           "WHERE id=?", (status, summary, error, encode(usage or session["usage"]), timestamp,
                                         timestamp, session_id))
        audit(connection, "agent_session", session_id, f"session.{status}", ORCHESTRATOR,
              summary or error or f"Session {status}", metadata={"usage": usage})


def _compact(value, depth=0):
    """Small, readable view of capability outputs for the step log and the planner."""
    if isinstance(value, dict):
        return {k: _compact(v, depth + 1) for k, v in list(value.items())[:20]
                if k not in ("items", "requirements", "findings", "audit_event_id") or depth > 1} | (
            {f"{k}_count": len(v) for k, v in value.items() if k in ("items", "requirements", "findings")
             and isinstance(v, list) and depth <= 1})
    if isinstance(value, list):
        return [_compact(v, depth + 1) for v in value[:5]] + ([f"… {len(value) - 5} more"] if len(value) > 5 else [])
    if isinstance(value, str) and len(value) > 200:
        return value[:200] + "…"
    return value


def _result_text(outputs: dict | None) -> str:
    text = json.dumps(_compact(outputs or {}), ensure_ascii=False, default=str)
    return text if len(text) <= MAX_RESULT_CHARS else text[:MAX_RESULT_CHARS] + "…"


# Context --------------------------------------------------------------------------------------------

def roster() -> list[dict]:
    with closing(connect()) as connection:
        agents = [decode(row, ("capabilities",)) for row in connection.execute(
            "SELECT id, slug, display_name, autonomy_level, status, capabilities FROM agents "
            "WHERE status <> 'retired' ORDER BY rowid")]
    result = []
    for agent in agents:
        tools = []
        for name in agent["capabilities"]:
            capability = CAPABILITIES.get(name)
            if capability is None:
                continue
            fields = {key: str(field.annotation).replace("typing.", "") for key, field in
                      capability.input_model.model_fields.items() if key not in ("actor", "vehicle", "market", "session_id")}
            tools.append({"capability": name, "inputs": fields, "description": capability.description[:240]})
        result.append({"agent": agent["slug"], "name": agent["display_name"], "status": agent["status"],
                       "autonomy": agent["autonomy_level"], "capabilities": tools})
    return result


def scope_context(vehicle: str, market: str) -> dict:
    mix = source_mix(vehicle, market)
    with closing(connect()) as connection:
        requirements = [dict(row) for row in connection.execute(
            "SELECT requirement_id, key, title, topic, score_total, evidence_grade, approved_version_id IS NOT NULL AS approved, "
            "open_review_count FROM v_requirement_list WHERE vehicle=? AND market=? ORDER BY score_total DESC LIMIT 12",
            (vehicle, market))]
        reviews = connection.execute("SELECT count(*) FROM review_items q JOIN requirements r ON r.id=q.requirement_id "
                                     "WHERE q.status='open' AND r.vehicle=? AND r.market=?", (vehicle, market)).fetchone()[0]
    connectors = {c["key"]: c["available"] for c in catalog(vehicle, market)["connectors"]}
    return {"vehicle": vehicle, "market": market, "sources": mix["totals"], "by_origin": mix["by_origin"],
            "connectors_available": connectors, "open_reviews": reviews, "top_requirements": requirements}


# Planners -------------------------------------------------------------------------------------------

def reference_plan(session: dict, history: list[dict], context: dict) -> dict:
    """Deterministic plan: the next step not yet done in a fixed, state-aware sequence."""
    done = {(s["detail"].get("capability"), s["detail"].get("input", {}).get("requirement_id"))
            for s in history if s["kind"] in ("delegate", "rejected")}
    capabilities = [s["detail"].get("capability") for s in history if s["kind"] == "delegate" and s["status"] != "failed"]
    agent_provider = session["budgets"]["agent_provider"]
    plan = []
    if context["connectors_available"].get("nhtsa"):
        plan.append(("feedback-analyst", "public_sources.import_nhtsa", {},
                     "Refresh official public complaints and recalls before updating proposals."))
    if context["connectors_available"].get("web_research") and agent_provider == "openai":
        plan.append(("trend-scout", "public_sources.web_research", {"max_per_topic": 4},
                     "Look for new owner and press opinions on the public web."))
    if context["top_requirements"]:
        plan.append(("change-watcher", "pipeline.assess_updates", {"provider": "deterministic"},
                     "Reassess all evidence against current proposals and approved baselines."))
    else:
        plan.append(("feedback-analyst", "pipeline.analyze", {"provider": "deterministic"},
                     "No requirements yet: analyse the evidence into findings."))
        analysis = next((s["detail"].get("outputs", {}).get("analysis_id") for s in reversed(history)
                         if s["detail"].get("capability") == "pipeline.analyze" and s["status"] == "succeeded"), None)
        if analysis or "pipeline.analyze" not in capabilities:
            plan.append(("requirement-writer", "pipeline.generate_requirements", {"analysis_id": analysis},
                         "Draft SMART requirement proposals from the findings."))
    plan.append(("scorer", "priorities.derive_inputs", {}, "Derive data-based priority inputs for the current versions."))
    for requirement in context["top_requirements"][:session["budgets"]["challenge_top"]]:
        plan.append(("challenger", "agents.challenge_requirement",
                     {"requirement_id": requirement["requirement_id"], "provider": agent_provider},
                     f"Challenge {requirement['key']} before the PM decides."))
    plan.append(("research-planner", "agents.research_brief", {}, "Turn the challenges into proposed studies."))
    if context["top_requirements"]:
        top = next((r for r in context["top_requirements"] if r["approved"]), context["top_requirements"][0])
        plan.append(("comms-drafter", "agents.draft_communications",
                     {"requirement_id": top["requirement_id"], "provider": agent_provider},
                     f"Draft the four audience messages for {top['key']}; nothing is sent."))
    for agent, capability, payload, reason in plan:
        if (capability, payload.get("requirement_id")) not in done:
            if capability == "pipeline.generate_requirements" and not payload["analysis_id"]:
                return {"action": "finish", "reasoning": "Analysis produced no analysis id; stopping before drafting.",
                        "summary": "Stopped: no analysis to draft from."}
            return {"action": "delegate", "agent": agent, "capability": capability, "input": payload, "reasoning": reason}
    return {"action": "finish", "reasoning": "All planned steps are done.", "summary": "Evidence refreshed, proposals "
            "updated, top proposals challenged, research planned and messages drafted."}


def openai_plan(client, run, session: dict, history: list[dict], context: dict, team: list[dict]) -> dict:
    steps_left = session["budgets"]["max_steps"] - sum(s["kind"] in ("delegate", "rejected") for s in history)
    answer = client.structured(task="orchestrator_plan", prompt_version=PLANNER_PROMPT, instructions=PLANNER_INSTRUCTIONS,
                               schema=_Step, run=run, max_output_tokens=4000, input={
                                   "goal": session["goal"], "scope": context, "roster": team,
                                   "agent_provider": session["budgets"]["agent_provider"], "steps_left": steps_left,
                                   "history": [{"seq": s["seq"], "kind": s["kind"], "agent": s["agent_id"],
                                                "title": s["title"], "status": s["status"],
                                                "capability": s["detail"].get("capability"),
                                                "input": s["detail"].get("input"),
                                                "result": s["detail"].get("result") or s["detail"].get("error")}
                                               for s in history if s["kind"] != "plan"]})
    plan = answer.model_dump()
    if plan["action"] == "delegate":
        try:
            plan["input"] = json.loads(plan["input_json"] or "{}")
        except json.JSONDecodeError:
            plan["input"] = None
    return plan


def validate(plan: dict, team: list[dict]) -> str | None:
    agents = {a["agent"]: a for a in team}
    # Planners name agents by slug; accept the registered id form too.
    plan["agent"] = (plan.get("agent") or "").removeprefix("ai:agent:").removeprefix("system:agent:")
    agent = agents.get(plan["agent"])
    if agent is None:
        return f"Unknown agent {plan.get('agent')!r}"
    if agent["status"] != "active":
        return f"Agent {agent['agent']} is {agent['status']}; a human must resume it"
    if plan.get("capability") not in {tool["capability"] for tool in agent["capabilities"]}:
        return f"Agent {agent['agent']} is not granted {plan.get('capability')!r}"
    if not isinstance(plan.get("input"), dict):
        return "Input must be a JSON object"
    if {"actor", "vehicle", "market", "session_id"} & set(plan["input"]):
        return "Input must not name an actor, vehicle, market or session; the session scope applies"
    return None


# Loop -----------------------------------------------------------------------------------------------

def _delegate(session: dict, plan: dict) -> dict:
    agent_id = next(a["id"] for a in _agent_ids() if a["slug"] == plan["agent"])
    payload = dict(plan["input"])
    capability = CAPABILITIES[plan["capability"]]
    if "session_id" in capability.input_model.model_fields:
        payload["session_id"] = session["id"]
    if plan["capability"] in SESSION_PROVIDER_CAPABILITIES:
        payload["provider"] = session["budgets"]["agent_provider"]  # the PM chose the specialists' provider
    task = create_task(TaskCreate(vehicle=session["vehicle"], market=session["market"], capability=plan["capability"],
                                  title=f"{plan['reasoning'][:200]}", input=payload, requested_by=ORCHESTRATOR,
                                  assigned_agent_id=agent_id))
    result = execute(task["id"], ORCHESTRATOR)
    return {"task": task, "result": result}


def _agent_ids() -> list[dict]:
    with closing(connect()) as connection:
        return [dict(row) for row in connection.execute("SELECT id, slug FROM agents")]


def run_session(session_id: str) -> None:
    try:
        _loop(session_id)
    except Exception as exc:  # the session records every failure
        _add_step(session_id, ORCHESTRATOR, "error", "Session failed", "failed",
                  {"error": f"{type(exc).__name__}: {exc}"[:2000], "trace": traceback.format_exc()[-1500:]})
        _finish(session_id, "failed", error=f"{type(exc).__name__}: {exc}"[:2000])


def _loop(session_id: str) -> None:
    with closing(connect()) as connection:
        session = _session(connection, session_id)
    budgets = session["budgets"]
    client = llm_client() if session["provider"] == "openai" else None
    usage = {"steps": 0, "rejected": 0, "planner_calls": 0, "total_tokens": 0}
    brief_done = False
    with record_run(None, "orchestrator.session", ORCHESTRATOR, session["method_version"],
                    {"session_id": session_id, "goal": session["goal"]}, session["vehicle"], session["market"]) as run:
        while True:
            with closing(connect()) as connection:
                current = _session(connection, session_id)
                history = _steps(connection, session_id)
            if current["stop_requested_by"]:
                _add_step(session_id, ORCHESTRATOR, "stopped", f"Stopped by {current['stop_requested_by']}", "info")
                run.outputs.update(usage=usage)
                _finish(session_id, "stopped", summary="Stopped by a human before the next step.", usage=usage)
                return
            if usage["steps"] + usage["rejected"] >= budgets["max_steps"]:
                break
            context = scope_context(session["vehicle"], session["market"])
            team = roster()
            if client is None:
                plan = reference_plan(session, history, context)
            else:
                plan = openai_plan(client, run, session, history, context, team)
                usage["planner_calls"] += 1
                usage["total_tokens"] = run.metrics.get("llm", {}).get("total_tokens", 0)
            if plan["action"] == "finish":
                _add_step(session_id, ORCHESTRATOR, "plan", plan.get("reasoning") or "Finishing", "info",
                          {"reasoning": plan.get("reasoning")})
                break
            problem = validate(plan, team)
            if problem:
                usage["rejected"] += 1
                _add_step(session_id, ORCHESTRATOR, "rejected", f"Rejected: {plan.get('agent')} · {plan.get('capability')}",
                          "rejected", {"reasoning": plan.get("reasoning"), "capability": plan.get("capability"),
                                       "input": plan.get("input"), "error": problem})
                continue
            usage["steps"] += 1
            try:
                outcome = _delegate(session, plan)
            except HTTPException as exc:
                _add_step(session_id, f"ai:agent:{plan['agent']}", "delegate", f"{plan['capability']} refused", "failed",
                          {"reasoning": plan["reasoning"], "capability": plan["capability"], "input": plan["input"],
                           "error": str(exc.detail)[:1000]})
                continue
            result, task = outcome["result"], outcome["task"]
            status = {"succeeded": "succeeded", "awaiting_human": "awaiting_human"}.get(result["status"], "failed")
            brief_done |= plan["capability"] == "agents.morning_brief" and status == "succeeded"
            _add_step(session_id, result.get("assigned_agent_id") or f"ai:agent:{plan['agent']}", "delegate",
                      plan["reasoning"], status,
                      {"reasoning": plan["reasoning"], "capability": plan["capability"], "input": plan["input"],
                       "result": _result_text(result.get("outputs")) if status != "failed" else None,
                       "outputs": _compact(result.get("outputs") or {}), "error": result.get("error")},
                      task_id=task["id"], run_ids=result.get("run_ids"))
        if not brief_done:
            usage["steps"] += 1
            outcome = _delegate(session, {"agent": "orchestrator", "capability": "agents.morning_brief", "input": {},
                                          "reasoning": "Compile the morning brief for the PM."})
            result = outcome["result"]
            _add_step(session_id, ORCHESTRATOR, "delegate", "Compile the morning brief for the PM.",
                      "succeeded" if result["status"] == "succeeded" else "failed",
                      {"capability": "agents.morning_brief", "input": {}, "result": _result_text(result.get("outputs")),
                       "outputs": _compact(result.get("outputs") or {}), "error": result.get("error")},
                      task_id=outcome["task"]["id"], run_ids=result.get("run_ids"))
        with closing(connect()) as connection:
            brief = connection.execute("SELECT content FROM agent_artifacts WHERE session_id=? AND kind='morning_brief' "
                                       "ORDER BY created_at DESC LIMIT 1", (session_id,)).fetchone()
        summary = json.loads(brief[0])["headline"] if brief else "Session finished without a brief."
        _add_step(session_id, ORCHESTRATOR, "finish", "Handed over to the PM", "info", {"summary": summary})
        usage["total_tokens"] = run.metrics.get("llm", {}).get("total_tokens", 0)
        run.outputs.update(usage=usage, summary=summary)
    _finish(session_id, "succeeded", summary=summary, usage=usage)


def recover_interrupted_sessions() -> list[str]:
    """Sessions run in this process's threads; any still 'running' at startup were interrupted by a restart."""
    with closing(connect()) as connection:
        ids = [row[0] for row in connection.execute("SELECT id FROM agent_sessions WHERE status='running'")]
    for session_id in ids:
        _add_step(session_id, ORCHESTRATOR, "error", "Interrupted by an API restart", "failed",
                  {"error": "The API restarted while this session ran; completed steps and artifacts are kept."})
        _finish(session_id, "failed", error="Interrupted by an API restart")
    return ids


# API ------------------------------------------------------------------------------------------------

def start_session(command: SessionStart, background: bool = True) -> dict:
    require_human(command.started_by)
    agent_provider = command.agent_provider or ("openai" if command.provider == "openai" else "deterministic")
    model, method = None, REFERENCE_METHOD
    if command.provider == "openai" or agent_provider == "openai":
        try:
            client = llm_client()
        except ProviderUnavailable as exc:
            raise HTTPException(503, str(exc)) from None
        if command.provider == "openai":
            model, method = client.model, client.method_version(PLANNER_PROMPT)
    with closing(connect()) as connection:
        orchestrator = connection.execute("SELECT status FROM agents WHERE id=?", (ORCHESTRATOR,)).fetchone()
        running = connection.execute("SELECT id FROM agent_sessions WHERE vehicle=? AND market=? AND status='running'",
                                     (command.vehicle, command.market)).fetchone()
    if orchestrator is None or orchestrator[0] != "active":
        raise HTTPException(409, "The orchestrator agent is paused or missing; a human must resume it")
    if running:
        raise HTTPException(409, f"Session {running[0]} is still running for this scope")
    timestamp = now()
    session = {"id": new_id(), "vehicle": command.vehicle, "market": command.market, "goal": command.goal,
               "provider": command.provider, "model": model, "method_version": method, "status": "running",
               "started_by": command.started_by,
               "budgets": encode({"max_steps": command.max_steps, "challenge_top": command.challenge_top,
                                  "agent_provider": agent_provider}),
               "created_at": timestamp, "updated_at": timestamp}
    with transaction() as connection:
        connection.execute(f"INSERT INTO agent_sessions ({','.join(session)}) VALUES ({','.join('?' for _ in session)})",
                           list(session.values()))
        audit(connection, "agent_session", session["id"], "session.started", command.started_by, command.goal,
              after={**session, "budgets": json.loads(session["budgets"])})
    _add_step(session["id"], ORCHESTRATOR, "plan", f"Goal from {command.started_by}: {command.goal}", "info",
              {"planner": command.provider, "model": model, "agent_provider": agent_provider,
               "max_steps": command.max_steps})
    if background:
        threading.Thread(target=run_session, args=(session["id"],), daemon=True, name=f"session-{session['id'][:8]}").start()
    else:
        run_session(session["id"])
    return get_session(session["id"])


@router.post("", status_code=201)
def post_session(command: SessionStart):
    return start_session(command)


@router.get("")
def list_sessions(vehicle: str | None = None, market: str | None = None, limit: int = Query(20, ge=1, le=200)):
    vehicle, market = scope_filters(vehicle, market)
    clauses, params = [], []
    for name, value in (("vehicle", vehicle), ("market", market)):
        if value is not None:
            clauses.append(f"{name}=?")
            params.append(value)
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    with closing(connect()) as connection:
        rows = connection.execute("SELECT * FROM agent_sessions" + where + " ORDER BY created_at DESC LIMIT ?",
                                  [*params, limit]).fetchall()
        items = []
        for row in rows:
            item = decode(row, ("budgets", "usage"))
            item["step_count"] = connection.execute("SELECT count(*) FROM session_steps WHERE session_id=?",
                                                    (item["id"],)).fetchone()[0]
            items.append(item)
    return {"items": items}


@router.get("/{session_id}")
def get_session(session_id: str):
    with closing(connect()) as connection:
        session = _session(connection, session_id)
        session["steps"] = _steps(connection, session_id)
        session["artifacts"] = [decode(row, ("content",)) for row in connection.execute(
            "SELECT * FROM agent_artifacts WHERE session_id=? ORDER BY created_at", (session_id,))]
    return session


@router.post("/{session_id}/stop")
def stop_session(session_id: str, command: SessionStop):
    require_human(command.actor)
    with transaction() as connection:
        session = _session(connection, session_id)
        if session["status"] != "running":
            raise HTTPException(409, f"Session is {session['status']}")
        connection.execute("UPDATE agent_sessions SET stop_requested_by=?, updated_at=? WHERE id=?",
                           (command.actor, now(), session_id))
        audit(connection, "agent_session", session_id, "session.stop_requested", command.actor,
              "Stop before the next step")
    return get_session(session_id)
