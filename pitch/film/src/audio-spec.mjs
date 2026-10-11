// Single source of truth for generated audio. Plain JS so the generator runs in Node.
export const MUSIC = {
  id: "music",
  lengthMs: 31000,
  plan: {
    positive_global_styles: [
      "cinematic hybrid trailer", "modern electronic", "aggressive", "precise", "German engineering",
      "pulsing sub bass", "tight punchy drums", "instrumental", "high production value",
    ],
    negative_global_styles: ["vocals", "lyrics", "lo-fi", "acoustic guitar", "jazz", "cheesy", "orchestral waltz"],
    sections: [
      {
        section_name: "Cold open",
        positive_local_styles: ["dark low drone", "ticking pulse", "sparse", "tension", "leaves space for engine sounds"],
        negative_local_styles: ["drums", "melody", "loud"],
        duration_ms: 5000,
        lines: [],
      },
      {
        section_name: "First reveal",
        positive_local_styles: ["driving electronic beat starts on the downbeat", "staccato synth arpeggio", "confident", "building energy", "rising filter", "ends with a fast riser and snare roll"],
        negative_local_styles: ["full drop", "vocals"],
        duration_ms: 10000,
        lines: [],
      },
      {
        section_name: "Second reveal drop",
        positive_local_styles: ["massive drop on the downbeat", "huge drums", "distorted sub bass", "big synth brass stabs", "triumphant", "maximum energy", "anthemic"],
        negative_local_styles: ["quiet", "sparse", "vocals"],
        duration_ms: 12000,
        lines: [],
      },
      {
        section_name: "Final hit",
        positive_local_styles: ["one final huge impact hit", "long reverb tail", "ring out to silence"],
        negative_local_styles: ["drums continuing", "new melody"],
        duration_ms: 4000,
        lines: [],
      },
    ],
  },
};

export const SFX = [
  { id: "engine-start", seconds: 2.5, text: "High performance sports car engine starting up with an aggressive throttle blip, loud exhaust roar, close microphone, cinematic" },
  { id: "rev-crackle", seconds: 2, text: "Aggressive sports car exhaust revving hard with loud crackles and pops on the overrun, cinematic" },
  { id: "flyby-1", seconds: 2, text: "Sports car flying past the camera at very high speed, loud exhaust roar with doppler effect" },
  { id: "flyby-2", seconds: 2, text: "Race car passing by at full throttle, screaming exhaust, doppler whoosh, cinematic" },
  { id: "downshift", seconds: 2, text: "Sports car downshifting hard with exhaust burble, crackles and bangs" },
  { id: "drift", seconds: 2.5, text: "Car drifting sideways, tires screeching, engine roaring at high rpm" },
  { id: "impact", seconds: 3, text: "Massive cinematic trailer impact hit with a deep sub bass boom and long tail" },
  { id: "braam", seconds: 3.5, text: "Huge cinematic trailer braam, distorted brass and deep sub drop, epic" },
  { id: "riser", seconds: 2.5, text: "Cinematic tension riser building fast and ending abruptly" },
  { id: "whoosh-1", seconds: 0.8, text: "Fast clean cinematic whoosh transition" },
  { id: "whoosh-2", seconds: 0.8, text: "Short airy swoosh transition, modern, clean" },
  { id: "click", seconds: 0.5, text: "Single crisp soft computer mouse click, clean UI sound" },
  { id: "typing", seconds: 1.5, text: "Fast soft laptop keyboard typing, close and clean" },
  { id: "blips", seconds: 1.2, text: "Cascade of soft digital interface blips and ticks, data loading, modern UI" },
  { id: "final-rev", seconds: 3, text: "Sports car exhaust giving one final huge rev with crackles, then silence" },
];
