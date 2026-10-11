"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  Globe2,
  Landmark,
  MessagesSquare,
  Play,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, date, fmt, query, write } from "@/lib/api";
import { useWorkspace } from "./context";
import { Empty, ErrorMessage, Loading, Panel } from "./shared";

type Origin =
  "bmw_internal" | "public_official" | "public_social" | "public_web";
type Role = "customer_voice" | "scoring_context" | "product_context";
type MixSource = {
  source_id: string;
  title: string;
  kind: string;
  origin: Origin;
  role: Role;
  connector: string | null;
  publisher: string | null;
  records: number;
  dated_records: number;
  first_observed: string | null;
  last_observed: string | null;
  linked_records: number;
  linked_requirements: number;
  videos?: Video[];
  batch?: string | null;
  posts?: number | null;
  comments?: number | null;
};
type Video = {
  id: string;
  url: string;
  title: string;
  channel: string;
  views: number | null;
  published: string | null;
  thumbnail: string;
};
type Mix = {
  sources: MixSource[];
  by_origin: Partial<
    Record<
      Origin,
      {
        sources: number;
        records: number;
        dated_records: number;
        linked_records: number;
      }
    >
  >;
  totals: {
    sources: number;
    records: number;
    dated_records: number;
    requirements: number;
    requirements_with_public_evidence: number;
  };
};
type Connector = {
  key: "bmw_files" | "nhtsa" | "web_research" | "reddit" | "youtube";
  mode?: "batch";
  last_batch?: { batch: string; imported_at: string; records: number } | null;
  label: string;
  origin: Origin;
  publisher: string;
  available: boolean;
  reason: string | null;
  endpoint: string;
  last_run: {
    run_id: string;
    status: string;
    finished_at: string | null;
  } | null;
};

export const ORIGINS: Record<
  Origin,
  { label: string; short: string; icon: typeof Building2 }
> = {
  bmw_internal: {
    label: "BMW internal files",
    short: "BMW internal",
    icon: Building2,
  },
  public_official: {
    label: "Official public records",
    short: "Public · official",
    icon: Landmark,
  },
  public_social: {
    label: "Public social (Reddit, YouTube)",
    short: "Public · social",
    icon: MessagesSquare,
  },
  public_web: {
    label: "Public web research",
    short: "Public · web",
    icon: Globe2,
  },
};

/** Recognisable marks for each source so a PM sees which existing channel a record comes from. */
export function SourceLogo({
  connector,
  origin,
  size = 18,
}: {
  connector: string | null | undefined;
  origin: Origin;
  size?: number;
}) {
  if (connector === "reddit")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        aria-label="Reddit"
        role="img"
      >
        <circle cx="10" cy="10" r="10" fill="#ff4500" />
        <ellipse cx="10" cy="11.6" rx="5.6" ry="3.7" fill="#fff" />
        <circle cx="7.9" cy="11.2" r="0.95" fill="#ff4500" />
        <circle cx="12.1" cy="11.2" r="0.95" fill="#ff4500" />
        <circle cx="13.9" cy="5.2" r="1.1" fill="#fff" />
        <path
          d="M10 8 L11 4.6 L13.9 5.2"
          stroke="#fff"
          strokeWidth="0.9"
          fill="none"
        />
      </svg>
    );
  if (connector === "youtube")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        aria-label="YouTube"
        role="img"
      >
        <rect x="0.5" y="3.5" width="19" height="13" rx="3.8" fill="#ff0000" />
        <path d="M8 7 L13.5 10 L8 13 Z" fill="#fff" />
      </svg>
    );
  const Icon =
    connector === "nhtsa"
      ? Landmark
      : connector === "web_research"
        ? Globe2
        : ORIGINS[origin].icon;
  return <Icon size={size - 2} className={`source-logo origin-${origin}`} />;
}
const ROLES: Record<Role, string> = {
  customer_voice: "Customer voice → findings",
  scoring_context: "Scoring context",
  product_context: "Product context",
};

