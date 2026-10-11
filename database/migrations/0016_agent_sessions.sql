-- Multi-agent orchestration (MULTI_AGENT_PLAN.md steps 2-3): orchestrator sessions with an append-only step
-- log, immutable specialist artifacts (challenges, research briefs, audience drafts, morning briefs) and the
-- capability grants that let the roster agents produce them. Agents prepare; humans decide. Nothing is sent.

CREATE TABLE agent_sessions (
    id TEXT PRIMARY KEY,
    vehicle TEXT NOT NULL,
    market TEXT NOT NULL,
    goal TEXT NOT NULL CHECK(length(trim(goal)) BETWEEN 1 AND 2000),
    provider TEXT NOT NULL CHECK(provider IN ('openai', 'reference')),
    model TEXT,                                  -- planner model; NULL for the labelled reference planner
    method_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'succeeded', 'failed', 'stopped')),
    started_by TEXT NOT NULL,                    -- the human who asked for the session
    stop_requested_by TEXT,                      -- a human; the loop stops before its next step
    budgets TEXT NOT NULL CHECK(json_valid(budgets)),
    usage TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(usage)),
    summary TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE INDEX agent_sessions_scope ON agent_sessions(vehicle, market, created_at);

-- Only a human starts or stops a session; agents act inside it through tasks.
CREATE TRIGGER agent_sessions_human_start BEFORE INSERT ON agent_sessions
BEGIN
    SELECT RAISE(ABORT, 'this action requires a human actor')
    WHERE lower(NEW.started_by) GLOB 'ai:*' OR lower(NEW.started_by) GLOB 'system:*'
       OR EXISTS (SELECT 1 FROM actors WHERE id = NEW.started_by AND kind <> 'human');
END;

CREATE TRIGGER agent_sessions_human_stop BEFORE UPDATE OF stop_requested_by ON agent_sessions
WHEN NEW.stop_requested_by IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'this action requires a human actor')
    WHERE lower(NEW.stop_requested_by) GLOB 'ai:*' OR lower(NEW.stop_requested_by) GLOB 'system:*'
       OR EXISTS (SELECT 1 FROM actors WHERE id = NEW.stop_requested_by AND kind <> 'human');
END;

CREATE TRIGGER agent_sessions_identity_fixed BEFORE UPDATE OF id, vehicle, market, goal, provider, started_by, created_at
ON agent_sessions
BEGIN SELECT RAISE(ABORT, 'session identity is fixed'); END;

CREATE TRIGGER agent_sessions_terminal BEFORE UPDATE OF status ON agent_sessions
WHEN OLD.status <> 'running' AND NEW.status IS NOT OLD.status
BEGIN SELECT RAISE(ABORT, 'finished sessions are final'); END;

CREATE TABLE session_steps (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES agent_sessions(id),
    seq INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('plan', 'delegate', 'rejected', 'finish', 'error', 'stopped')),
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detail)),
    task_id TEXT REFERENCES tasks(id),
    run_ids TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(run_ids)),
    status TEXT NOT NULL CHECK(status IN ('info', 'succeeded', 'awaiting_human', 'failed', 'rejected')),
    created_at TEXT NOT NULL,
    UNIQUE(session_id, seq)
);

CREATE TRIGGER session_steps_append_only BEFORE UPDATE ON session_steps
BEGIN SELECT RAISE(ABORT, 'session steps are append-only'); END;
CREATE TRIGGER session_steps_no_delete BEFORE DELETE ON session_steps
BEGIN SELECT RAISE(ABORT, 'session steps are append-only'); END;

CREATE TABLE agent_artifacts (
    id TEXT PRIMARY KEY,
    vehicle TEXT NOT NULL,
    market TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('challenge', 'research_brief', 'audience_drafts', 'morning_brief')),
    requirement_id TEXT REFERENCES requirements(id),
    version_id TEXT REFERENCES requirement_versions(id),
    score_id TEXT REFERENCES scores(id),
    session_id TEXT REFERENCES agent_sessions(id),
    run_id TEXT REFERENCES runs(id),
    created_by TEXT NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('openai', 'deterministic')),
    method_version TEXT NOT NULL,
    content TEXT NOT NULL CHECK(json_valid(content)),
    created_at TEXT NOT NULL
);
CREATE INDEX agent_artifacts_scope ON agent_artifacts(vehicle, market, kind, created_at);
CREATE INDEX agent_artifacts_requirement ON agent_artifacts(requirement_id, created_at);

CREATE TRIGGER agent_artifacts_immutable BEFORE UPDATE ON agent_artifacts
BEGIN SELECT RAISE(ABORT, 'agent artifacts are immutable'); END;
CREATE TRIGGER agent_artifacts_no_delete BEFORE DELETE ON agent_artifacts
BEGIN SELECT RAISE(ABORT, 'agent artifacts are immutable'); END;

-- Capability grants for the specialist outputs and the public data connectors.
UPDATE agents SET capabilities = '["agents.morning_brief"]', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'ai:agent:orchestrator';
UPDATE agents SET capabilities = '["agents.challenge_requirement"]', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'ai:agent:challenger';
UPDATE agents SET capabilities = '["agents.draft_communications"]', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'ai:agent:comms-drafter';
UPDATE agents SET capabilities = '["market_data.coverage","agents.research_brief"]',
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'ai:agent:research-planner';
UPDATE agents SET capabilities = '["pipeline.analyze","signals.score_sentiment","market_data.import_bmw","market_data.derive_preserve","public_sources.import_nhtsa"]',
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'ai:agent:feedback-analyst';
UPDATE agents SET capabilities = '["signals.refresh_watchlist","signals.backfill_watchlist","signals.summarise","public_sources.web_research"]',
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'ai:agent:trend-scout';
