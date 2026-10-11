// Generates music and sound effects with ElevenLabs. Cached by request hash.
import "dotenv/config";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { MUSIC, SFX } from "../src/audio-spec.mjs";

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("Set ELEVENLABS_API_KEY in pitch/film/.env");
const OUT = "public/audio";
const CACHE = `${OUT}/.cache.json`;
await fs.mkdir(OUT, { recursive: true });
const cache = JSON.parse(await fs.readFile(CACHE, "utf8").catch(() => "{}"));
const only = process.argv.slice(2);

async function call(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}
const duration = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim();

const jobs = [
  { id: MUSIC.id, url: "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192", body: { composition_plan: MUSIC.plan, model_id: "music_v1" } },
  ...SFX.map((s) => ({ id: s.id, url: "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192", body: { text: s.text, duration_seconds: s.seconds, prompt_influence: 0.5 } })),
].filter((j) => !only.length || only.includes(j.id));

const timings = JSON.parse(await fs.readFile("src/audio-timings.json", "utf8").catch(() => "{}"));
// ElevenLabs allows 4 concurrent requests on this plan; stay under it.
const queue = [...jobs];
await Promise.all(Array.from({ length: 3 }, async () => { for (let j; (j = queue.shift()); ) await run(j); }));
async function run(j) {
  const hash = crypto.createHash("sha1").update(JSON.stringify(j.body)).digest("hex");
  const file = `${OUT}/${j.id}.mp3`;
  if (cache[j.id] === hash && (await fs.stat(file).catch(() => null))) return console.log("cached", j.id);
  try {
    await fs.writeFile(file, await call(j.url, j.body));
    cache[j.id] = hash;
    timings[j.id] = duration(file);
    console.log("generated", j.id, timings[j.id].toFixed(2) + "s");
  } catch (e) { console.error("FAILED", j.id, e.message.slice(0, 400)); }
}
await fs.writeFile(CACHE, JSON.stringify(cache, null, 2));
await fs.writeFile("src/audio-timings.json", JSON.stringify(timings, null, 2));
