"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardCheck,
  Copy,
  Database,
  FlaskConical,
  Gavel,
  MailX,
  Newspaper,
  ShieldAlert,
  Swords,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api, date, fmt, query, readable, write } from "@/lib/api";
import { useWorkspace } from "./context";
import { Empty, ErrorMessage, Loading, Panel } from "./shared";

/* Types (mirror server/agent_work.py artifact contents) --------------------------------------- */

export type ArtifactKind =
  "challenge" | "research_brief" | "audience_drafts" | "morning_brief";
type ArtifactBase = {
  id: string;
  vehicle: string;
  market: string;
  requirement_id: string | null;
  version_id: string | null;
  score_id: string | null;
  session_id: string | null;
  run_id: string | null;
  created_by: string;
  provider: "openai" | "deterministic" | string;
  method_version: string;
  created_at: string;
};
export type Severity = "high" | "medium" | "low";
export type ChallengeContent = {
  requirement_key: string;
  title: string;
  version: number;
  score_total: number;
  evidence_grade: string;
  verdict: "hold_for_evidence" | "proceed_with_caveats" | "no_objection";
  objections: {
    code: string;
    severity: Severity;
    claim: string;
    suggested_action: string;
    numbers: Record<string, number>;
  }[];
  counterarguments: { claim: string; evidence_id: string; quote: string }[];
  rejected_ungrounded: number;
  missing_evidence: string[];
  target_realism: string | null;
  note: string;
};
export type ResearchContent = {
  challenged_requirements: number;
  items: {
    code: string;
    method: string;
    requirements: { requirement_id: string; key: string; severity: Severity }[];
  }[];
  coverage_warnings: { code: string; message: string; severity: Severity }[];
  note: string;
};
export type Audience = "engineering" | "market" | "board" | "sales";
export type DraftsContent = {
  requirement_key: string;
  title: string;
  version: number;
  decision_status: string;
  decision_id: string | null;
  drafts: { audience: Audience; subject: string; body: string; sent: false }[];
  note: string;
};
export type BriefLineKind =
  "evidence" | "review" | "decision" | "challenge" | "research" | "error";
export type BriefContent = {
  as_of: string;
  window_hours: number;
  headline: string;
  lines: {
    kind: BriefLineKind;
    text: string;
    href: string;
    requirement_id?: string;
  }[];
  counts: Partial<
    Record<
      | "requirements"
      | "awaiting_decision"
      | "open_reviews"
      | "new_sources"
      | "challenged"
      | "held"
      | "failed_tasks",
      number
    >
  >;
  note: string;
};
export type Artifact =
  | (ArtifactBase & { kind: "challenge"; content: ChallengeContent })
  | (ArtifactBase & { kind: "research_brief"; content: ResearchContent })
  | (ArtifactBase & { kind: "audience_drafts"; content: DraftsContent })
  | (ArtifactBase & { kind: "morning_brief"; content: BriefContent });
type ArtifactPage = { items: Artifact[]; total: number };

export function useArtifacts(
  filters: Record<string, string | number | undefined>,
  enabled = true,
) {
  const { scope } = useWorkspace();
  const search = query(scope, filters);
  return useQuery({
    queryKey: ["artifacts", search],
    queryFn: ({ signal }) =>
      api<ArtifactPage>(`/artifacts?${search}`, { signal }),
    enabled,
  });
}

/* Small pieces ------------------------------------------------------------------------------- */

const VERDICTS: Record<ChallengeContent["verdict"], string> = {
  hold_for_evidence: "Hold for evidence",
  proceed_with_caveats: "Proceed with caveats",
  no_objection: "No objection",
};

export function Verdict({ value }: { value: ChallengeContent["verdict"] }) {
  return (
    <span className={`verdict-chip verdict-${value}`}>
      {VERDICTS[value] || readable(value)}
    </span>
  );
}

function ProviderLabel({ artifact }: { artifact: ArtifactBase }) {
  return artifact.provider === "openai" ? (
    <span className="ai-label" title={artifact.method_version}>
      AI · <span className="mono">{artifact.method_version}</span>
    </span>
  ) : (
    <span className="method-label" title={artifact.method_version}>
      Rules · <span className="mono">{artifact.method_version}</span>
    </span>
  );
}

