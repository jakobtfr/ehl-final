import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Final stage deck: V1 trailer, two pipeline slides (the live demo follows), V2 trailer, close.
// Slides carry only headlines, large figures and short card text; the presenter speaks the
// detail and caveats (notes/pitch-final-run-of-show.md). Figures follow the claim ledger.
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'output/pitch-final.html');
const fontRoot = path.join(here, 'assets/fonts');
const b64 = async file => (await fs.readFile(file)).toString('base64');
const font = async (family, weight, file) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${await b64(file)}) format('woff2')}`;
const fonts = [
  await font('Barlow', 300, `${fontRoot}/barlow-latin-300-normal.woff2`),
  await font('Barlow', 400, `${fontRoot}/barlow-latin-400-normal.woff2`),
  await font('Barlow', 500, `${fontRoot}/barlow-latin-500-normal.woff2`),
].join('\n');
const editCss = await fs.readFile(path.join(here, 'slide-edit.css'), 'utf8');
const runtime = await fs.readFile(path.join(here, 'slide-runtime.js'), 'utf8');
const logoWhite = (await fs.readFile(path.join(here, 'assets/bmw-white.svg'), 'utf8')).replace(/^<\?xml[^>]+>\s*/, '');
const logoGrey = (await fs.readFile(path.join(here, 'assets/bmw-grey.svg'), 'utf8')).replace(/^<\?xml[^>]+>\s*/, '');
// g60-car-faded.png is g60-car.webp with its studio backdrop faded to transparent, so the car
// sits on any dark panel without a visible box (CSS masks leave seams in printed PDFs).
// Car model: "2023 BMW i5 M60" by Nazh Design / Sketchfab, CC BY 4.0 (credited in pitch/README.md).
const carUri = `data:image/png;base64,${await b64(path.join(here, 'assets/g60-car-faded.png'))}`;

const mark = dark => `<div class="mark">${dark ? logoWhite : logoGrey}</div>`;
// A film slot plays its MP4 when the file sits next to this HTML; otherwise its title card shows.
const filmSlide = (label, src, kicker, title, active = '') => `<section class="slide dark film-slide${active}" data-label="${label}" aria-label="${label} trailer">
<div class="film-fallback"><div class="film-car car-art" aria-hidden="true"></div><p class="film-kicker">${kicker}</p><h1 class="film-title">${title}</h1></div>
<video class="film" src="${src}" preload="auto" playsinline></video></section>`;
const step = (n, title, text, d) => `<li data-enter style="--d:${d}s"><b>${n}</b><strong data-edit>${title}</strong><p>${text}</p></li>`;

const slides = [
  filmSlide('V1', 'pitch-film-v1-short.mp4', 'V1 · The product management pipeline', 'Evidence to<br>decision.', ' active'),

  `<section class="slide pipeline" data-label="Pipeline 1" aria-label="The pipeline">${mark(false)}
<h2 data-enter>From customer voice to a requirement a PM can defend.</h2>
<ol class="steps">
${step(1, 'Collect', 'BMW feedback, NHTSA, owner forums, web', .12)}
${step(2, 'Link', 'Every row kept word for word', .2)}
${step(3, 'Propose', 'Requirements from recurring needs', .28)}
${step(4, 'Score', 'Priority beside evidence grade', .36)}
${step(5, 'Decide', 'The PM approves an exact version', .44)}
</ol>
<div class="loop" data-enter style="--d:.56s"><span>New evidence</span><i></i><strong data-edit>Only affected proposals reopen</strong></div></section>`,

  `<section class="slide hook" data-label="Pipeline 2" aria-label="Three questions">${mark(false)}
