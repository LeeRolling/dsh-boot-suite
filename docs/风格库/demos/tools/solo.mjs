// tools/solo.mjs <packId> <primitive> [t] —— 只渲染某个包里的某一条原语，打印它产生的前若干条绘图指令
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// mock canvas
function makeCtx(log) {
  const R = (v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v);
  const noop = () => {};
  const ctx = {
    canvas: { width: 1920, height: 1080 },
    save: () => { log.push("save"); },
    restore: () => { log.push("restore"); },
    beginPath: () => log.push("beginPath"),
    closePath: () => log.push("closePath"),
    moveTo: (x, y) => log.push(`moveTo ${R(x)} ${R(y)}`),
    lineTo: (x, y) => log.push(`lineTo ${R(x)} ${R(y)}`),
    quadraticCurveTo: (a, b, c, d) => log.push(`quad ${R(a)} ${R(b)} ${R(c)} ${R(d)}`),
    bezierCurveTo: (a, b, c, d, e2, f) => log.push(`bez ${R(a)} ${R(b)} ${R(c)} ${R(d)} ${R(e2)} ${R(f)}`),
    arc: (x, y, r) => log.push(`arc ${R(x)} ${R(y)} ${R(r)}`),
    ellipse: (x, y, rx, ry) => log.push(`ellipse ${R(x)} ${R(y)} ${R(rx)} ${R(ry)}`),
    rect: (x, y, w, h) => log.push(`rect ${R(x)} ${R(y)} ${R(w)} ${R(h)}`),
    fill: () => log.push("fill"),
    stroke: () => log.push("stroke"),
    clip: () => log.push("clip"),
    fillRect: (x, y, w, h) => log.push(`fillRect ${R(x)} ${R(y)} ${R(w)} ${R(h)}`),
    strokeRect: (x, y, w, h) => log.push(`strokeRect ${R(x)} ${R(y)} ${R(w)} ${R(h)}`),
    fillText: (s, x, y) => log.push(`fillText ${JSON.stringify(s)} ${R(x)} ${R(y)}`),
    strokeText: noop, setLineDash: noop, clearRect: noop,
    drawImage: (img, x, y, w, h) => log.push(`drawImage ${R(x)} ${R(y)} ${R(w)} ${R(h)}`),
    translate: (x, y) => log.push(`translate ${R(x)} ${R(y)}`),
    scale: (x, y) => log.push(`scale ${R(x)} ${R(y)}`),
    rotate: (a) => log.push(`rotate ${R(a)}`),
    transform: noop, setTransform: noop, resetTransform: noop,
    measureText: (s) => ({ width: String(s).length * 0.55 * 20 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
  };
  for (const k of ["globalAlpha", "globalCompositeOperation", "fillStyle", "strokeStyle", "lineWidth", "lineCap", "lineJoin", "font", "textAlign", "textBaseline", "shadowColor", "shadowBlur"]) {
    let v = null;
    Object.defineProperty(ctx, k, { get: () => v, set: (nv) => { v = nv; log.push(`${k}=${nv}`); } });
  }
  return ctx;
}

class MockCanvas {
  constructor() { this.width = 1920; this.height = 1080; this.style = {}; this.clientWidth = 1920; this.clientHeight = 1080; }
  getContext() { this._log = this._log || []; this._ctx = this._ctx || makeCtx(this._log); return this._ctx; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1920, height: 1080 }; }
  setAttribute() {} appendChild() {}
}
globalThis.document = { createElement: () => new MockCanvas(), documentElement: { style: {} } };
globalThis.devicePixelRatio = 2;
globalThis.window = globalThis;

const require = createRequire(import.meta.url);
const IR = require(path.join(root, "ir-player.js"));

const [packId, prim, tArg] = process.argv.slice(2);
const pack = JSON.parse(fs.readFileSync(path.join(root, "styles", packId + ".json"), "utf8"));
const t = tArg == null ? 1 : +tArg;
const solo = JSON.parse(JSON.stringify(pack));
solo.timeline = solo.timeline.filter((e) => e.primitive === prim);
if (!solo.timeline.length) { console.error("no such primitive in pack: " + prim); process.exit(2); }

const canvas = new MockCanvas();
const ctx = canvas.getContext();
IR.renderStyle(solo, t, ctx, { instance: canvas, strict: true, lod: 1 });
const log = canvas._log || [];
console.log(`pack=${packId} prim=${prim} t=${t} ops=${log.length}`);
console.log(log.slice(0, 60).join("\n"));
