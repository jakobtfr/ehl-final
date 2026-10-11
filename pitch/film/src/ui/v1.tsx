import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, MONO, SANS } from "../theme";
import { Card, Cursor, Stage } from "./Stage";
import { Check, Count, FileIcon, Grade, Kicker, Pill, Rise, useProgress, useSpring } from "./kit";

/* Values come from the frozen G60 / US demo and its claim ledger. */

const files: { name: string; kind: "xlsx" | "pdf"; meta: string }[] = [
  { name: "G60_feedback_hackathon.xlsx", kind: "xlsx", meta: "Feedback_Explorer · customer feedback" },
  { name: "F70_G60_G68_G70_customer_studies.xlsx", kind: "xlsx", meta: "survey aggregates" },
  { name: "sales_volumes.xlsx", kind: "xlsx", meta: "market volumes" },
  { name: "G60_OptionList.PDF", kind: "pdf", meta: "official option list" },
];

export const ImportShot: React.FC = () => {
  const count = useProgress(4, 30);
  return (
    <Stage zoom={[1.55, 1.75]} tilt={[[10, 14], [6, 8]]} pan={[[-160, 150], [-90, 110]]} seed="import">
      <Card style={{ width: 1280, padding: "44px 52px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 26 }}>
          <Kicker>Sources & imports · G60 / US</Kicker>
          <div style={{ font: `300 92px ${SANS}`, color: C.ink, letterSpacing: "-0.02em" }}>
            <Count to={4365} p={count} />
            <span style={{ font: `400 26px ${SANS}`, color: C.muted, marginLeft: 16 }}>evidence rows</span>
          </div>
        </div>
        {files.map((f, i) => (
          <Rise key={f.name} delay={i * 3} y={30}>
            <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "18px 0", borderTop: `1px solid ${C.line}` }}>
              <FileIcon kind={f.kind} size={46} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `500 34px ${SANS}`, color: C.ink }}>{f.name}</div>
                <div style={{ font: `400 21px ${MONO}`, color: C.muted, marginTop: 4 }}>{f.meta}</div>
              </div>
              <Pill tone="green">Imported</Pill>
            </div>
          </Rise>
        ))}
      </Card>
    </Stage>
  );
};

export const EvidenceShot: React.FC = () => {
  const sweep = useProgress(8, 22);
  return (
    <Stage zoom={[1.75, 1.95]} tilt={[[4, -16], [2, -10]]} pan={[[300, 60], [200, 30]]} seed="evidence">
      <Card style={{ width: 1380, padding: "46px 56px" }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <FileIcon kind="xlsx" size={40} />
          <div style={{ font: `400 26px ${MONO}`, color: C.muted }}>G60_feedback_hackathon.xlsx</div>
          <div style={{ font: `400 26px ${MONO}`, color: C.faint }}>/ Feedback_Explorer /</div>
          <div style={{ font: `500 26px ${MONO}`, color: C.blue, background: C.blueSoft, padding: "2px 10px" }}>row 432</div>
        </div>
        <div style={{ font: `400 64px ${SANS}`, color: C.ink, lineHeight: 1.18, marginTop: 34, letterSpacing: "-0.01em" }}>
          Original customer feedback on{" "}
          <span style={{ position: "relative", whiteSpace: "nowrap" }}>
            <span style={{ position: "absolute", left: -6, right: -6, top: 8, bottom: 2, background: "rgba(28,105,212,0.16)", transform: `scaleX(${sweep})`, transformOrigin: "0 50%" }} />
            <span style={{ position: "relative" }}>charging availability</span>
          </span>
          , kept word for word.
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 34 }}>
          <Pill tone="grey">Source B</Pill>
          <Pill tone="grey">US</Pill>
          <Pill tone="blue">Linked to REQ-G60-US-001</Pill>
        </div>
      </Card>
    </Stage>
  );
};

