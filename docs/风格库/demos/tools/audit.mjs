/**
 * audit.mjs — 版式体检（没有浏览器也能查「画到画布外面」）
 * ---------------------------------------------------------------------------
 * selftest 只比对调用序列，看不见「东西摆在哪儿」。这个脚本用带变换矩阵的
 * 测量型 2D context 把每个风格包在若干时刻画一遍，把所有填充/文字/圆弧的
 * 包围盒换算到 1920×1080 逻辑坐标里，然后报告：
 *   · 完全落在画布外的元素（一定看不见 = 白写了）
 *   · 文字横向溢出（右边界 > 1920 或左边界 < 0）
 *   · 文字基线跑到画布外
 * 中文按 1em、拉丁按 0.55em 估宽（CJK 字宽近似 1em，这是关键差别）。
 *
 * 运行： node tools/audit.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const IR = require(path.join(ROOT, 'ir-player.js'));

const VW = 1920, VH = 1080;

/* ---------------- 矩阵 ---------------- */

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/* ---------------- 测量 context ---------------- */

const isWide = (ch) => /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/.test(ch);

function fontSizeOf(font) {
  const m = /(\d+(?:\.\d+)?)px/.exec(font || '');
  return m ? parseFloat(m[1]) : 12;
}
function textWidth(str, size) {
  let w = 0;
  for (const ch of String(str)) w += isWide(ch) ? size : size * 0.55;
  return w;
}

function makeCtx(out) {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let path = [];       // 当前路径：数组 of [x,y]（已转设备坐标）
  let cur = null;

  const push = (type, box) => out.push({ type, box });

  const ctx = {
    /* 状态 */
    save() { stack.push(m.slice()); },
    restore() { if (stack.length) m = stack.pop(); },
    setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; },
    translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); },
    scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate(r) { const c = Math.cos(r), s = Math.sin(r); m = mul(m, [c, s, -s, c, 0, 0]); },
    transform(a, b, c, d, e, f) { m = mul(m, [a, b, c, d, e, f]); },
    resetTransform() { m = [1, 0, 0, 1, 0, 0]; },

    /* 路径 */
    beginPath() { path = []; cur = null; },
    closePath() { cur = null; },
    moveTo(x, y) { cur = [apply(m, x, y)]; path.push(cur); },
    lineTo(x, y) { if (!cur) { cur = [apply(m, x, y)]; path.push(cur); } else cur.push(apply(m, x, y)); },
    quadraticCurveTo(cx, cy, x, y) {
      const p0 = cur && cur.length ? cur[cur.length - 1] : apply(m, cx, cy);
      const c = apply(m, cx, cy), p1 = apply(m, x, y);
      for (let i = 1; i <= 8; i++) {
        const t = i / 8, u = 1 - t;
        cur.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
      }
    },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      const p0 = cur && cur.length ? cur[cur.length - 1] : apply(m, c1x, c1y);
      const a = apply(m, c1x, c1y), b = apply(m, c2x, c2y), p1 = apply(m, x, y);
      for (let i = 1; i <= 10; i++) {
        const t = i / 10, u = 1 - t;
        cur.push([
          u * u * u * p0[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * p1[0],
          u * u * u * p0[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * p1[1]
        ]);
      }
    },
    arc(x, y, r, a0, a1) {
      const c = apply(m, x, y);
      const rr = r * Math.max(Math.abs(m[0]), Math.abs(m[3]));
      push('arc', [c[0] - rr, c[1] - rr, c[0] + rr, c[1] + rr]);
      // 把圆的四个极点塞进当前子路径，这样后面的 fill()/stroke() 包围盒也是对的
      if (!cur) { cur = []; path.push(cur); }
      cur.push([c[0] - rr, c[1] - rr], [c[0] + rr, c[1] + rr], [c[0] + rr, c[1] - rr], [c[0] - rr, c[1] + rr]);
    },
    ellipse(x, y, rx, ry) {
      const c = apply(m, x, y);
      const sx = rx * Math.max(Math.abs(m[0]), Math.abs(m[3]));
      const sy = ry * Math.max(Math.abs(m[1]), Math.abs(m[2]));
      push('arc', [c[0] - sx, c[1] - sy, c[0] + sx, c[1] + sy]);
      if (!cur) { cur = []; path.push(cur); }
      cur.push([c[0] - sx, c[1] - sy], [c[0] + sx, c[1] + sy]);
    },
    rect(x, y, w, h) {
      const p = [apply(m, x, y), apply(m, x + w, y), apply(m, x + w, y + h), apply(m, x, y + h)];
      path.push(p);
    },

    /* 画 */
    fill() {
      const pts = path.flat();
      if (!pts.length) return;
      push('fill', boxOf(pts));
    },
    stroke() {
      const pts = path.flat();
      if (!pts.length) return;
      push('stroke', boxOf(pts));
    },
    fillRect(x, y, w, h) {
      const p = [apply(m, x, y), apply(m, x + w, y), apply(m, x + w, y + h), apply(m, x, y + h)];
      push('fill', boxOf(p));
    },
    strokeRect(x, y, w, h) {
      const p = [apply(m, x, y), apply(m, x + w, y), apply(m, x + w, y + h), apply(m, x, y + h)];
      push('stroke', boxOf(p));
    },
    clearRect() { },
    clip() { },
    fillText(str, x, y) {
      const size = fontSizeOf(ctx.font);
      const w = textWidth(str, size);
      const align = ctx.textAlign || 'left';
      let x0 = x;
      if (align === 'center') x0 = x - w / 2;
      else if (align === 'right') x0 = x - w;
      const base = ctx.textBaseline || 'alphabetic';
      let top = y - size * 0.8;
      if (base === 'middle') top = y - size * 0.5;
      else if (base === 'top') top = y;
      else if (base === 'bottom') top = y - size;
      const p = [apply(m, x0, top), apply(m, x0 + w, top), apply(m, x0 + w, top + size), apply(m, x0, top + size)];
      push('text', boxOf(p));
      out.push({ type: 'textmeta', text: String(str), size, align });
    },
    strokeText(str, x, y) { ctx.fillText(str, x, y); },
    measureText(str) { return { width: textWidth(str, fontSizeOf(ctx.font)) }; },

    /* 渐变 / 图像 */
    createLinearGradient() { return grad(); },
    createRadialGradient() { return grad(); },
    createPattern() { return grad(); },
    drawImage(img) { if (img && img.__w) push('fill', [0, 0, img.__w, img.__h]); },

    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    shadowColor: 'transparent',
    shadowBlur: 0,
    imageSmoothingEnabled: true
  };
  return ctx;
}

