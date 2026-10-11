import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C, ease } from "../theme";

/**
 * Light, macro "product" stage in the spirit of the reference trailer: cool white void,
 * a soft floor, drifting square particles at several depths, and a slow camera move.
 */
export const Stage: React.FC<{
  children: React.ReactNode;
  /** Camera scale at the start and end of the shot. */
  zoom?: [number, number];
  /** Camera pan in px at start and end. */
  pan?: [[number, number], [number, number]];
  /** Perspective tilt in degrees [rotateX, rotateY] at start and end. */
  tilt?: [[number, number], [number, number]];
  dark?: boolean;
  particles?: number;
  seed?: string;
}> = ({ children, zoom = [1, 1.08], pan = [[0, 0], [0, 0]], tilt = [[8, -10], [5, -6]], dark = false, particles = 46, seed = "s" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const s = interpolate(t, [0, 1], zoom);
  const x = interpolate(t, [0, 1], [pan[0][0], pan[1][0]]);
  const y = interpolate(t, [0, 1], [pan[0][1], pan[1][1]]);
  const rx = interpolate(t, [0, 1], [tilt[0][0], tilt[1][0]]);
  const ry = interpolate(t, [0, 1], [tilt[0][1], tilt[1][1]]);
  const bg = dark
    ? `radial-gradient(120% 90% at 50% 35%, #1a2230 0%, #0c1016 60%, #07090c 100%)`
    : `radial-gradient(120% 90% at 50% 30%, #ffffff 0%, ${C.bg} 45%, ${C.bg2} 100%)`;

  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <Floor dark={dark} frame={frame} />
      <Particles count={particles} seed={seed} frame={frame} dark={dark} layer="back" />
      <AbsoluteFill style={{ perspective: 1600, perspectiveOrigin: "50% 40%" }}>
        <AbsoluteFill
          style={{
            transform: `translate(${x}px, ${y}px) scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg)`,
            transformStyle: "preserve-3d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          backdropFilter: "blur(9px)",
          WebkitBackdropFilter: "blur(9px)",
          maskImage: "radial-gradient(62% 58% at 50% 48%, transparent 45%, black 100%)",
          WebkitMaskImage: "radial-gradient(62% 58% at 50% 48%, transparent 45%, black 100%)",
        }}
      />
      <Particles count={Math.round(particles / 3)} seed={seed + "f"} frame={frame} dark={dark} layer="front" />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: dark
            ? "radial-gradient(90% 80% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)"
            : "radial-gradient(90% 80% at 50% 45%, transparent 60%, rgba(120,132,150,0.18) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const Floor: React.FC<{ dark: boolean; frame: number }> = ({ dark, frame }) => (
  <AbsoluteFill style={{ perspective: 900 }}>
    <div
      style={{
        position: "absolute",
        left: "-50%",
        right: "-50%",
        top: "58%",
        height: "120%",
        transform: `rotateX(78deg) translateY(${-(frame * 2) % 80}px)`,
        transformOrigin: "50% 0%",
        backgroundImage: `linear-gradient(${dark ? "rgba(90,140,220,0.16)" : "rgba(28,105,212,0.10)"} 1px, transparent 1px), linear-gradient(90deg, ${dark ? "rgba(90,140,220,0.16)" : "rgba(28,105,212,0.10)"} 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 70%)",
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 70%)",
      }}
    />
  </AbsoluteFill>
);

const Particles: React.FC<{ count: number; seed: string; frame: number; dark: boolean; layer: "back" | "front" }> = ({ count, seed, frame, dark, layer }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {Array.from({ length: count }, (_, i) => {
      const r = (k: string) => random(`${seed}-${layer}-${i}-${k}`);
      const depth = layer === "front" ? 0.85 + r("d") * 0.15 : r("d") * 0.8;
      const size = layer === "front" ? 18 + r("s") * 30 : 4 + depth * 14;
      const blur = layer === "front" ? 10 + r("b") * 10 : Math.abs(depth - 0.45) * 9;
      const speed = 0.25 + depth * 1.1;
      const x = ((r("x") * 2100 + frame * speed * (r("dir") > 0.5 ? 1 : -1) * 1.4) % 2100 + 2100) % 2100 - 90;
      const y = r("y") * 1080 - frame * speed * 0.5;
      const blue = r("c") > 0.55;
      const fill = dark
        ? blue ? "rgba(70,140,240,0.75)" : "rgba(200,215,235,0.35)"
        : blue ? "rgba(28,105,212,0.55)" : "rgba(150,165,185,0.45)";
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: ((y % 1180) + 1180) % 1180 - 50,
            width: size,
            height: size,
            background: fill,
            filter: `blur(${blur}px)`,
            opacity: layer === "front" ? 0.5 : 0.35 + depth * 0.5,
            transform: `rotate(${r("rot") * 20}deg)`,
          }}
        />
      );
    })}
  </AbsoluteFill>
);

/** Square, hairline product card as used across the app. */
export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; dark?: boolean }> = ({ children, style, dark }) => (
  <div
    style={{
      background: dark ? "#151b24" : C.surface,
      border: `1px solid ${dark ? "#263040" : C.line}`,
      boxShadow: dark ? "0 40px 90px rgba(0,0,0,0.5)" : "0 30px 80px rgba(30,45,70,0.14), 0 4px 14px rgba(30,45,70,0.06)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Arrow cursor with a name tag, like a multiplayer cursor. */
export const Cursor: React.FC<{ x: number; y: number; label?: string; pressed?: boolean }> = ({ x, y, label, pressed }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `scale(${pressed ? 0.88 : 1})`, transformOrigin: "0 0", zIndex: 50 }}>
    <svg width="44" height="52" viewBox="0 0 22 26" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.25))" }}>
      <path d="M1 1 L1 20 L6 15.5 L9.5 24 L13 22.5 L9.6 14.3 L16 14.3 Z" fill="#0f141b" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
    {label ? (
      <div style={{ position: "absolute", left: 34, top: 40, background: "#0f141b", color: "#fff", font: "500 22px Barlow", padding: "4px 10px", whiteSpace: "nowrap" }}>{label}</div>
    ) : null}
  </div>
);
