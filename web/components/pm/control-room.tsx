"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Ban,
  CircleStop,
  History,
  Play,
  Sparkles,
  UserRound,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api, date, fmt, query, readable, write } from "@/lib/api";
import {
  ArtifactView,
  MorningBrief,
  useArtifacts,
  type Artifact,
} from "./agent-artifacts";
import { useWorkspace } from "./context";
import { Empty, ErrorMessage, Loading, Panel, useUrlState } from "./shared";

/* Types (mirror server/orchestrator.py) ------------------------------------------------------ */

type SessionStatus = "running" | "succeeded" | "failed" | "stopped";
type StepStatus =
  "info" | "succeeded" | "awaiting_human" | "failed" | "rejected";
type Step = {
  id: string;
  seq: number;
  agent_id: string;
  kind: "plan" | "delegate" | "rejected" | "finish" | "error" | "stopped";
  title: string;
  status: StepStatus;
  detail: {
    reasoning?: string;
    capability?: string;
    input?: Record<string, unknown>;
    result?: string;
    outputs?: Record<string, unknown>;
    error?: string | null;
    summary?: string;
    planner?: string;
    model?: string | null;
  };
  task_id: string | null;
  run_ids: string[];
  created_at: string;
};
type SessionBase = {
  id: string;
  vehicle: string;
  market: string;
  goal: string;
  provider: "openai" | "reference";
  model: string | null;
  method_version: string;
  status: SessionStatus;
  started_by: string;
  stop_requested_by: string | null;
  budgets: {
    max_steps: number;
    challenge_top: number;
    agent_provider: "deterministic" | "openai";
  };
  usage: Partial<{
    steps: number;
    rejected: number;
    planner_calls: number;
    total_tokens: number;
  }>;
  summary: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};
type SessionSummary = SessionBase & { step_count: number };
type Session = SessionBase & { steps: Step[]; artifacts: Artifact[] };
type AgentLite = { id: string; display_name: string; kind: string };

const DEFAULT_GOAL =
  "Prepare today's planning review: refresh evidence, update the proposals, challenge the top ones and brief me.";

/* Helpers ------------------------------------------------------------------------------------- */

const cleanError = (error: Error) =>
  error.message.replace(
    " Reload and review the current version before submitting again.",
    "",
  );

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function elapsed(from: string, to: number) {
  const seconds = Math.max(
    0,
    Math.round((to - new Date(from).getTime()) / 1000),
  );
  const m = Math.floor(seconds / 60);
  return m
    ? `${m} min ${String(seconds % 60).padStart(2, "0")} s`
    : `${seconds} s`;
}

const clock = (value: string) =>
  new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Madrid",
  });

function initials(name: string) {
  const words = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/);
  return (words[0]?.[0] || "?") + (words[1]?.[0] || "");
}

function agentClass(id: string) {
  if (id === "ai:agent:orchestrator") return "is-orchestrator";
  if (id.startsWith("ai:")) return "is-ai";
  if (id.startsWith("system:")) return "is-system";
  return "is-human";
}

const STEP_LABELS: Record<StepStatus, string> = {
  info: "Note",
  succeeded: "Done",
  awaiting_human: "Waits for PM",
  failed: "Failed",
  rejected: "Rejected",
};
const KIND_LABELS: Partial<Record<Step["kind"], string>> = {
  plan: "Plan",
  finish: "Handed over",
  stopped: "Stopped",
};
const SESSION_LABELS: Record<SessionStatus, string> = {
  running: "Running",
  succeeded: "Handed over",
  failed: "Failed",
  stopped: "Stopped",
};

const HIDDEN_OUTPUTS = new Set([
  "artifact_id",
  "run_id",
  "method_version",
  "awaiting_human",
  "requirement_key",
  "analysis_id",
  "rubric_version",
  "vehicle",
  "market",
]);
/** Scalar outputs as short "key value" facts; nested objects and IDs stay in the run record. */
function facts(outputs?: Record<string, unknown>) {
  if (!outputs) return [];
  return Object.entries(outputs)
    .filter(
      ([key, value]) =>
        !HIDDEN_OUTPUTS.has(key) &&
        !key.endsWith("_id") &&
        (typeof value === "number" ||
          typeof value === "boolean" ||
          (typeof value === "string" && value.length <= 40)),
    )
    .slice(0, 6)
    .map(([key, value]) => ({
      key: readable(key),
      value:
        typeof value === "number"
          ? fmt(value)
          : typeof value === "boolean"
            ? value
              ? "yes"
              : "no"
            : readable(String(value)),
    }));
}