export const RequirementShot: React.FC = () => {
  const p = useSpring(0);
  return (
    <Stage zoom={[1.5, 1.68]} tilt={[[12, 12], [7, 6]]} pan={[[300, 80], [220, 50]]} seed="req">
      <Card style={{ width: 1360, padding: "50px 58px", transform: `translateZ(${(1 - p) * -120}px)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Kicker size={24}>REQ-G60-US-001 · version 2</Kicker>
          <Pill tone="blue">Proposed</Pill>
        </div>
        <Rise delay={3}>
          <div style={{ font: `300 112px ${SANS}`, color: C.ink, letterSpacing: "-0.03em", marginTop: 22 }}>Improve charging experience</div>
        </Rise>
        <Rise delay={7}>
          <div style={{ display: "flex", gap: 46, marginTop: 30, font: `400 28px ${SANS}`, color: C.muted }}>
            <span>
              <b style={{ color: C.ink, fontWeight: 500 }}>264</b> linked evidence records
            </span>
            <span>
              <b style={{ color: C.ink, fontWeight: 500 }}>12</b> checked by hand
            </span>
            <span>
              <b style={{ color: C.ink, fontWeight: 500 }}>1</b> false positive kept visible
            </span>
          </div>
        </Rise>
      </Card>
    </Stage>
  );
};

export const ScoreShot: React.FC = () => {
  const n = useProgress(0, 22);
  const g = useSpring(14, 16);
  return (
    <Stage zoom={[1.75, 1.95]} tilt={[[6, -18], [3, -12]]} pan={[[360, 20], [270, 0]]} seed="score">
      <Card style={{ width: 1200, padding: "50px 60px" }}>
        <Kicker size={24}>Priority · versioned rubric · same inputs, same score</Kicker>
        <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 18 }}>
          <div style={{ font: `300 230px ${SANS}`, color: C.ink, letterSpacing: "-0.04em", lineHeight: 1 }}>
            <Count to={71.26} decimals={2} p={n} />
          </div>
          <div style={{ transform: `scale(${0.4 + g * 0.6})`, opacity: g }}>
            <Grade g="C" size={130} />
          </div>
          <div style={{ font: `400 26px ${SANS}`, color: C.muted, opacity: g, width: 220 }}>Evidence grade sits beside the score, never inside it.</div>
        </div>
        <div style={{ marginTop: 26, display: "flex", gap: 16, opacity: interpolate(useCurrentFrame(), [18, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          <Pill tone="amber">80% task success · PM assumption</Pill>
        </div>
      </Card>
    </Stage>
  );
};

const nodes = [
  { k: "Source", v: "Workbook row 432" },
  { k: "Finding", v: "Charging availability" },
  { k: "Requirement", v: "REQ-G60-US-001 v2" },
  { k: "Decision", v: "PM only" },
];

export const TraceShot: React.FC = () => {
  const line = useProgress(2, 26);
  return (
    <Stage zoom={[1.55, 1.65]} tilt={[[16, 0], [10, 0]]} pan={[[560, 0], [-520, 0]]} seed="trace">
      <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative" }}>
        <div style={{ position: "absolute", left: 160, right: 160, top: "50%", height: 4, background: C.line }} />
        <div style={{ position: "absolute", left: 160, width: `calc((100% - 320px) * ${line})`, top: "50%", height: 4, background: C.blue, boxShadow: "0 0 18px rgba(28,105,212,0.6)" }} />
        {nodes.map((n, i) => {
          const on = line >= i / (nodes.length - 1) - 0.02;
          return (
            <Rise key={n.k} delay={i * 4}>
              <Card style={{ width: 400, margin: "0 30px", padding: "30px 34px", borderTop: `4px solid ${on ? C.blue : C.line}` }}>
                <Kicker color={on ? C.blue : C.muted}>{`0${i + 1} · ${n.k}`}</Kicker>
                <div style={{ font: `400 38px ${SANS}`, color: C.ink, marginTop: 12 }}>{n.v}</div>
              </Card>
            </Rise>
          );
        })}
      </div>
    </Stage>
  );
};

export const ApproveShot: React.FC = () => {
  const frame = useCurrentFrame();
  const typed = "Trace checked. Target stays a PM assumption.";
  const chars = Math.floor(interpolate(frame, [0, 13], [0, typed.length], { extrapolateRight: "clamp" }));
  const move = useProgress(8, 18);
  const pressed = frame >= 18 && frame < 21;
  const done = frame >= 20;
  return (
    <Stage zoom={[1.85, 2.05]} tilt={[[4, 10], [2, 6]]} pan={[[-420, -230], [-520, -280]]} seed="approve">
      <Card style={{ width: 1300, padding: "42px 52px", position: "relative" }}>
        <Kicker>PM decision · exact version and score</Kicker>
        <div style={{ display: "flex", gap: 20, marginTop: 22, alignItems: "center" }}>
          <div style={{ width: 54, height: 54, background: C.graphite, color: "#fff", font: `500 28px ${SANS}`, display: "flex", alignItems: "center", justifyContent: "center" }}>T</div>
          <div style={{ font: `500 32px ${SANS}`, color: C.ink }}>Troy · Product manager</div>
        </div>
        <div style={{ border: `1px solid ${C.line}`, marginTop: 22, padding: "20px 24px", font: `400 32px ${SANS}`, color: C.ink, minHeight: 44 }}>
          {typed.slice(0, chars)}
          <span style={{ opacity: frame % 10 < 5 ? 1 : 0, color: C.blue }}>|</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 22, marginTop: 26 }}>
          {done ? (
            <Rise y={10} blur={4}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, font: `500 28px ${SANS}`, color: C.green }}>
                <Check /> Approved · written to the audit trail
              </div>
            </Rise>
          ) : null}
          <div
            style={{
              background: done ? C.green : C.blue,
              color: "#fff",
              font: `500 34px ${SANS}`,
              padding: "18px 40px",
              transform: `scale(${pressed ? 0.95 : 1})`,
              boxShadow: pressed ? "0 0 0 10px rgba(28,105,212,0.18)" : "none",
            }}
          >
            {done ? "Approved v2" : "Approve v2"}
          </div>
        </div>
        <Cursor x={interpolate(move, [0, 1], [700, 1090])} y={interpolate(move, [0, 1], [430, 300])} label="Troy · PM" pressed={pressed} />
      </Card>
    </Stage>
  );
};

export const ReviewShot: React.FC = () => {
  const n = useProgress(6, 20);
  return (
    <Stage zoom={[1.4, 1.56]} tilt={[[10, -12], [6, -8]]} pan={[[60, 0], [0, 0]]} seed="review">
      <div style={{ display: "flex", gap: 40, alignItems: "stretch" }}>
        <Rise delay={0}>
          <Card style={{ width: 560, padding: "40px 44px", opacity: 0.9 }}>
            <Kicker>v2 · approved · frozen</Kicker>
            <div style={{ font: `300 120px ${SANS}`, color: C.muted, marginTop: 12 }}>71.26</div>
            <Pill tone="green">Approved by PM</Pill>
          </Card>
        </Rise>
        <Rise delay={4}>
          <Card style={{ width: 660, padding: "40px 44px", borderTop: `4px solid ${C.amber}` }}>
            <Kicker color={C.amber}>New evidence · needs review · 1 of 11</Kicker>
            <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 12 }}>
              <div style={{ font: `300 120px ${SANS}`, color: C.ink }}>
                <Count from={71.26} to={71.33} decimals={2} p={n} />
              </div>
              <div style={{ font: `500 44px ${SANS}`, color: C.amber, opacity: n }}>+0.07</div>
            </div>
            <Pill tone="amber">PM reviews the change</Pill>
          </Card>
        </Rise>
      </div>
    </Stage>
  );
};
