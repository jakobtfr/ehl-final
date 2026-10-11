import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, MONO, SANS } from "../theme";
import { Card, Cursor, Stage } from "./Stage";
import { Check, Kicker, Pill, Rise, Spinner, useProgress, useSpring } from "./kit";

/* Registry, tasks and runs mirror GET /agents, /tasks and /runs on the integrated platform build. */

type Agent = { name: string; dept: string; level: string; model: string; caps: string[] };
const agents: Agent[] = [
  { name: "Feedback analyst", dept: "Customer insights", level: "A1", model: "openai · gpt-6-luna", caps: ["pipeline.analyze", "signals.score_sentiment"] },
  { name: "Trend scout", dept: "Market intelligence", level: "A1", model: "openai · gpt-6-luna", caps: ["signals.refresh_watchlist", "public_sources.web_research"] },
  { name: "Competitor analyst", dept: "Market intelligence", level: "A1", model: "openai · gpt-6-luna", caps: ["signals.backfill_watchlist"] },
  { name: "Market balancer", dept: "Market intelligence", level: "A1", model: "openai · gpt-6-luna", caps: ["markets.compare", "markets.detect_conflicts"] },
  { name: "Request triage", dept: "Requests", level: "A1", model: "openai · gpt-6-luna", caps: ["requests.cluster", "requests.triage"] },
  { name: "Requirement writer", dept: "Requirements", level: "A1", model: "openai · gpt-6-luna", caps: ["pipeline.generate_requirements"] },
  { name: "Scorer", dept: "Prioritisation", level: "A0", model: "Deterministic code", caps: ["priorities.rank", "priorities.sensitivity"] },
  { name: "Challenger", dept: "Quality", level: "A2", model: "openai · gpt-6-luna", caps: ["agents.challenge_requirement"] },
  { name: "Change watcher", dept: "Monitoring", level: "A2", model: "openai · gpt-6-luna", caps: ["pipeline.assess_updates"] },
  { name: "Comms drafter", dept: "Communications", level: "A3", model: "openai · gpt-6-luna", caps: ["agents.draft_communications"] },
  { name: "Research planner", dept: "Research", level: "A1", model: "openai · gpt-6-luna", caps: ["agents.research_brief"] },
];

const levelTone: Record<string, string> = { A0: C.blue, A1: C.blue, A2: C.amber, A3: "#7a4bc2" };

const Bot: React.FC<{ size?: number; color?: string }> = ({ size = 30, color = C.blue }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
    <rect x="4" y="8" width="16" height="12" />
    <path d="M12 8V4M8 13h.01M16 13h.01M9 17h6" strokeLinecap="square" />
  </svg>
);

const AgentCard: React.FC<{ a: Agent; scale?: number }> = ({ a, scale = 1 }) => (
  <Card style={{ width: 420 * scale, padding: `${26 * scale}px ${28 * scale}px` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14 * scale }}>
      <div style={{ width: 46 * scale, height: 46 * scale, background: C.blueSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Bot size={26 * scale} color={a.model.startsWith("Det") ? C.graphite : C.blue} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ font: `500 ${28 * scale}px ${SANS}`, color: C.ink }}>{a.name}</div>
        <div style={{ font: `400 ${19 * scale}px ${SANS}`, color: C.muted }}>{a.dept}</div>
      </div>
      <span style={{ font: `500 ${20 * scale}px ${MONO}`, color: levelTone[a.level], border: `1.5px solid ${levelTone[a.level]}`, padding: `${2 * scale}px ${8 * scale}px` }}>{a.level}</span>
    </div>
    <div style={{ font: `400 ${17 * scale}px ${MONO}`, color: C.muted, marginTop: 16 * scale }}>{a.model}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 * scale, marginTop: 12 * scale }}>
      {a.caps.map((c) => (
        <span key={c} style={{ font: `400 ${16 * scale}px ${MONO}`, color: C.ink, background: "#eef1f5", padding: `${3 * scale}px ${8 * scale}px` }}>
          {c}
        </span>
      ))}
    </div>
  </Card>
);