export function useSourceMix() {
  const { scope } = useWorkspace();
  return useQuery({
    queryKey: ["source-mix", query(scope)],
    queryFn: ({ signal }) =>
      api<Mix>(`/public-sources/mix?${query(scope)}`, { signal }),
  });
}

const day = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
function observed(source: MixSource) {
  if (!source.first_observed || !source.last_observed) return "Undated";
  return source.first_observed === source.last_observed
    ? day(source.first_observed)
    : `${day(source.first_observed)} – ${day(source.last_observed)}`;
}

/** Records per origin as one bar, then each source with its role and the requirements it supports. */
export function SourceMixPanel({ compact = false }: { compact?: boolean }) {
  const { base, scope } = useWorkspace();
  const mix = useSourceMix();
  const data = mix.data;
  const order: Origin[] = [
    "bmw_internal",
    "public_official",
    "public_social",
    "public_web",
  ];
  const videos = (data?.sources || []).flatMap((s) => s.videos || []);
  const voice = (data?.sources || []).filter(
    (s) => s.role === "customer_voice",
  );
  const voiceTotal = voice.reduce((sum, s) => sum + s.records, 0) || 1;
  return (
    <Panel
      className="source-mix"
      title="Evidence sources"
      description={
        data
          ? `${data.totals.sources} sources · ${fmt(data.totals.records)} records · ${data.totals.requirements_with_public_evidence} of ${data.totals.requirements} requirements also cite public evidence · ${scope.vehicle} / ${scope.market}`
          : "BMW files and public data in one evidence base"
      }
      action={
        compact ? (
          <Link className="text-link" href={`${base}/sources`}>
            Sources & connectors <ArrowUpRight size={13} />
          </Link>
        ) : undefined
      }
    >
      {mix.isPending ? (
        <Loading label="Loading source mix…" />
      ) : mix.error ? (
        <ErrorMessage error={mix.error} />
      ) : !data?.sources.length ? (
        <Empty
          title="No sources yet"
          description="Import BMW files or run a public data connector."
        />
      ) : (
        <>
          <div className="source-mix-legend">
            {order.map((origin) => {
              const group = data.by_origin[origin];
              const Icon = ORIGINS[origin].icon;
              return (
                <div
                  key={origin}
                  className={`source-mix-origin origin-${origin}`}
                >
                  <span className="source-mix-swatch" aria-hidden />
                  <Icon size={14} />
                  <div>
                    <strong>{ORIGINS[origin].label}</strong>
                    <span>
                      {group
                        ? `${group.sources} source${group.sources === 1 ? "" : "s"} · ${fmt(group.records)} records · ${fmt(group.dated_records)} dated`
                        : "Not imported"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="source-mix-bar"
            role="img"
            aria-label="Share of customer-voice records by source"
          >
            {voice.map((s) => (
              <span
                key={s.source_id}
                className={`origin-${s.origin}`}
                style={{ flexGrow: Math.max(s.records / voiceTotal, 0.012) }}
                title={`${s.title}: ${fmt(s.records)} records`}
              />
            ))}
          </div>
          <p className="source-mix-caption">
            Customer-voice records by source. Public sources are small in count
            but dated and independent of BMW&apos;s own channels; sample counts
            are not market prevalence.
          </p>
          <ul className="source-chips" aria-label="Customer-voice sources">
            {voice.map((s) => (
              <li key={s.source_id}>
                <Link href={`${base}/evidence?source=${s.source_id}`}>
                  <SourceLogo
                    connector={s.connector}
                    origin={s.origin}
                    size={16}
                  />
                  <span>{s.title.replace(/ \(batch .*\)$/, "")}</span>
                  <small className="tabular-nums">{fmt(s.records)}</small>
                </Link>
              </li>
            ))}
          </ul>
          {!compact && (
            <div className="pm-table-wrap">
              <table className="pm-table source-mix-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Origin</th>
                    <th>Role</th>
                    <th>Records</th>
                    <th>Observed</th>
                    <th>Supports requirements</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((s) => (
                    <tr key={s.source_id}>
                      <td className="source-mix-name">
                        <SourceLogo connector={s.connector} origin={s.origin} />
                        <Link
                          className="text-link"
                          href={`${base}/evidence?source=${s.source_id}`}
                        >
                          {s.title}
                        </Link>
                        {s.publisher && (
                          <small className="source-mix-publisher">
                            {s.publisher}
                          </small>
                        )}
                      </td>
                      <td>
                        <span
                          className={`source-origin-chip origin-${s.origin}`}
                        >
                          {ORIGINS[s.origin].short}
                        </span>
                      </td>
                      <td>{ROLES[s.role]}</td>
                      <td className="tabular-nums">
                        {fmt(s.records)}
                        {s.dated_records > 0 && (
                          <small> · {fmt(s.dated_records)} dated</small>
                        )}
                      </td>
                      <td>{observed(s)}</td>
                      <td className="tabular-nums">
                        {s.role === "customer_voice"
                          ? `${s.linked_requirements} (${fmt(s.linked_records)} records)`
                          : "Via scoring inputs"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!compact && videos.length > 0 && (
            <div className="source-videos">
              <h3>Videos in the YouTube batch</h3>
              <ul>
                {videos.map((v) => (
                  <li key={v.id}>
                    <a href={v.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={v.thumbnail}
                        alt=""
                        loading="lazy"
                        width={160}
                        height={90}
                      />
                      <strong>{v.title}</strong>
                      <small>
                        {v.channel}
                        {v.views ? ` · ${fmt(v.views)} views` : ""}
                        {v.published ? ` · ${day(v.published)}` : ""}
                      </small>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

type NhtsaResult = {
  new_complaints: number;
  new_recalls: number;
  models: string[];
  warnings: string[];
};
type WebResult = {
  imported: number;
  rejected: unknown[];
  per_topic: Record<string, { kept: number; already_imported: number }>;
};

/** The scope's data connectors. Each button runs one recorded import; analysis stays a separate step. */
export function PublicConnectors() {
  const { scope, actor, refresh } = useWorkspace();
  const client = useQueryClient();
  const catalog = useQuery({
    queryKey: ["public-source-catalog", query(scope)],
    queryFn: ({ signal }) =>
      api<{ connectors: Connector[] }>(
        `/public-sources/catalog?${query(scope)}`,
        { signal },
      ),
  });
  const done = () => {
    client.invalidateQueries({ queryKey: ["source-mix"] });
    client.invalidateQueries({ queryKey: ["public-source-catalog"] });
    refresh();
  };
  const actorId = actor?.id || "system:public-sources";
  const nhtsa = useMutation({
    mutationFn: () =>
      write<NhtsaResult>("/public-sources/nhtsa/import", {
        ...scope,
        actor: actorId,
      }),
    onSuccess: (r) => {
      toast.success(
        r.new_complaints + r.new_recalls
          ? `NHTSA: ${r.new_complaints} new complaints and ${r.new_recalls} new recalls across ${r.models.length} model-years. Run a cumulative update to assess their impact.`
          : `NHTSA: up to date, no new records across ${r.models.length} model-years.`,
      );
      done();
    },
    onError: (error) => toast.error(error.message),
  });
  const web = useMutation({
    mutationFn: () =>
      write<WebResult>("/public-sources/web-research/import", {
        ...scope,
        actor: actorId,
      }),
    onSuccess: (r) => {
      toast.success(
        r.imported
          ? `Web research: ${r.imported} grounded pages imported${r.rejected.length ? `, ${r.rejected.length} rejected (not returned by the search)` : ""}. Run a cumulative update to assess their impact.`
          : "Web research: no new pages beyond those already imported.",
      );
      done();
    },
    onError: (error) => toast.error(error.message),
  });
  const bmw = useMutation({
    mutationFn: () =>
      write<{
        totals: { new_sources: number; new_evidence: number; files: number };
      }>("/market-data/import-bmw", {
        actor: actorId,
      }),
    onSuccess: (r) => {
      toast.success(
        `BMW files: ${r.totals.files} files read, ${fmt(r.totals.new_evidence)} new records across all vehicle and market scopes.`,
      );
      done();
    },
    onError: (error) => toast.error(error.message),
  });
  const running = { bmw_files: bmw, nhtsa, web_research: web } as const;
  return (
    <Panel
      title="Data connectors"
      description="Every connector writes through the same import: originals archived, records located and deduplicated, runs audited."
    >
      {catalog.isPending ? (
        <Loading label="Loading connectors…" />
      ) : catalog.error ? (
        <ErrorMessage error={catalog.error} />
      ) : (
        <div className="connector-grid">
          {catalog.data.connectors.map((c) => {
            if (c.mode === "batch")
              return (
                <article
                  key={c.key}
                  className={`connector-card origin-${c.origin}`}
                >
                  <div className="connector-heading">
                    <SourceLogo connector={c.key} origin={c.origin} size={16} />
                    <span className={`source-origin-chip origin-${c.origin}`}>
                      {ORIGINS[c.origin].short}
                    </span>
                  </div>
                  <h3>{c.label}</h3>
                  <p>{c.publisher}</p>
                  <small>
                    {c.last_batch
                      ? `Batch ${c.last_batch.batch} · ${fmt(c.last_batch.records)} records imported ${date(c.last_batch.imported_at)}`
                      : "No batch imported for this scope yet"}
                  </small>
                  <small className="connector-batch">
                    <Terminal size={12} /> Batch snapshot, no API key:{" "}
                    <code>scripts/import_social_batch.py</code>
                  </small>
                </article>
              );
            const mutation = running[c.key as keyof typeof running];
            return (
              <article
                key={c.key}
                className={`connector-card origin-${c.origin}`}
              >
                <div className="connector-heading">
                  <SourceLogo connector={c.key} origin={c.origin} size={16} />
                  <span className={`source-origin-chip origin-${c.origin}`}>
                    {ORIGINS[c.origin].short}
                  </span>
                </div>
                <h3>{c.label}</h3>
                <p>{c.publisher}</p>
                <small>
                  {c.available
                    ? c.last_run
                      ? `Last run ${date(c.last_run.finished_at)} · ${c.last_run.status}`
                      : "Not run for this scope yet"
                    : c.reason}
                </small>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!c.available || mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  <Play size={13} />
                  {mutation.isPending
                    ? c.key === "web_research"
                      ? "Searching the web…"
                      : "Importing…"
                    : c.key === "bmw_files"
                      ? "Import all BMW files"
                      : "Fetch new records"}
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

type RequirementMix = {
  sources: {
    source_id: string;
    title: string;
    origin: Origin;
    supporting: number;
    conflicting: number;
    dated: number;
  }[];
  public_supporting: number;
};

/** Where one requirement version's linked records come from, across every page of the trace. */
export function RequirementSourceMix({
  requirementId,
  versionId,
}: {
  requirementId: string;
  versionId: string;
}) {
  const { base } = useWorkspace();
  const mix = useQuery({
    queryKey: ["requirement-source-mix", requirementId, versionId],
    queryFn: ({ signal }) =>
      api<RequirementMix>(
        `/public-sources/requirements/${encodeURIComponent(requirementId)}?version_id=${encodeURIComponent(versionId)}`,
        { signal },
      ),
  });
  if (!mix.data?.sources.length) return null;
  return (
    <section className="detail-section requirement-source-mix">
      <h3>Evidence by source</h3>
      <ul>
        {mix.data.sources.map((s) => (
          <li key={s.source_id}>
            <span className={`source-origin-chip origin-${s.origin}`}>
              {ORIGINS[s.origin].short}
            </span>
            <Link
              className="text-link"
              href={`${base}/evidence?source=${s.source_id}`}
            >
              {s.title}
            </Link>
            <small className="tabular-nums">
              {fmt(s.supporting)} linked records
              {s.dated ? ` · ${fmt(s.dated)} dated` : ""}
            </small>
          </li>
        ))}
      </ul>
    </section>
  );
}