<h2 data-enter>Every requirement has to survive three questions.</h2>
<ol class="questions">
<li data-enter style="--d:.16s"><b>1</b><strong data-edit>Where did it come from?</strong></li>
<li data-enter style="--d:.28s"><b>2</b><strong data-edit>How sure are we?</strong></li>
<li data-enter style="--d:.40s"><b>3</b><strong data-edit>What changed since we decided?</strong></li>
</ol>
<div class="hook-panel"></div><div class="hook-car car-art" data-enter style="--d:.2s" role="img" aria-label="BMW i5 M60"></div></section>`,

  filmSlide('V2', 'pitch-film-v2-short.mp4', 'V2 · The multi-agent system', 'Agents<br>prepare.'),

  `<section class="slide dark close" data-close data-label="Close" aria-label="Close">${mark(true)}
<div class="blue-rule"></div>
<h1 data-enter>Agents prepare.<br>Product managers<br>decide.</h1>
<div class="lanes">
<div class="lane" data-enter style="--d:.14s"><strong data-edit>Automated</strong><p>Import, link to source, score</p></div>
<div class="lane" data-enter style="--d:.26s"><strong data-edit>Surfaced</strong><p>Weak evidence and assumptions</p></div>
<div class="lane human" data-enter style="--d:.38s"><strong data-edit>PM only</strong><p>Every decision, fully audited</p></div>
</div></section>`,

];

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Final Pitch · BMW Product Intelligence</title>
<style>
${fonts}
:root{--navy:#0b1422;--ink:#171b21;--blue:#1c69d4;--paper:#f4f5f7;--tile:#e9ecf1;--muted:#5d6878;--amber:#b86e00}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050b13}body{font-family:Barlow,Arial,sans-serif}
.deck{position:absolute;left:50%;top:50%;width:1280px;height:720px;transform:translate(-50%,-50%) scale(var(--scale,1));transform-origin:center;overflow:hidden;background:var(--navy);box-shadow:0 25px 100px #0008}
.slide{position:absolute;inset:0;display:none;overflow:hidden;background:var(--paper);color:var(--ink)}.slide.active{display:block;animation:slideIn .5s cubic-bezier(.2,.75,.2,1) both}.slide.dark{background:var(--navy);color:#fff}
@keyframes slideIn{from{opacity:0}to{opacity:1}}
[data-enter]{opacity:0;transform:translateY(18px)}.active [data-enter]{animation:rise .55s calc(.1s + var(--d,0s)) cubic-bezier(.2,.8,.2,1) both}@keyframes rise{to{opacity:1;transform:none}}
h1,h2,p,ol,ul{margin:0}h1,h2{font-weight:300;letter-spacing:-.022em}
.mark{position:absolute;z-index:2;left:80px;top:48px}.mark svg{width:48px;height:48px;display:block}
.car-art{background:url(${carUri}) center/contain no-repeat;aspect-ratio:1035/610}
/* Film */
.film-slide{background:#000}.film{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;opacity:0}.has-film .film{opacity:1}
.film-fallback{position:absolute;inset:0;background:radial-gradient(circle at 70% 55%,#173a6b 0,#0b1422 55%)}.film-car{position:absolute;right:20px;top:170px;width:700px}
.film-kicker{position:absolute;left:80px;top:212px;font-size:18px;letter-spacing:.18em;text-transform:uppercase;color:#8fb4e8}
.film-title{position:absolute;left:80px;top:250px;width:620px;font-size:68px;line-height:1.06}.has-film .film-fallback{display:none}
/* Hook */
.hook h2{position:absolute;left:80px;top:170px;width:640px;font-size:58px;line-height:1.08}
.questions{position:absolute;left:80px;top:380px;width:640px;padding:0;list-style:none}.questions li{display:grid;grid-template-columns:56px 1fr;align-items:baseline;padding:20px 0;border-top:1px solid #d4dae3}.questions li:last-child{border-bottom:1px solid #d4dae3}
.questions b{font-size:30px;font-weight:300;color:var(--blue)}.questions strong{font-size:32px;font-weight:500;letter-spacing:-.01em}
.hook-panel{position:absolute;left:792px;top:0;right:0;bottom:0;background:radial-gradient(circle at 50% 52%,#1d3352 0,#0b1422 70%)}.hook-car{position:absolute;left:806px;top:262px;width:460px}
/* Pipeline */
.pipeline h2{position:absolute;left:80px;top:150px;width:900px;font-size:56px;line-height:1.08}
.steps{position:absolute;left:80px;top:340px;width:1120px;padding:0;list-style:none;display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.steps li{position:relative;background:var(--tile);padding:26px 22px 28px;min-height:196px}.steps li:last-child{background:var(--navy);color:#fff}
.steps li:not(:last-child)::after{content:'';position:absolute;z-index:1;right:-12px;top:44px;width:12px;height:2px;background:var(--blue)}
.steps b{display:block;font-size:20px;font-weight:400;color:var(--blue)}.steps li:last-child b{color:#8fb4e8}
.steps strong{display:block;margin-top:14px;font-size:32px;font-weight:500;letter-spacing:-.01em}.steps p{margin-top:10px;font-size:20px;line-height:1.3;color:var(--muted)}.steps li:last-child p{color:#b9c9dd}
/* Close */
.close .blue-rule{position:absolute;left:80px;top:196px;width:7px;height:300px;background:var(--blue);transform-origin:top;transform:scaleY(0)}.active .blue-rule{animation:ruleGrow .7s .1s cubic-bezier(.2,.8,.2,1) forwards}@keyframes ruleGrow{to{transform:scaleY(1)}}
.close h1{position:absolute;left:112px;top:206px;width:540px;font-size:68px;line-height:1.06}
.lanes{position:absolute;left:700px;top:196px;width:500px}.lane{padding:22px 0 24px;border-top:1px solid #2c4060}.lane:last-child{border-bottom:1px solid #2c4060}.lane strong{display:block;font-size:30px;font-weight:500}.lane p{font-size:24px;color:#b9c9dd;margin-top:4px}
.lane.human{background:linear-gradient(90deg,#1c69d433,transparent);padding-left:20px;margin-left:-20px;border-left:3px solid var(--blue)}.lane.human p{color:#fff}
/* Controls */
.progress{position:absolute;z-index:10;left:0;bottom:0;height:4px;background:var(--blue);transition:width .45s ease}
.toolbar .timer{font-size:13px;padding:0 6px;color:#8fb4e8}
@media(prefers-reduced-motion:reduce){.slide.active,.active [data-enter],.active .blue-rule{animation:none!important;opacity:1!important;transform:none!important}.progress{transition:none}}
${editCss}
@media print{
  @page{size:1280px 720px;margin:0}
  html,body{width:1280px;height:auto;overflow:visible;background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}
  .deck{position:static;left:auto;top:auto;width:1280px;height:auto;transform:none;overflow:visible;box-shadow:none}
  .slide,.slide.active{position:relative;display:block!important;width:1280px;height:720px;animation:none!important;break-after:page;page-break-after:always}
  .slide:last-of-type{break-after:auto;page-break-after:auto}
  .slide [data-enter],.slide.active [data-enter],.slide .blue-rule{opacity:1!important;transform:none!important;animation:none!important}
  .progress,.toolbar,.film{display:none!important}.film-fallback{display:block!important}
}
</style></head><body><main class="deck" aria-label="Final pitch deck">
${slides.join('\n')}
<div class="progress" id="progress"></div><div class="toolbar" aria-label="Slide controls"><span class="timer" id="timer" hidden>0:00</span><button id="prev" aria-label="Previous slide">‹</button><span class="page-count" id="page-count">V1</span><button id="next" aria-label="Next slide">›</button><button id="edit">Edit text</button><button id="save">Save HTML</button><button id="print">Print PDF</button></div>
</main><script>${runtime}</script></body></html>`;
await fs.writeFile(out, html);
console.log(out);
