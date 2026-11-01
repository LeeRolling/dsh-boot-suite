/**
 * selftest.mjs — 无浏览器的自检
 * ---------------------------------------------------------------------------
 * 1) 10 个 JSON 可解析 + validatePack 通过
 * 2) 用「记录型 mock 2D context」渲染每个 pack 的 t=0 与 t=duration，
 *    逐调用比对（数值 round 到 1e-6）→ 验证「首尾一致」这个硬要求
 * 3) 同一 t 渲染两次比对 → 验证确定性
 * 4) save/restore 配平检查 → 验证原语不会破坏画布状态栈
 * 5) 渲染耗时统计（60fps 预算 = 16.6ms）
 *
 * 运行： node tools/selftest.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

/* ------------------------------------------------------------------ */
/* mock 2D context                                                     */
/* ------------------------------------------------------------------ */

const R = (v) => (typeof v === 'number' ? (Number.isNaN(v) ? 'NaN' : Math.round(v * 1e6) / 1e6) : String(v));

function makeCtx(log) {
  const grad = {
    addColorStop(at, c) { log.push(`stop(${R(at)},${R(c)})`); }
  };
  const ctx = {
    saveDepth: 0,
    canvas: { width: 1920, height: 1080 },
    save() { this.saveDepth++; log.push('save'); },
    restore() { this.saveDepth--; log.push('restore'); },
    beginPath() { log.push('bp'); },
    closePath() { log.push('cp'); },
    moveTo(x, y) { log.push(`m(${R(x)},${R(y)})`); },
    lineTo(x, y) { log.push(`l(${R(x)},${R(y)})`); },
    quadraticCurveTo(a, b, c, d) { log.push(`q(${R(a)},${R(b)},${R(c)},${R(d)})`); },
    bezierCurveTo(a, b, c, d, e, f) { log.push(`bz(${R(a)},${R(b)},${R(c)},${R(d)},${R(e)},${R(f)})`); },
    arc(x, y, r, a0, a1) { log.push(`arc(${R(x)},${R(y)},${R(r)},${R(a0)},${R(a1)})`); },
    ellipse(x, y, rx, ry, rot, a0, a1) { log.push(`el(${R(x)},${R(y)},${R(rx)},${R(ry)},${R(rot)},${R(a0)},${R(a1)})`); },
    rect(x, y, w, h) { log.push(`rect(${R(x)},${R(y)},${R(w)},${R(h)})`); },
    fill(rule) { log.push(`fill(${rule || ''})`); },
    stroke() { log.push('stroke'); },
    clip(rule) { log.push(`clip(${rule || ''})`); },
    fillRect(x, y, w, h) { log.push(`fr(${R(x)},${R(y)},${R(w)},${R(h)})`); },
    strokeRect(x, y, w, h) { log.push(`sr(${R(x)},${R(y)},${R(w)},${R(h)})`); },
    clearRect(x, y, w, h) { log.push(`cr(${R(x)},${R(y)},${R(w)},${R(h)})`); },
    fillText(t, x, y) { log.push(`ft(${R(t)},${R(x)},${R(y)})`); },
    strokeText(t, x, y) { log.push(`st(${R(t)},${R(x)},${R(y)})`); },
    measureText(t) { return { width: String(t).length * 0.55 * (this._size || 40) }; },
    translate(x, y) { log.push(`tr(${R(x)},${R(y)})`); },
    rotate(a) { log.push(`ro(${R(a)})`); },
    scale(x, y) { log.push(`sc(${R(x)},${R(y)})`); },
    setTransform(a, b, c, d, e, f) { log.push(`st(${R(a)},${R(b)},${R(c)},${R(d)},${R(e)},${R(f)})`); },
    setLineDash(a) { log.push(`dash(${R(a && a.join(';'))})`); },
    createLinearGradient() { log.push('lg'); return grad; },
    createRadialGradient() { log.push('rg'); return grad; },
    createPattern() { log.push('pat'); return {}; },
    drawImage(img, x, y, w, h) { log.push(`img(${R(x)},${R(y)},${R(w)},${R(h)})`); },
    getBoundingClientRect() { return { width: 1920, height: 1080 }; }
  };
  const props = ['globalAlpha', 'globalCompositeOperation', 'fillStyle', 'strokeStyle', 'lineWidth',
    'lineCap', 'lineJoin', 'miterLimit', 'shadowColor', 'shadowBlur', 'font', 'textAlign',
    'textBaseline', 'imageSmoothingEnabled'];
  for (const p of props) {
    let v;
    Object.defineProperty(ctx, p, {
      get() { return v; },
      set(nv) {
        v = nv;
        if (p === 'font') { const m = /(\d+(?:\.\d+)?)px/.exec(String(nv)); ctx._size = m ? +m[1] : 40; }
        log.push(`${p}=${R(nv)}`);
      },
      enumerable: true
    });
  }
  return ctx;
}

class MockCanvas {
  constructor(w = 1920, h = 1080) {
    this.width = w; this.height = h;
    this._log = [];
    this._ctx = makeCtx(this._log);
    this._ctx.canvas = this;
  }
  getContext() { return this._ctx; }
  getBoundingClientRect() { return { width: this.width, height: this.height }; }
}

