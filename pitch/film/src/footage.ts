/**
 * Live-action shots, by slot. Files live in public/footage (gitignored; see README).
 * `shots/` holds 2.0 s HD cut-downs of official BMW PressClub masters (factory-07 is Pexels).
 * `trim` is the start offset in seconds inside the file.
 */
export type Shot = { src: string; trim?: number; rate?: number };

const s = (name: string, trim = 0.4): Shot => ({ src: `footage/shots/${name}.mp4`, trim });

export const F: Record<string, Shot> = {
  // Cold open: aggressive car moments.
  open1: s("coldopen-01", 0.8), // M4 headlights flare on in the dark
  open2: s("coldopen-02", 0.6), // top-down drift, tyre marks
  open3: s("coldopen-03", 0.8), // M2 drifting in smoke
  open4: s("coldopen-10", 0.6), // M4 drifting toward camera, sun flare
  open5: s("coldopen-09", 1.0), // CSL shifter
  open6: s("coldopen-04", 0.8), // wheel and caliper macro
  open7: s("interstitial-01", 1.2), // yellow M4 headlights
  // Between V1 software shots.
  v1a: s("coldopen-07", 0.6), // M3 at Bathurst, golden hour
  v1factory: s("factory-02", 0.6), // paint robots on a body
  v1b: s("interstitial-05", 0.6), // kidney grille
  // Between V2 software shots and the climax.
  v2a: s("coldopen-05", 0.6), // low tracking shot, M2
  v2factory: s("factory-05", 0.6), // welding cell sparks
  v2b: s("interstitial-03", 0.6), // tail-light macro
  climax1: s("coldopen-06", 0.8), // road-level chase
  climax2: s("factory-04", 0.6), // robot inside a body-in-white
  climax3: s("interstitial-07", 1.0), // car in the hangar door light
  climax4: s("factory-01", 0.6), // robot on an orange body
  climax5: s("interstitial-02", 1.2), // M4 silhouette lights up
};