function VersionFlag({
  artifact,
  currentVersionId,
}: {
  artifact: ArtifactBase;
  currentVersionId?: string;
}) {
  if (!currentVersionId || !artifact.version_id) return null;
  return artifact.version_id === currentVersionId ? (
    <span className="artifact-version is-current">For the current version</span>
  ) : (
    <span className="artifact-version is-stale">
      Earlier version · ask again
    </span>
  );
}

/* Challenge ---------------------------------------------------------------------------------- */

export function ChallengeCard({
  artifact,
  currentVersionId,
  compact = false,
}: {
  artifact: ArtifactBase & { content: ChallengeContent };
  currentVersionId?: string;
  compact?: boolean;
}) {
  const { base } = useWorkspace();
  const c = artifact.content;
  const [open, setOpen] = useState(!compact);
  const shown = open ? c.objections : c.objections.slice(0, 2);
  return (
    <article
      className="artifact-card artifact-challenge"
      id={`artifact-${artifact.id}`}
    >
      <header className="artifact-head">
        <Swords size={15} aria-hidden />
        <div>
          <span className="requirement-key">
            {c.requirement_key} · v{c.version} · {c.score_total.toFixed(1)} /
            grade {c.evidence_grade}
          </span>
          <h3>
            {artifact.requirement_id ? (
              <Link
                className="text-link"
                href={`${base}/requirements?requirement=${artifact.requirement_id}&tab=challenges`}
              >
                {c.title}
              </Link>
            ) : (
              c.title
            )}
          </h3>
        </div>
        <Verdict value={c.verdict} />
      </header>
      <div className="artifact-meta">
        <ProviderLabel artifact={artifact} />
        <VersionFlag artifact={artifact} currentVersionId={currentVersionId} />
        <span className="muted">{date(artifact.created_at)}</span>
      </div>
      {c.objections.length > 0 && (
        <ol className="objection-list">
          {shown.map((o, i) => (
            <li key={`${o.code}-${i}`}>
              <span className={`severity severity-${o.severity}`}>
                {o.severity}
              </span>
              <div>
                <p>{o.claim}</p>
                <small>{o.suggested_action}</small>
              </div>
            </li>
          ))}
        </ol>
      )}
      {c.objections.length > 2 && compact && (
        <button
          className="text-link artifact-more"
          onClick={() => setOpen(!open)}
        >
          {open ? "Show fewer" : `Show all ${c.objections.length} objections`}
        </button>
      )}
      {c.counterarguments.length > 0 && (
        <section className="counter-list">
          <h4>
            <span className="ai-label">AI</span> Counterarguments, quoted from
            linked evidence
          </h4>
          {c.counterarguments.map((a, i) => (
            <figure key={i}>
              <p>{a.claim}</p>
              <blockquote>&ldquo;{a.quote}&rdquo;</blockquote>
              <figcaption>
                <Link
                  className="text-link"
                  href={`${base}/evidence?evidence=${encodeURIComponent(a.evidence_id)}`}
                >
                  Open evidence{" "}
                  <span className="mono">{a.evidence_id.slice(0, 8)}</span>
                  <ArrowUpRight size={12} />
                </Link>
              </figcaption>
            </figure>
          ))}
        </section>
      )}
      {c.rejected_ungrounded > 0 && (
        <p className="artifact-footnote">
          <ShieldAlert size={13} /> {c.rejected_ungrounded} AI counterargument
          {c.rejected_ungrounded === 1 ? "" : "s"} discarded: the quote was not
          found verbatim in the linked evidence.
        </p>
      )}
      {c.missing_evidence.length > 0 && (
        <section className="missing-list">
          <h4>Missing evidence</h4>
          <ul>
            {c.missing_evidence.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      )}
      {c.target_realism && (
        <p className="artifact-footnote">Target realism: {c.target_realism}</p>
      )}
      <p className="artifact-note">{c.note}</p>
    </article>
  );
}

/* Research brief ---------------------------------------------------------------------------- */

export function ResearchBriefCard({
  artifact,
}: {
  artifact: ArtifactBase & { content: ResearchContent };
}) {
  const { base } = useWorkspace();
  const c = artifact.content;
  return (
    <article className="artifact-card" id={`artifact-${artifact.id}`}>
      <header className="artifact-head">
        <FlaskConical size={15} aria-hidden />
        <div>
          <span className="requirement-key">
            Research brief · {c.challenged_requirements} challenged requirement
            {c.challenged_requirements === 1 ? "" : "s"}
          </span>
          <h3>Proposed studies</h3>
        </div>
        <ProviderLabel artifact={artifact} />
      </header>
      {c.coverage_warnings.length > 0 && (
        <ul className="coverage-warnings">
          {c.coverage_warnings.map((w) => (
            <li key={w.code}>
              <span className={`severity severity-${w.severity}`}>
                {w.severity}
              </span>
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      )}
      <ol className="study-list">
        {c.items.map((item) => (
          <li key={item.code}>
            <span className="mono">{readable(item.code)}</span>
            <p>{item.method}</p>
            <div className="chip-list">
              {item.requirements.map((r) => (
                <Link
                  key={r.requirement_id}
                  className="chip study-req"
                  title={`${r.severity} severity`}
                  href={`${base}/requirements?requirement=${r.requirement_id}`}
                >
                  {r.key}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className="artifact-note">{c.note}</p>
    </article>
  );
}

/* Drafts tray -------------------------------------------------------------------------------- */

const AUDIENCES: Audience[] = ["engineering", "market", "board", "sales"];

export function DraftsTray({
  artifact,
  currentVersionId,
}: {
  artifact: ArtifactBase & { content: DraftsContent };
  currentVersionId?: string;
}) {
  const { base } = useWorkspace();
  const c = artifact.content;
  const available = AUDIENCES.filter((a) =>
    c.drafts.some((d) => d.audience === a),
  );
  const [tab, setTab] = useState<Audience>(available[0] || "engineering");
  const draft = c.drafts.find((d) => d.audience === tab);
  const copy = () => {
    if (!draft) return;
    navigator.clipboard
      .writeText(`${draft.subject}\n\n${draft.body}`)
      .then(() =>
        toast.success(`${readable(tab)} draft copied. Nothing was sent.`),
      )
      .catch(() => toast.error("Copy failed. Select the text instead."));
  };
  return (
    <article
      className="artifact-card drafts-tray"
      id={`artifact-${artifact.id}`}
    >
      <header className="artifact-head">
        <MailX size={15} aria-hidden />
        <div>
          <span className="requirement-key">
            {c.requirement_key} · v{c.version} · {c.decision_status}
          </span>
          <h3>
            {artifact.requirement_id ? (
              <Link
                className="text-link"
                href={`${base}/requirements?requirement=${artifact.requirement_id}&tab=challenges`}
              >
                Drafts: {c.title}
              </Link>
            ) : (
              `Drafts: ${c.title}`
            )}
          </h3>
        </div>
        <span className="draft-badge">Draft · never sent</span>
      </header>
      <div className="artifact-meta">
        <ProviderLabel artifact={artifact} />
        <VersionFlag artifact={artifact} currentVersionId={currentVersionId} />
      </div>
      <div className="drafts-tabs" role="tablist" aria-label="Audience">
        {available.map((a) => (
          <button
            key={a}
            role="tab"
            aria-selected={tab === a}
            onClick={() => setTab(a)}
          >
            {readable(a)}
          </button>
        ))}
      </div>
      {draft && (
        <div className="draft-body" role="tabpanel">
          <div className="draft-subject">
            <span className="mono">Subject</span>
            <strong>{draft.subject}</strong>
          </div>
          <p>{draft.body}</p>
          <div className="draft-actions">
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy size={13} /> Copy
            </Button>
            <span className="muted">
              Agents draft; you decide whether and where to send.
            </span>
          </div>
        </div>
      )}
      <p className="artifact-note">{c.note}</p>
    </article>
  );
}

/* Morning brief ------------------------------------------------------------------------------ */

const LINE_ICONS: Record<BriefLineKind, typeof Database> = {
  evidence: Database,
  review: ClipboardCheck,
  decision: Gavel,
  challenge: Swords,
  research: FlaskConical,
  error: AlertTriangle,
};
const COUNT_LABELS: [keyof BriefContent["counts"], string][] = [
  ["awaiting_decision", "Await your decision"],
  ["held", "Held by challenger"],
  ["open_reviews", "Open reviews"],
  ["new_sources", "Sources in window"],
  ["failed_tasks", "Failed tasks"],
];

export function MorningBrief({
  artifact,
  compact = false,
}: {
  artifact: ArtifactBase & { content: BriefContent };
  compact?: boolean;
}) {
  const c = artifact.content;
  const lines = compact ? c.lines.slice(0, 4) : c.lines;
  return (
    <article
      className={`morning-brief ${compact ? "is-compact" : ""}`}
      id={`artifact-${artifact.id}`}
    >
      <div className="morning-brief-top">
        <span className="mono">
          <Newspaper size={13} aria-hidden /> Morning brief · as of{" "}
          {date(c.as_of)}
        </span>
        <ProviderLabel artifact={artifact} />
      </div>
      <p className="morning-brief-headline">{c.headline}</p>
      <dl className="morning-brief-counts">
        {COUNT_LABELS.filter(([key]) => c.counts[key] !== undefined).map(
          ([key, label]) => (
            <div
              key={key}
              className={
                key === "failed_tasks" && c.counts[key]
                  ? "is-error"
                  : key === "held" && c.counts[key]
                    ? "is-attention"
                    : undefined
              }
            >
              <dt>{label}</dt>
              <dd>{fmt(c.counts[key] || 0)}</dd>
            </div>
          ),
        )}
      </dl>
      <ul className="morning-brief-lines">
        {lines.map((line, i) => {
          const Icon = LINE_ICONS[line.kind] || Newspaper;
          return (
            <li key={i} className={`brief-line brief-${line.kind}`}>
              <Link href={line.href}>
                <Icon size={14} aria-hidden />
                <span className="brief-kind mono">{line.kind}</span>
                <span className="brief-text">{line.text}</span>
                <ArrowUpRight size={13} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {compact && c.lines.length > lines.length && (
        <p className="muted morning-brief-more">
          {c.lines.length - lines.length} more in the control room.
        </p>
      )}
      <p className="artifact-note">{c.note}</p>
    </article>
  );
}

/** Latest morning brief for the scope; the PM's entry point on the overview. */
export function MorningBriefPanel() {
  const { base } = useWorkspace();
  const briefs = useArtifacts({ kind: "morning_brief", limit: 1 });
  const latest = briefs.data?.items[0];
  if (briefs.isPending || briefs.error) return null;
  return (
    <Panel
      className="morning-brief-panel"
      title="Your morning brief"
      description="Compiled by the agent team from recorded data. Nothing is decided or sent."
      action={
        <Link className="text-link" href={`${base}/agents`}>
          Control room <ArrowUpRight size={13} />
        </Link>
      }
    >
      {latest?.kind === "morning_brief" ? (
        <MorningBrief artifact={latest} compact />
      ) : (
        <Empty
          title="No brief yet"
          description="Run the agent team in the control room to compile one."
        />
      )}
    </Panel>
  );
}

/** Renders any artifact by kind. */
export function ArtifactView({
  artifact,
  currentVersionId,
  compact,
}: {
  artifact: Artifact;
  currentVersionId?: string;
  compact?: boolean;
}) {
  switch (artifact.kind) {
    case "challenge":
      return (
        <ChallengeCard
          artifact={artifact}
          currentVersionId={currentVersionId}
          compact={compact}
        />
      );
    case "research_brief":
      return <ResearchBriefCard artifact={artifact} />;
    case "audience_drafts":
      return (
        <DraftsTray artifact={artifact} currentVersionId={currentVersionId} />
      );
    case "morning_brief":
      return <MorningBrief artifact={artifact} />;
    default:
      return null;
  }
}

/* Requirement drawer: challenges & drafts ---------------------------------------------------- */

type TaskResult = {
  id: string;
  status: string;
  error: string | null;
  outputs?: { artifact_id?: string } & Record<string, unknown>;
};
const SPECIALISTS = {
  challenge: {
    capability: "agents.challenge_requirement",
    agent: "ai:agent:challenger",
    label: "Ask the challenger",
    title: "Challenge",
  },
  drafts: {
    capability: "agents.draft_communications",
    agent: "ai:agent:comms-drafter",
    label: "Draft messages",
    title: "Draft audience messages for",
  },
} as const;

export function RequirementAgentWork({
  requirementId,
  requirementKey,
  currentVersionId,
}: {
  requirementId: string;
  requirementKey: string;
  currentVersionId: string;
}) {
  const { scope, actor } = useWorkspace();
  const client = useQueryClient();
  const [provider, setProvider] = useState<"deterministic" | "openai">(
    "deterministic",
  );
  const artifacts = useArtifacts({ requirement_id: requirementId, limit: 40 });
  const human = actor?.kind === "human" && !!actor.active;
  const run = useMutation({
    mutationFn: async (which: keyof typeof SPECIALISTS) => {
      const spec = SPECIALISTS[which];
      const task = await write<TaskResult>("/tasks", {
        ...scope,
        capability: spec.capability,
        title: `${spec.title} ${requirementKey}`,
        input: { requirement_id: requirementId, provider },
        requested_by: actor!.id,
        assigned_agent_id: spec.agent,
      });
      return write<TaskResult>(
        `/tasks/${encodeURIComponent(task.id)}/execute`,
        { actor: actor!.id },
      );
    },
    onSuccess: (task, which) => {
      if (task.status === "failed" || task.error)
        toast.error(
          `${SPECIALISTS[which].label} failed: ${task.error || task.status}`,
        );
      else
        toast.success(
          which === "challenge"
            ? `Challenger finished for ${requirementKey}. A PM resolves each objection; the requirement is unchanged.`
            : `Four audience drafts ready for ${requirementKey}. Nothing was sent.`,
        );
      client.invalidateQueries({ queryKey: ["artifacts"] });
      client.invalidateQueries({ queryKey: ["tasks"] });
      client.invalidateQueries({ queryKey: ["runs"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status === 503
          ? "AI is unavailable right now. Use the rules-based specialist."
          : error.message,
      ),
  });
  const items = artifacts.data?.items || [];
  const challenge = items.find((a) => a.kind === "challenge");
  const drafts = items.find((a) => a.kind === "audience_drafts");
  return (
    <section className="detail-section requirement-agent-work">
      <div className="agent-work-actions">
        <div>
          <h3>Challenges & drafts</h3>
          <p className="muted">
            Specialist agents argue against this proposal and draft the
            follow-up messages. You decide; nothing is sent.
          </p>
        </div>
        <div className="agent-work-buttons">
          <div
            className="segmented"
            role="radiogroup"
            aria-label="Specialist method"
          >
            {(["deterministic", "openai"] as const).map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={provider === p}
                onClick={() => setProvider(p)}
              >
                {p === "deterministic" ? "Rules" : "AI"}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!human || run.isPending}
            onClick={() => run.mutate("challenge")}
          >
            <Swords size={13} />
            {run.isPending && run.variables === "challenge"
              ? "Challenging…"
              : SPECIALISTS.challenge.label}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!human || run.isPending}
            onClick={() => run.mutate("drafts")}
          >
            <MailX size={13} />
            {run.isPending && run.variables === "drafts"
              ? "Drafting…"
              : SPECIALISTS.drafts.label}
          </Button>
        </div>
        {!human && (
          <p className="attention-text agent-work-hint">
            Select a human reviewer in the sidebar to request specialist work.
          </p>
        )}
      </div>
      {artifacts.error ? (
        <ErrorMessage
          error={artifacts.error}
          retry={() => void artifacts.refetch()}
        />
      ) : artifacts.isPending ? (
        <Loading label="Loading agent work…" />
      ) : !challenge && !drafts ? (
        <Empty
          title="No challenges or drafts yet"
          description="Ask the challenger before you decide, or run the agent team from the control room."
        />
      ) : (
        <>
          {challenge?.kind === "challenge" && (
            <ChallengeCard
              artifact={challenge}
              currentVersionId={currentVersionId}
            />
          )}
          {drafts?.kind === "audience_drafts" && (
            <DraftsTray artifact={drafts} currentVersionId={currentVersionId} />
          )}
        </>
      )}
    </section>
  );
}