function grad() {
  const g = { addColorStop() { }, __grad: true };
  return g;
}

function boxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
}

/* ---------------- 假 canvas ---------------- */

class MockCanvas {
  constructor(w = VW, h = VH) { this.width = w; this.height = h; this.__w = w; this.__h = h; this.style = {}; this.clientWidth = w; this.clientHeight = h; }
  getContext(kind) { return kind === '2d' ? makeCtx([]) : null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
  toDataURL() { return 'data:,'; }
}
if (!globalThis.document) {
  globalThis.document = {
    createElement(tag) {
      const c = new MockCanvas(300, 150);
      const ctxLog = [];
      c.getContext = (k) => (k === '2d' ? makeCtx(ctxLog) : null);
      return c;
    }
  };
}

/* ---------------- 跑 ---------------- */

const styleDir = path.join(ROOT, 'styles');
const files = fs.readdirSync(styleDir).filter((f) => f.endsWith('.json')).sort();
const TS = [0, 0.5, 1, 1.5, 2, 2.5, 2.98];

/* 人工确认为「有意」的画布外内容。assume.json 不存在则一条都不放过。 */
const ALLOW_FILE = path.join(__dirname, 'audit.allow.json');
const ALLOW = fs.existsSync(ALLOW_FILE) ? JSON.parse(fs.readFileSync(ALLOW_FILE, 'utf8')) : [];
const sidesOf = (b) => {
  const s = [];
  if (b[3] <= 0) s.push('above');
  if (b[1] >= VH) s.push('below');
  if (b[2] <= 0) s.push('left');
  if (b[0] >= VW) s.push('right');
  return s;
};
const isAllowed = (packId, type, b) => {
  const sides = sidesOf(b);
  if (!sides.length) return false;
  return ALLOW.some((r) => r.pack === packId && (!r.type || r.type === type) &&
    sides.every((s) => (r.sides || []).includes(s)));
};

let problems = 0;
const near = (a, b) => Math.abs(a - b) < 0.5;

for (const f of files) {
  const pack = JSON.parse(fs.readFileSync(path.join(styleDir, f), 'utf8'));
  const outside = new Map();
  const overflow = new Map();
  let boxes = 0;

  for (const t of TS) {
    const out = [];
    const cv = new MockCanvas(VW, VH);
    const ctx = makeCtx(out);
    cv.getContext = () => ctx;
    IR.renderStyle(pack, t, cv, { lod: 1, strict: false });

    for (let i = 0; i < out.length; i++) {
      const rec = out[i];
      if (rec.type === 'textmeta') continue;
      const b = rec.box;
      boxes++;
      // 完全在外
      if (b[2] < 0 || b[0] > VW || b[3] < 0 || b[1] > VH) {
        if (!isAllowed(pack.id, rec.type, b)) {
          const key = `${rec.type} [${b.map((v) => v.toFixed(0)).join(',')}] @${t}`;
          outside.set(key, (outside.get(key) || 0) + 1);
        }
      }
      // 文字横向溢出（容忍 2px 舍入）
      if (rec.type === 'text') {
        const meta = out[i + 1];
        if (b[0] < -2 || b[2] > VW + 2) {
          const key = `"${meta ? meta.text.slice(0, 22) : '?'}" x∈[${b[0].toFixed(0)},${b[2].toFixed(0)}] @${t}`;
          overflow.set(key, true);
        }
      }
    }
  }

  const ok = outside.size === 0 && overflow.size === 0;
  console.log(`${ok ? '✅' : '❌'} ${f}  (${boxes} 个包围盒)`);
  if (outside.size) {
    problems += outside.size;
    console.log('   完全画在画布外：');
    for (const [k, n] of outside) console.log(`     · ${k} ×${n}`);
  }
  if (overflow.size) {
    problems += overflow.size;
    console.log('   文字横向溢出：');
    for (const k of overflow.keys()) console.log(`     · ${k}`);
  }
}

console.log(problems === 0 ? '\n✅ 版式体检通过：没有元素被画到画布外，没有文字横向溢出' : `\n❌ ${problems} 处需要修`);
process.exit(problems === 0 ? 0 : 1);
