import * as THREE from "three";

/**
 * Brand marks applied at runtime on top of the licensed artist models.
 *
 * Placement follows the BMW USA configurator renders (rear: model name left, M designation right,
 * roundel centred on the boot lid; roundels on the bonnet and wheel hubs). Positions are ray origins;
 * the mark is laid onto whatever surface the ray hits, so the artist geometry stays untouched.
 */
export type RearBadge = { text: string; mStripes?: boolean; x: number; y: number; height: number };

export type VehicleTrim = {
  /** Author-built meshes replaced by the marks below. */
  hideMeshes: string[];
  /** Artist lettering merged into shared meshes: triangles of these materials fully inside a box are dropped. */
  stripLettering?: { materials: string[]; boxes: [number[], number[]][] };
  /** BMW i models carry a blue halo around the roundel. */
  roundelHalo: boolean;
  rearRoundel: { y: number; size: number };
  bonnetRoundel: { z: number; size: number };
  wheelRoundelSize: number;
  rearBadges: RearBadge[];
};

const M_STRIPES = ["#81c4ff", "#16588e", "#e7222e"];
const BMW_BLUE = "#1c69d4";
const I_HALO = "#3b9be6";
const LETTER_IDS = ["W_60_", "M_60_", "B_x5F_22d_60_"];

let letterMarkup: Promise<string> | null = null;

/** Reuse the official BMW letterforms already shipped in /brand instead of redrawing them. */
function loadLetters(): Promise<string> {
  letterMarkup ??= fetch("/brand/bmw-white.svg").then((r) => r.text()).then((svg) => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const paths = LETTER_IDS.map((id) => doc.getElementById(id)?.getAttribute("d")).filter(Boolean);
    const transform = doc.getElementById("Group")?.getAttribute("transform") || "";
    return `<g transform="${transform}" fill="#f2f4f6">${paths.map((d) => `<path d="${d}"/>`).join("")}</g>`;
  });
  return letterMarkup;
}

function roundelSvg(letters: string, halo: boolean): string {
  const c = 26.4347214;
  // Blue in the upper-left and lower-right quadrants, as on the configurator renders.
  const blue = (sx: number, sy: number) =>
    `<path d="M${c},${c} L${c + sx * 15.68},${c} A15.68,15.68 0 0 ${sx * sy > 0 ? 1 : 0} ${c},${c + sy * 15.68} Z" fill="${BMW_BLUE}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 58.87 58.87" width="512" height="512">
    <defs>
      <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#9aa3ab"/>
        <stop offset=".55" stop-color="#d9dee2"/><stop offset="1" stop-color="#5d656c"/>
      </linearGradient>
    </defs>
    ${halo ? `<circle cx="${c}" cy="${c}" r="29.3" fill="${I_HALO}"/>` : ""}
    <circle cx="${c}" cy="${c}" r="${c}" fill="url(#chrome)"/>
    <circle cx="${c}" cy="${c}" r="24.9" fill="#0d0f12"/>
    ${letters}
    <circle cx="${c}" cy="${c}" r="16.45" fill="url(#chrome)"/>
    <circle cx="${c}" cy="${c}" r="15.68" fill="#f7f8f9"/>
    ${blue(-1, -1)}${blue(1, 1)}
  </svg>`;
}

function svgToCanvas(svg: string, size: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d")!.drawImage(image, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Roundel could not be rendered")); };
    image.src = url;
  });
}

function chromeFill(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, "#f4f6f8");
  g.addColorStop(0.4, "#a9b1b8");
  g.addColorStop(0.5, "#3c4349");
  g.addColorStop(0.6, "#c9cfd4");
  g.addColorStop(1, "#596168");
  return g;
}

/** Lettering in the chrome, wide-set style of BMW model badges; M badges add the tricolour stripes. */
async function badgeCanvas(badge: RearBadge): Promise<{ canvas: HTMLCanvasElement; aspect: number }> {
  const px = 160;
  const font = `${badge.mStripes ? "italic 600" : "500"} ${px}px Barlow, "Helvetica Neue", Arial, sans-serif`;
  await document.fonts?.load(font).catch(() => undefined);
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const spacing = px * 0.06;
  const textWidth = [...badge.text].reduce((sum, ch) => sum + measure.measureText(ch).width + spacing, -spacing);
  const stripeWidth = badge.mStripes ? px * 0.95 : 0;
  const pad = px * 0.12;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(textWidth + stripeWidth + pad * 2);
  canvas.height = Math.ceil(px * 1.1);
  const ctx = canvas.getContext("2d")!;
  const baseline = px * 0.9;
  const capTop = baseline - px * 0.72;
  let x = pad;
  if (badge.mStripes) {
    const w = px * 0.24, slant = px * 0.2, h = baseline - capTop;
    M_STRIPES.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + i * w + slant, capTop);
      ctx.lineTo(x + (i + 1) * w + slant, capTop);
      ctx.lineTo(x + (i + 1) * w, capTop + h);
      ctx.lineTo(x + i * w, capTop + h);
      ctx.fill();
    });
    x += stripeWidth;
  }
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = chromeFill(ctx, capTop, baseline);
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = px * 0.03;
  ctx.shadowOffsetY = px * 0.02;
  ctx.lineWidth = px * 0.035;
  ctx.strokeStyle = "rgba(20,24,28,.75)";
  for (const ch of badge.text) {
    ctx.strokeText(ch, x, baseline);
    ctx.fillText(ch, x, baseline);
    x += measure.measureText(ch).width + spacing;
  }
  return { canvas, aspect: canvas.width / canvas.height };
}

