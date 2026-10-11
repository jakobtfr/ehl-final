// Captures real app screens at 2x for the film. Usage: node scripts/capture.mjs <baseUrl> <outDir> <path...>
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
const [base, out, ...paths] = process.argv.slice(2);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, colorScheme: "light" });
const page = await ctx.newPage();
for (const p of paths) {
  await page.goto(base + p, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(+process.env.WAIT || 2500);
  const name = p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("captured", name);
}
await browser.close();
