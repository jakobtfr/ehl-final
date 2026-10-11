import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, SANS, ease } from "../theme";

/** 0→1 progress between two local frames with the house ease. */
export const useProgress = (from: number, to: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
};

export const useSpring = (delay = 0, damping = 24) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay + 4, fps, config: { damping, stiffness: 170, mass: 0.8 } });
};

/** Element that rises and sharpens into place. */
export const Rise: React.FC<{ delay?: number; children: React.ReactNode; y?: number; style?: React.CSSProperties; blur?: number }> = ({
  delay = 0,
  children,
  y = 40,
  style,
  blur = 12,
}) => {
  const p = useSpring(delay);
  return (
    <div style={{ opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * y}px)`, filter: `blur(${(1 - p) * blur}px)`, ...style }}>
      {children}
    </div>
  );
};

export const Kicker: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({ children, color = C.muted, size = 22, style }) => (
  <div style={{ font: `400 ${size}px ${MONO}`, letterSpacing: "0.16em", textTransform: "uppercase", color, ...style }}>{children}</div>
);

export const Pill: React.FC<{ children: React.ReactNode; tone?: "blue" | "amber" | "green" | "grey" | "red"; size?: number }> = ({ children, tone = "blue", size = 22 }) => {
  const tones = {
    blue: [C.blue, C.blueSoft],
    amber: [C.amber, C.amberSoft],
    green: [C.green, C.greenSoft],
    grey: [C.muted, "#eef1f5"],
    red: ["#b3261e", "#fbeae9"],
  } as const;
  const [fg, bg] = tones[tone];
  return (
    <span style={{ font: `500 ${size}px ${SANS}`, color: fg, background: bg, border: `1px solid ${fg}33`, padding: `${size * 0.22}px ${size * 0.55}px`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
};

/** Square evidence-grade chip, as shown beside every priority score. */
export const Grade: React.FC<{ g: string; size?: number }> = ({ g, size = 60 }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      border: `2px solid ${C.amber}`,
      color: C.amber,
      background: C.amberSoft,
      font: `500 ${size * 0.6}px ${SANS}`,
    }}
  >
    {g}
  </span>
);

export const Check: React.FC<{ size?: number; color?: string }> = ({ size = 28, color = C.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="square" />
  </svg>
);

export const Spinner: React.FC<{ size?: number }> = ({ size = 26 }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${frame * 18}deg)` }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={C.line} strokeWidth="2.5" />
      <path d="M12 3 A9 9 0 0 1 21 12" fill="none" stroke={C.blue} strokeWidth="2.5" />
    </svg>
  );
};

/** Animated number with fixed decimals. */
export const Count: React.FC<{ to: number; from?: number; decimals?: number; p: number; grouping?: boolean }> = ({ to, from = 0, decimals = 0, p, grouping = true }) => {
  const v = from + (to - from) * p;
  return <>{v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping })}</>;
};

export const FileIcon: React.FC<{ kind: "xlsx" | "pdf"; size?: number }> = ({ kind, size = 56 }) => (
  <svg width={size} height={size * 1.2} viewBox="0 0 40 48">
    <path d="M2 2 H27 L38 13 V46 H2 Z" fill="#fff" stroke={C.line} strokeWidth="2" />
    <path d="M27 2 V13 H38" fill="none" stroke={C.line} strokeWidth="2" />
    <rect x="6" y="28" width="28" height="12" fill={kind === "xlsx" ? C.green : "#b3261e"} />
    <text x="20" y="37.5" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8.5" fill="#fff">
      {kind.toUpperCase()}
    </text>
  </svg>
);
