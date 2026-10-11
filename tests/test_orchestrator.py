"""Orchestrator sessions and specialist artifacts: delegation through the task runtime, policy checks, human gates."""

import json
import sqlite3

import pytest

from server import orchestrator, public_sources
from server.orchestrator import SessionStart, start_session

PM = "Dana Weber (PM)"
RECORDS = [
    ("Public charging is hard to find on road trips and the app shows broken chargers.", "Dislikes"),
    ("I love how quiet the cabin is on the highway.", "Likes"),
    ("The seat cushion is uncomfortable on long drives.", "Dislikes"),
    ("Charging at home is easy and reliable.", "Likes"),
]


@pytest.fixture
def scope(client, monkeypatch):
    monkeypatch.setattr(public_sources, "_get_json", lambda path, params, warnings=None: {"results": []})
    response = client.post("/imports/records", json={
        "vehicle": "G60", "market": "US", "title": "BMW feedback", "reference": "feedback.json", "kind": "feedback",
        "records": [{"content": text, "location": {"row": i}, "metadata": {"Feedback Type": kind}}
                    for i, (text, kind) in enumerate(RECORDS, 1)]})
    assert response.status_code == 201
    assert client.post("/pipeline/run", json={"vehicle": "G60", "market": "US", "provider": "deterministic"}).status_code == 201
    return client


def requirement_ids(client):
    return [r["id"] for r in client.get("/requirements?vehicle=G60&market=US").json()["items"]]


def test_reference_session_delegates_through_tasks_and_decides_nothing(scope, db):
    session = start_session(SessionStart(vehicle="G60", market="US", started_by=PM, challenge_top=2), background=False)
    assert session["status"] == "succeeded", session["error"]
    delegated = [s for s in session["steps"] if s["kind"] == "delegate"]
    capabilities = [s["detail"]["capability"] for s in delegated]
    assert capabilities[:3] == ["public_sources.import_nhtsa", "pipeline.assess_updates", "priorities.derive_inputs"]
    assert capabilities.count("agents.challenge_requirement") == 2
    assert capabilities[-1] == "agents.morning_brief"
    assert all(s["task_id"] and s["run_ids"] for s in delegated)
    assert {a["kind"] for a in session["artifacts"]} == {"challenge", "research_brief", "audience_drafts", "morning_brief"}

    tasks = scope.get("/tasks?vehicle=G60&market=US&limit=50").json()["items"]
    assert {t["requested_by"] for t in tasks} == {"ai:agent:orchestrator"}
    assert {t["assigned_agent_id"] for t in tasks} >= {"ai:agent:challenger", "ai:agent:comms-drafter",
                                                       "system:agent:scorer", "ai:agent:orchestrator"}
    with sqlite3.connect(db) as connection:
        assert connection.execute("SELECT count(*) FROM decisions").fetchone()[0] == 0
    drafts = next(a for a in session["artifacts"] if a["kind"] == "audience_drafts")["content"]
    assert [d["audience"] for d in drafts["drafts"]] == ["engineering", "market", "board", "sales"]
    assert not any(d["sent"] for d in drafts["drafts"]) and drafts["decision_status"].startswith("a proposal")
    brief = next(a for a in session["artifacts"] if a["kind"] == "morning_brief")["content"]
    assert brief["counts"]["awaiting_decision"] == len(requirement_ids(scope))
    assert any(line["href"].startswith("/g60/us/requirements?requirement=") for line in brief["lines"])
    listed = scope.get(f"/artifacts?vehicle=G60&market=US&session_id={session['id']}").json()
    assert listed["total"] == len(session["artifacts"])


def test_sessions_are_started_and_stopped_by_humans_only(scope, db, monkeypatch):
    for actor in ("ai:agent:orchestrator", "system:scheduler"):
        assert scope.post("/sessions", json={"started_by": actor}).status_code == 403
    monkeypatch.setattr(orchestrator.threading, "Thread", lambda **kwargs: type("T", (), {"start": lambda self: None})())
    session = scope.post("/sessions", json={"vehicle": "G60", "market": "US", "started_by": PM}).json()
    assert session["status"] == "running"
    assert scope.post("/sessions", json={"vehicle": "G60", "market": "US", "started_by": PM}).status_code == 409
    assert scope.post(f"/sessions/{session['id']}/stop", json={"actor": "ai:agent:orchestrator"}).status_code == 403
    assert scope.post(f"/sessions/{session['id']}/stop", json={"actor": PM}).status_code == 200
    orchestrator.run_session(session["id"])
    stopped = scope.get(f"/sessions/{session['id']}").json()
    assert stopped["status"] == "stopped" and stopped["steps"][-1]["kind"] == "stopped"
    assert not [s for s in stopped["steps"] if s["kind"] == "delegate"]
    with sqlite3.connect(db) as connection, pytest.raises(sqlite3.IntegrityError, match="human"):
        connection.execute("INSERT INTO agent_sessions (id, vehicle, market, goal, provider, method_version, started_by, "
                           "budgets, created_at, updated_at) VALUES ('x','G60','US','g','reference','m','ai:agent:x','{}','t','t')")
    with sqlite3.connect(db) as connection, pytest.raises(sqlite3.IntegrityError, match="append-only"):
        connection.execute("UPDATE session_steps SET title='edited'")


