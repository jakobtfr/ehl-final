import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, SANS, ease } from "./theme";
import { useSpring } from "./ui/kit";

/** Full-frame live-action shot with a light grade, a slow push and a vignette. */
export const Footage: React.FC<{ src: string; trim?: number; push?: number; rate?: number }> = ({ src, trim = 0, push = 0.06, rate = 1 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const s = 1.02 + push * (frame / Math.max(1, durationInFrames));
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={Math.round(trim * fps)}
        playbackRate={rate}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${s})`, filter: "contrast(1.08) saturate(0.92) brightness(0.98)" }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(85% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.5) 100%)" }} />
      <Grain />
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: 0.07,
        mixBlendMode: "overlay",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        backgroundPosition: `${random(`g${frame}`) * 220}px ${random(`h${frame}`) * 220}px`,
      }}
    />
  );
};

/** "V1" / "V2" slam card. V2 inverts to graphite to read as the second revolution. */
export const VersionCard: React.FC<{ v: string; line: string; dark?: boolean }> = ({ v, line, dark }) => {
  const frame = useCurrentFrame();
  const p = useSpring(0, 18);
  const sub = useSpring(6, 24);
  const shake = frame < 8 ? (random(`sh${frame}`) - 0.5) * 18 * (1 - frame / 8) : 0;
  const flash = interpolate(frame, [0, 5], [1, 0], { extrapolateRight: "clamp" });
  const fg = dark ? "#ffffff" : C.ink;
  return (
    <AbsoluteFill
      style={{
        background: dark ? "radial-gradient(80% 70% at 50% 45%, #13233d 0%, #0a0e14 55%, #050608 100%)" : "radial-gradient(90% 80% at 50% 40%, #ffffff 0%, #eef1f5 100%)",
        alignItems: "center",
        justifyContent: "center",
        transform: `translate(${shake}px, ${shake * 0.6}px)`,
      }}
    >
      {dark ? <Rays frame={frame} /> : null}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            font: `300 470px ${SANS}`,
            letterSpacing: "-0.06em",
            color: fg,
            lineHeight: 0.9,
            transform: `scale(${1.5 - p * 0.5})`,
            filter: `blur(${(1 - p) * 30}px)`,
            opacity: Math.min(1, p * 2),
            textShadow: dark ? "0 0 80px rgba(60,130,240,0.55)" : "none",
          }}
        >
          {v}
        </div>
        <div style={{ width: 140 * sub, height: 4, background: C.blue, marginTop: 34 }} />
        <div style={{ font: `400 38px ${MONO}`, letterSpacing: "0.32em", textTransform: "uppercase", color: dark ? "#9db9e6" : C.muted, marginTop: 30, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
          {line}
        </div>
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: flash * (dark ? 1 : 0.6) }} />
    </AbsoluteFill>
  );
};

const Rays: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ overflow: "hidden" }}>
    {Array.from({ length: 26 }, (_, i) => {
      const y = random(`ry${i}`) * 1080;
      const len = 300 + random(`rl${i}`) * 700;
      const speed = 40 + random(`rs${i}`) * 60;
      const x = ((random(`rx${i}`) * 2400 + frame * speed) % 2800) - 600;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: len,
            height: 2 + random(`rh${i}`) * 2,
            background: "linear-gradient(90deg, transparent, rgba(80,150,255,0.85), transparent)",
            filter: "blur(1px)",
            opacity: 0.5,
          }}
        />
      );
    })}
  </AbsoluteFill>
);

/** A real capture of the running app, tilted in space with a slow push. */
export const Screen: React.FC<{ file: string; crop?: { x: number; y: number; scale: number }; tilt?: [number, number]; label?: string }> = ({ file, crop = { x: 50, y: 0, scale: 1 }, tilt = [10, -12], label }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { easing: ease });
  return (
    <AbsoluteFill style={{ background: "radial-gradient(110% 90% at 50% 30%, #ffffff 0%, #e9edf2 100%)", perspective: 1800, overflow: "hidden" }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 1600,
            height: 1000,
            overflow: "hidden",
            boxShadow: "0 50px 120px rgba(20,35,60,0.28)",
            transform: `scale(${crop.scale * (1 + t * 0.07)}) rotateX(${tilt[0] * (1 - t * 0.4)}deg) rotateY(${tilt[1] * (1 - t * 0.4)}deg)`,
            transformOrigin: `${crop.x}% ${crop.y}%`,
          }}
        >
          <Img src={staticFile(`captures/${file}`)} style={{ width: 1600, height: 1000 }} />
        </div>
      </AbsoluteFill>
      {label ? (
        <div style={{ position: "absolute", left: 80, bottom: 70, font: `400 26px ${MONO}`, letterSpacing: "0.16em", textTransform: "uppercase", color: C.ink, background: "rgba(255,255,255,0.85)", padding: "8px 14px" }}>
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const EndCard: React.FC = () => {
  const a = useSpring(2, 26);
  const b = useSpring(20, 26);
  const c = useSpring(44, 26);
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [80, 90], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line = (p: number): React.CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 24}px)`, filter: `blur(${(1 - p) * 10}px)` });
  return (
    <AbsoluteFill style={{ background: "#050608", alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ font: `300 104px ${SANS}`, color: "#fff", letterSpacing: "-0.02em", ...line(a) }}>Agents prepare.</div>
        <div style={{ font: `300 104px ${SANS}`, color: "#fff", letterSpacing: "-0.02em", marginTop: 6, ...line(b) }}>
          Product managers <span style={{ color: "#5b9bf0" }}>decide.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginTop: 70, ...line(c) }}>
          <Img src={staticFile("brand/bmw-white.svg")} style={{ width: 66, height: 66 }} />
          <div style={{ textAlign: "left" }}>
            <div style={{ font: `500 34px ${SANS}`, color: "#fff" }}>BMW Product Intelligence</div>
            <div style={{ font: `400 18px ${MONO}`, color: "#8a94a3", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 4 }}>Evidence to decision</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Black: React.FC = () => <AbsoluteFill style={{ background: "#000" }} />;

/** Short white flash used on hard transitions. */
export const Flash: React.FC<{ frames?: number }> = ({ frames = 6 }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [0, frames], [0.9, 0], { extrapolateRight: "clamp" }) }} />;
};
