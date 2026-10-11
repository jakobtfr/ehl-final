import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { beat as b, fontFaces } from "./theme";
import { F } from "./footage";
import { Black, EndCard, Flash, Footage, Screen, VersionCard } from "./scenes";
import { ApproveShot, EvidenceShot, ImportShot, RequirementShot, ReviewShot, ScoreShot, TraceShot } from "./ui/v1";
import { AgentsGridShot, GateShot, IntegrationsShot, OrchestratorShot, QueueShot, RunsShot } from "./ui/v2";

type Cut = { from: number; to: number; el: React.ReactNode; flash?: boolean };

const shot = (k: keyof typeof F, push?: number) => <Footage {...F[k]} push={push} />;

/** The edit. Every boundary sits on the 143.5 BPM grid (see theme.ts). */
export const CUTS: Cut[] = [
  // 0–5 s · cold open: engine on, then accelerating cuts.
  { from: 0, to: b(0), el: shot("open1", 0.1) },
  { from: b(0), to: b(2), el: shot("open2") },
  { from: b(2), to: b(4), el: shot("open3") },
  { from: b(4), to: b(6), el: shot("open4") },
  { from: b(6), to: b(7), el: shot("open5") },
  { from: b(7), to: b(8), el: shot("open6") },
  { from: b(8), to: b(9), el: shot("open7") },

  // 5–15 s · V1, the product management pipeline.
  { from: b(9), to: b(11), el: <VersionCard v="V1" line="The product management pipeline" /> },
  { from: b(11), to: b(13), el: <ImportShot /> },
  { from: b(13), to: b(15), el: <EvidenceShot /> },
  { from: b(15), to: b(16), el: shot("v1a") },
  { from: b(16), to: b(18), el: <RequirementShot /> },
  { from: b(18), to: b(20), el: <ScoreShot /> },
  { from: b(20), to: b(21), el: shot("v1factory") },
  { from: b(21), to: b(23), el: <TraceShot /> },
  { from: b(23), to: b(25), el: <ApproveShot /> },
  { from: b(25), to: b(26), el: shot("v1b") },
  { from: b(26), to: b(28), el: <ReviewShot /> },
  { from: b(28), to: b(30), el: <Screen file="g60_us.png" crop={{ x: 30, y: 10, scale: 1.25 }} tilt={[12, -14]} /> },
  { from: b(30), to: b(30.5), el: <Screen file="g60_us_requirements.png" crop={{ x: 40, y: 30, scale: 1.3 }} tilt={[8, 12]} /> },
  { from: b(30.5), to: b(31), el: <Screen file="g60_us_priorities.png" crop={{ x: 50, y: 60, scale: 1.3 }} tilt={[8, -12]} /> },
  { from: b(31), to: b(31.5), el: <Screen file="g60_us_markets.png" crop={{ x: 40, y: 40, scale: 1.3 }} tilt={[8, 12]} /> },
  { from: b(31.5), to: b(32), el: <Screen file="g60_us_signals.png" crop={{ x: 50, y: 50, scale: 1.3 }} tilt={[8, -12]} /> },
  { from: b(32), to: b(33), el: <Black /> },

  // 15–27 s · V2, the multi-agent system on top of the deterministic pipeline.
  { from: b(33), to: b(36), el: <VersionCard v="V2" line="The multi-agent system" dark /> },
  { from: b(36), to: b(38), el: <OrchestratorShot /> },
  { from: b(38), to: b(40), el: <AgentsGridShot /> },
  { from: b(40), to: b(41), el: shot("v2a") },
  { from: b(41), to: b(43), el: <QueueShot /> },
  { from: b(43), to: b(44), el: shot("v2factory") },
  { from: b(44), to: b(48), el: <IntegrationsShot /> },
  { from: b(48), to: b(50), el: <RunsShot /> },
  { from: b(50), to: b(51), el: shot("v2b") },
  { from: b(51), to: b(53), el: <GateShot /> },
  { from: b(53), to: b(55), el: <Screen file="g60_us_agents.png" crop={{ x: 30, y: 20, scale: 1.3 }} tilt={[12, 14]} /> },
  // Climax: one beat per shot.
  { from: b(55), to: b(56), el: shot("climax1"), flash: true },
  { from: b(56), to: b(57), el: shot("climax2") },
  { from: b(57), to: b(58), el: shot("climax3") },
  { from: b(58), to: b(59), el: shot("climax4") },
  { from: b(59), to: b(60), el: shot("climax5") },
  { from: b(60), to: 810, el: <Black /> },

  // 27–30 s · close.
  { from: 810, to: 900, el: <EndCard /> },
];

type Sfx = { at: number; id: string; vol?: number };
export const SFX: Sfx[] = [
  { at: 0, id: "engine-start", vol: 0.7 },
  { at: b(0) - 4, id: "flyby-1", vol: 0.6 },
  { at: b(2) - 2, id: "downshift", vol: 0.5 },
  { at: b(4) - 2, id: "drift", vol: 0.45 },
  { at: b(7) - 3, id: "rev-crackle", vol: 0.6 },
  { at: b(9), id: "impact", vol: 0.7 },
  { at: b(11) - 6, id: "whoosh-1", vol: 0.5 },
  { at: b(11) + 2, id: "blips", vol: 0.35 },
  { at: b(15) - 3, id: "flyby-2", vol: 0.55 },
  { at: b(18), id: "blips", vol: 0.35 },
  { at: b(23), id: "typing", vol: 0.35 },
  { at: b(23) + 18, id: "click", vol: 0.8 },
  { at: b(28) - 6, id: "whoosh-2", vol: 0.5 },
  { at: b(30.5) - 50, id: "riser", vol: 0.4 },
  { at: b(33), id: "braam", vol: 1 },
  { at: b(33), id: "impact", vol: 1 },
  { at: b(36) - 6, id: "whoosh-1", vol: 0.5 },
  { at: b(40) - 4, id: "flyby-1", vol: 0.6 },
  { at: b(41), id: "blips", vol: 0.35 },
  { at: b(44) - 6, id: "whoosh-2", vol: 0.5 },
  { at: b(50) - 3, id: "rev-crackle", vol: 0.5 },
  { at: b(51) + 16, id: "click", vol: 0.8 },
  { at: b(55) - 4, id: "flyby-2", vol: 0.8 },
  { at: b(57) - 3, id: "drift", vol: 0.6 },
  { at: b(59) - 3, id: "downshift", vol: 0.7 },
  { at: 810, id: "impact", vol: 1 },
  { at: 806, id: "final-rev", vol: 0.85 },
];

const Music: React.FC = () => {
  const frame = useCurrentFrame();
  // Duck the bed slightly under the cold-open engine sounds.
  const vol = interpolate(frame, [0, 140, 150, 900], [0.6, 0.7, 1, 1], { extrapolateRight: "clamp" });
  return <Audio src={staticFile("audio/music-edit.wav")} volume={vol} />;
};

export const Film: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <style>{fontFaces}</style>
    {CUTS.map((c, i) => (
      <Sequence key={i} from={c.from} durationInFrames={c.to - c.from} name={`cut ${i}`}>
        {c.el}
        {c.flash ? <Flash /> : null}
      </Sequence>
    ))}
    <Music />
    {SFX.map((s, i) => (
      <Sequence key={`s${i}`} from={Math.max(0, s.at)} name={`sfx ${s.id}`}>
        <Audio src={staticFile(`audio/${s.id}.mp3`)} volume={s.vol ?? 1} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