def plan(action="delegate", agent=None, capability=None, payload=None, reasoning="Next step."):
    return {"reasoning": reasoning, "action": action, "agent": agent, "capability": capability,
            "input_json": None if payload is None else json.dumps(payload), "summary": None}


def test_openai_planner_steps_are_validated_in_code(scope, fake_llm, db):
    target = requirement_ids(scope)[0]
    scope.post("/agents/ai:agent:research-planner/pause", json={"actor": PM, "rationale": "Hold research for now"})
    plans = iter([
        plan(agent="challenger", capability="pipeline.assess_updates", payload={}),           # not granted
        plan(agent="research-planner", capability="agents.research_brief", payload={}),       # paused
        plan(agent="challenger", capability="agents.challenge_requirement",
             payload={"requirement_id": target, "vehicle": "G70"}),                           # scope smuggling
        plan(agent="ai:agent:challenger", capability="agents.challenge_requirement",
             payload={"requirement_id": target, "provider": "deterministic"}),                # ok (id form)
        plan(action="finish", reasoning="Enough for today."),
    ])

    def respond(request):
        assert request["text"]["format"]["name"] == "orchestrator_plan"
        context = json.loads(request["input"])
        assert "decide_requirement" not in json.dumps(context["roster"])
        return next(plans)

    fake_llm.responder = respond
    session = start_session(SessionStart(vehicle="G60", market="US", provider="openai", started_by=PM,
                                         agent_provider="deterministic"), background=False)
    assert session["status"] == "succeeded", session["error"]
    rejected = [s["detail"]["error"] for s in session["steps"] if s["kind"] == "rejected"]
    assert len(rejected) == 3
    assert "not granted" in rejected[0] and "paused" in rejected[1] and "scope applies" in rejected[2]
    delegated = [s["detail"]["capability"] for s in session["steps"] if s["kind"] == "delegate"]
    assert delegated == ["agents.challenge_requirement", "agents.morning_brief"]  # brief is always compiled
    assert session["usage"]["planner_calls"] == 5 and session["usage"]["rejected"] == 3
    assert session["model"] == "fake-model" and session["method_version"].startswith("openai:fake-model:")


def test_budget_caps_delegations(scope, fake_llm):
    target = requirement_ids(scope)[0]
    fake_llm.responder = lambda request: plan(agent="challenger", capability="agents.challenge_requirement",
                                              payload={"requirement_id": target, "provider": "deterministic"})
    session = start_session(SessionStart(vehicle="G60", market="US", provider="openai", started_by=PM, max_steps=2,
                                         agent_provider="deterministic"), background=False)
    delegated = [s["detail"]["capability"] for s in session["steps"] if s["kind"] == "delegate"]
    assert delegated == ["agents.challenge_requirement"] * 2 + ["agents.morning_brief"]


def test_challenger_keeps_only_grounded_counterarguments(scope, fake_llm, db):
    target = next(r for r in scope.get("/requirements?vehicle=G60&market=US").json()["items"] if r["topic"] == "charging")
    trace = scope.get(f"/requirements/{target['id']}/trace").json()
    record = trace["evidence"]["items"][0]
    fake_llm.responder = lambda request: {
        "counterarguments": [
            {"claim": "Grounded", "evidence_id": record["id"], "quote": record["content"][:30]},
            {"claim": "Invented", "evidence_id": record["id"], "quote": "range doubled overnight"},
            {"claim": "Unknown record", "evidence_id": "nope", "quote": "anything"}],
        "missing_evidence": ["Dated survey"], "target_realism": "Untested threshold."}
    task = scope.post("/tasks", json={"vehicle": "G60", "market": "US", "capability": "agents.challenge_requirement",
                                      "title": "Challenge", "input": {"requirement_id": target["id"], "provider": "openai"},
                                      "requested_by": PM, "assigned_agent_id": "ai:agent:challenger"}).json()
    result = scope.post(f"/tasks/{task['id']}/execute", json={"actor": PM}).json()
    assert result["status"] == "awaiting_human", result["error"]
    artifact = scope.get(f"/artifacts/{result['outputs']['artifact_id']}").json()
    assert [c["claim"] for c in artifact["content"]["counterarguments"]] == ["Grounded"]
    assert artifact["content"]["rejected_ungrounded"] == 2
    assert artifact["created_by"] == "ai:agent:challenger" and artifact["provider"] == "openai"
    assert artifact["version_id"] == target["current_version_id"]
    codes = {o["code"] for o in artifact["content"]["objections"]}
    assert {"assumed_targets", "not_specific", "no_public_corroboration"} <= codes
    with sqlite3.connect(db) as connection, pytest.raises(sqlite3.IntegrityError, match="immutable"):
        connection.execute("UPDATE agent_artifacts SET content='{}'")


