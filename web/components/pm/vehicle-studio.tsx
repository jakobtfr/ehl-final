"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, Download, Focus, RotateCcw } from "lucide-react";
import { useStoredValue } from "@/hooks/use-stored-value";
import { api, locationLabel } from "@/lib/api";
import type { Trace } from "@/lib/types";
import { buildZoneRollups, vehicleAssets, zoneNames, type ZoneRollup } from "@/lib/vehicle-models";
import { useWorkspace } from "./context";
import { VehicleConfigurator } from "./vehicle-configurator";
import { Heading, ScoreLabel, Status } from "./shared";

const VehicleViewport = dynamic(() => import("./vehicle-viewport").then((module) => module.VehicleViewport), {
  ssr: false,
  loading: () => <div className="vehicle-stage vehicle-stage-loading">Preparing 3D viewer…</div>,
});

type Treatment = "improve" | "preserve" | "investigate" | "defer";
type Draft = Record<string, { treatment?: Treatment; note?: string }>;
type Layer = "priority" | "evidence" | "review" | "plan";
type PanelTab = "plan" | "feedback" | "requirements" | "specs";
const treatments: { value: Treatment; label: string; detail: string; color: string }[] = [
  { value: "improve", label: "Improve", detail: "Make the experience better", color: "#b36a35" },
  { value: "preserve", label: "Preserve", detail: "Keep what customers value", color: "#25766b" },
  { value: "investigate", label: "Investigate", detail: "Find out more", color: "#8273a9" },
  { value: "defer", label: "Defer", detail: "Return to this later", color: "#6f7a84" },
];
const treatmentColors = Object.fromEntries(treatments.map((item) => [item.value, item.color])) as Record<Treatment, string>;
const unlinked = "#8c9aa6";
const layers: { value: Layer; label: string; legend: { color: string; label: string }[] }[] = [
  {
    value: "priority",
    label: "Priority",
    legend: [
      { color: "#b45b3f", label: "70+" },
      { color: "#ba842e", label: "45–70" },
      { color: "#32749a", label: "Under 45" },
      { color: unlinked, label: "No requirements" },
    ],
  },
  {
    value: "evidence",
    label: "Evidence",
    legend: [
      { color: "#247266", label: "Grade A–B" },
      { color: "#a96a27", label: "Grade C–D" },
      { color: unlinked, label: "No requirements" },
    ],
  },
  {
    value: "review",
    label: "Review",
    legend: [
      { color: "#b45b3f", label: "Needs review" },
      { color: "#247266", label: "Reviewed" },
      { color: unlinked, label: "No requirements" },
    ],
  },
  {
    value: "plan",
    label: "Your plan",
    legend: [...treatments.map(({ color, label }) => ({ color, label })), { color: unlinked, label: "No plan yet" }],
  },
];
const paints = [
  { name: "Studio blue", value: "#244a70" },
  { name: "Silver", value: "#bdc7cf" },
  { name: "Graphite", value: "#343943" },
  { name: "Pearl", value: "#e9e9e4" },
];

function parseDraft(value: string): Draft {
  try {
    const data: unknown = JSON.parse(value);
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Draft) : {};
  } catch {
    return {};
  }
}

function zoneColor(rollup: ZoneRollup | undefined, layer: Layer, treatment?: Treatment) {
  if (layer === "plan") return treatment ? treatmentColors[treatment] : unlinked;
  if (!rollup?.requirements.length) return unlinked;
  if (layer === "evidence") return rollup.worstGrade === "D" || rollup.worstGrade === "C" ? "#a96a27" : "#247266";
  if (layer === "review") return rollup.openReviews ? "#b45b3f" : "#247266";
  return (rollup.topPriority || 0) >= 70 ? "#b45b3f" : (rollup.topPriority || 0) >= 45 ? "#ba842e" : "#32749a";
}

