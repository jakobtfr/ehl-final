// Re-encodes the render for QuickTime/projector playback (yuv420p, TV range), normalises
// loudness for a presentation room and places the film next to the final deck.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const src = "out/pitch-film.mp4";
const dst = "../output/pitch-film.mp4";
execFileSync("ffmpeg", [
  "-loglevel", "error", "-y", "-i", src,
  "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "16",
  "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart",
  "-af", "loudnorm=I=-14:TP=-1:LRA=11",
  "-c:a", "aac", "-b:a", "256k", "-ar", "48000", dst,
], { stdio: "inherit" });
console.log("wrote", dst, (fs.statSync(dst).size / 1e6).toFixed(1) + " MB");