def test_specialists_reject_other_scopes_and_unassigned_capabilities(scope):
    target = requirement_ids(scope)[0]
    other = scope.post("/tasks", json={"vehicle": "G70", "market": "US", "capability": "agents.challenge_requirement",
                                       "title": "Wrong scope", "input": {"requirement_id": target},
                                       "requested_by": PM, "assigned_agent_id": "ai:agent:challenger"}).json()
    result = scope.post(f"/tasks/{other['id']}/execute", json={"actor": PM}).json()
    assert result["status"] == "failed" and "another vehicle and market" in result["error"]
    refused = scope.post("/tasks", json={"vehicle": "G60", "market": "US", "capability": "agents.draft_communications",
                                         "title": "Not the drafter", "input": {"requirement_id": target},
                                         "requested_by": PM, "assigned_agent_id": "ai:agent:challenger"})
    assert refused.status_code == 422


def test_sessions_interrupted_by_a_restart_are_closed_at_startup(scope, monkeypatch):
    monkeypatch.setattr(orchestrator.threading, "Thread", lambda **kwargs: type("T", (), {"start": lambda self: None})())
    session = scope.post("/sessions", json={"vehicle": "G60", "market": "US", "started_by": PM}).json()
    assert orchestrator.recover_interrupted_sessions() == [session["id"]]
    closed = scope.get(f"/sessions/{session['id']}").json()
    assert closed["status"] == "failed" and closed["error"] == "Interrupted by an API restart"
    assert scope.post("/sessions", json={"vehicle": "G60", "market": "US", "started_by": PM}).status_code == 201


def test_session_provider_overrides_the_planner_for_specialists(scope, fake_llm):
    target = requirement_ids(scope)[0]
    plans = iter([plan(agent="challenger", capability="agents.challenge_requirement",
                       payload={"requirement_id": target, "provider": "deterministic"}),
                  plan(action="finish")])

    def respond(request):
        name = request["text"]["format"]["name"]
        if name == "orchestrator_plan":
            return next(plans)
        assert name == "challenge_requirement"
        return {"counterarguments": [], "missing_evidence": [], "target_realism": "n/a"}

    fake_llm.responder = respond
    session = start_session(SessionStart(vehicle="G60", market="US", provider="openai", started_by=PM), background=False)
    challenge = next(a for a in session["artifacts"] if a["kind"] == "challenge")
    assert challenge["provider"] == "openai"


def test_whole_team_session_briefs_every_agent(scope, db):
    session = start_session(SessionStart(vehicle="G60", market="US", started_by=PM, challenge_top=1, team="all",
                                         max_steps=25), background=False)
    assert session["status"] == "succeeded", session["error"]
    assert session["budgets"]["team"] == "all"
    delegated = [s for s in session["steps"] if s["kind"] == "delegate"]
    standby = [s for s in session["steps"] if s["kind"] == "plan" and s["detail"].get("standby")]
    capabilities = [s["detail"]["capability"] for s in delegated]
    assert {"signals.summarise", "markets.compare", "markets.detect_conflicts", "requests.triage",
            "market_data.coverage"} <= set(capabilities)
    assert {s["detail"]["standby"] for s in standby} == {"competitor-analyst", "requirement-writer"}
    assert all(s["agent_id"].endswith(s["detail"]["standby"]) and s["status"] == "info" for s in standby)
    assert capabilities[-1] == "agents.morning_brief"
    roster = {agent["id"] for agent in scope.get("/agents?limit=200").json()["items"] if agent["status"] == "active"}
    assert {s["agent_id"] for s in delegated + standby} == roster
    assert len(capabilities) == len({str((s["detail"]["capability"], s["detail"]["input"])) for s in delegated})
    with sqlite3.connect(db) as connection:
        assert connection.execute("SELECT count(*) FROM decisions").fetchone()[0] == 0