export function VehicleStudio() {
  const { scope, requirements, base } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const railRef = useRef<HTMLDivElement>(null);
  const asset = vehicleAssets.find(
    ({ manifest }) => manifest.vehicle.code === scope.vehicle && manifest.vehicle.market === scope.market,
  );
  const [storedLayer, setLayer] = useStoredValue("bmw-twin-layer", "priority");
  const layer = layers.find((item) => item.value === storedLayer) || layers[0];
  const [paint, setPaint] = useStoredValue(
    `bmw-twin-paint-${scope.vehicle}`,
    scope.vehicle === "G70" ? "#bdc7cf" : "#244a70",
  );
  const [storedDraft, setStoredDraft] = useStoredValue(`bmw-twin-draft-${scope.vehicle}-${scope.market}`, "{}");
  const [tab, setTab] = useState<PanelTab>("plan");
  const draft = useMemo(() => parseDraft(storedDraft), [storedDraft]);
  const manifest = asset?.manifest;
  const zoneIds = useMemo(() => (manifest ? Object.keys(manifest.zones) : []), [manifest]);
  const requestedZone = search.get("zone");
  const zoneId =
    manifest && requestedZone && Object.hasOwn(manifest.zones, requestedZone) ? requestedZone : "charging";
  const zoneIndex = zoneIds.indexOf(zoneId);
  const rollups = useMemo(
    () => (manifest ? buildZoneRollups(manifest, requirements) : {}),
    [manifest, requirements],
  );
  const pinColors = useMemo(
    () => Object.fromEntries(zoneIds.map((id) => [id, zoneColor(rollups[id], layer.value, draft[id]?.treatment)])),
    [zoneIds, rollups, layer.value, draft],
  );
  const selected = rollups[zoneId];
  const lead = selected?.requirements[0];
  const zone = manifest?.zones[zoneId];
  const selectedDraft = draft[zoneId] || {};
  const [viewRequest, setViewRequest] = useState({
    vehicle: scope.vehicle,
    mode: (requestedZone && manifest?.zones[requestedZone] ? "focus" : "overview") as "overview" | "focus",
    revision: 0,
  });
  const cameraView = useMemo(
    () => (viewRequest.vehicle === scope.vehicle ? viewRequest : { mode: "overview" as const, revision: 0 }),
    [scope.vehicle, viewRequest],
  );
  const moveCamera = (mode: "overview" | "focus") =>
    setViewRequest((previous) => ({ vehicle: scope.vehicle, mode, revision: previous.revision + 1 }));
  const signals = useQuery({
    queryKey: ["studio-signals", lead?.id, lead?.current_version_id, lead?.score_id],
    queryFn: ({ signal }) =>
      api<Trace>(
        `/requirements/${encodeURIComponent(lead!.id)}/trace?${new URLSearchParams({
          version_id: lead!.current_version_id,
          score_id: lead!.score_id,
          limit: "6",
          offset: "0",
        })}`,
        { signal },
      ),
    enabled: !!lead,
  });
  const sourceNames = new Map(signals.data?.sources.map((item) => [item.id, item.title]) || []);
  const quotes = signals.data?.evidence.items.slice(0, 3) || [];
  const configuredCount = Object.values(draft).filter((value) => value.treatment || value.note).length;

  useEffect(() => {
    // Keep the selected area centred in the rail without scrolling the page.
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>('[data-active="true"]');
    if (!rail || !chip) return;
    rail.scrollTo({ left: chip.offsetLeft - (rail.clientWidth - chip.clientWidth) / 2, behavior: "smooth" });
  }, [zoneId]);

  const selectZone = (id: string) => {
    moveCamera("focus");
    const params = new URLSearchParams(search.toString());
    params.set("zone", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const stepZone = (offset: number) => {
    if (zoneIds.length) selectZone(zoneIds[(zoneIndex + offset + zoneIds.length) % zoneIds.length]);
  };
  const changeDraft = (patch: Partial<Draft[string]>) => {
    setStoredDraft(JSON.stringify({ ...draft, [zoneId]: { ...selectedDraft, ...patch } }));
  };
  const exportDraft = () => {
    if (!manifest) return;
    const payload = {
      kind: "local-planning-scenario",
      exportedAt: new Date().toISOString(),
      vehicle: manifest.vehicle.code,
      market: manifest.vehicle.market,
      model: manifest.id,
      visualPaintPreview: paint,
      zones: Object.fromEntries(
        Object.entries(draft)
          .filter(([, value]) => value.treatment || value.note)
          .map(([id, value]) => [
            id,
            {
              ...value,
              topics: manifest.zones[id]?.topics || [],
              linkedRequirements: (rollups[id]?.requirements || []).map((item) => ({
                id: item.id,
                key: item.key,
                currentVersionId: item.current_version_id,
                scoreId: item.score_id,
              })),
            },
          ]),
      ),
      note: "Scenario only. No requirement version, score, decision or vehicle specification was changed.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${manifest.vehicle.code.toLowerCase()}-pm-scenario.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const requirementHref = (id: string) =>
    `${base}/twin?zone=${encodeURIComponent(zoneId)}&requirement=${encodeURIComponent(id)}&tab=evidence`;
  const tabs: [PanelTab, string][] = [
    ["plan", "Plan"],
    ["feedback", "Feedback"],
    ["requirements", `Requirements ${selected?.requirements.length || 0}`],
    ["specs", "Specs"],
  ];

  return (
    <div className="vehicle-studio">
      <Heading
        title="Vehicle studio"
        description="Pick an area on the car, read what customers say, then plan a response."
        action={
          <div className="studio-bar-controls">
            <nav className="studio-model-switch" aria-label="Vehicle model">
              {vehicleAssets.map((item) => (
                <Link
                  key={item.manifest.id}
                  href={`/${item.manifest.vehicle.code.toLowerCase()}/${item.manifest.vehicle.market.toLowerCase()}/twin`}
                  aria-current={asset?.manifest.id === item.manifest.id ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {manifest && (
              <button type="button" className="studio-export" onClick={exportDraft} disabled={!configuredCount}>
                <Download size={15} /> Download plan
              </button>
            )}
          </div>
        }
      />

      {!asset || !manifest ? (
        <section className="pm-panel studio-unavailable">
          <h2>
            A model for {scope.vehicle} / {scope.market} is coming soon
          </h2>
          <p>Explore the G60 or G70 in the US market using the model selector.</p>
        </section>
      ) : (
        <>
          <div className="studio-config">
            <section className="studio-stage" aria-label={`${scope.vehicle} 3D exploration`}>
              <div className="studio-canvas">
                <VehicleViewport
                  key={manifest.id}
                  asset={asset}
                  selectedZone={zoneId}
                  paint={paint}
                  responses={draft}
                  pinColors={pinColors}
                  onSelect={selectZone}
                  cameraView={cameraView}
                />

                <div className="studio-hud studio-hud-model">
                  <span className="studio-eyebrow">
                    {scope.vehicle === "G70" ? "THE 7" : "THE 5"} · {scope.market}
                  </span>
                  <h2>BMW {scope.vehicle === "G70" ? "i7" : "i5"}</h2>
                  <p>
                    {manifest.vehicle.variant.replace(/\s*\(.*\)$/, "")} · {manifest.vehicle.modelYear}
                  </p>
                </div>

                <div className="studio-hud studio-hud-layer">
                  <div className="studio-segmented" role="radiogroup" aria-label="Color areas by">
                    {layers.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        role="radio"
                        aria-checked={layer.value === item.value}
                        onClick={() => setLayer(item.value)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <ul className="studio-legend" aria-label={`${layer.label} legend`}>
                    {layer.legend.map((item) => (
                      <li key={item.label}>
                        <i style={{ background: item.color }} />
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="studio-hud studio-hud-tools">
                  <div className="studio-view-controls" aria-label="Camera view">
                    <button type="button" onClick={() => moveCamera("overview")} aria-label="Reset view to whole car">
                      <RotateCcw size={14} /> Whole car
                    </button>
                    <button type="button" onClick={() => moveCamera("focus")}>
                      <Focus size={14} /> Focus area
                    </button>
                  </div>
                  <div className="studio-paint-controls" role="group" aria-label="Paint preview">
                    <span>{paints.find((item) => item.value === paint)?.name || "Paint"}</span>
                    <div className="studio-swatches">
                      {paints.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          title={`${item.name} preview`}
                          aria-label={item.name}
                          aria-pressed={paint === item.value}
                          onClick={() => setPaint(item.value)}
                          style={{ "--swatch-color": item.value } as React.CSSProperties}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="studio-rail">
                <button type="button" className="studio-rail-step" onClick={() => stepZone(-1)} aria-label="Previous area">
                  <ChevronLeft size={16} />
                </button>
                <div className="studio-rail-track" ref={railRef} role="group" aria-label="Areas around the car">
                  {zoneIds.map((id) => {
                    const treatment = draft[id]?.treatment;
                    return (
                      <button
                        key={id}
                        type="button"
                        className="studio-chip"
                        data-active={id === zoneId}
                        aria-pressed={id === zoneId}
                        onClick={() => selectZone(id)}
                      >
                        <i style={{ background: pinColors[id] }} />
                        <span>
                          <strong>{zoneNames[id] || id}</strong>
                          <small>
                            {rollups[id]?.requirements.length || 0} req.
                            {treatment ? ` · ${treatments.find((item) => item.value === treatment)?.label}` : ""}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="studio-rail-step" onClick={() => stepZone(1)} aria-label="Next area">
                  <ChevronRight size={16} />
                </button>
              </div>
            </section>

            <aside className="studio-panel" aria-label="Selected area">
              <header className="studio-panel-head">
                <div>
                  <span className="studio-eyebrow">
                    AREA {String(zoneIndex + 1).padStart(2, "0")} OF {String(zoneIds.length).padStart(2, "0")}
                  </span>
                  <h2>{zoneNames[zoneId] || zoneId}</h2>
                </div>
                <div className="studio-panel-steps">
                  <button type="button" onClick={() => stepZone(-1)} aria-label="Previous area">
                    <ChevronLeft size={15} />
                  </button>
                  <button type="button" onClick={() => stepZone(1)} aria-label="Next area">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </header>

              <dl className="studio-rollup">
                <div>
                  <dt>Requirements</dt>
                  <dd>{selected?.requirements.length || 0}</dd>
                </div>
                <div>
                  <dt>Top priority</dt>
                  <dd>{selected?.topPriority == null ? "—" : selected.topPriority.toFixed(1)}</dd>
                </div>
                <div>
                  <dt>Lowest grade</dt>
                  <dd>{selected?.worstGrade || "—"}</dd>
                </div>
                <div>
                  <dt>Need review</dt>
                  <dd>{selected?.openReviews || 0}</dd>
                </div>
              </dl>

              <div className="studio-tabs" role="tablist" aria-label="Area detail">
                {tabs.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    id={`studio-tab-${value}`}
                    aria-controls="studio-tab-panel"
                    aria-selected={tab === value}
                    onClick={() => setTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div
                className="studio-panel-body"
                role="tabpanel"
                id="studio-tab-panel"
                aria-labelledby={`studio-tab-${tab}`}
                data-tab={tab}
              >
                {tab === "plan" && (
                  <>
                    <div className="studio-treatment-list" role="radiogroup" aria-label="Planning response">
                      {treatments.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          role="radio"
                          aria-checked={selectedDraft.treatment === item.value}
                          onClick={() =>
                            changeDraft({
                              treatment: selectedDraft.treatment === item.value ? undefined : item.value,
                            })
                          }
                          style={{ "--treatment-color": item.color } as React.CSSProperties}
                        >
                          <strong>
                            <i />
                            {item.label}
                          </strong>
                          <span>{item.detail}</span>
                        </button>
                      ))}
                    </div>
                    <label className="studio-note">
                      <span>Notes</span>
                      <textarea
                        value={selectedDraft.note || ""}
                        onChange={(event) => changeDraft({ note: event.target.value })}
                        placeholder="What would improve this experience?"
                        rows={4}
                      />
                    </label>
                    <p className="studio-fine">Saved in this browser. No requirement, score or decision changes.</p>
                  </>
                )}

                {tab === "feedback" && (
                  <div className="studio-signals">
                    {!lead ? (
                      <p>No customer feedback is linked to this area yet.</p>
                    ) : signals.isPending ? (
                      <p>Loading customer feedback…</p>
                    ) : signals.error ? (
                      <p role="alert">Feedback could not load. Open the requirement to view its sources.</p>
                    ) : (
                      quotes.map((item) => (
                        <blockquote key={item.id}>
                          <p>“{item.content}”</p>
                          <cite>
                            {sourceNames.get(item.source_id) || item.source_id} · {locationLabel(item.location)}
                          </cite>
                        </blockquote>
                      ))
                    )}
                    {lead && (
                      <Link href={requirementHref(lead.id)}>
                        View all supporting and conflicting feedback <ArrowUpRight size={14} />
                      </Link>
                    )}
                  </div>
                )}

                {tab === "requirements" &&
                  (!selected?.requirements.length ? (
                    <p className="studio-fine">
                      No requirements for this area in {scope.vehicle} / {scope.market} yet.
                    </p>
                  ) : (
                    <div className="studio-requirement-list">
                      {selected.requirements.map((item) => (
                        <Link key={item.id} href={requirementHref(item.id)}>
                          <span className="studio-requirement-top">
                            <span className="mono">{item.key}</span>
                            <ScoreLabel score={item.priority} grade={item.evidence_grade} />
                          </span>
                          <strong>{item.title}</strong>
                          <span className="studio-requirement-meta">
                            <Status value={item.status} />
                            {item.needs_review && <span className="studio-review-flag">Needs review</span>}
                            <ArrowUpRight size={14} />
                          </span>
                        </Link>
                      ))}
                      <Link
                        className="studio-register-link"
                        href={`${base}/requirements?topic=${encodeURIComponent(zone?.topics[0] || "")}`}
                      >
                        All requirements <ArrowUpRight size={14} />
                      </Link>
                    </div>
                  ))}

                {tab === "specs" && <VehicleConfigurator key={manifest.id} data={asset.configurator} />}
              </div>

              <footer className="studio-summary">
                <div className="studio-summary-head">
                  <span className="studio-eyebrow">YOUR PLAN</span>
                  <span>
                    {configuredCount} of {zoneIds.length} areas
                  </span>
                </div>
                <div className="studio-summary-strip">
                  {zoneIds.map((id) => {
                    const treatment = draft[id]?.treatment;
                    const label = `${zoneNames[id] || id}: ${treatment || (draft[id]?.note ? "note" : "no plan")}`;
                    return (
                      <button
                        key={id}
                        type="button"
                        data-active={id === zoneId}
                        data-noted={!treatment && !!draft[id]?.note}
                        title={label}
                        aria-label={label}
                        onClick={() => selectZone(id)}
                        style={{ background: treatment ? treatmentColors[treatment] : undefined }}
                      />
                    );
                  })}
                </div>
              </footer>
            </aside>
          </div>

          <footer className="studio-credit">
            <span>
              <a href={manifest.source.url} target="_blank" rel="noreferrer">
                {manifest.source.title}
              </a>{" "}
              by{" "}
              <a href={manifest.source.creatorUrl} target="_blank" rel="noreferrer">
                {manifest.source.creator}
              </a>{" "}
              ·{" "}
              <a href={manifest.licence.url} target="_blank" rel="noreferrer">
                CC BY 4.0
              </a>{" "}
              · Geometry and materials adapted · Requirement counts are not customer prevalence
            </span>
            <details>
              <summary>About this model</summary>
              <p>{manifest.vehicle.modelYearBasis}</p>
              <p>
                {manifest.interior
                  ? "The cabin and equipment use simplified artist geometry."
                  : "Cabin, cargo and battery markers use approximate positions on the exterior model."}{" "}
                Paint previews are illustrative. Planning notes stay in this browser until downloaded.
              </p>
              <a href={`${asset.base}/${manifest.licence.file}`}>View licence</a>
            </details>
          </footer>
        </>
      )}
    </div>
  );
}