/* Activity stream ----------------------------------------------------------------------------- */

function StepItem({ step, names }: { step: Step; names: Map<string, string> }) {
  const { base, requirements } = useWorkspace();
  const name = names.get(step.agent_id) || step.agent_id;
  const d = step.detail || {};
  const requirementId =
    typeof d.input?.requirement_id === "string"
      ? d.input.requirement_id
      : undefined;
  const requirement = requirementId
    ? requirements.find((r) => r.id === requirementId)
    : undefined;
  const artifactId =
    typeof d.outputs?.artifact_id === "string"
      ? d.outputs.artifact_id
      : undefined;
  const items = facts(d.outputs);
  const status = step.kind === "rejected" ? "rejected" : step.status;
  return (
    <li className={`cr-step cr-step-${step.kind} is-${status}`}>
      <span className={`cr-avatar ${agentClass(step.agent_id)}`} aria-hidden>
        {initials(name)}
      </span>
      <div className="cr-step-body">
        <div className="cr-step-top">
          <strong>{name}</strong>
          {d.capability && (
            <span className="cr-capability mono">{d.capability}</span>
          )}
          <span className={`cr-step-status is-${status}`}>
            {status === "info"
              ? (KIND_LABELS[step.kind] ?? STEP_LABELS.info)
              : STEP_LABELS[status]}
          </span>
          <time className="mono" dateTime={step.created_at}>
            {clock(step.created_at)}
          </time>
        </div>
        <p className="cr-step-title">{step.title}</p>
        {step.kind === "rejected" ? (
          <p className="cr-step-rejected">
            <Ban size={13} aria-hidden />
            <span>
              <b>Rejected by policy:</b>{" "}
              {d.error || "This agent may not call that capability."}
            </span>
          </p>
        ) : d.error ? (
          <p className="cr-step-error">{d.error}</p>
        ) : null}
        {step.kind === "finish" && d.summary && d.summary !== step.title && (
          <p className="cr-step-summary">{d.summary}</p>
        )}
        {items.length > 0 && (
          <dl className="cr-facts">
            {items.map((f) => (
              <div key={f.key}>
                <dt>{f.key}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {(requirementId || artifactId || step.run_ids.length > 0) && (
          <div className="cr-step-links">
            {requirementId && (
              <Link
                className="text-link"
                href={`${base}/requirements?requirement=${requirementId}`}
              >
                {requirement ? requirement.key : "Open requirement"}
                <ArrowUpRight size={12} />
              </Link>
            )}
            {artifactId && (
              <a className="text-link" href={`#artifact-${artifactId}`}>
                View result
              </a>
            )}
            {step.run_ids.length > 0 && (
              <span className="muted mono">
                {step.run_ids.length} recorded run
                {step.run_ids.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/* Start panel -------------------------------------------------------------------------------- */

function StartPanel({
  running,
  onStarted,
}: {
  running: SessionSummary | undefined;
  onStarted: (id: string) => void;
}) {
  const { scope, actor } = useWorkspace();
  const client = useQueryClient();
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [planner, setPlanner] = useState<"openai" | "reference">("reference");
  const [challengeTop, setChallengeTop] = useState(3);
  const [maxSteps, setMaxSteps] = useState(12);
  const human = actor?.kind === "human" && !!actor.active;
  const start = useMutation({
    mutationFn: () =>
      write<Session>("/sessions", {
        ...scope,
        goal: goal.trim() || DEFAULT_GOAL,
        provider: planner,
        started_by: actor!.id,
        max_steps: maxSteps,
        challenge_top: challengeTop,
      }),
    onSuccess: (session) => {
      toast.success(
        session.provider === "openai"
          ? "The AI planner is working. Steps stream in as each agent finishes."
          : "The reference plan is running.",
      );
      client.setQueryData(["session", session.id], session);
      client.invalidateQueries({ queryKey: ["sessions"] });
      onStarted(session.id);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status === 503
          ? `The AI planner is unavailable: ${cleanError(error)}`
          : cleanError(error),
      ),
  });
  const blocked = !human || !!running || start.isPending;
  return (
    <Panel
      className="cr-start"
      title="Run the agent team"
      description="The orchestrator plans each step and delegates it to a specialist. Agents read, reconcile, draft and challenge; decisions stay with you."
    >
      <label className="pm-field">
        <span>Goal for today</span>
        <textarea
          className="pm-input"
          rows={3}
          value={goal}
          maxLength={2000}
          onChange={(e) => setGoal(e.target.value)}
        />
      </label>
      <div className="cr-planner" role="radiogroup" aria-label="Planner">
        {(
          [
            [
              "openai",
              "AI planner",
              "Plans step by step from the results; a few minutes.",
              Sparkles,
            ],
            [
              "reference",
              "Reference plan",
              "Offline and deterministic; seconds.",
              Workflow,
            ],
          ] as const
        ).map(([value, label, note, Icon]) => (
          <button
            key={value}
            role="radio"
            aria-checked={planner === value}
            onClick={() => setPlanner(value)}
          >
            <Icon size={15} aria-hidden />
            <span>
              <strong>{label}</strong>
              <small>{note}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="cr-budgets">
        <label>
          <span>Challenge top</span>
          <input
            className="pm-input"
            type="number"
            min={0}
            max={8}
            value={challengeTop}
            onChange={(e) =>
              setChallengeTop(
                Math.min(8, Math.max(0, Number(e.target.value) || 0)),
              )
            }
          />
        </label>
        <label>
          <span>Step budget</span>
          <input
            className="pm-input"
            type="number"
            min={1}
            max={25}
            value={maxSteps}
            onChange={(e) =>
              setMaxSteps(
                Math.min(25, Math.max(1, Number(e.target.value) || 1)),
              )
            }
          />
        </label>
      </div>
      <div className="cr-start-footer">
        <span className="cr-starter">
          <UserRound size={14} aria-hidden />
          {human ? (
            <>
              Started by <b>{actor!.display_name}</b>
            </>
          ) : (
            <span className="attention-text">
              Select a human reviewer in the sidebar to start the team.
            </span>
          )}
        </span>
        <Button disabled={blocked} onClick={() => start.mutate()}>
          <Play size={14} />
          {start.isPending
            ? "Starting…"
            : running
              ? "Team is working…"
              : "Start"}
        </Button>
      </div>
    </Panel>
  );
}

/* Session view ------------------------------------------------------------------------------- */

function SessionView({
  id,
  names,
  history,
  onSelect,
}: {
  id: string;
  names: Map<string, string>;
  history: SessionSummary[];
  onSelect: (id: string) => void;
}) {
  const { actor, actors, refresh } = useWorkspace();
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session", id],
    queryFn: ({ signal }) =>
      api<Session>(`/sessions/${encodeURIComponent(id)}`, { signal }),
    refetchInterval: (q) => (q.state.data?.status === "running" ? 2000 : false),
  });
  const s = session.data;
  const running = s?.status === "running";
  const now = useNow(running);
  const previous = useRef<{ status?: string; steps?: number }>({});
  useEffect(() => {
    if (!s) return;
    const before = previous.current;
    if (before.steps !== undefined && before.steps !== s.steps.length) {
      client.invalidateQueries({ queryKey: ["tasks"] });
      client.invalidateQueries({ queryKey: ["runs"] });
    }
    if (before.status === "running" && s.status !== "running") {
      client.invalidateQueries({ queryKey: ["sessions"] });
      client.invalidateQueries({ queryKey: ["artifacts"] });
      refresh();
      if (s.status === "succeeded")
        toast.success("The agent team handed over. Your brief is ready.");
      else if (s.status === "stopped")
        toast.info(
          `Session stopped${s.stop_requested_by ? ` by ${actors.find((a) => a.id === s.stop_requested_by)?.display_name || s.stop_requested_by}` : ""}.`,
        );
      else toast.error(`Session ${s.status}${s.error ? `: ${s.error}` : "."}`);
    }
    previous.current = { status: s.status, steps: s.steps.length };
  }, [s, client, refresh, actors]);
  const stop = useMutation({
    mutationFn: () =>
      write<Session>(`/sessions/${encodeURIComponent(id)}/stop`, {
        actor: actor!.id,
      }),
    onSuccess: (data) => {
      client.setQueryData(["session", id], data);
      toast.success("Stop requested. The team stops before its next step.");
    },
    onError: (error) => toast.error(cleanError(error)),
  });
  const person = (actorId: string) =>
    actors.find((a) => a.id === actorId)?.display_name || actorId;

  if (session.error)
    return (
      <ErrorMessage
        error={session.error}
        retry={() => void session.refetch()}
      />
    );
  if (!s) return <Loading label="Opening the session…" />;
  const usage = s.usage || {};
  const steps = [...s.steps].sort((a, b) => a.seq - b.seq);
  const work = s.artifacts.filter((a) => a.kind !== "morning_brief");
  const human = actor?.kind === "human" && !!actor.active;
  return (
    <>
      <Panel
        className={`cr-session is-${s.status}`}
        title={s.goal}
        description={`Started by ${person(s.started_by)} · ${date(s.created_at)}`}
        action={
          running && (
            <Button
              variant="outline"
              size="sm"
              disabled={!human || !!s.stop_requested_by || stop.isPending}
              onClick={() => stop.mutate()}
              title={
                human
                  ? undefined
                  : "Select a human reviewer to stop the session"
              }
            >
              <CircleStop size={13} />
              {s.stop_requested_by ? "Stopping…" : "Stop"}
            </Button>
          )
        }
      >
        <div className="cr-session-strip">
          <span className={`cr-session-status is-${s.status}`}>
            {running && <span className="cr-pulse" aria-hidden />}
            {SESSION_LABELS[s.status]}
          </span>
          <span
            className={s.provider === "openai" ? "ai-label" : "method-label"}
          >
            {s.provider === "openai" ? "AI planner" : "Reference plan"}
            <span className="mono">{s.model || s.method_version}</span>
          </span>
          <span className="method-label">
            Specialists <span className="mono">{s.budgets.agent_provider}</span>
          </span>
          <span className="cr-elapsed mono">
            {elapsed(
              s.created_at,
              s.finished_at ? new Date(s.finished_at).getTime() : now,
            )}
          </span>
        </div>
        <dl className="cr-usage">
          <div>
            <dt>Steps</dt>
            <dd>
              {fmt(usage.steps || 0)}
              <small> / {s.budgets.max_steps}</small>
            </dd>
          </div>
          <div className={usage.rejected ? "is-rejected" : undefined}>
            <dt>Rejected by policy</dt>
            <dd>{fmt(usage.rejected || 0)}</dd>
          </div>
          <div>
            <dt>Planner calls</dt>
            <dd>{fmt(usage.planner_calls || 0)}</dd>
          </div>
          <div>
            <dt>Model tokens</dt>
            <dd>{fmt(usage.total_tokens || 0)}</dd>
          </div>
        </dl>
        {s.error && (
          <div className="pm-alert error" role="alert">
            {s.error}
          </div>
        )}
        <div className="cr-session-grid">
          <div>
            <h3 className="cr-subhead">Activity</h3>
            <ol className="cr-stream" aria-live="polite">
              {steps.map((step) => (
                <StepItem key={step.id} step={step} names={names} />
              ))}
              {running && (
                <li className="cr-step cr-thinking">
                  <span className="cr-avatar is-orchestrator" aria-hidden>
                    <span className="cr-dots">
                      <i />
                      <i />
                      <i />
                    </span>
                  </span>
                  <div className="cr-step-body">
                    <p className="cr-step-title">
                      {s.stop_requested_by
                        ? `Stop requested by ${person(s.stop_requested_by)}; finishing the current step…`
                        : s.provider === "openai"
                          ? "Planning the next step…"
                          : "Working on the next step…"}
                    </p>
                  </div>
                </li>
              )}
            </ol>
          </div>
          <aside className="cr-history">
            <h3 className="cr-subhead">
              <History size={13} aria-hidden /> Sessions
            </h3>
            <ul>
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    aria-current={h.id === id ? "true" : undefined}
                    onClick={() => onSelect(h.id)}
                  >
                    <span className={`cr-dot is-${h.status}`} aria-hidden />
                    <span>
                      <strong>{date(h.created_at)}</strong>
                      <small>
                        {h.provider === "openai" ? "AI planner" : "Reference"} ·{" "}
                        {h.step_count} steps · {SESSION_LABELS[h.status]}
                      </small>
                      <small>{person(h.started_by)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Panel>
      {work.length > 0 && (
        <Panel
          className="cr-artifacts"
          title="What the team prepared"
          description="Immutable results, each tied to its run. Challenges and drafts wait for you; nothing was approved or sent."
        >
          <div className="cr-artifact-grid">
            {work
              .filter((a) => a.kind === "challenge")
              .map((a) => (
                <ArtifactView key={a.id} artifact={a} compact />
              ))}
          </div>
          {work
            .filter((a) => a.kind !== "challenge")
            .map((a) => (
              <ArtifactView key={a.id} artifact={a} />
            ))}
        </Panel>
      )}
    </>
  );
}

/* Control room ------------------------------------------------------------------------------- */

export function ControlRoom() {
  const { scope } = useWorkspace();
  const { params, set } = useUrlState();
  const sessions = useQuery({
    queryKey: ["sessions", query(scope)],
    queryFn: ({ signal }) =>
      api<{ items: SessionSummary[] }>(
        `/sessions?${query(scope, { limit: 12 })}`,
        { signal },
      ),
    refetchInterval: (q) =>
      q.state.data?.items.some((s) => s.status === "running") ? 3000 : false,
  });
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: ({ signal }) =>
      api<{ items: AgentLite[] }>("/agents?limit=200", { signal }),
  });
  const latestBrief = useArtifacts({ kind: "morning_brief", limit: 1 });
  const names = new Map(
    (agents.data?.items || []).map((a) => [a.id, a.display_name]),
  );
  const items = sessions.data?.items || [];
  const running = items.find((s) => s.status === "running");
  const selected = params.get("session") || items[0]?.id;
  const select = (id: string) => set({ session: id });
  const sessionBrief = useArtifacts(
    { kind: "morning_brief", session_id: selected, limit: 1 },
    !!selected,
  );
  const brief = sessionBrief.data?.items[0] || latestBrief.data?.items[0];
  const fromLatest = !!sessionBrief.data && !sessionBrief.data.items.length;
  return (
    <div className="control-room">
      <div className="cr-top">
        <StartPanel running={running} onStarted={select} />
        <Panel
          className="cr-brief-panel"
          title="Morning brief"
          description={
            !fromLatest || !brief
              ? `${scope.vehicle} / ${scope.market} · from the selected session. Your entry point: what changed, what waits for you.`
              : `${scope.vehicle} / ${scope.market} · latest brief; the selected session has not compiled one.`
          }
        >
          {latestBrief.isPending ? (
            <Loading label="Loading the brief…" />
          ) : brief?.kind === "morning_brief" ? (
            <MorningBrief artifact={brief} />
          ) : (
            <Empty
              title="No brief yet"
              description="Start the team; it ends every session with a brief for you."
            />
          )}
        </Panel>
      </div>
      {sessions.error ? (
        <ErrorMessage
          error={sessions.error}
          retry={() => void sessions.refetch()}
        />
      ) : sessions.isPending ? (
        <Loading label="Loading sessions…" />
      ) : !selected ? (
        <Panel title="Sessions">
          <Empty
            title="The team has not run in this scope"
            description="Start a session to watch the orchestrator plan and delegate, step by step."
          />
        </Panel>
      ) : (
        <SessionView
          key={selected}
          id={selected}
          names={names}
          history={items}
          onSelect={select}
        />
      )}
    </div>
  );
}