/* document 垫片：让 makeCanvas / 纹理缓存路径在 node 里也能跑 */
globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error('unexpected element ' + tag);
    return new MockCanvas();
  }
};
globalThis.devicePixelRatio = 2;

const IR = require(path.join(ROOT, 'ir-player.js'));

/* ------------------------------------------------------------------ */
/* 收集 styles                                                         */
/* ------------------------------------------------------------------ */

const styleDir = path.join(ROOT, 'styles');
const files = fs.readdirSync(styleDir).filter((f) => f.endsWith('.json')).sort();
if (files.length === 0) {
  console.error('找不到 styles/*.json');
  process.exit(1);
}

let fail = 0;
const rows = [];
const primUse = new Set();

function check(name, ok, detail) {
  if (!ok) { fail++; console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
  else console.log(`  ✅ ${name}`);
}

console.log('\n=== 1. 解析 + 结构校验 ===');
const packs = [];
for (const f of files) {
  let pack = null;
  try {
    pack = JSON.parse(fs.readFileSync(path.join(styleDir, f), 'utf8'));
  } catch (err) {
    console.error(`  ❌ ${f} JSON 解析失败: ${err.message}`);
    fail++;
    continue;
  }
  const v = IR.validatePack(pack);
  const bad = v.errors;
  console.log(`  ${bad.length ? '❌' : '✅'} ${f}  (${pack.id || '?'} / ${pack.name || '?'}, ${pack.timeline.length} 条时间线)`);
  if (bad.length) { fail++; console.error('     ' + bad.join('; ')); }
  if (v.warnings.length) console.log('     ⚠ ' + v.warnings.join('; '));
  packs.push({ file: f, pack });
}

console.log('\n=== 2. 首尾一致 / 确定性 / save-restore 配平 / 耗时 ===');
for (const { file, pack } of packs) {
  const D = pack.duration;
  const l0 = [], l1 = [], la = [];
  const c0 = makeCtx(l0), c1 = makeCtx(l1), ca = makeCtx(la);
  const t0 = process.hrtime.bigint();
  IR.renderStyle(pack, 0, c0, { strict: true });
  const t1 = process.hrtime.bigint();
  IR.renderStyle(pack, D, c1, { strict: true });
  const t2 = process.hrtime.bigint();
  IR.renderStyle(pack, 0, ca, { strict: true });
  const t3 = process.hrtime.bigint();

  // 首尾一致
  let diffAt = -1;
  const n = Math.max(l0.length, l1.length);
  for (let i = 0; i < n; i++) if (l0[i] !== l1[i]) { diffAt = i; break; }
  const loopOk = diffAt === -1;
  // 确定性
  const detOk = l0.length === la.length && l0.every((x, i) => x === la[i]);
  // 栈配平
  const balOk = c0.saveDepth === 0 && c1.saveDepth === 0 && ca.saveDepth === 0;
  // 耗时（ms/帧）
  const ms0 = Number(t1 - t0) / 1e6, msD = Number(t2 - t1) / 1e6, msA = Number(t3 - t2) / 1e6;
  const ms = Math.max(ms0, msD, msA);

  for (const e of pack.timeline) primUse.add(e.primitive);

  const okAll = loopOk && detOk && balOk;
  if (!okAll) fail++;
  rows.push({ id: pack.id, prims: new Set(pack.timeline.map((e) => e.primitive)).size, calls: l0.length, ms, okAll, file });
  console.log(`  ${okAll ? '✅' : '❌'} ${pack.id.padEnd(22)} calls=${String(l0.length).padStart(6)}  ${ms.toFixed(2)}ms  ` +
    `loop=${loopOk ? 'ok' : 'DIFF@' + diffAt} det=${detOk ? 'ok' : 'NO'} stack=${balOk ? 'ok' : 'LEAK'} depth=${c0.saveDepth}`);
  if (!loopOk) {
    console.log(`     t=0 [${diffAt}]: ${String(l0[diffAt]).slice(0, 110)}`);
    console.log(`     t=D [${diffAt}]: ${String(l1[diffAt]).slice(0, 110)}`);
  }
}

console.log('\n=== 3. 覆盖率 ===');
console.log(`  使用到的原语 (${primUse.size}/${IR.primitiveNames().length}): ${[...primUse].sort().join(', ')}`);
const unused = IR.primitiveNames().filter((p) => !primUse.has(p));
console.log(`  未使用: ${unused.length ? unused.join(', ') : '（无）'}`);

console.log('\n=== 4. 性能 ===');
const worst = rows.slice().sort((a, b) => b.ms - a.ms)[0];
console.log(`  最慢: ${worst ? worst.id + ' ' + worst.ms.toFixed(2) + 'ms' : '-'}`);
const avg = rows.reduce((s, r) => s + r.ms, 0) / (rows.length || 1);
console.log(`  平均: ${avg.toFixed(2)}ms（12 格同屏预算 ≈ 16.6ms 总和，单帧可接受）`);

console.log(`\n${fail === 0 ? '✅ 全部通过' : '❌ 有 ' + fail + ' 项失败'}（${packs.length} 个风格包）`);
process.exit(fail === 0 ? 0 : 1);