function markMaterial(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return new THREE.MeshStandardMaterial({
    map, transparent: true, alphaTest: 0.04, metalness: 0.15, roughness: 0.32,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
}

/** A flat mark laid 2.5 mm proud of the hit surface, facing along its normal. */
function placeMark(material: THREE.Material, width: number, height: number, hit: THREE.Intersection, up = new THREE.Vector3(0, 1, 0)) {
  const normal = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  const tangentUp = up.clone().sub(normal.clone().multiplyScalar(up.dot(normal))).normalize();
  const right = new THREE.Vector3().crossVectors(tangentUp, normal).normalize();
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, tangentUp, normal));
  mesh.position.copy(hit.point).addScaledVector(normal, 0.0025);
  mesh.renderOrder = 2;
  mesh.name = "brand_mark";
  return mesh;
}

function stripLettering(meshes: THREE.Mesh[], { materials, boxes }: NonNullable<VehicleTrim["stripLettering"]>) {
  const regions = boxes.map(([min, max]) => new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
  const p = new THREE.Vector3();
  for (const mesh of meshes) {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const index = mesh.geometry.index;
    if (!materials.includes(material.name) || !index) continue;
    const position = mesh.geometry.getAttribute("position");
    const inside = (i: number) => { p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld); return regions.some((r) => r.containsPoint(p)); };
    const kept: number[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
      if (!(inside(a) && inside(b) && inside(c))) kept.push(a, b, c);
    }
    if (kept.length !== index.count) mesh.geometry.setIndex(kept);
  }
}

/** Applies roundels and rear lettering; returns the created marks so the caller can dispose them. */
export async function applyBrandMarks(vehicle: THREE.Object3D, trim: VehicleTrim, renderer: THREE.WebGLRenderer): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = "brand_marks";
  const surfaces: THREE.Mesh[] = [];
  const tyres: THREE.Mesh[] = [];
  vehicle.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (trim.hideMeshes.includes(object.name)) { object.visible = false; return; }
    const names = (Array.isArray(object.material) ? object.material : [object.material]).map((m) => m.name);
    if (names.some((n) => /glass|interior|dashboard/.test(n))) return;
    if (names.includes("rubber_tires")) tyres.push(object);
    surfaces.push(object);
  });
  if (trim.stripLettering) stripLettering(surfaces, trim.stripLettering);
  const raycaster = new THREE.Raycaster();
  const cast = (origin: THREE.Vector3, direction: THREE.Vector3) => {
    raycaster.set(origin, direction.normalize());
    return raycaster.intersectObjects(surfaces, false).find((hit) => hit.face);
  };

  const letters = await loadLetters();
  const roundel = markMaterial(await svgToCanvas(roundelSvg(letters, trim.roundelHalo), 512), renderer);
  // The roundel artwork carries a 3-unit margin for the halo; size refers to the chrome rim.
  const haloScale = 58.87 / 52.87;

  const rear = cast(new THREE.Vector3(0, trim.rearRoundel.y, -10), new THREE.Vector3(0, 0, 1));
  if (rear) { const s = trim.rearRoundel.size * haloScale; group.add(placeMark(roundel, s, s, rear)); }

  const bonnet = cast(new THREE.Vector3(0, 5, trim.bonnetRoundel.z), new THREE.Vector3(0, -1, 0));
  if (bonnet) { const s = trim.bonnetRoundel.size * haloScale; group.add(placeMark(roundel, s, s, bonnet, new THREE.Vector3(0, 0, -1))); }

  // Wheel hubs: the artist tyres are not symmetric front-to-back, so the hub sits directly below
  // each tyre's crown rather than at its bounding-box centre.
  type Hub = { box: THREE.Box3; crown: THREE.Vector3[] };
  const hubs = new Map<string, Hub>();
  const v = new THREE.Vector3();
  const tyrePoints = (visit: (key: string, point: THREE.Vector3) => void) => {
    for (const tyre of tyres) {
      const position = tyre.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(tyre.matrixWorld);
        visit(`${v.x > 0 ? "L" : "R"}${v.z > 0 ? "F" : "B"}`, v);
      }
    }
  };
  tyrePoints((key, point) => {
    if (!hubs.has(key)) hubs.set(key, { box: new THREE.Box3(), crown: [] });
    hubs.get(key)!.box.expandByPoint(point);
  });
  tyrePoints((key, point) => { const hub = hubs.get(key)!; if (point.y > hub.box.max.y - 0.003) hub.crown.push(point.clone()); });
  const hubMaterial = markMaterial(await svgToCanvas(roundelSvg(letters, false), 256), renderer);
  for (const { box, crown } of hubs.values()) {
    const centre = box.getCenter(new THREE.Vector3());
    centre.z = crown.reduce((sum, point) => sum + point.z, 0) / Math.max(crown.length, 1);
    const side = Math.sign(centre.x);
    const hit = cast(new THREE.Vector3(side * 3, centre.y, centre.z), new THREE.Vector3(-side, 0, 0));
    if (hit) group.add(placeMark(hubMaterial, trim.wheelRoundelSize, trim.wheelRoundelSize, hit));
  }

  for (const badge of trim.rearBadges) {
    const hit = cast(new THREE.Vector3(badge.x, badge.y, -10), new THREE.Vector3(0, 0, 1));
    if (!hit) continue;
    const { canvas, aspect } = await badgeCanvas(badge);
    group.add(placeMark(markMaterial(canvas, renderer), badge.height * aspect, badge.height, hit));
  }

  vehicle.add(group);
  return group;
}

export function disposeBrandMarks(group: THREE.Group | null) {
  if (!group) return;
  const materials = new Set<THREE.MeshStandardMaterial>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    materials.add(object.material as THREE.MeshStandardMaterial);
  });
  materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
  group.removeFromParent();
}
