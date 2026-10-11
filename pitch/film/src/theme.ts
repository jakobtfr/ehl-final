import { Easing, staticFile } from "remotion";

export const FPS = 30;
export const DURATION = 900;

/** Tokens mirror web/DESIGN.md: graphite, cool white, hairlines, one BMW-inspired blue. */
export const C = {
  bg: "#f3f5f8",
  bg2: "#e6eaf0",
  surface: "#ffffff",
  ink: "#0f141b",
  muted: "#6b7480",
  faint: "#a3abb6",
  line: "#dfe4ea",
  blue: "#1c69d4",
  blueSoft: "#e8f0fb",
  graphite: "#11161d",
  amber: "#a96a27",
  amberSoft: "#fbf1e4",
  green: "#247266",
  greenSoft: "#e5f2ef",
};

export const SANS = "Barlow, 'Helvetica Neue', Arial, sans-serif";
export const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

/**
 * Music is 143.5 BPM and is offset by 1.1 s so its drop lands on frame 450.
 * Every cut is expressed in beats so the edit stays on the grid.
 */
export const BEAT = 12.5435;
export const PHASE = 36.15;
export const beat = (k: number) => Math.round(PHASE + BEAT * k);
export const MUSIC_OFFSET = 33;

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export const fontFaces = `
@font-face { font-family: Barlow; font-weight: 300; src: url(${staticFile("fonts/barlow-latin-300-normal.woff2")}) format("woff2"); }
@font-face { font-family: Barlow; font-weight: 400; src: url(${staticFile("fonts/barlow-latin-400-normal.woff2")}) format("woff2"); }
@font-face { font-family: Barlow; font-weight: 500; src: url(${staticFile("fonts/barlow-latin-500-normal.woff2")}) format("woff2"); }
@font-face { font-family: Barlow; font-weight: 600; src: url(${staticFile("fonts/barlow-latin-600-normal.woff2")}) format("woff2"); }
@font-face { font-family: 'IBM Plex Mono'; font-weight: 400; src: url(${staticFile("fonts/ibm-plex-mono-latin-400-normal.woff2")}) format("woff2"); }
`;