export const OrchestratorShot: React.FC = () => {
  const p = useSpring(0, 20);
  const lines = useProgress(8, 24);
  return (
    <Stage zoom={[1.75, 1.3]} tilt={[[14, 0], [10, 0]]} pan={[[0, 420], [0, 150]]} seed="orch">
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Card style={{ width: 980, padding: "40px 48px", transform: `scale(${0.85 + p * 0.15})`, opacity: p, borderTop: `5px solid ${C.blue}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ width: 72, height: 72, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={42} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <Kicker color={C.blue}>Orchestrator</Kicker>
              <div style={{ font: `400 52px ${SANS}`, color: C.ink, marginTop: 4 }}>PM chief of staff</div>
            </div>
            <span style={{ font: `500 30px ${MONO}`, color: C.blue, border: `2px solid ${C.blue}`, padding: "4px 12px" }}>A0</span>
          </div>
          <div style={{ font: `400 27px ${SANS}`, color: C.muted, marginTop: 20, lineHeight: 1.35 }}>
            Plans the work, sequences specialist agents through tasks and stops at every human gate.
          </div>
        </Card>
        <svg width="1500" height="220" style={{ marginTop: -2 }}>
          {[-600, -300, 0, 300, 600].map((dx, i) => (
            <path
              key={i}
              d={`M750 0 C 750 110, ${750 + dx} 110, ${750 + dx} 220`}
              fill="none"
              stroke={C.blue}
              strokeWidth="3"
              strokeDasharray="400"
              strokeDashoffset={400 * (1 - lines)}
              opacity={0.7}
            />
          ))}
        </svg>
        <div style={{ display: "flex", gap: 26 }}>
          {agents.slice(0, 5).map((a, i) => (
            <Rise key={a.name} delay={14 + i * 2}>
              <div style={{ filter: `blur(${Math.abs(i - 2) * 1.5}px)` }}>
                <AgentCard a={a} scale={0.66} />
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </Stage>
  );
};

export const AgentsGridShot: React.FC = () => (
  <Stage zoom={[2.1, 1.4]} tilt={[[18, -8], [12, -3]]} pan={[[-560, 300], [0, 40]]} seed="grid">
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 420px)", gap: 26 }}>
      {agents.slice(0, 11).map((a, i) => (
        <Rise key={a.name} delay={(i % 4) * 2 + Math.floor(i / 4) * 3} y={60}>
          <AgentCard a={a} />
        </Rise>
      ))}
      <Rise delay={12} y={60}>
        <Card style={{ width: 420, height: "100%", padding: 28, display: "flex", flexDirection: "column", justifyContent: "center", background: C.graphite, border: "none" }}>
          <Kicker color="#8fb4ec">Specialist agents</Kicker>
          <div style={{ font: `300 120px ${SANS}`, color: "#fff", lineHeight: 1 }}>11</div>
          <div style={{ font: `400 22px ${SANS}`, color: "#aab4c3" }}>bounded by registered capabilities</div>
        </Card>
      </Rise>
    </div>
  </Stage>
);

const tasks = [
  { cap: "public_sources.import_nhtsa", title: "Refresh official complaints and recalls", agent: "Feedback analyst", end: "ok" },
  { cap: "pipeline.assess_updates", title: "Reassess evidence against approved baselines", agent: "Change watcher", end: "ok" },
  { cap: "priorities.derive_inputs", title: "Derive priority inputs for current versions", agent: "Scorer", end: "ok" },
  { cap: "agents.challenge_requirement", title: "Challenge REQ-G60-US-008 before the PM decides", agent: "Challenger", end: "human" },
  { cap: "agents.draft_communications", title: "Draft audience messages · nothing is sent", agent: "Comms drafter", end: "ok" },
  { cap: "agents.morning_brief", title: "Compile the morning brief for the PM", agent: "Orchestrator", end: "ok" },
];

export const QueueShot: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage zoom={[1.6, 1.75]} tilt={[[8, 14], [5, 9]]} pan={[[320, 60], [200, 10]]} seed="queue">
      <Card style={{ width: 1500, padding: "36px 46px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <Kicker>Task queue · G60 / US</Kicker>
          <Kicker color={C.blue}>scheduler · live</Kicker>
        </div>
        {tasks.map((t, i) => {
          const start = 2 + i * 2.6;
          const state = frame < start ? "queued" : frame < start + 6 ? "running" : t.end === "human" ? "human" : "done";
          return (
            <Rise key={t.cap} delay={i * 1.5} y={20} blur={6}>
              <div style={{ display: "grid", gridTemplateColumns: "520px 1fr 230px", alignItems: "center", gap: 20, padding: "17px 0", borderTop: `1px solid ${C.line}` }}>
                <span style={{ font: `400 22px ${MONO}`, color: C.ink }}>{t.cap}</span>
                <span style={{ font: `400 26px ${SANS}`, color: C.muted, whiteSpace: "nowrap", overflow: "hidden" }}>
                  {t.title} <span style={{ color: C.faint }}>· {t.agent}</span>
                </span>
                <span style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
                  {state === "queued" ? <Pill tone="grey">Queued</Pill> : null}
                  {state === "running" ? (
                    <>
                      <Spinner /> <Pill tone="blue">Running</Pill>
                    </>
                  ) : null}
                  {state === "done" ? (
                    <>
                      <Check /> <Pill tone="green">Succeeded</Pill>
                    </>
                  ) : null}
                  {state === "human" ? <Pill tone="amber">Awaiting human</Pill> : null}
                </span>
              </div>
            </Rise>
          );
        })}
      </Card>
    </Stage>
  );
};

const apps = [
  { name: "Claude", file: "claude.svg" },
  { name: "ChatGPT", file: "chatgpt.svg" },
  { name: "Microsoft Teams", file: "teams.svg" },
  { name: "Excel", file: "excel.svg" },
  { name: "Outlook", file: "outlook.svg" },
  { name: "SharePoint", file: "sharepoint.svg" },
  { name: "Jira", file: "jira.svg" },
  { name: "Power BI", file: "powerbi.svg" },
];

export const IntegrationsShot: React.FC = () => {
  const frame = useCurrentFrame();
  const hub = useSpring(0, 18);
  const R = 400;
  return (
    <Stage zoom={[1.45, 1.15]} tilt={[[20, 0], [14, 0]]} pan={[[0, 80], [0, 20]]} seed="apps">
      <div style={{ position: "relative", width: 1400, height: 1000 }}>
        <svg width="1400" height="1000" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {apps.map((a, i) => {
            const ang = (i / apps.length) * Math.PI * 2 - Math.PI / 2;
            const x = 700 + Math.cos(ang) * R * 1.45;
            const y = 500 + Math.sin(ang) * R;
            const p = interpolate(frame, [6 + i * 2, 14 + i * 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const pulse = ((frame * 0.05 + i * 0.13) % 1);
            return (
              <g key={a.name} opacity={p}>
                <line x1={700} y1={500} x2={x} y2={y} stroke={C.blue} strokeWidth="2.5" opacity="0.35" />
                <circle cx={700 + (x - 700) * pulse} cy={500 + (y - 500) * pulse} r="7" fill={C.blue} />
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", left: 700, top: 500, transform: `translate(-50%, -50%) scale(${0.6 + hub * 0.4})`, opacity: hub }}>
          <Card style={{ width: 360, padding: "30px 30px", textAlign: "center", borderTop: `5px solid ${C.blue}` }}>
            <Img src={staticFile("brand/bmw-grey.svg")} style={{ width: 84, height: 84 }} />
            <div style={{ font: `500 30px ${SANS}`, color: C.ink, marginTop: 10 }}>Product Intelligence</div>
            <div style={{ font: `400 20px ${MONO}`, color: C.blue, marginTop: 8, letterSpacing: "0.12em" }}>MCP · API</div>
          </Card>
        </div>
        {apps.map((a, i) => {
          const ang = (i / apps.length) * Math.PI * 2 - Math.PI / 2;
          const x = 700 + Math.cos(ang) * R * 1.45;
          const y = 500 + Math.sin(ang) * R;
          return (
            <div key={a.name} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)" }}>
              <Rise delay={4 + i * 2} y={50}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <Card style={{ width: 150, height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Img src={staticFile(`logos/${a.file}`)} style={{ width: 92, height: 92, objectFit: "contain" }} />
                  </Card>
                  <div style={{ font: `500 26px ${SANS}`, color: C.ink, whiteSpace: "nowrap" }}>{a.name}</div>
                </div>
              </Rise>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

const runs = [
  ["agents.morning_brief", "Orchestrator", "morning-brief-v1"],
  ["agents.challenge_requirement", "Challenger", "challenge-rules-v1"],
  ["priorities.rank", "Scorer", "priority-ranking-v1"],
  ["pipeline.assess_updates", "Change watcher", "keyword-rules-v1"],
  ["public_sources.web_research", "Trend scout", "public-web-research-v1"],
  ["agents.research_brief", "Research planner", "research-gaps-v1"],
  ["markets.compare", "Market balancer", "market-balance-v1"],
];

export const RunsShot: React.FC = () => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [0, 30], [0, -120]);
  return (
    <Stage zoom={[1.75, 1.9]} tilt={[[6, -16], [4, -11]]} pan={[[280, 120], [220, 40]]} seed="runs">
      <Card style={{ width: 1300, padding: "34px 44px", overflow: "hidden", height: 640 }}>
        <Kicker>Recorded runs · every call inspectable</Kicker>
        <div style={{ transform: `translateY(${scroll}px)`, marginTop: 16 }}>
          {runs.map(([cap, who, method], i) => (
            <Rise key={cap} delay={i * 2} y={24} blur={6}>
              <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 0", borderTop: `1px solid ${C.line}` }}>
                <Check size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ font: `400 28px ${MONO}`, color: C.ink }}>{cap}</div>
                  <div style={{ font: `400 21px ${SANS}`, color: C.muted, marginTop: 2 }}>
                    {who} · {method} · input hash {(((i + 3) * 2654435761) >>> 0).toString(16).slice(0, 8)}…
                  </div>
                </div>
                <Pill tone="green">Succeeded</Pill>
              </div>
            </Rise>
          ))}
        </div>
      </Card>
    </Stage>
  );
};

export const GateShot: React.FC = () => {
  const frame = useCurrentFrame();
  const move = useProgress(4, 16);
  const pressed = frame >= 16 && frame < 19;
  const done = frame >= 18;
  return (
    <Stage zoom={[1.8, 2.0]} tilt={[[4, 12], [2, 7]]} pan={[[-240, -60], [-380, -120]]} seed="gate">
      <Card style={{ width: 1280, padding: "42px 52px", position: "relative", borderTop: `5px solid ${done ? C.green : C.amber}` }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Kicker color={done ? C.green : C.amber}>{done ? "Human gate · decided by PM" : "Human gate · awaiting human"}</Kicker>
          <Kicker>Challenger · A2</Kicker>
        </div>
        <div style={{ font: `300 60px ${SANS}`, color: C.ink, marginTop: 18, letterSpacing: "-0.01em" }}>Challenge REQ-G60-US-008 before the PM decides</div>
        <div style={{ display: "flex", gap: 14, marginTop: 22 }}>
          <Pill tone="red">AI approval refused by the API</Pill>
          <Pill tone="grey">Proposal only</Pill>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
          <div style={{ background: done ? C.green : C.blue, color: "#fff", font: `500 34px ${SANS}`, padding: "18px 40px", transform: `scale(${pressed ? 0.95 : 1})`, boxShadow: pressed ? "0 0 0 10px rgba(28,105,212,0.18)" : "none", display: "flex", gap: 12, alignItems: "center" }}>
            {done ? (
              <>
                <Check color="#fff" /> Reviewed
              </>
            ) : (
              "Review proposal"
            )}
          </div>
        </div>
        <Cursor x={interpolate(move, [0, 1], [640, 1060])} y={interpolate(move, [0, 1], [420, 330])} label="Troy · PM" pressed={pressed} />
      </Card>
    </Stage>
  );
};
