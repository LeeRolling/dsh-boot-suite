/*!
 * ir-player.js — 通用「风格 IR」播放器
 * ---------------------------------------------------------------------------
 * 无外部依赖 / 纯 Canvas 2D / 1920x1080 逻辑画布 / file:// 可离线运行。
 *
 * 契约：
 *   IR.renderStyle(pack, t[, canvasOrCtx][, opts])  —— 把风格包 pack 在时刻 t 画出来
 *   t ∈ [0, pack.duration]，且要求  renderStyle(pack, duration) ≡ renderStyle(pack, 0)
 *   （即整段是无缝循环；播放器自己不做 t 取模，方便自检比对首尾两帧）
 *
 * 画面是 t 的纯函数：同一 t 画两次必须像素级一致。
 * 禁止 Math.random / Date.now / 任何跨帧累积状态；随机数只来自 mulberry32(seed)。
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  var IR = factory();
  if (typeof module === 'object' && module.exports) module.exports = IR;
  if (root) root.IR = IR;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VW = 1920, VH = 1080, TAU = Math.PI * 2;

  /* =======================================================================
   * 0. 基础数学 / 缓动
   * ===================================================================== */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function invlerp(a, b, v) { return b === a ? 0 : (v - a) / (b - a); }
  function smoothstep(a, b, x) {
    var t = clamp01((x - a) / (b - a || 1e-9));
    return t * t * (3 - 2 * t);
  }
  function smootherstep(a, b, x) {
    var t = clamp01((x - a) / (b - a || 1e-9));
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  /** 循环相位：t 在 0..D 上跑 k 圈，返回 [0,1)。t=D 时与 t=0 相同。 */
  function cyc(t, D, k, ph) {
    var v = (t * (k == null ? 1 : k)) / (D || 1) + (ph || 0);
    v = v - Math.floor(v);
    return v;
  }
  /** 无缝脉冲：0 → 1 → 0，t=0 与 t=D 相等且导数为 0。 */
  function pulse(t, D, k, ph) { return 0.5 - 0.5 * Math.cos(TAU * cyc(t, D, k, ph)); }
  function bez2(a, c, b, k) {
    var m = 1 - k;
    return [m * m * a[0] + 2 * m * k * c[0] + k * k * b[0],
            m * m * a[1] + 2 * m * k * c[1] + k * k * b[1]];
  }
  function dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)); }

  var EASE = {
    linear: function (p) { return p; },
    inQuad: function (p) { return p * p; },
    outQuad: function (p) { return 1 - (1 - p) * (1 - p); },
    inOutQuad: function (p) { return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; },
    inCubic: function (p) { return p * p * p; },
    outCubic: function (p) { return 1 - Math.pow(1 - p, 3); },
    inOutCubic: function (p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    inQuart: function (p) { return p * p * p * p; },
    outQuart: function (p) { return 1 - Math.pow(1 - p, 4); },
    inOutQuart: function (p) { return p < .5 ? 8 * Math.pow(p, 4) : 1 - Math.pow(-2 * p + 2, 4) / 2; },
    outQuint: function (p) { return 1 - Math.pow(1 - p, 5); },
    inExpo: function (p) { return p <= 0 ? 0 : Math.pow(2, 10 * p - 10); },
    outExpo: function (p) { return p >= 1 ? 1 : 1 - Math.pow(2, -10 * p); },
    inOutExpo: function (p) {
      if (p <= 0) return 0; if (p >= 1) return 1;
      return p < .5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2;
    },
    inSine: function (p) { return 1 - Math.cos(p * Math.PI / 2); },
    outSine: function (p) { return Math.sin(p * Math.PI / 2); },
    inOutSine: function (p) { return -(Math.cos(Math.PI * p) - 1) / 2; },
    outCirc: function (p) { return Math.sqrt(1 - Math.pow(p - 1, 2)); },
    outBack: function (p) { var c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    outBackSoft: function (p) { var c = .9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    inOutBack: function (p) {
      var c = 1.70158 * 1.525;
      return p < .5
        ? (Math.pow(2 * p, 2) * ((c + 1) * 2 * p - c)) / 2
        : (Math.pow(2 * p - 2, 2) * ((c + 1) * (p * 2 - 2) + c) + 2) / 2;
    },
    outElastic: function (p) {
      if (p === 0 || p === 1) return p;
      var c = TAU / 3;
      return Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * c) + 1;
    },
    smoothstep: function (p) { return p * p * (3 - 2 * p); },
    smootherstep: function (p) { return p * p * p * (p * (p * 6 - 15) + 10); },
    step: function (p) { return p < 1 ? 0 : 1; },
    hold: function (p) { return 0; }
  };
  function easeFn(name) {
    if (typeof name === 'function') return name;
    return EASE[name] || EASE.linear;
  }

  /* =======================================================================
   * 1. 确定性随机
   * ===================================================================== */

  /** mulberry32：32 位种子，跨浏览器逐位一致。 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** FNV-1a，把字符串 id 变成种子。 */
  function hashStr(s) {
    var h = 2166136261 >>> 0, i, n;
    s = String(s);
    for (i = 0, n = s.length; i < n; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rangeOf(rng, a, b) { return a + (b - a) * rng(); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

  /* =======================================================================
   * 2. 颜色
   * ===================================================================== */

  var rgbCache = Object.create(null);
  function hex2rgb(h) {
    var v = rgbCache[h];
    if (v) return v;
    var s = String(h).replace('#', '').trim();
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    if (!isFinite(n)) { v = [255, 0, 255]; }
    else { v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    rgbCache[h] = v;
    return v;
  }
  function rgb2hex(r, g, b) {
    var f = function (x) { x = Math.round(clamp(x, 0, 255)); return (x < 16 ? '0' : '') + x.toString(16); };
    return '#' + f(r) + f(g) + f(b);
  }
  /** 解析颜色：'$key' 走调色板；'#rgb' / '#rrggbb' 直接；其它（rgb()/hsl()/named）原样透传。 */
  function col(v, pal, alpha) {
    if (v == null) v = '#ffffff';
    if (typeof v === 'string' && v.charAt(0) === '$') v = (pal && pal[v.slice(1)]) || '#ff00ff';
    if (typeof v !== 'string') return String(v);
    if (alpha == null || alpha >= 1) return v;
    if (v.charAt(0) === '#') {
      var c = hex2rgb(v);
      return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (Math.round(clamp01(alpha) * 1000) / 1000) + ')';
    }
    return v;
  }
  function alphaOf(v, a) { return col(v, null, a); }
  function mix(c1, c2, k) {
    var a = hex2rgb(c1), b = hex2rgb(c2);
    k = clamp01(k);
    return rgb2hex(lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k));
  }
  function shade(c, k) { // k>0 提亮，k<0 压暗
    var a = hex2rgb(c);
    if (k >= 0) return mix(c, '#ffffff', k);
    return mix(c, '#000000', -k);
  }

  /* =======================================================================
   * 3. 字体（全部系统字体，无外链）
   * ===================================================================== */

  var FONTS = {
    serif: 'Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", SimSun, serif',
    serifCJK: '"Songti SC", SimSun, "Noto Serif SC", "Times New Roman", serif',
    sans: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", Arial, sans-serif',
    sansHeavy: '"Microsoft YaHei", "PingFang SC", "Arial Black", sans-serif',
    mono: '"Cascadia Mono", Consolas, "DejaVu Sans Mono", "Courier New", monospace',
    display: 'Impact, Haettenschweiler, "Arial Black", "Microsoft YaHei", sans-serif',
    comic: 'Impact, Haettenschweiler, "Arial Black", "Microsoft YaHei", sans-serif',
    math: '"Cambria Math", Cambria, Georgia, "Times New Roman", serif'
  };
  function fontStr(q) {
    var fam = FONTS[q.font] || q.font || FONTS.sans;
    var size = q.size == null ? 48 : q.size;
    var style = (q.italic ? 'italic ' : '') + (q.weight ? q.weight + ' ' : '');
    return style + size + 'px ' + fam;
  }
  function setFont(c, q) { c.font = fontStr(q); }

  /** 手写字距（letterSpacing 兼容性差，逐字绘制）。 */
  function trackedWidth(c, txt, tracking) {
    if (!tracking) return c.measureText(txt).width;
    var w = 0, i;
    for (i = 0; i < txt.length; i++) w += c.measureText(txt.charAt(i)).width + tracking;
    return w - tracking;
  }
  function fillTracked(c, txt, x, y, tracking, align) {
    txt = String(txt);
    if (!tracking) { c.textAlign = align || 'left'; c.fillText(txt, x, y); return; }
    var total = trackedWidth(c, txt, tracking);
    var px = align === 'center' ? x - total / 2 : (align === 'right' ? x - total : x);
    var prev = c.textAlign;
    c.textAlign = 'left';
    for (var i = 0; i < txt.length; i++) {
      c.fillText(txt.charAt(i), px, y);
      px += c.measureText(txt.charAt(i)).width + tracking;
    }
    c.textAlign = prev;
  }
  function strokeTracked(c, txt, x, y, tracking, align) {
    txt = String(txt);
    if (!tracking) { c.textAlign = align || 'left'; c.strokeText(txt, x, y); return; }
    var total = trackedWidth(c, txt, tracking);
    var px = align === 'center' ? x - total / 2 : (align === 'right' ? x - total : x);
    var prev = c.textAlign;
    c.textAlign = 'left';
    for (var i = 0; i < txt.length; i++) {
      c.strokeText(txt.charAt(i), px, y);
      px += c.measureText(txt.charAt(i)).width + tracking;
    }
    c.textAlign = prev;
  }

  /* =======================================================================
   * 4. 几何路径
   * ===================================================================== */

  function pathPts(c, pts, closed) {
    if (!pts || !pts.length) return;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (closed !== false) c.closePath();
  }
  function roundRectPath(c, x, y, w, h, r) {
    r = Math.min(r == null ? 0 : r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }
  function starPath(c, cx, cy, rOut, rIn, n, rot, jitter, rng) {
    n = Math.max(3, n | 0);
    var pts = [], i, a, r;
    for (i = 0; i < n * 2; i++) {
      a = rot + (i / (n * 2)) * TAU;
      r = (i % 2 === 0) ? rOut : rIn;
      if (jitter && rng) r *= 1 + (rng() - .5) * jitter;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    pathPts(c, pts, true);
    return pts;
  }
  function polyArea(pts) {
    var a = 0, i, j;
    for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
    }
    return Math.abs(a / 2);
  }
  function centroid(pts) {
    var x = 0, y = 0, i;
    for (i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; }
    return [x / pts.length, y / pts.length];
  }

  /* =======================================================================
   * 5. 画布
   * ===================================================================== */

  function makeCanvas(w, h) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, w | 0);
    cv.height = Math.max(1, h | 0);
    return cv;
  }

  /**
   * 按 CSS 尺寸 + DPR 调整位图，并把坐标系设成 1920x1080。
   * @returns {{ctx:CanvasRenderingContext2D, scale:number, dpr:number, width:number, height:number}}
   */
  function fitCanvas(canvas, opts) {
    opts = opts || {};
    var rect = (opts.width && opts.height) ? { width: opts.width, height: opts.height }
      : (canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: VW, height: VH });
    var cw = Math.max(1, Math.round(rect.width || VW));
    var ch = Math.max(1, Math.round(rect.height || VH));
    var deviceDpr = (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) ? devicePixelRatio : 1;
    var dpr = Math.min(opts.dpr || deviceDpr, opts.maxDpr || 2);
    var bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    var ctx = canvas.getContext('2d', { alpha: false });
    var contain = opts.fit === 'contain';
    var s = contain ? Math.min(bw / VW, bh / VH) : Math.max(bw / VW, bh / VH);
    ctx.setTransform(s, 0, 0, s, (bw - VW * s) / 2, (bh - VH * s) / 2);
    ctx.imageSmoothingEnabled = true;
    return { ctx: ctx, scale: s, dpr: dpr, width: bw, height: bh, cssWidth: cw, cssHeight: bh / dpr };
  }

  /* =======================================================================
   * 6. 背景 / 纹理
   * ===================================================================== */

  function addStops(g, stops, pal) {
    if (!stops) return;
    for (var i = 0; i < stops.length; i++) {
      var st = stops[i];
      if (Array.isArray(st)) g.addColorStop(clamp01(st[1] == null ? 0 : st[1]), col(st[0], pal));
      else g.addColorStop(clamp01(st.at == null ? 0 : st.at), col(st.c, pal, st.a));
    }
  }

  function fillGradLayer(c, L, pal) {
    var g, w = L.rect ? L.rect[0] : 0, y = L.rect ? L.rect[1] : 0,
        ww = L.rect ? L.rect[2] : VW, hh = L.rect ? L.rect[3] : VH;
    if (L.type === 'radial') {
      var cx = L.x == null ? VW / 2 : L.x, cy = L.y == null ? VH / 2 : L.y;
      g = c.createRadialGradient(cx, cy, L.r0 == null ? 0 : L.r0, cx, cy, L.r == null ? VW * .5 : L.r);
    } else {
      var ang = (L.angle == null ? 90 : L.angle) * Math.PI / 180;
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var cx2 = L.x == null ? VW / 2 : L.x, cy2 = L.y == null ? VH / 2 : L.y;
      var len = (Math.abs(VW * dx) + Math.abs(VH * dy)) / 2;
      g = c.createLinearGradient(cx2 - dx * len, cy2 - dy * len, cx2 + dx * len, cy2 + dy * len);
    }
    addStops(g, L.stops, pal);
    c.fillStyle = g;
    if (L.rect) c.fillRect(w, y, ww, hh); else c.fillRect(0, 0, VW, VH);
  }

  function drawBackground(c, spec, pal) {
    if (!spec) { c.fillStyle = col('$bg', pal, 1); c.fillRect(0, 0, VW, VH); return; }
    var layers = spec.type === 'layers' ? (spec.layers || []) : [spec];
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      c.save();
      c.globalAlpha = L.alpha == null ? 1 : L.alpha;
      if (L.type === 'linear' || L.type === 'radial') fillGradLayer(c, L, pal);
      else { c.fillStyle = col(L.color || '$bg', pal); c.fillRect(0, 0, VW, VH); }
      c.restore();
    }
  }

  var PATCACHE = Object.create(null);
  /** 把一次性的纹理画进离屏 canvas 并缓存（确定性：内容只由 seed/参数决定）。 */
  function cachedLayer(key, w, h, draw) {
    var hit = PATCACHE[key];
    if (hit) return hit;
    var cv = makeCanvas(w, h);
    if (!cv) return null;
    var c2 = cv.getContext('2d');
    c2.clearRect(0, 0, w, h);
    draw(c2);
    PATCACHE[key] = cv;
    return cv;
  }

  function drawTexture(S, spec) {
    if (!spec || !spec.type || spec.type === 'none') return;
    var c = S.ctx, pal = S.pal, a = spec.alpha == null ? .5 : spec.alpha;
    var seed = spec.seed == null ? hashStr((S.pack.id || '') + ':tex') : spec.seed;
    var key = spec.type + '|' + seed + '|' + JSON.stringify(spec);
    var cv = cachedLayer(key, VW, VH, function (g) {
      var rng = mulberry32(seed);
      var i, n, x, y;
      if (spec.type === 'grain' || spec.type === 'speckle' || spec.type === 'fiber') {
        n = spec.count || (spec.type === 'fiber' ? 900 : 4200);
        var cols = spec.colors || ['#000000', '#ffffff'];
        for (i = 0; i < n; i++) {
          x = rng() * VW; y = rng() * VH;
          if (spec.type === 'fiber') {
            var len = (u2(rng) * 40 + 8), ang = (rng() - .5) * .28 + (rng() < .5 ? 0 : Math.PI / 2);
            g.strokeStyle = col(cols[i % cols.length], pal, .05 + rng() * .05);
            g.lineWidth = 1;
            g.beginPath(); g.moveTo(x, y);
            g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
            g.stroke();
          } else {
            var s2 = (spec.min == null ? 1 : spec.min) + rng() * ((spec.max == null ? 2.2 : spec.max) - (spec.min == null ? 1 : spec.min));
            g.fillStyle = col(cols[i % cols.length], pal, .03 + rng() * .07);
            g.fillRect(x, y, s2, s2);
          }
        }
      } else if (spec.type === 'canvas') {
        n = spec.count || 2600;
        for (i = 0; i < n; i++) {
          x = rng() * VW; y = rng() * VH;
          var ang2 = (rng() - .5) * .5 + (rng() < .5 ? 0 : Math.PI / 2) + (rng() - .5) * .5;
          g.strokeStyle = 'rgba(' + (rng() < .5 ? '255,232,190' : '0,0,0') + ',' + (.02 + rng() * .04).toFixed(3) + ')';
          g.lineWidth = .8 + rng() * 1.4;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang2) * (3 + rng() * 9), y + Math.sin(ang2) * (3 + rng() * 9)); g.stroke();
        }
      } else if (spec.type === 'scanlines') {
        var gap = spec.gap || 3, dark = spec.color || '#000000';
        g.fillStyle = col(dark, pal, spec.amount == null ? .35 : spec.amount);
        for (y = 0; y < VH; y += gap) g.fillRect(0, y, VW, Math.max(1, gap * .5));
      } else if (spec.type === 'dots') {
        n = spec.count || 1400;
        var rad = spec.size || 1.6;
        for (i = 0; i < n; i++) {
          x = rng() * VW; y = rng() * VH;
          g.fillStyle = col(spec.color || '$ink', pal, .02 + rng() * .05);
          g.beginPath(); g.arc(x, y, rad * (.5 + rng()), 0, TAU); g.fill();
        }
      }
      function u2(r) { return r(); }
    });
    if (!cv) return;
    c.save();
    c.globalAlpha = a;
    c.drawImage(cv, 0, 0, VW, VH);
    c.restore();
  }

  /* =======================================================================
   * 7. 原语注册表
   * ===================================================================== */

  var PRIM = Object.create(null);
  function def(name, fn) { PRIM[name] = fn; }

  /* --- 7.1 色块 ------------------------------------------------------- */

  def('rect', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    c.save();
    c.globalAlpha = A;
    if (q.blend) c.globalCompositeOperation = q.blend;
    var x = q.x || 0, y = q.y || 0, w = q.w == null ? VW : q.w, h = q.h == null ? VH : q.h;
    if (q.rot) {
      var px = q.ox == null ? x + w / 2 : q.ox, py = q.oy == null ? y + h / 2 : q.oy;
      c.translate(px, py); c.rotate(q.rot * Math.PI / 180); c.translate(-px, -py);
    }
    var grow = q.grow == null ? 1 : lerp(0, 1, q.grow) * (q.growFrom == null ? 1 : 1);
    if (q.grow != null) { w *= grow; h *= grow; x += (q.w == null ? VW : q.w) * (1 - grow) / 2; y += (q.h == null ? VH : q.h) * (1 - grow) / 2; }
    var reveal = q.reveal == null ? 1 : clamp01(q.reveal);
    if (reveal < 1) {
      c.beginPath();
      if (q.revealFrom === 'right') c.rect(x + w * (1 - reveal), y, w * reveal, h);
      else if (q.revealFrom === 'up') c.rect(x, y + h * (1 - reveal), w, h * reveal);
      else if (q.revealFrom === 'center') c.rect(x + w * (1 - reveal) / 2, y, w * reveal, h);
      else c.rect(x, y, w * reveal, h);
      c.clip();
    }
    if (q.grad) {
      var g = q.grad.type === 'radial'
        ? c.createRadialGradient(q.x + w / 2, q.y + h / 2, 0, q.x + w / 2, q.y + h / 2, Math.max(w, h) * .6)
        : (function () {
            var a = (q.grad.angle == null ? 90 : q.grad.angle) * Math.PI / 180;
            return c.createLinearGradient(x, y, x + Math.cos(a) * w, y + Math.sin(a) * h);
          })();
      addStops(g, q.grad.stops, pal);
      c.fillStyle = g;
    } else c.fillStyle = col(q.fill || '#ffffff', pal);
    if (q.radius) { roundRectPath(c, x, y, w, h, q.radius); c.fill(); }
    else c.fillRect(x, y, w, h);
    if (q.stroke) {
      c.strokeStyle = col(q.stroke, pal);
      c.lineWidth = q.lineWidth == null ? 2 : q.lineWidth;
      if (q.radius) { roundRectPath(c, x, y, w, h, q.radius); c.stroke(); }
      else c.strokeRect(x, y, w, h);
    }
    c.restore();
  });

  /* --- 7.2 多边形色块 ------------------------------------------------- */

  def('poly', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0 || !q.pts) return;
    c.save();
    c.globalAlpha = A;
    if (q.blend) c.globalCompositeOperation = q.blend;
    var pts = q.pts, i, p2 = [];
    var sc = q.scale == null ? 1 : q.scale;
    // pv：指定铰点/轴心（不写则用质心）。折纸的翅膀、铰链必须绕铰点转，不能绕质心。
    var ce = q.pv ? [q.pv[0], q.pv[1]] : centroid(pts);
    for (i = 0; i < pts.length; i++) {
      var dx = pts[i][0] - ce[0], dy = pts[i][1] - ce[1];
      var px = ce[0] + (q.ox == null ? 0 : q.ox) + dx * sc;
      var py = ce[1] + (q.oy == null ? 0 : q.oy) + dy * sc;
      if (q.rot) {
        var r = q.rot * Math.PI / 180, ax = px - ce[0], ay = py - ce[1];
        px = ce[0] + ax * Math.cos(r) - ay * Math.sin(r);
        py = ce[1] + ax * Math.sin(r) + ay * Math.cos(r);
      }
      p2.push([px, py]);
    }
    pathPts(c, p2, q.closed !== false);
    if (q.fill) { c.fillStyle = col(q.fill, pal); c.fill(); }
    if (q.stroke) {
      c.strokeStyle = col(q.stroke, pal);
      c.lineWidth = q.lineWidth == null ? 2 : q.lineWidth;
      c.lineJoin = q.lineJoin || 'miter';
      c.stroke();
    }
    c.restore();
  });

  /* --- 7.3 线条 ------------------------------------------------------- */

  function segLen(pts) {
    var n = 0, i;
    for (i = 1; i < pts.length; i++) n += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    return n;
  }
  function strokePartial(c, pts, prog) {
    var total = segLen(pts), want = total * clamp01(prog), acc = 0, i;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) {
      var l = dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      if (acc + l >= want) {
        var k = l ? (want - acc) / l : 0;
        c.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
        c.stroke();
        return;
      }
      acc += l;
      c.lineTo(pts[i][0], pts[i][1]);
    }
    c.stroke();
  }

  def('line', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var pts = q.pts;
    if (!pts) pts = [[q.x1 == null ? 0 : q.x1, q.y1 == null ? 0 : q.y1],
                     [q.x2 == null ? VW : q.x2, q.y2 == null ? VH : q.y2]];
    c.save();
    c.globalAlpha = A;
    c.strokeStyle = col(q.color || '$ink', pal);
    c.lineWidth = q.width == null ? 2 : q.width;
    c.lineCap = q.cap || 'round';
    c.lineJoin = 'round';
    if (q.dash && c.setLineDash) c.setLineDash(q.dash);
    if (q.progress == null || q.progress >= 1) {
      pathPts(c, pts, false); c.stroke();
    } else strokePartial(c, pts, q.progress);
    if (c.setLineDash) c.setLineDash([]);
    c.restore();
  });

  /* --- 7.4 线框（从四角画出来） --------------------------------------- */

  def('frame', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var p = clamp01(q.progress == null ? 1 : q.progress);
    var x = q.x || 0, y = q.y || 0, w = q.w == null ? VW : q.w, h = q.h == null ? VH : q.h;
    c.save();
    c.globalAlpha = A;
    c.strokeStyle = col(q.color || '$ink', pal);
    c.lineWidth = q.width == null ? 1.7 : q.width;
    var cx = x + w / 2, cy = y + h / 2;
    if (q.from === 'center') {
      var hw = (w / 2) * p, hh = (h / 2) * p;
      c.beginPath();
      c.moveTo(cx - hw, y); c.lineTo(cx + hw, y);
      c.moveTo(cx - hw, y + h); c.lineTo(cx + hw, y + h);
      c.moveTo(x, cy - hh); c.lineTo(x, cy + hh);
      c.moveTo(x + w, cy - hh); c.lineTo(x + w, cy + hh);
      c.stroke();
    } else {
      // 四角 → 中间：四段各自从角点出发
      var L = (w / 2) * clamp01(p * 1.0), V = (h / 2) * clamp01(p * 1.0);
      c.beginPath();
      c.moveTo(x, y); c.lineTo(x + L, y);
      c.moveTo(x, y); c.lineTo(x, y + V);
      c.moveTo(x + w, y); c.lineTo(x + w - L, y);
      c.moveTo(x + w, y); c.lineTo(x + w, y + V);
      c.moveTo(x, y + h); c.lineTo(x + L, y + h);
      c.moveTo(x, y + h); c.lineTo(x, y + h - V);
      c.moveTo(x + w, y + h); c.lineTo(x + w - L, y + h);
      c.moveTo(x + w, y + h); c.lineTo(x + w, y + h - V);
      c.stroke();
    }
    c.restore();
  });

  /* --- 7.5 文字 ------------------------------------------------------- */

  def('text', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var lines = q.lines || [q.text == null ? '' : q.text];
    var size = q.size == null ? 48 : q.size;
    var lh = q.lineHeight == null ? size * 1.22 : q.lineHeight;
    var x = q.x == null ? VW / 2 : q.x;
    var y = q.y == null ? VH / 2 : q.y;
    var trk = q.tracking == null ? 0 : (typeof q.tracking === 'number' ? q.tracking : 0);
    var align = q.align || 'left';
    c.save();
    c.globalAlpha = A;
    setFont(c, { font: q.font, size: size, weight: q.weight, italic: q.italic });
    c.textBaseline = q.baseline || 'alphabetic';
    if (q.maxWidth) { /* 交给浏览器压缩 */ }
    // 文字底衬
    if (q.box) {
      var bw = 0, i0;
      for (i0 = 0; i0 < lines.length; i0++) bw = Math.max(bw, trackedWidth(c, String(lines[i0]), trk));
      var padX = q.box.padX == null ? 26 : q.box.padX;
      var padY = q.box.padY == null ? 14 : q.box.padY;
      var bx = align === 'center' ? x - bw / 2 - padX : (align === 'right' ? x - bw - padX : x - padX);
      var by = y - size - padY + (q.box.dy || 0);
      var bwd = bw + padX * 2, bhd = lh * lines.length + padY * 2 - (lh - size);
      c.save();
      c.globalAlpha = A * (q.box.alpha == null ? 1 : q.box.alpha);
      c.fillStyle = col(q.box.fill || '#000000', pal);
      roundRectPath(c, bx, by, bwd, bhd, q.box.radius || 0);
      c.fill();
      if (q.box.stroke) { c.strokeStyle = col(q.box.stroke, pal); c.lineWidth = q.box.lineWidth || 2; c.stroke(); }
      c.restore();
    }
    for (var i = 0; i < lines.length; i++) {
      var ly = y + i * lh;
      var txt = String(lines[i]);
      if (q.rot) {
        c.save();
        c.translate(x, ly); c.rotate(q.rot * Math.PI / 180); c.translate(-x, -ly);
      }
      if (q.glow) {
        c.shadowColor = col(q.glowColor || q.color || '#ffffff', pal, q.glowAlpha == null ? .8 : q.glowAlpha);
        c.shadowBlur = q.glow;
      }
      if (q.stroke) {
        c.strokeStyle = col(q.stroke, pal);
        c.lineWidth = q.strokeWidth == null ? Math.max(2, size * .05) : q.strokeWidth;
        c.lineJoin = 'round';
        c.miterLimit = 2;
        strokeTracked(c, txt, x, ly, trk, align);
      }
      c.fillStyle = col(q.color || '$fg', pal);
      fillTracked(c, txt, x, ly, trk, align);
      if (q.glow) { c.shadowBlur = 0; c.shadowColor = 'transparent'; }
      if (q.rot) c.restore();
    }
    c.restore();
  });

  /* --- 7.6 打字机（字符数由进度决定，纯函数） ------------------------- */

  def('type_text', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var txt = String(q.text == null ? '' : q.text);
    var prog = clamp01(q.progress == null ? e.p : q.progress);
    var n = q.chars != null ? Math.min(txt.length, q.chars) : Math.round(prog * txt.length);
    var shown = txt.slice(0, n);
    var size = q.size == null ? 40 : q.size;
    var trk = q.tracking == null ? 0 : q.tracking;
    c.save();
    c.globalAlpha = A;
    setFont(c, { font: q.font, size: size, weight: q.weight, italic: q.italic });
    c.textBaseline = q.baseline || 'alphabetic';
    if (q.glow) { c.shadowColor = col(q.glowColor || q.color, pal, .85); c.shadowBlur = q.glow; }
    c.fillStyle = col(q.color || '$fg', pal);
    fillTracked(c, shown, q.x, q.y, trk, q.align || 'left');
    if (q.cursor) {
      var cw = Math.max(size * .5, trackedWidth(c, 'M', trk));
      var on = q.cursorPhase == null ? 1 : (Math.cos(TAU * q.cursorPhase) > 0 ? 1 : 0);
      if (on) {
        var cx0 = trackedWidth(c, shown, trk) + 4;
        var ax = q.align === 'center' ? q.x + cx0 - trackedWidth(c, txt, trk) / 2 : (q.align === 'right' ? q.x : q.x + cx0);
        c.fillStyle = col(q.cursorColor || q.color || '$fg', pal, .9);
        c.fillRect(ax, q.y - size * .78, cw * .62, size * .95);
      }
    }
    c.restore();
  });

  /* --- 7.7 网格 ------------------------------------------------------- */

  def('grid', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var x = q.x || 0, y = q.y || 0, w = q.w == null ? VW : q.w, h = q.h == null ? VH : q.h;
    var sp = q.spacing || 80, major = q.majorEvery || 5;
    var prog = clamp01(q.progress == null ? 1 : q.progress);
    c.save();
    c.globalAlpha = A;
    c.lineWidth = q.width == null ? 1 : q.width;
    c.strokeStyle = col(q.color || '$grid', pal);
    var i, n;
    n = Math.floor(w / sp);
    for (i = 0; i <= n; i++) {
      if ((i % major) === 0) continue;
      c.globalAlpha = A * (q.minorAlpha == null ? .45 : q.minorAlpha) * smoothstep(0, .35, prog);
      c.beginPath(); c.moveTo(x + i * sp, y); c.lineTo(x + i * sp, y + h * clamp01(prog * 1.6)); c.stroke();
    }
    n = Math.floor(h / sp);
    for (i = 0; i <= n; i++) {
      if ((i % major) === 0) continue;
      c.globalAlpha = A * (q.minorAlpha == null ? .45 : q.minorAlpha) * smoothstep(0, .35, prog);
      c.beginPath(); c.moveTo(x, y + i * sp); c.lineTo(x + w * clamp01(prog * 1.6), y + i * sp); c.stroke();
    }
    c.globalAlpha = A * (q.majorAlpha == null ? 1 : q.majorAlpha);
    n = Math.floor(w / sp);
    for (i = 0; i <= n; i += major) {
      c.beginPath(); c.moveTo(x + i * sp, y); c.lineTo(x + i * sp, y + h * clamp01(prog * 1.6)); c.stroke();
    }
    n = Math.floor(h / sp);
    for (i = 0; i <= n; i += major) {
      c.beginPath(); c.moveTo(x, y + i * sp); c.lineTo(x + w * clamp01(prog * 1.6), y + i * sp); c.stroke();
    }
    c.restore();
  });

  /* --- 7.8 发光点 ----------------------------------------------------- */

  def('glow_dot', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var x = q.x, y = q.y, r = q.r == null ? 14 : q.r;
    var k = q.pulse == null ? 1 : lerp(1 - (q.pulseAmp == null ? .35 : q.pulseAmp), 1, pulse(S.t, S.D, q.pulseK == null ? 4 : q.pulseK, q.phase || 0));
    c.save();
    c.globalCompositeOperation = q.blend || 'lighter';
    var g = c.createRadialGradient(x, y, 0, x, y, r * 4.2 * k);
    g.addColorStop(0, col(q.color || '$accent', pal, .95 * A));
    g.addColorStop(.25, col(q.color || '$accent', pal, .35 * A));
    g.addColorStop(1, col(q.color || '$accent', pal, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r * 4.2 * k, 0, TAU); c.fill();
    c.globalAlpha = A;
    c.fillStyle = col(q.core || '#fff8e8', pal);
    c.beginPath(); c.arc(x, y, r * .55 * k, 0, TAU); c.fill();
    c.restore();
  });

  /* --- 7.9 箭头 ------------------------------------------------------- */

  def('arrow', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var x1 = q.x1, y1 = q.y1, x2 = q.x2, y2 = q.y2;
    var p = clamp01(q.progress == null ? 1 : q.progress);
    var ex = lerp(x1, x2, p), ey = lerp(y1, y2, p);
    var ang = Math.atan2(y2 - y1, x2 - x1);
    var hs = q.head == null ? 18 : q.head;
    c.save();
    c.globalAlpha = A;
    c.strokeStyle = col(q.color || '$accent', pal);
    c.fillStyle = col(q.color || '$accent', pal);
    c.lineWidth = q.width == null ? 4 : q.width;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(ex, ey); c.stroke();
    if (p > .12) {
      c.beginPath();
      c.moveTo(ex, ey);
      c.lineTo(ex - hs * Math.cos(ang - .42), ey - hs * Math.sin(ang - .42));
      c.lineTo(ex - hs * Math.cos(ang + .42), ey - hs * Math.sin(ang + .42));
      c.closePath(); c.fill();
    }
    c.restore();
  });

  /* --- 7.10 编号徽章 -------------------------------------------------- */

  def('badge', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    c.save();
    c.globalAlpha = A;
    var w = q.w == null ? 96 : q.w, h = q.h == null ? 96 : q.h;
    c.fillStyle = col(q.fill || '$accent', pal);
    if (q.circle) { c.beginPath(); c.arc(q.x + w / 2, q.y + h / 2, Math.min(w, h) / 2, 0, TAU); c.fill(); }
    else c.fillRect(q.x, q.y, w, h);
    setFont(c, { font: q.font || 'mono', size: q.size == null ? 46 : q.size, weight: q.weight || 700 });
    c.fillStyle = col(q.fg || '$bg', pal);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(q.label == null ? '' : q.label), q.x + w / 2, q.y + h / 2 + (q.dy || 0));
    c.restore();
  });

  /* --- 7.11 波形 ------------------------------------------------------ */

  def('wave', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var x = q.x || 0, w = q.w == null ? VW : q.w;
    var yc = q.y == null ? VH / 2 : q.y;
    var amp = q.amp == null ? 80 : q.amp;
    var k = q.k == null ? 2 : q.k;          // 每个循环的周期数（整数保证无缝）
    var ph = q.phase || 0;
    var n = q.samples || 220;
    var grow = clamp01(q.progress == null ? 1 : q.progress);
    var pts = [], i;
    for (i = 0; i <= n * grow; i++) {
      var u = i / n, px = x + u * w;
      var env = Math.sin(Math.PI * clamp01(u * (q.env == null ? 1 : q.env)));
      var v = Math.sin(TAU * (u * k + ph - cyc(S.t, S.D, q.speedK == null ? 1 : q.speedK, 0)));
      if (q.k2) v = v * .62 + Math.sin(TAU * (u * q.k2 + ph * 1.7)) * .38;
      pts.push([px, yc - v * amp * (q.envelope === false ? 1 : env)]);
    }
    if (pts.length < 2) return;
    c.save();
    c.globalAlpha = A;
    if (q.fill) {
      c.beginPath();
      c.moveTo(pts[0][0], q.base == null ? yc + amp * 1.6 : q.base);
      for (i = 0; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.lineTo(pts[pts.length - 1][0], q.base == null ? yc + amp * 1.6 : q.base);
      c.closePath();
      var g = c.createLinearGradient(0, yc - amp, 0, q.base == null ? yc + amp * 1.6 : q.base);
      g.addColorStop(0, col(q.fill, pal, .42));
      g.addColorStop(1, col(q.fill, pal, 0));
      c.fillStyle = g; c.fill();
    }
    c.strokeStyle = col(q.color || '$accent', pal);
    c.lineWidth = q.width == null ? 4 : q.width;
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();
    if (q.dots) {
      c.fillStyle = col(q.color || '$accent', pal);
      for (i = 0; i < pts.length; i += Math.max(1, Math.floor(n / 24))) {
        c.beginPath(); c.arc(pts[i][0], pts[i][1], 3, 0, TAU); c.fill();
      }
    }
    c.restore();
  });

  /* --- 7.12 扫描线 ---------------------------------------------------- */

  def('scanlines', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? .35 : q.alpha);
    if (A <= 0) return;
    var gap = q.gap || 3;
    c.save();
    c.globalAlpha = A;
    c.fillStyle = col(q.color || '#000000', pal);
    for (var y = q.y0 || 0; y < (q.y1 == null ? VH : q.y1); y += gap) {
      c.fillRect(q.x0 || 0, y, (q.x1 == null ? VW : q.x1) - (q.x0 || 0), Math.max(1, gap * (q.thickness || .45)));
    }
    c.restore();
  });

  /* --- 7.13 暗角 ------------------------------------------------------ */

  def('vignette', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? .8 : q.alpha);
    if (A <= 0) return;
    var cx = q.x == null ? VW / 2 : q.x, cy = q.y == null ? VH / 2 : q.y;
    var inner = q.inner == null ? VH * .28 : q.inner;
    var outer = q.outer == null ? VH * 1.02 : q.outer;
    c.save();
    var g = c.createRadialGradient(cx, cy, inner, cx, cy, outer);
    g.addColorStop(0, col(q.color || '#000000', pal, 0));
    g.addColorStop(q.mid == null ? .62 : q.mid, col(q.color || '#000000', pal, A * .35));
    g.addColorStop(1, col(q.color || '#000000', pal, A));
    c.fillStyle = g;
    c.fillRect(0, 0, VW, VH);
    c.restore();
  });

  /* --- 7.14 粒子场 ---------------------------------------------------- */

  def('particles', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? .8 : q.alpha);
    if (A <= 0) return;
    var n = S.n(q.count || 300);
    var rng = mulberry32((q.seed == null ? S.pack.seed || 1 : q.seed) >>> 0);
    var area = q.area || { x: 0, y: 0, w: VW, h: VH };
    var cols = q.colors || ['$accent'];
    var rmin = q.rmin == null ? 1.2 : q.rmin, rmax = q.rmax == null ? 3.6 : q.rmax;
    var travel = q.travel == null ? (area.h * 1.25) : q.travel;
    var blend = q.blend === undefined ? 'lighter' : q.blend;
    var tw = q.twinkle || 0;
    c.save();
    c.globalAlpha = A;
    if (blend) c.globalCompositeOperation = blend;
    for (var i = 0; i < n; i++) {
      var x0 = area.x + rng() * area.w;
      var y0 = area.y + rng() * area.h;
      var kc = 1 + Math.floor(rng() * (q.cycles || 2) + 1e-9);
      var ph = rng();
      var r = rmin + (rmax - rmin) * Math.pow(rng(), q.rPow || 1);
      var swayA = (q.sway == null ? 18 : q.sway) * rng();
      var swayK = 1 + Math.floor(rng() * 2);
      var lit = 1;
      if (tw) lit = 1 - tw * .5 + tw * .5 * Math.cos(TAU * (cyc(S.t, S.D, kc, rng()) + ph));
      var u = cyc(S.t, S.D, kc, ph);
      if (q.dir === 'up') u = 1 - u;
      if (q.dir === 'left') { /* 水平流 */ }
      var px = x0 + Math.sin(TAU * (u * swayK + ph)) * swayA;
      var py = y0 + (q.dir === 'left' ? 0 : u * travel);
      if (q.wrap !== false && q.dir !== 'left') {
        py = area.y + (((py - area.y) % (area.h + travel * 0)) + (area.h)) % (area.h + travel * 0);
      }
      if (q.dir === 'left') {
        px = area.x + (((x0 - area.x) + u * (area.w + 200)) % (area.w + 200));
        py = y0 + Math.sin(TAU * (u * swayK + ph)) * swayA * .4;
      }
      var cc = cols[i % cols.length];
      c.fillStyle = col(cc, pal, (q.dotAlpha == null ? .55 : q.dotAlpha) * lit);
      c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
      if (q.glowRatio && (i % 100) / 100 < q.glowRatio) {
        c.fillStyle = col(cc, pal, .05);
        c.beginPath(); c.arc(px, py, r * 3.4, 0, TAU); c.fill();
      }
    }
    c.restore();
  });

  /* --- 7.15 粒子聚形 -------------------------------------------------- */

  var SHAPES = {
    heart: function (x, y) { y = -y * 1.15 + .1; x *= 1.15; return Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0; },
    house: function (x, y) {
      return (Math.abs(x) <= .6 && y >= -.1 && y <= .78 && !(Math.abs(x) < .15 && y > .4)) ||
             (y < -.1 && y > -.85 && Math.abs(x) <= .85 * (y + .85) / .75);
    },
    person: function (x, y) {
      return (x * x + (y + .55) * (y + .55) <= .05) ||
             (y >= -.28 && y <= .88 && Math.abs(x) <= .25 + (y + .28) * .2);
    },
    star: function (x, y) {
      var a = Math.atan2(y, x), r = Math.sqrt(x * x + y * y);
      var k = Math.cos(5 * a) * .5 + .5;
      return r <= .35 + .55 * k;
    },
    ring: function (x, y) { var r = Math.sqrt(x * x + y * y); return r <= .92 && r >= .58; },
    triangle: function (x, y) { return y <= .8 && y >= -.8 && Math.abs(x) <= (.8 - y) * .62; },
    spiral: function (x, y) {
      var a = Math.atan2(y, x), r = Math.sqrt(x * x + y * y);
      var d = Math.abs(((a / TAU) + .5) - (r * .85)) % 1;
      return r < .95 && d < .09;
    }
  };
  var SHCACHE = Object.create(null);
  function shapePts(kind, n, seed) {
    var key = kind + '|' + n + '|' + seed;
    if (SHCACHE[key]) return SHCACHE[key];
    var test = SHAPES[kind] || SHAPES.ring;
    var rng = mulberry32(seed >>> 0), out = [], guard = 0, x, y;
    while (out.length < n && guard < n * 300) {
      guard++;
      x = rng() * 2 - 1; y = rng() * 2 - 1;
      if (test(x, y)) out.push([x, y]);
    }
    while (out.length < n) { x = rng() * 2 - 1; y = rng() * 2 - 1; out.push([x, y]); }
    SHCACHE[key] = out;
    return out;
  }
  function shuffled(arr, rng) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(rng() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  def('morph', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var n = S.n(q.count || 1200);
    var seed = q.seed == null ? 2026 : q.seed;
    var ka = q.a || 'heart', kb = q.b || 'house';
    var P1 = shuffled(shapePts(ka, n, seed), mulberry32((seed + 11) >>> 0));
    var P2 = shuffled(shapePts(kb, n, seed + 7), mulberry32((seed + 29) >>> 0));
    var prng = mulberry32((seed + 101) >>> 0);
    var cx = q.cx == null ? 960 : q.cx, cy = q.cy == null ? 520 : q.cy;
    var sc = q.scale == null ? 380 : q.scale;
    var trail = q.trail || [0.05, 0.1];
    var colA = q.colors ? q.colors[0] : (pal.c1 || '#F08A8A');
    var colB = q.colors ? q.colors[1] : (pal.c2 || '#F1C070');
    var hold = q.hold || [.22, .78];
    var kk = q.k == null ? 1 : q.k;
    function weight(t) {
      var u = pulse(t, S.D, kk, q.phase || 0);
      var w = (u - hold[0]) / (hold[1] - hold[0]);
      return smootherstep(0, 1, clamp01(w));
    }
    var zoom = q.zoom == null ? .012 : q.zoom;
    var z = 1 + zoom * Math.sin(TAU * cyc(S.t, S.D, 1, 0) * 1);

    c.save();
    c.globalAlpha = A;
    c.globalCompositeOperation = q.blend || 'lighter';
    for (var i = 0; i < n; i++) {
      var ang = prng() * TAU, amp = prng(), phs = prng() * TAU;
      var fr = 1 + Math.floor(prng() * 2), sr = Math.pow(prng(), 1.4), gl = prng() < .2;
      var Ax = P1[i][0], Ay = P1[i][1], Bx = P2[i][0], By = P2[i][1];
      var ctrl = [(Ax + Bx) / 2 + Math.cos(ang) * (.35 + .9 * amp),
                  (Ay + By) / 2 + Math.sin(ang) * (.35 + .9 * amp)];
      for (var s = -1; s <= trail.length - 1; s++) {
        // 把「拖尾时间」折回 [0,D)，保证 t=0 与 t=D 取到同一点
        var tRaw = S.t - (s >= 0 ? trail[s] : 0);
        var tUse = ((tRaw % S.D) + S.D) % S.D;
        var w = weight(tUse);
        var pf = bez2([Ax, Ay], ctrl, [Bx, By], w);
        var wob = .012 * (1 - Math.sin(Math.PI * w));
        pf[0] += Math.cos(phs + 1.3 * tUse) * wob;
        pf[1] += Math.sin(1.7 * phs + 1.1 * tUse) * wob;
        var sx = 960 + (pf[0] * sc) * z, sy = 540 + (pf[1] * sc - 20) * z;
        var L = .75 + .25 * Math.sin(TAU * (cyc(S.t, S.D, fr, 0) + phs / TAU));
        var r = (1.1 + 1.6 * sr) * (1 + s * 0);
        var aMul = [1, .5, .25][s] == null ? .25 : [1, .5, .25][s];
        var rr = [1, .8, .6][s] == null ? .6 : [1, .8, .6][s];
        var cc = mix(colA, colB, w);
        var al = (q.dotAlpha == null ? .62 : q.dotAlpha) * L * aMul * A;
        if (gl && s === 0) {
          c.globalAlpha = 1;
          c.fillStyle = col(cc, pal, al * .08);
          c.beginPath(); c.arc(sx, sy, r * 3.2, 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
        c.fillStyle = col(cc, pal, al);
        c.beginPath(); c.arc(sx, sy, r * rr, 0, TAU); c.fill();
      }
    }
    c.restore();
  });

  /* --- 7.16 折纸 ------------------------------------------------------ */

  def('paper_fold', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var cx = q.cx == null ? 960 : q.cx, cy = q.cy == null ? 540 : q.cy;
    var sc = q.scale == null ? 1 : q.scale;
    var u = clamp01(q.u == null ? e.pe : q.u);
    var paper = q.paper || '#F6EFE1', shadeC = q.shade || '#DFCFB4', crease = q.crease || '#C0A885';
    var flaps = q.flaps || [];
    c.save();
    c.globalAlpha = A;
    c.translate(cx, cy);
    c.scale(sc, sc);
    c.rotate((q.rot || 0) * Math.PI / 180);
    // 投影
    if (q.shadow !== false) {
      var sg = c.createRadialGradient(20, 150, 10, 20, 150, 330);
      sg.addColorStop(0, 'rgba(60,45,30,' + (.30 * A) + ')');
      sg.addColorStop(1, 'rgba(60,45,30,0)');
      c.save(); c.translate(0, 0); c.scale(1, .34);
      c.fillStyle = sg; c.beginPath(); c.arc(20, 150 / .34, 330, 0, TAU); c.fill(); c.restore();
    }
    // 纸的基本形
    if (q.sheet) {
      var sp = [];
      for (var i0 = 0; i0 < q.sheet.length; i0++) sp.push([q.sheet[i0][0], q.sheet[i0][1] + (1 - u) * 0]);
      pathPts(c, sp, true);
      var g0 = c.createLinearGradient(-260, -260, 260, 300);
      g0.addColorStop(0, paper);
      g0.addColorStop(1, shadeC);
      c.fillStyle = g0; c.fill();
      c.strokeStyle = crease; c.lineWidth = 1.2; c.globalAlpha = A * .5; c.stroke(); c.globalAlpha = A;
    }
    // 折翼：绕铰点从 a0 转到 a1
    for (var j = 0; j < flaps.length; j++) {
      var f = flaps[j];
      var d0 = f.delay == null ? 0 : f.delay;
      var fp = smootherstep(d0, d0 + .55, u);
      var ang = lerp(f.a0, f.a1, fp) * Math.PI / 180;
      var len = f.len * (0.55 + 0.45 * (f.pop ? 1 : 1));
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var nx = -dy, ny = dx;
      var wdt = (f.w || 60) * (0.42 + 0.58 * Math.min(1, fp * 1.6 + .35));
      var hx = f.h[0], hy = f.h[1];
      var p2 = [
        [hx, hy],
        [hx + dx * len * .55 + nx * wdt, hy + dy * len * .55 + ny * wdt],
        [hx + dx * len, hy + dy * len],
        [hx + dx * len * .55 - nx * wdt, hy + dy * len * .55 - ny * wdt]
      ];
      pathPts(c, p2, true);
      var base = mix(f.s0 || paper, f.s1 || shadeC, fp);
      var gg = c.createLinearGradient(hx, hy, hx + dx * len, hy + dy * len);
      gg.addColorStop(0, shade(base, .06));
      gg.addColorStop(1, shade(base, -.06));
      c.fillStyle = gg;
      c.fill();
      c.strokeStyle = crease; c.lineWidth = 1.1; c.globalAlpha = A * .62; c.stroke();
      c.globalAlpha = A;
      // 折缝高光
      if (fp > .15 && fp < .92) {
        c.save();
        c.globalAlpha = A * .28 * (1 - Math.abs(fp - .5) * 1.6);
        c.strokeStyle = '#fffaf0'; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + dx * len, hy + dy * len); c.stroke();
        c.restore();
      }
    }
    c.restore();
  });

  /* --- 7.17 半调网点 -------------------------------------------------- */

  def('halftone', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? .9 : q.alpha);
    if (A <= 0) return;
    var x = q.x || 0, y = q.y || 0, w = q.w == null ? VW : q.w, h = q.h == null ? VH : q.h;
    var spBase = q.spacing || 16;
    // LOD：网格间距放大 = 更少的点 + 更大的点，墨量近似守恒（mip 式降采样）
    var sp = spBase / Math.max(S.lod, .5);
    var rmax = q.rmax == null ? sp * .48 : q.rmax * (sp / spBase);
    var ang = (q.angle == null ? 30 : q.angle) * Math.PI / 180;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var ph = cyc(S.t, S.D, q.k == null ? 1 : q.k, q.phase || 0);
    c.save();
    c.globalAlpha = A;
    c.fillStyle = col(q.color || '$ink', pal);
    if (q.rect) { c.beginPath(); c.rect(q.rect[0], q.rect[1], q.rect[2], q.rect[3]); c.clip(); }
    if (q.circle) {
      c.beginPath(); c.arc(q.circle[0], q.circle[1], q.circle[2], 0, TAU); c.clip();
    }
    var cols = Math.ceil(w / sp) + 2, rows = Math.ceil(h / sp) + 2;
    for (var j = -1; j < rows; j++) {
      for (var i = -1; i < cols; i++) {
        var lx = i * sp + (j % 2 ? sp / 2 : 0), ly = j * sp;
        var px = x + lx * ca - ly * sa, py = y + lx * sa + ly * ca;
        if (px < x - sp || px > x + w + sp || py < y - sp || py > y + h + sp) continue;
        var u = clamp01((lx) / w), v = clamp01(ly / h);
        var d;
        if (q.mode === 'radial') d = 1 - clamp01(dist(px, py, q.cx == null ? x + w / 2 : q.cx, q.cy == null ? y + h / 2 : q.cy) / ((q.r || Math.max(w, h) * .8)));
        else if (q.mode === 'flat') d = 1;
        else if (q.mode === 'custom') d = q.v == null ? .5 : q.v;
        else d = clamp01(q.dir === 'down' ? v : (q.dir === 'up' ? 1 - v : u));
        d = clamp01(d * .82 + .18 * (.5 + .5 * Math.sin(TAU * (u * 2 + ph))));
        var r = rmax * Math.pow(d, q.gamma || 1);
        if (r < .35) continue;
        c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
      }
    }
    c.restore();
  });

  /* --- 7.18 字符画（真正的字，落在字符网格上） ------------------------ */

  def('glyph_field', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0 || !q.art) return;
    var art = q.art, rows = art.length, cell = q.cell == null ? 30 : q.cell;
    var cw = cell * (q.cellW == null ? 1 : q.cellW), chh = cell * (q.chh == null ? 1 : q.chh);
    var ox = q.x == null ? 0 : q.x, oy = q.y == null ? 0 : q.y;
    var rev = clamp01(q.reveal == null ? 1 : q.reveal);
    var maxD = Math.sqrt(Math.pow(art[0].length, 2) + rows * rows) * .5;
    var rcx = art[0].length / 2, rcy = rows / 2;
    c.save();
    c.globalAlpha = A;
    setFont(c, { font: q.font || 'mono', size: cell * (q.sizeK == null ? .98 : q.sizeK), weight: q.weight });
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (q.glow) { c.shadowColor = col(q.color || '$fg', pal, .7); c.shadowBlur = q.glow; }
    var thresh = rev * (maxD * 1.18);
    for (var r = 0; r < rows; r++) {
      var line = art[r];
      for (var i = 0; i < line.length; i++) {
        var g = line.charAt(i);
        if (g === ' ' || g === '.') {
          if (!q.dots) continue;
        }
        var dd = Math.sqrt(Math.pow(i - rcx, 2) + Math.pow(r - rcy, 2));
        var a = clamp01((thresh - dd) / (maxD * .16));
        if (a <= .01) continue;
        var px = ox + i * cw, py = oy + r * chh;
        var isBright = q.bright && q.bright.indexOf(g) >= 0;
        c.fillStyle = col(isBright ? (q.brightColor || q.color) : (q.color || '$fg'), pal, a * (isBright ? 1 : (q.dimAlpha == null ? .82 : q.dimAlpha)));
        c.fillText(g, px, py);
      }
    }
    c.restore();
  });

  /* --- 7.19 符号流（滚动缓冲 / 字符雨） ------------------------------- */

  def('glyph_stream', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var chars = q.chars || '01ABCDEF#$%&*+=<>/\\|';
    var cols = q.cols || 40, rows = q.rows || 12;
    var cw = q.cw == null ? 28 : q.cw, chh = q.chh == null ? 40 : q.chh;
    var ox = q.x == null ? 0 : q.x, oy = q.y == null ? 0 : q.y;
    var rng = mulberry32((q.seed == null ? 7 : q.seed) >>> 0);
    var dir = q.dir || 'down';
    c.save();
    c.globalAlpha = A;
    setFont(c, { font: q.font || 'mono', size: q.size == null ? 30 : q.size, weight: q.weight });
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (q.glow) { c.shadowColor = col(q.color || '$fg', pal, .6); c.shadowBlur = q.glow; }
    for (var ci = 0; ci < cols; ci++) {
      var kc = 1 + Math.floor(rng() * 2);
      var ph = rng();
      var head = cyc(S.t, S.D, kc, ph) * (rows + 6) - 3;
      var lit = (q.colStart == null ? .35 : q.colStart) + rng() * .4;
      for (var ri = 0; ri < rows; ri++) {
        var gch = chars.charAt(Math.floor(rng() * chars.length));
        var d = dir === 'left' ? (ri / rows) : (head - ri);
        var a;
        if (dir === 'left') {
          var u = cyc(S.t, S.D, kc, ph);
          var pos = ((ci + u * cols) % cols);
          a = clamp01(1 - Math.abs((pos - ri) / 3));
          if (a <= .02) continue;
        } else {
          if (d < 0 || d > 9) continue;
          a = clamp01(1 - d / 9) * (d < .6 ? 1 : .85);
        }
        var px = ox + (dir === 'left' ? ci * cw : ci * cw), py = oy + ri * chh;
        c.fillStyle = col(d === 0 && q.headColor ? q.headColor : (q.color || '$fg'), pal, a * lit);
        c.fillText(gch, px, py);
      }
    }
    c.restore();
  });

  /* --- 7.20 终端 LOG 行 ----------------------------------------------- */

  def('term_log', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var x = q.x == null ? 100 : q.x, y = q.y == null ? VH - 120 : q.y;
    var w = q.w == null ? VW - 200 : q.w;
    var size = q.size == null ? 40 : q.size;
    var prog = clamp01(q.progress == null ? e.p : q.progress);
    c.save();
    c.globalAlpha = A;
    setFont(c, { font: q.font || 'mono', size: size, weight: q.weight || 400 });
    c.textBaseline = 'middle';
    // 分隔线
    c.strokeStyle = col(q.color || '$fg', pal, .28);
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, y - size * .92); c.lineTo(x + w, y - size * .92); c.stroke();
    // 反色标签
    var tag = q.tag || 'LOG';
    c.textAlign = 'left';
    var tw = c.measureText(tag).width + size * .9;
    c.fillStyle = col(q.color || '$fg', pal, .82);
    c.fillRect(x, y - size * .58, tw, size * 1.16);
    c.fillStyle = col(q.tagColor || pal.bg || '#0a0a0a', pal);
    c.fillText(tag, x + size * .45, y + 1);
    // 提示符 + 正文（按进度打字）
    var prompt = q.prompt == null ? '> ' : q.prompt;
    var body = String(q.text == null ? '' : q.text);
    var nch = q.chars != null ? Math.min(body.length, q.chars) : Math.round(prog * body.length);
    var shown = body.slice(0, nch);
    c.fillStyle = col(q.color || '$fg', pal, .55);
    c.fillText(prompt, x + tw + size * .6, y + 1);
    var pw = c.measureText(prompt).width;
    c.fillStyle = col(q.color || '$fg', pal, .96);
    c.fillText(shown, x + tw + size * .6 + pw, y + 1);
    if (q.cursor && Math.cos(TAU * (q.cursorPhase || 0)) > 0) {
      var cwid = c.measureText('M').width * .62;
      c.fillStyle = col(q.color || '$fg', pal, .9);
      c.fillRect(x + tw + size * .6 + pw + c.measureText(shown).width + 4, y - size * .5, cwid, size);
    }
    c.restore();
  });

  /* --- 7.21 爆炸音效字 ------------------------------------------------- */

  def('burst', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var rng = mulberry32((q.seed == null ? 99 : q.seed) >>> 0);
    var sc = q.scale == null ? 1 : q.scale;
    c.save();
    c.globalAlpha = A;
    c.translate(q.x, q.y);
    c.rotate((q.rot || 0) * Math.PI / 180);
    c.scale(sc, sc);
    starPath(c, 0, 0, q.r == null ? 210 : q.r, (q.r == null ? 210 : q.r) * (q.ratio || .58), q.spikes || 14, (q.start || 0), q.jitter == null ? .3 : q.jitter, rng);
    c.fillStyle = col(q.fill || '#FFD23F', pal);
    c.fill();
    c.strokeStyle = col(q.stroke || pal.ink || '#141414', pal);
    c.lineWidth = q.lineWidth == null ? 9 : q.lineWidth;
    c.lineJoin = 'miter';
    c.stroke();
    if (q.text) {
      setFont(c, { font: q.font || 'comic', size: q.size == null ? 96 : q.size, weight: q.weight });
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.rotate((q.textRot || -7) * Math.PI / 180);
      if (q.textStroke !== false) {
        c.strokeStyle = col(q.stroke || pal.ink || '#141414', pal);
        c.lineWidth = (q.size == null ? 96 : q.size) * .14;
        c.lineJoin = 'round';
        c.strokeText(q.text, 0, 6);
      }
      c.fillStyle = col(q.textColor || '#FFFFFF', pal);
      c.fillText(q.text, 0, 6);
    }
    c.restore();
  });

  /* --- 7.22 对话气泡 --------------------------------------------------- */

  def('balloon', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var sc = q.scale == null ? 1 : q.scale;
    c.save();
    c.globalAlpha = A;
    c.translate(q.x, q.y);
    c.scale(sc, sc);
    var rx = q.rx == null ? 240 : q.rx, ry = q.ry == null ? 130 : q.ry;
    var tail = q.tail || [rx * .2, ry + 90, 60];
    // 尾巴
    c.beginPath();
    c.moveTo(tail[0] - tail[2] * .5, ry * .55);
    c.lineTo(tail[0], tail[1]);
    c.lineTo(tail[0] + tail[2] * .5, ry * .5);
    c.closePath();
    c.fillStyle = col(q.fill || '#ffffff', pal);
    c.fill();
    c.strokeStyle = col(q.stroke || pal.ink || '#141414', pal);
    c.lineWidth = q.lineWidth == null ? 7 : q.lineWidth;
    c.stroke();
    // 主体
    c.beginPath();
    if (c.ellipse) c.ellipse(0, 0, rx, ry, 0, 0, TAU); else c.arc(0, 0, rx, 0, TAU);
    c.fillStyle = col(q.fill || '#ffffff', pal);
    c.fill();
    c.stroke();
    // 文字
    var lines = q.lines || [];
    var size = q.size == null ? 46 : q.size;
    setFont(c, { font: q.font || 'comic', size: size, weight: q.weight });
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = col(q.color || pal.ink || '#141414', pal);
    var lh = size * 1.12, y0 = -(lines.length - 1) * lh / 2;
    for (var i = 0; i < lines.length; i++) c.fillText(lines[i], 0, y0 + i * lh);
    c.restore();
  });

  /* --- 7.23 旁白黄框 --------------------------------------------------- */

  def('caption', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var w = q.w == null ? 620 : q.w, h = q.h == null ? 120 : q.h;
    c.save();
    c.globalAlpha = A;
    c.translate(q.x, q.y);
    if (q.rot) c.rotate(q.rot * Math.PI / 180);
    if (q.scale != null) c.scale(q.scale, q.scale);
    c.fillStyle = col(q.fill || '#FFD23F', pal);
    c.fillRect(-w / 2, -h / 2, w, h);
    c.strokeStyle = col(q.stroke || pal.ink || '#141414', pal);
    c.lineWidth = q.lineWidth == null ? 6 : q.lineWidth;
    c.strokeRect(-w / 2, -h / 2, w, h);
    var lines = q.lines || [q.text || ''];
    var size = q.size == null ? 44 : q.size;
    setFont(c, { font: q.font || 'comic', size: size, weight: q.weight });
    c.textAlign = q.align || 'center'; c.textBaseline = 'middle';
    c.fillStyle = col(q.color || pal.ink || '#141414', pal);
    var lh = size * 1.16, y0 = -(lines.length - 1) * lh / 2;
    var tx = q.align === 'left' ? -w / 2 + (q.padX == null ? 28 : q.padX) : 0;
    for (var i = 0; i < lines.length; i++) c.fillText(lines[i], tx, y0 + i * lh);
    c.restore();
  });

  /* --- 7.24 漫画分格 --------------------------------------------------- */

  def('comic_panel', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var x = q.x || 0, y = q.y || 0, w = q.w == null ? 600 : q.w, h = q.h == null ? 400 : q.h;
    var sk = q.skew || 0, lw = q.lineWidth == null ? 9 : q.lineWidth;
    c.save();
    c.globalAlpha = A;
    var pts = [[x + sk, y], [x + w + sk, y], [x + w - sk, y + h], [x - sk, y + h]];
    pathPts(c, pts, true);
    c.fillStyle = col(q.fill || '#f4ecd6', pal);
    c.fill();
    if (q.shadow !== false) {
      c.save();
      c.globalAlpha = A * .28;
      c.translate(10, 12);
      pathPts(c, pts, true);
      c.fillStyle = '#000000'; c.fill();
      c.restore();
    }
    c.strokeStyle = col(q.border || pal.ink || '#141414', pal);
    c.lineWidth = lw; c.lineJoin = 'miter';
    pathPts(c, pts, true); c.stroke();
    c.restore();
  });

  /* --- 7.25 英雄剪影 --------------------------------------------------- */

  def('hero', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var sc = q.scale == null ? 1 : q.scale;
    var ink = q.color || '#141414';
    c.save();
    c.globalAlpha = A;
    c.translate(q.x, q.y);
    c.scale(sc, sc);
    c.fillStyle = col(q.body || '#2a6fdb', pal);
    // 斗篷
    c.beginPath();
    c.moveTo(-90, -40); c.quadraticCurveTo(-300, 120, -250, 300);
    c.quadraticCurveTo(-120, 260, -40, 300); c.closePath();
    c.fillStyle = col(q.cape || '#e23b2e', pal); c.fill();
    c.strokeStyle = col(ink, pal); c.lineWidth = 9; c.stroke();
    // 躯干
    c.beginPath();
    c.moveTo(-110, -30); c.lineTo(110, -30);
    c.quadraticCurveTo(150, 140, 130, 320);
    c.lineTo(-130, 320);
    c.quadraticCurveTo(-150, 140, -110, -30);
    c.closePath();
    c.fillStyle = col(q.body || '#2a6fdb', pal); c.fill();
    c.strokeStyle = col(ink, pal); c.lineWidth = 9; c.stroke();
    // 举起的拳臂
    c.beginPath();
    c.moveTo(90, 10); c.quadraticCurveTo(250, -40, 268, -190);
    c.lineTo(340, -150); c.quadraticCurveTo(320, 60, 150, 70);
    c.closePath();
    c.fillStyle = col(q.body || '#2a6fdb', pal); c.fill(); c.stroke();
    // 拳头
    c.beginPath(); c.arc(300, -195, 52, 0, TAU);
    c.fillStyle = col(q.skin || '#f0b48a', pal); c.fill(); c.stroke();
    // 头
    c.beginPath(); c.arc(0, -120, 92, 0, TAU);
    c.fillStyle = col(q.skin || '#f0b48a', pal); c.fill(); c.stroke();
    // 面罩
    c.beginPath();
    c.moveTo(-92, -140); c.quadraticCurveTo(0, -186, 92, -140);
    c.quadraticCurveTo(0, -108, -92, -140);
    c.closePath();
    c.fillStyle = col(q.body || '#2a6fdb', pal); c.fill(); c.stroke();
    // 眼睛
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(-34, -142, 24, 13, -.12, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(34, -142, 24, 13, .12, 0, TAU); c.fill();
    c.fillStyle = col(ink, pal);
    c.beginPath(); c.arc(-30, -142, 7, 0, TAU); c.fill();
    c.beginPath(); c.arc(30, -142, 7, 0, TAU); c.fill();
    // 胸标
    c.beginPath(); starPath(c, 0, 90, 48, 20, 5, -Math.PI / 2);
    c.fillStyle = col(q.emblem || '#ffd43b', pal); c.fill();
    c.strokeStyle = col(ink, pal); c.lineWidth = 6; c.stroke();
    c.restore();
  });

  /* --- 7.26 集中线 ----------------------------------------------------- */

  def('focus_lines', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? .85 : q.alpha);
    if (A <= 0) return;
    var rng = mulberry32((q.seed == null ? 5 : q.seed) >>> 0);
    var n = q.count || 90, cx = q.cx == null ? VW / 2 : q.cx, cy = q.cy == null ? VH / 2 : q.cy;
    var rIn = q.rIn == null ? 260 : q.rIn, rOut = q.rOut == null ? 1500 : q.rOut;
    var rot = (q.rot || 0) * Math.PI / 180 + TAU * cyc(S.t, S.D, q.k == null ? 1 : q.k, 0) * (q.spin == null ? 1 : q.spin);
    c.save();
    c.globalAlpha = A;
    c.fillStyle = col(q.color || pal.ink || '#141414', pal);
    for (var i = 0; i < n; i++) {
      var a0 = rot + (i / n) * TAU + (rng() - .5) * .02;
      var wide = (rng() * .006 + .003) * (q.thick || 1);
      var len = rOut * (q.vary === false ? 1 : (.55 + rng() * .55));
      var ri = rIn * (q.vary === false ? 1 : (.75 + rng() * .5));
      c.beginPath();
      c.moveTo(cx + Math.cos(a0) * ri, cy + Math.sin(a0) * ri);
      c.lineTo(cx + Math.cos(a0 - wide) * len, cy + Math.sin(a0 - wide) * len);
      c.lineTo(cx + Math.cos(a0 + wide) * len, cy + Math.sin(a0 + wide) * len);
      c.closePath();
      c.fill();
    }
    c.restore();
  });

  /* --- 7.27 水墨晕染 --------------------------------------------------- */

  def('ink_wash', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? .9 : q.alpha);
    if (A <= 0) return;
    var rng = mulberry32((q.seed == null ? 3 : q.seed) >>> 0);
    var n = q.layers || 5, i;
    var base = q.color || '#1A1A18';
    c.save();
    c.globalAlpha = A;
    for (i = 0; i < n; i++) {
      var ox = q.x + (rng() - .5) * q.r * (q.spread == null ? .55 : q.spread);
      var oy = q.y + (rng() - .5) * q.r * (q.spread == null ? .55 : q.spread) * .7;
      var rr = q.r * (.45 + rng() * .6);
      var g = c.createRadialGradient(ox, oy, rr * .05, ox, oy, rr);
      var a0 = (q.coreAlpha == null ? .5 : q.coreAlpha) * (i === 0 ? 1.15 : .55);
      g.addColorStop(0, col(base, pal, a0 * A));
      g.addColorStop(q.edge == null ? .55 : q.edge, col(base, pal, a0 * .45 * A));
      g.addColorStop(1, col(base, pal, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(ox, oy, rr, 0, TAU); c.fill();
    }
    c.restore();
  });

  /* --- 7.28 竹 --------------------------------------------------------- */

  def('bamboo', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var stalks = q.stalks || [];
    var sway = q.sway == null ? 1 : q.sway;
    var ink = q.color || '#20201D';
    c.save();
    c.globalAlpha = A;
    for (var s = 0; s < stalks.length; s++) {
      var st = stalks[s];
      var x0 = st.x, yb = st.y1, yt = st.y0, wid = st.w || 14;
      var phase = st.phase == null ? s * .7 : st.phase;
      var amp = (st.sway == null ? 14 : st.sway) * sway;
      var bend = Math.sin(TAU * cyc(S.t, S.D, 1, phase)) * amp;
      var segs = 8, pts = [], i;
      function sxAt(y) {
        var u = clamp01((yb - y) / (yb - yt));
        return x0 + bend * u * u + Math.sin(u * 3 + phase) * 2;
      }
      var wNow = function (y) {
        var u = clamp01((yb - y) / (yb - yt));
        return wid * (.55 + .45 * u) * (st.taper == null ? 1 : st.taper);
      };
      // 竹杆：左边缘上行 + 右边缘下行
      c.beginPath();
      for (i = 0; i <= segs; i++) {
        var yy = lerp(yb, yt, i / segs);
        var ww = wNow(yy);
        if (i === 0) c.moveTo(sxAt(yy) - ww, yy); else c.lineTo(sxAt(yy) - ww, yy);
      }
      for (i = segs; i >= 0; i--) {
        var yy2 = lerp(yb, yt, i / segs);
        c.lineTo(sxAt(yy2) + wNow(yy2), yy2);
      }
      c.closePath();
      var g = c.createLinearGradient(x0 - wid, 0, x0 + wid, 0);
      g.addColorStop(0, col(ink, pal, .72 * (st.alpha == null ? 1 : st.alpha)));
      g.addColorStop(.45, col(ink, pal, .95 * (st.alpha == null ? 1 : st.alpha)));
      g.addColorStop(1, col(ink, pal, .55 * (st.alpha == null ? 1 : st.alpha)));
      c.fillStyle = g; c.fill();
      // 竹节
      var nodes = st.nodes || 6;
      c.strokeStyle = col(q.nodeColor || '#0C0C0A', pal, .55);
      c.lineWidth = Math.max(1.5, wid * .16);
      for (i = 1; i < nodes; i++) {
        var ny = lerp(yb, yt, i / nodes);
        c.beginPath();
        c.moveTo(sxAt(ny) - wNow(ny) - 2, ny);
        c.lineTo(sxAt(ny) + wNow(ny) + 2, ny);
        c.stroke();
      }
      // 竹叶
      var leaves = st.leaves || [];
      for (var l = 0; l < leaves.length; l++) {
        var lf = leaves[l];
        var ly = lerp(yb, yt, lf.at);
        var lx = sxAt(ly);
        var la = lf.a * Math.PI / 180 + Math.sin(TAU * cyc(S.t, S.D, 1, phase + .2)) * .035;
        var ll = lf.len || 150, lw = lf.w || 26;
        c.save();
        c.translate(lx, ly);
        c.rotate(la);
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(ll * .45, -lw, ll, -lw * .12);
        c.quadraticCurveTo(ll * .45, lw * .72, 0, 0);
        c.closePath();
        c.fillStyle = col(ink, pal, (lf.a2 == null ? .82 : lf.a2) * A);
        c.fill();
        c.restore();
      }
    }
    c.restore();
  });

  /* --- 7.29 印章 ------------------------------------------------------- */

  def('seal', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var s = q.size == null ? 110 : q.size;
    var rng = mulberry32((q.seed == null ? 44 : q.seed) >>> 0);
    c.save();
    c.globalAlpha = A;
    c.translate(q.x, q.y);
    c.rotate((q.rot || 0) * Math.PI / 180);
    c.fillStyle = col(q.color || '#A8322A', pal);
    c.fillRect(-s / 2, -s / 2, s, s);
    // 边缘残破
    c.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < 26; i++) {
      var ex = (rng() * 2 - 1) * s / 2, ey = (rng() < .5 ? (rng() < .5 ? -1 : 1) : (rng() * 2 - 1)) * s / 2;
      c.beginPath(); c.arc(ex, ey, s * (.012 + rng() * .028), 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    if (q.text) {
      setFont(c, { font: q.font || 'serifCJK', size: s * (q.textK == null ? .62 : q.textK), weight: q.weight || 700 });
      c.fillStyle = col(q.fg || '#F7F1E4', pal);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      var chars = String(q.text).split('');
      if (q.vertical !== false && chars.length > 1) {
        var lh = s * .44;
        for (var j = 0; j < chars.length; j++) c.fillText(chars[j], 0, (j - (chars.length - 1) / 2) * lh);
      } else c.fillText(q.text, 0, s * .04);
    }
    c.restore();
  });

  /* --- 7.30 顶光光池 --------------------------------------------------- */

  def('light_pool', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var cx = q.x == null ? VW / 2 : q.x, cy = q.y == null ? 0 : q.y;
    var r = q.r == null ? 760 : q.r;
    c.save();
    c.globalAlpha = 1;
    c.globalCompositeOperation = q.blend || 'lighter';
    var g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col(q.color || '#E2B673', pal, (q.strength == null ? .55 : q.strength) * A));
    g.addColorStop(.45, col(q.color || '#E2B673', pal, (q.strength == null ? .55 : q.strength) * .28 * A));
    g.addColorStop(1, col(q.color || '#E2B673', pal, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    if (q.cone) {
      var cg = c.createLinearGradient(cx, cy, cx, cy + r * 1.4);
      cg.addColorStop(0, col(q.color || '#E2B673', pal, (q.strength == null ? .55 : q.strength) * .5 * A));
      cg.addColorStop(1, col(q.color || '#E2B673', pal, 0));
      c.fillStyle = cg;
      c.beginPath();
      c.moveTo(cx - q.cone[0], cy);
      c.lineTo(cx - q.cone[1], cy + r * 1.5);
      c.lineTo(cx + q.cone[1], cy + r * 1.5);
      c.lineTo(cx + q.cone[0], cy);
      c.closePath(); c.fill();
    }
    c.restore();
  });

  /* --- 7.31 油画笔触 --------------------------------------------------- */

  def('oil_strokes', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var rng = mulberry32((q.seed == null ? 17 : q.seed) >>> 0);
    var n = S.n(q.count || 130), x = q.x || 0, y = q.y || 0, w = q.w == null ? VW : q.w, h = q.h == null ? VH : q.h;
    var base = q.color || '#E2B673', hi = q.hi || '#F6D9A8';
    c.save();
    c.globalAlpha = A;
    c.globalCompositeOperation = q.blend || 'source-over';
    c.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var px = x + rng() * w, py = y + rng() * h;
      var ang = (q.angle == null ? -70 : q.angle) * Math.PI / 180 + (rng() - .5) * (q.spread == null ? .55 : q.spread);
      var len = (q.len == null ? 26 : q.len) * (.5 + rng() * .9);
      var wd = (q.width == null ? 9 : q.width) * (.55 + rng() * .9);
      c.strokeStyle = col(base, pal, (q.strokeAlpha == null ? .5 : q.strokeAlpha) * (.4 + rng() * .6));
      c.lineWidth = wd;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      c.stroke();
      if (rng() < (q.hiRatio == null ? .45 : q.hiRatio)) {
        c.strokeStyle = col(hi, pal, .34 * (.4 + rng() * .6));
        c.lineWidth = wd * .42;
        c.beginPath();
        c.moveTo(px + 1, py + 1);
        c.lineTo(px + Math.cos(ang) * len * .92, py + Math.sin(ang) * len * .92);
        c.stroke();
      }
    }
    c.restore();
  });

  /* --- 7.32 顶光人像（教父） ------------------------------------------- */

  def('portrait_oil', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var sc = q.scale == null ? 1 : q.scale;
    var lit = q.lit || '#E2B673', mid = q.mid || '#8F5D2A', dark = q.dark || '#24150B', nearBlack = q.nearBlack || '#070403';
    var skin = q.skin || '#C8996A';
    c.save();
    c.globalAlpha = A;
    c.translate(q.x, q.y);
    c.scale(sc, sc);

    // 椅背
    c.beginPath();
    c.moveTo(-360, 470);
    c.quadraticCurveTo(-390, -300, -300, -420);
    c.quadraticCurveTo(0, -520, 300, -420);
    c.quadraticCurveTo(390, -300, 360, 470);
    c.closePath();
    var cg = c.createLinearGradient(0, -480, 0, 480);
    cg.addColorStop(0, nearBlack);
    cg.addColorStop(.55, '#120B05');
    cg.addColorStop(1, '#0A0703');
    c.fillStyle = cg; c.fill();

    // 身体/西装
    c.beginPath();
    c.moveTo(-250, 470);
    c.quadraticCurveTo(-280, 80, -150, -40);
    c.quadraticCurveTo(0, -100, 150, -40);
    c.quadraticCurveTo(280, 80, 250, 470);
    c.closePath();
    var bg = c.createLinearGradient(-100, -60, 120, 470);
    bg.addColorStop(0, '#3B2614');
    bg.addColorStop(.5, dark);
    bg.addColorStop(1, '#100A06');
    c.fillStyle = bg; c.fill();

    // 白衬衫
    c.beginPath();
    c.moveTo(-70, -40); c.quadraticCurveTo(0, 40, 70, -40);
    c.quadraticCurveTo(30, 200, 0, 300);
    c.quadraticCurveTo(-30, 200, -70, -40);
    c.closePath();
    var sg = c.createLinearGradient(0, -40, 0, 300);
    sg.addColorStop(0, '#E8D9C0');
    sg.addColorStop(1, '#6B5231');
    c.fillStyle = sg; c.fill();

    // 脖子
    c.beginPath();
    c.moveTo(-58, -120); c.lineTo(58, -120); c.lineTo(66, -10); c.lineTo(-66, -10);
    c.closePath();
    c.fillStyle = '#4A2E16'; c.fill();

    // 头（顶光 → 下方迅速入暗）
    var hx = 0, hy = -230, hr = 118;
    c.beginPath();
    c.ellipse(hx, hy, hr, hr * 1.16, 0, 0, TAU);
    var hg = c.createLinearGradient(hx, hy - hr, hx, hy + hr);
    hg.addColorStop(0, lit);
    hg.addColorStop(.28, mix(lit, skin, .55));
    hg.addColorStop(.62, '#5E3A1C');
    hg.addColorStop(1, '#1C1009');
    c.fillStyle = hg; c.fill();

    // 眉骨投影：把眼睛压进阴影
    c.save();
    c.beginPath(); c.ellipse(hx, hy, hr, hr * 1.16, 0, 0, TAU); c.clip();
    c.globalAlpha = A * .92;
    var eg = c.createLinearGradient(hx, hy - 40, hx, hy + 60);
    eg.addColorStop(0, 'rgba(12,7,3,.95)');
    eg.addColorStop(.55, 'rgba(12,7,3,.86)');
    eg.addColorStop(1, 'rgba(12,7,3,0)');
    c.fillStyle = eg;
    c.beginPath();
    c.ellipse(hx, hy - 2, hr * 1.02, 62, 0, 0, TAU);
    c.fill();
    c.restore();

    // 颧骨/鼻梁受光面
    c.save();
    c.globalAlpha = A * .5;
    var ng = c.createLinearGradient(hx - 40, hy + 10, hx + 30, hy + 90);
    ng.addColorStop(0, 'rgba(226,182,115,.55)');
    ng.addColorStop(1, 'rgba(226,182,115,0)');
    c.fillStyle = ng;
    c.beginPath(); c.ellipse(hx + 4, hy + 34, 34, 62, .06, 0, TAU); c.fill();
    c.restore();

    // 头顶点光（rim）
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = A * .55;
    var rg = c.createRadialGradient(hx - 6, hy - hr * .92, 2, hx - 6, hy - hr * .92, hr * .82);
    rg.addColorStop(0, 'rgba(255,226,178,.5)');
    rg.addColorStop(1, 'rgba(255,226,178,0)');
    c.fillStyle = rg;
    c.beginPath(); c.arc(hx - 6, hy - hr * .9, hr * .82, 0, TAU); c.fill();
    c.restore();

    // 头发/背光侧
    c.save();
    c.globalAlpha = A * .9;
    c.beginPath();
    c.ellipse(hx, hy - 18, hr * 1.02, hr * .98, 0, Math.PI * 1.05, Math.PI * 1.98);
    c.lineTo(hx + hr, hy + 30);
    c.quadraticCurveTo(hx, hy - 30, hx - hr, hy + 30);
    c.closePath();
    c.fillStyle = '#160D06'; c.fill();
    c.restore();

    // 领结
    c.beginPath();
    c.moveTo(-52, 44); c.quadraticCurveTo(-14, 30, -6, 48); c.quadraticCurveTo(-16, 66, -52, 58);
    c.closePath();
    c.fillStyle = '#080604'; c.fill();
    c.beginPath();
    c.moveTo(52, 44); c.quadraticCurveTo(14, 30, 6, 48); c.quadraticCurveTo(16, 66, 52, 58);
    c.closePath(); c.fill();
    c.beginPath(); c.arc(0, 50, 14, 0, TAU); c.fill();

    // 胸前的红玫瑰
    c.save();
    c.translate(-118, 96);
    c.fillStyle = '#9C1A1A';
    for (var k = 0; k < 5; k++) {
      var aa = k * 1.25;
      c.beginPath();
      c.ellipse(Math.cos(aa) * 13, Math.sin(aa) * 11, 20, 15, aa, 0, TAU);
      c.fill();
    }
    c.fillStyle = '#6E0F0F';
    c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill();
    c.restore();

    // 手 + 猫
    c.save();
    c.globalAlpha = A * .96;
    c.beginPath();
    c.moveTo(120, 300); c.quadraticCurveTo(230, 300, 268, 350);
    c.quadraticCurveTo(250, 400, 150, 392); c.quadraticCurveTo(96, 370, 120, 300);
    c.closePath();
    c.fillStyle = '#2A190D'; c.fill();
    // 猫
    c.beginPath();
    c.ellipse(210, 330, 96, 62, -.08, 0, TAU);
    c.fillStyle = '#1A120C'; c.fill();
    c.beginPath();
    c.moveTo(292, 300); c.lineTo(322, 268); c.lineTo(330, 306);
    c.closePath(); c.fillStyle = '#1A120C'; c.fill();
    c.beginPath();
    c.moveTo(252, 292); c.lineTo(262, 258); c.lineTo(286, 286);
    c.closePath(); c.fill();
    // 猫的受光背脊
    c.strokeStyle = 'rgba(226,182,115,.5)';
    c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(150, 306); c.quadraticCurveTo(230, 276, 300, 306);
    c.stroke();
    c.restore();

    // 肩线受光边
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = A * .42;
    c.strokeStyle = 'rgba(226,182,115,.9)';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(-152, -38); c.quadraticCurveTo(-40, -104, 60, -70);
    c.stroke();
    c.restore();

    c.restore();
  });

  /* --- 7.33 太阳（Biennale） ------------------------------------------- */

  def('sun', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var x = q.x == null ? 1380 : q.x, y = q.y == null ? 470 : q.y;
    var r = q.r == null ? 250 : q.r;
    var rise = q.rise == null ? 0 : q.rise * 300;
    c.save();
    c.globalAlpha = A;
    // 光晕
    if (q.halo !== false) {
      var hr = q.haloR == null ? 560 : q.haloR;
      var g = c.createRadialGradient(x, y + rise, r * .08, x, y + rise, hr);
      g.addColorStop(0, col(q.color || '#F6C23E', pal, .95));
      g.addColorStop(.38, col(q.color || '#F6C23E', pal, .62));
      g.addColorStop(.7, col('#F6D678', pal, .22));
      g.addColorStop(1, col('#F6D678', pal, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y + rise, hr, 0, TAU); c.fill();
    }
    // 实心圆
    c.fillStyle = col(q.color || '#F6C23E', pal);
    c.beginPath(); c.arc(x, y + rise, r, 0, TAU); c.fill();
    // 同心细圈
    var rings = q.rings || [1, 1.32, 1.64];
    c.lineWidth = q.ringWidth == null ? 1.7 : q.ringWidth;
    for (var i = 0; i < rings.length; i++) {
      c.strokeStyle = col(q.ink || '$ink', pal, i === 0 ? .9 : .45);
      c.beginPath(); c.arc(x, y + rise, r * rings[i], 0, TAU); c.stroke();
    }
    // 刻度环
    if (q.ticks !== false) {
      var tr = r * (q.tickR == null ? 1.64 : q.tickR);
      var n = q.tickCount || 120;
      var rot = (q.rot == null ? 0 : q.rot) * Math.PI / 180;
      c.strokeStyle = col(q.ink || '$ink', pal, .85);
      c.lineWidth = q.tickWidth == null ? 1.6 : q.tickWidth;
      for (var j = 0; j < n; j++) {
        var a = rot + j / n * TAU;
        var lng = (j % 5 === 0) ? (q.tickLong == null ? 22 : q.tickLong) : (q.tickShort == null ? 11 : q.tickShort);
        c.beginPath();
        c.moveTo(x + Math.cos(a) * tr, y + rise + Math.sin(a) * tr);
        c.lineTo(x + Math.cos(a) * (tr + lng), y + rise + Math.sin(a) * (tr + lng));
        c.stroke();
      }
    }
    c.restore();
  });

  /* --- 7.34 坐标系 ----------------------------------------------------- */

  def('axes', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var x0 = q.x0 == null ? 300 : q.x0, x1 = q.x1 == null ? 1620 : q.x1;
    var y0 = q.y0 == null ? 820 : q.y0, y1 = q.y1 == null ? 240 : q.y1;
    var ox = q.ox == null ? 960 : q.ox, oy = q.oy == null ? 560 : q.oy;
    var p = clamp01(q.progress == null ? 1 : q.progress);
    var tick = q.tick == null ? 80 : q.tick;
    c.save();
    c.globalAlpha = A;
    c.strokeStyle = col(q.color || '$axis', pal);
    c.lineWidth = q.width == null ? 2.5 : q.width;
    c.lineCap = 'round';
    var hp = smoothstep(0, .6, p), vp = smoothstep(.15, .85, p);
    c.beginPath();
    c.moveTo(x0, oy); c.lineTo(lerp(x0, x1, hp), oy);
    c.moveTo(ox, y0); c.lineTo(ox, lerp(y0, y1, vp));
    c.stroke();
    // 刻度
    if (q.ticks !== false) {
      c.lineWidth = 1.8;
      var n = Math.floor((x1 - x0) / tick), i;
      for (i = 0; i <= n; i++) {
        var px = x0 + i * tick;
        if (!(i % (q.skip || 1))) {
          c.globalAlpha = A * hp * .75;
          c.beginPath(); c.moveTo(px, oy - 8); c.lineTo(px, oy + 8); c.stroke();
        }
      }
      n = Math.floor((y0 - y1) / tick);
      for (i = 0; i <= n; i++) {
        var py = y0 - i * tick;
        c.globalAlpha = A * vp * .75;
        c.beginPath(); c.moveTo(ox - 8, py); c.lineTo(ox + 8, py); c.stroke();
      }
    }
    // 箭头
    c.globalAlpha = A * hp;
    c.fillStyle = col(q.color || '$axis', pal);
    c.beginPath();
    c.moveTo(x1, oy); c.lineTo(x1 - 22, oy - 9); c.lineTo(x1 - 22, oy + 9); c.closePath(); c.fill();
    c.globalAlpha = A * vp;
    c.beginPath();
    c.moveTo(ox, y1); c.lineTo(ox - 9, y1 + 22); c.lineTo(ox + 9, y1 + 22); c.closePath(); c.fill();
    // 标签
    if (q.labels) {
      c.globalAlpha = A * .9;
      setFont(c, { font: q.font || 'math', size: q.labelSize || 34, italic: true });
      c.fillStyle = col(q.color || '$axis', pal);
      c.textAlign = 'center'; c.textBaseline = 'top';
      for (var li = 0; li < q.labels.length; li++) {
        var L = q.labels[li];
        c.fillText(L.t, L.x, L.y);
      }
    }
    c.restore();
  });

  /* --- 7.35 函数曲线 --------------------------------------------------- */

  var FNS = {
    sin: function (x, amp, freq, ph) { return Math.sin(x * freq + ph) * amp; },
    cos: function (x, amp, freq, ph) { return Math.cos(x * freq + ph) * amp; },
    tanh: function (x, amp, freq, ph) { return Math.tanh((x * freq + ph)) * amp; },
    gauss: function (x, amp, freq, ph) { var d = (x * freq + ph); return amp * Math.exp(-d * d); },
    parabola: function (x, amp, freq, ph) { var d = (x * freq + ph); return amp * d * d; },
    cubic: function (x, amp, freq, ph) { var d = (x * freq + ph); return amp * d * d * d; },
    sqrt: function (x, amp, freq, ph) { var d = (x * freq + ph); return amp * Math.sqrt(Math.max(0, d)); },
    abs: function (x, amp, freq, ph) { return amp * Math.abs(Math.sin(x * freq + ph)); },
    const: function (x, amp) { return amp; }
  };

  def('curve', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var x0 = q.x0 == null ? 300 : q.x0, x1 = q.x1 == null ? 1620 : q.x1;
    var oy = q.oy == null ? 560 : q.oy, unit = q.unit == null ? 130 : q.unit;
    var xr = q.xr || [-6, 6];
    var f1 = FNS[q.fn || 'sin'] || FNS.sin;
    var f2 = q.morph ? (FNS[q.morph.fn] || FNS.sin) : null;
    var k = q.morph ? clamp01(q.morph.k == null ? 0 : q.morph.k) : 0;
    var amp1 = q.amp == null ? 1.6 : q.amp, freq1 = q.freq == null ? 1 : q.freq, ph1 = q.phase || 0;
    var amp2 = q.morph && q.morph.amp != null ? q.morph.amp : amp1;
    var freq2 = q.morph && q.morph.freq != null ? q.morph.freq : freq1;
    var ph2 = q.morph && q.morph.phase != null ? q.morph.phase : ph1;
    var n = q.samples || 320;
    var prog = clamp01(q.progress == null ? 1 : q.progress);
    var pts = [], i, m = Math.max(1, Math.ceil(n * prog));
    for (i = 0; i <= m; i++) {
      var u = i / n;
      var xv = lerp(xr[0], xr[1], u);
      var y1v = f1(xv, amp1, freq1, ph1);
      var yv = y1v;
      if (f2) yv = lerp(y1v, f2(xv, amp2, freq2, ph2), k);
      if (!isFinite(yv)) yv = 0;
      var cy = q.clampY == null ? 8 : Math.abs(q.clampY);
      yv = clamp(yv, -cy, cy);
      pts.push([lerp(x0, x1, u), oy - yv * unit]);
    }
    if (pts.length < 2) return;
    c.save();
    c.globalAlpha = A;
    c.strokeStyle = col(q.color || '$accent', pal);
    c.lineWidth = q.width == null ? 5 : q.width;
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();
    if (q.dotAt != null) {
      var vx = q.dotAt;
      var dotY = oy - lerp(f1(vx, amp1, freq1, ph1), f2 ? f2(vx, amp2, freq2, ph2) : 0, k) * unit;
      var dotX = x0 + ((vx - xr[0]) / (xr[1] - xr[0])) * (x1 - x0);
      c.fillStyle = col(q.dotColor || q.color || '$accent', pal);
      c.beginPath(); c.arc(dotX, dotY, q.dotR == null ? 11 : q.dotR, 0, TAU); c.fill();
      if (q.dotRing) {
        c.strokeStyle = col(q.dotColor || q.color || '$accent', pal, .35);
        c.lineWidth = 3;
        c.beginPath(); c.arc(dotX, dotY, (q.dotR == null ? 11 : q.dotR) * 2.4, 0, TAU); c.stroke();
      }
    }
    c.restore();
  });

  /* --- 7.36 五幕导航条 ------------------------------------------------- */

  def('timeline_rail', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var x = q.x == null ? 100 : q.x, y = q.y == null ? 940 : q.y;
    var w = q.w == null ? 1720 : q.w, h = q.h == null ? 6 : q.h;
    var n = q.segments || 5, gap = q.gap == null ? 14 : q.gap;
    var active = q.active == null ? 0 : q.active;
    var sw = (w - gap * (n - 1)) / n;
    c.save();
    c.globalAlpha = A;
    for (var i = 0; i < n; i++) {
      var sx = x + i * (sw + gap);
      c.fillStyle = col(i <= active ? (q.activeColor || '$accent') : (q.color || '#2A2A32'), pal, i <= active ? 1 : (q.idleAlpha == null ? .5 : q.idleAlpha));
      c.fillRect(sx, y, sw, h);
    }
    c.restore();
  });

  /* --- 7.37 转场色块 --------------------------------------------------- */

  def('wipe', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var p = clamp01(q.progress == null ? e.pe : q.progress);
    var dir = q.dir || 'left';
    var x = q.x || 0, y = q.y || 0, w = q.w == null ? VW : q.w, h = q.h == null ? VH : q.h;
    var sk = q.skew || 0;
    c.save();
    c.globalAlpha = A;
    c.fillStyle = col(q.color || '$accent', pal);
    c.beginPath();
    if (dir === 'left') {
      c.moveTo(x, y); c.lineTo(x + w * p, y); c.lineTo(x + w * p - sk, y + h); c.lineTo(x, y + h);
    } else if (dir === 'right') {
      c.moveTo(x + w, y); c.lineTo(x + w - w * p, y); c.lineTo(x + w - w * p + sk, y + h); c.lineTo(x + w, y + h);
    } else if (dir === 'down') {
      c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h * p - sk); c.lineTo(x, y + h * p);
    } else {
      c.moveTo(x, y + h); c.lineTo(x + w, y + h); c.lineTo(x + w, y + h - h * p + sk); c.lineTo(x, y + h - h * p);
    }
    c.closePath(); c.fill();
    c.restore();
  });

  /* --- 7.38 CRT 电源 / 玻璃 -------------------------------------------- */

  def('crt', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var pw = clamp01(q.power == null ? 1 : q.power);
    var expo = clamp01(q.exposure == null ? 1 : q.exposure) * A * (.34 + .66 * pw);
    var hx, hy, hw, hh;
    c.save();
    c.globalAlpha = 1;
    // 电源开合：用黑边把可见区域裁成 点 → 线 → 面
    if (pw < 1) {
      var cx = VW / 2, cy = VH / 2;
      if (pw < .08) {
        var dr = 2 + pw / .08 * 5;
        hw = dr * 2; hh = dr * .7;
      } else if (pw < .18) {
        var k = (pw - .08) / .10;
        hw = VW * k; hh = 2 + k * 4;
      } else {
        // 展开段压缩到 .18→.55：让「开着」占据循环的大部分时间，
        // 否则 3 秒里有两秒是黑屏，网格缩略图会看着像坏掉
        var k2 = clamp01((pw - .18) / .37);
        hw = VW; hh = VH * k2;
      }
      hx = cx - hw / 2; hy = cy - hh / 2;
      c.fillStyle = '#000000';
      c.fillRect(0, 0, VW, Math.max(0, hy));
      c.fillRect(0, hy + hh, VW, Math.max(0, VH - hy - hh));
      c.fillRect(0, hy, Math.max(0, hx), hh);
      c.fillRect(hx + hw, hy, Math.max(0, VW - hx - hw), hh);
      // 亮边：只留上下两条细亮线（整屏 bloom 会把整个画面刷白，
      // 掩盖掉「点→线→面」的开机语义，也会让 3 秒循环看起来像闪光弹）
      c.globalCompositeOperation = 'lighter';
      var ec = col(q.color || '#FFB454', pal, .5);
      c.fillStyle = ec;
      c.fillRect(hx, hy - 1.5, hw, 3);
      c.fillRect(hx, hy + hh - 1.5, hw, 3);
      if (pw < .10) {
        var gr = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(hw, hh) * .9 + 34);
        gr.addColorStop(0, col(q.color || '#FFB454', pal, .85));
        gr.addColorStop(1, col(q.color || '#FFB454', pal, 0));
        c.fillStyle = gr;
        c.fillRect(cx - 90, cy - 90, 180, 180);
      }
      c.globalCompositeOperation = 'source-over';
    }
    // 曝光（整体压黑）
    if (expo < 1) {
      c.globalAlpha = (1 - expo) * .96;
      c.fillStyle = '#000000';
      c.fillRect(0, 0, VW, VH);
      c.globalAlpha = 1;
    }
    if (q.scan !== false) {
      c.globalAlpha = (q.scanAlpha == null ? .22 : q.scanAlpha) * expo;
      c.fillStyle = '#000000';
      var gap = q.scanGap || 3;
      for (var y = 0; y < VH; y += gap) c.fillRect(0, y, VW, Math.max(1, gap * .45));
      c.globalAlpha = 1;
    }
    // 玻璃暗边 + 圆角遮挡
    if (q.glass !== false) {
      var r = q.radius == null ? 46 : q.radius;
      c.globalAlpha = 1;
      c.fillStyle = '#050403';
      // evenodd 遮罩：先画圆角内框，再叠加整屏矩形，只填圆角外的四角
      // 注意：roundRectPath 内部会 beginPath()，所以矩形必须放在它之后，
      // 否则内框会被清掉、整屏被填黑（crt 全黑 bug 的根因）。
      roundRectPath(c, 0, 0, VW, VH, r);
      c.rect(0, 0, VW, VH);
      c.fill('evenodd');
      // 四边内阴影
      var eg = c.createLinearGradient(0, 0, 0, 120);
      eg.addColorStop(0, 'rgba(0,0,0,.55)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = eg; c.fillRect(0, 0, VW, 120);
      var eg2 = c.createLinearGradient(0, VH, 0, VH - 140);
      eg2.addColorStop(0, 'rgba(0,0,0,.6)'); eg2.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = eg2; c.fillRect(0, VH - 140, VW, 140);
      var eg3 = c.createLinearGradient(0, 0, 160, 0);
      eg3.addColorStop(0, 'rgba(0,0,0,.5)'); eg3.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = eg3; c.fillRect(0, 0, 160, VH);
      var eg4 = c.createLinearGradient(VW, 0, VW - 160, 0);
      eg4.addColorStop(0, 'rgba(0,0,0,.5)'); eg4.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = eg4; c.fillRect(VW - 160, 0, 160, VH);
    }
    // 闪烁
    if (q.flicker) {
      var f = .5 - .5 * Math.cos(TAU * cyc(S.t, S.D, q.flickerK || 7, 0));
      c.globalAlpha = q.flicker * f * expo;
      c.fillStyle = '#000000';
      c.fillRect(0, 0, VW, VH);
    }
    c.restore();
  });

  /* =======================================================================
   * 7.39 字雨（A1）
   * ===================================================================== */

  def('glyph_rain', function (S, e) {
    var c = S.ctx, q = e.params, pal = S.pal;
    var A = e.a * (q.alpha == null ? 1 : q.alpha);
    if (A <= 0) return;
    var rng = mulberry32((q.seed == null ? 11 : q.seed) >>> 0);
    var words = q.words && q.words.length ? q.words : ['静'];
    var n = S.n(q.count || 24);
    var area = q.area || { x: 0, y: 0, w: VW, h: VH };
    var tiers = q.sizes || [.55, .7, .9, 1.2, 1.7];
    var baseSize = q.size == null ? 92 : q.size;
    var fall = q.fall == null ? area.h * 1.28 : q.fall;
    var tint = q.color || '$fg';
    var ga = q.glyphAlpha == null ? .92 : q.glyphAlpha;
    c.save();
    c.globalAlpha = A;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (var i = 0; i < n; i++) {
      var wd = words[Math.floor(rng() * words.length) % words.length];
      var tier = tiers[Math.floor(rng() * tiers.length) % tiers.length];
      var x = area.x + rng() * area.w;
      var ph = rng();
      var kc = 1 + Math.floor(rng() * 2);
      var bright = rng();
      var u = cyc(S.t, S.D, kc, ph);
      var y = area.y - fall * .18 + u * fall;
      var sz = baseSize * tier;
      setFont(c, { font: q.font || 'serifCJK', size: sz, weight: q.weight || 400 });
      var a = ga * (.45 + .55 * bright) * (.55 + .45 * Math.sin(Math.PI * clamp01(u)));
      c.fillStyle = col(tint, pal, a);
      c.fillText(wd, x, y);
    }
    // 落地堆积：t 0→0.9 长起来，2.55→3.0 收回（首尾都归零）
    var pileN = q.pile == null ? 0 : q.pile;
    if (pileN > 0) {
      var grow = smoothstep(0, .9, S.t) * (1 - smoothstep(2.5, S.D, S.t));
      var show = Math.round(pileN * grow);
      var prng = mulberry32((q.seed == null ? 11 : q.seed) + 777);
      var pileBase = area.y + area.h;
      var moundH = q.pileH == null ? 64 : q.pileH;
      var span = q.pileW == null ? area.w * .78 : q.pileW;
      c.globalAlpha = A * (q.pileAlpha == null ? .5 : q.pileAlpha);
      for (var j = 0; j < show; j++) {
        var pw = words[Math.floor(prng() * words.length) % words.length];
        var px = area.x + area.w / 2 + (prng() - .5) * span;
        var py = pileBase - prng() * moundH;
        var ps = 22 + prng() * 16;
        var pa = .35 + prng() * .5;
        setFont(c, { font: q.font || 'serifCJK', size: ps, weight: 400 });
        c.fillStyle = col(q.pileColor || tint, pal, pa);
        c.fillText(pw, px, py);
      }
    }
    c.restore();
  });

  /* =======================================================================
   * 7.40 参数动画解析（JSON 里用 $wave/$osc/$tween/$pulse01/$lt 让参数随 t 走）
   * ===================================================================== */

  function resolveParams(node, S, ctx, depth) {
    if (node == null || depth > 5) return node;
    if (typeof node !== 'object') return node;
    var i, k, out, arr;
    if (Array.isArray(node)) {
      arr = [];
      for (i = 0; i < node.length; i++) arr.push(resolveParams(node[i], S, ctx, depth + 1));
      return arr;
    }
    if (node.$wave) {
      var w = node.$wave;
      var kk = w[2] == null ? 1 : w[2];
      return lerp(w[0], w[1], .5 - .5 * Math.cos(TAU * cyc(S.t, S.D, kk, w[3] || 0)));
    }
    if (node.$osc) {
      var o = node.$osc;
      return o[0] * Math.sin(TAU * cyc(S.t, S.D, o[1] == null ? 1 : o[1], o[2] || 0));
    }
    if (node.$cyc) {
      // 线性推进并折回：u 从 0 走到 1，t=D 时回到 0（适合相位/角度这类"转一圈"的量）
      var cy = node.$cyc;
      return cy[0] * cyc(S.t, S.D, cy[1] == null ? 1 : cy[1], cy[2] || 0);
    }
    if (node.$steps) {
      // 分级开关：把一段循环切成 n 等份，返回 0..n-1（幕序号、步骤序号、章节号）
      var stq = node.$steps;
      var sn = Math.max(1, stq[0] | 0);
      return Math.min(sn - 1, Math.floor(cyc(S.t, S.D, stq[1] == null ? 1 : stq[1], stq[2] || 0) * sn));
    }
    if (node.$pulse01) {
      var pu = node.$pulse01;
      return pulse(S.t, S.D, pu[0] == null ? 1 : pu[0], pu[1] || 0);
    }
    if (node.$tween) {
      var tw = node.$tween;
      return lerp(tw[0], tw[1], easeFn(tw[2])(ctx.p));
    }
    if (node.$lt) {
      var lt2 = node.$lt;
      var den = lt2[3] == null ? ctx.dur : lt2[3];
      return lerp(lt2[0], lt2[1], easeFn(lt2[2])(clamp01(den > 0 ? ctx.lt / den : 1)));
    }
    out = {};
    for (k in node) {
      if (Object.prototype.hasOwnProperty.call(node, k)) out[k] = resolveParams(node[k], S, ctx, depth + 1);
    }
    return out;
  }

  /* =======================================================================
   * 8. renderStyle — 唯一入口
   * ===================================================================== */

  function drawGuides(c, opts) {
    opts = opts || {};
    c.save();
    c.globalAlpha = 1;
    c.setLineDash && c.setLineDash([10, 8]);
    c.strokeStyle = 'rgba(255,64,140,.85)';
    c.lineWidth = 2;
    var sx = 96, sy = 96, sw = VW - 192, sh = VH - 192;
    if (opts.safe) { sx = opts.safe[0]; sy = opts.safe[1]; sw = opts.safe[2]; sh = opts.safe[3]; }
    c.strokeRect(sx, sy, sw, sh);
    c.setLineDash && c.setLineDash([6, 10]);
    c.strokeStyle = 'rgba(255,255,255,.28)';
    c.lineWidth = 1.4;
    c.beginPath();
    for (var i = 1; i < 3; i++) {
      c.moveTo(sx + sw * i / 3, sy); c.lineTo(sx + sw * i / 3, sy + sh);
      c.moveTo(sx, sy + sh * i / 3); c.lineTo(sx + sw, sy + sh * i / 3);
    }
    c.stroke();
    c.setLineDash && c.setLineDash([]);
    c.strokeStyle = 'rgba(64,220,255,.55)';
    c.beginPath();
    c.moveTo(VW / 2 - 40, VH / 2); c.lineTo(VW / 2 + 40, VH / 2);
    c.moveTo(VW / 2, VH / 2 - 40); c.lineTo(VW / 2, VH / 2 + 40);
    c.stroke();
    if (opts.cols) {
      c.strokeStyle = 'rgba(255,255,255,.14)';
      c.beginPath();
      for (var j = 0; j <= opts.cols; j++) {
        c.moveTo(sx + sw * j / opts.cols, sy);
        c.lineTo(sx + sw * j / opts.cols, sy + sh);
      }
      c.stroke();
    }
    c.restore();
  }

  function renderStyle(pack, t, target, opts) {
    opts = opts || {};
    if (!pack) throw new Error('renderStyle: pack 为空');
    var c = null;
    if (target && typeof target.getContext === 'function') c = target.getContext('2d');
    else if (target && typeof target.fillRect === 'function') c = target;
    if (!c) throw new Error('renderStyle: 需要 canvas 或 CanvasRenderingContext2D');
    var pal = pack.palette || {};
    var D = +pack.duration || 3;
    var tt = t == null ? 0 : +t;
    var lod = opts.lod == null ? 1 : clamp(+opts.lod, 0.15, 1);
    var S = {
      ctx: c, pack: pack, pal: pal, t: tt, D: D, w: VW, h: VH,
      q: opts.quality == null ? 1 : opts.quality,
      lod: lod,
      // 按 LOD 缩放"元素个数"：至少保留 1，避免低 LOD 时整层消失
      n: function (v) { return Math.max(1, Math.round((+v || 0) * lod)); },
      opts: opts
    };
    c.save();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    if (c.setLineDash) c.setLineDash([]);
    c.lineCap = 'butt';
    c.lineJoin = 'miter';
    drawBackground(c, pack.bg, pal);
    drawTexture(S, pack.texture);

    var entries = pack.timeline || [], list = [], i, e;
    for (i = 0; i < entries.length; i++) list.push({ e: entries[i], i: i });
    list.sort(function (a, b) {
      var la = a.e.layer || 0, lb = b.e.layer || 0;
      return la - lb || a.i - b.i;
    });

    for (i = 0; i < list.length; i++) {
      e = list[i].e;
      var fn = PRIM[e.primitive];
      if (!fn) { if (opts.strict) throw new Error('未知原语: ' + e.primitive); continue; }
      var from = +e.from || 0;
      var to = e.to == null ? D : +e.to;
      var dur = Math.max(1e-6, to - from);
      var lt = tt - from;
      if (lt < -1e-6 || lt > dur + 1e-6) continue;
      var p = clamp01(lt / dur);
      var pe = easeFn(e.ease)(p);
      var a = e.alpha == null ? 1 : +e.alpha;
      var rawq = e.params || {};
      var ctxEntry = {
        from: from, to: to, dur: dur, lt: lt, p: p, pe: pe, a: a,
        params: rawq, ease: e.ease, primitive: e.primitive,
        rng: mulberry32(hashStr(String(pack.id || '') + ':' + e.primitive + ':' + (e.seed == null ? list[i].i : e.seed)))
      };
      var qp = resolveParams(rawq, S, ctxEntry, 0);
      ctxEntry.params = qp;
      // fadeIn/fadeOut 既可以写在 params 里，也可以写在 entry 顶层
      var fi = qp.fadeIn != null ? qp.fadeIn : e.fadeIn;
      var fo = qp.fadeOut != null ? qp.fadeOut : e.fadeOut;
      if (fi) a *= smoothstep(0, +fi, lt);
      if (fo) a *= 1 - smoothstep(dur - +fo, dur, lt);
      if (a <= 0.0005) continue;
      ctxEntry.a = a;
      c.save();
      c.globalAlpha = a;
      try { fn(S, ctxEntry); } catch (err) {
        if (opts.strict) { c.restore(); throw err; }
        if (typeof console !== 'undefined') console.warn('[ir] ' + e.primitive + ': ' + err.message);
      }
      c.restore();
    }

    if (opts.guides) drawGuides(c, { safe: (pack.layout || {}).safe, cols: opts.cols || 12 });
    c.restore();
    return S;
  }

  function validatePack(pack) {
    var errs = [], warns = [];
    if (!pack || typeof pack !== 'object') { return { ok: false, errors: ['pack 不是对象'], warnings: [] }; }
    if (!pack.id) errs.push('缺少 id');
    if (!pack.name) warns.push('缺少 name');
    if (pack.duration == null) errs.push('缺少 duration');
    if (!pack.palette) warns.push('缺少 palette');
    if (!pack.timeline || !pack.timeline.length) errs.push('缺少 timeline');
    else {
      for (var i = 0; i < pack.timeline.length; i++) {
        var e = pack.timeline[i], tag = 'timeline[' + i + ']';
        if (e.from == null) errs.push(tag + ' 缺少 from');
        if (e.to == null) errs.push(tag + ' 缺少 to');
        if (!e.primitive) errs.push(tag + ' 缺少 primitive');
        else if (!PRIM[e.primitive]) errs.push(tag + ' 未知原语 ' + e.primitive);
        if (e.to < e.from) errs.push(tag + ' to < from');
        if (e.to > pack.duration) warns.push(tag + ' 超出 duration');
      }
    }
    return { ok: errs.length === 0, errors: errs, warnings: warns };
  }

  /* =======================================================================
   * 9. 导出
   * ===================================================================== */

  return {
    version: '1.0.0',
    VW: VW, VH: VH, TAU: TAU,
    FONTS: FONTS,
    EASE: EASE,
    PRIM: PRIM,
    SHAPES: SHAPES,
    mulberry32: mulberry32,
    hashStr: hashStr,
    fitCanvas: fitCanvas,
    drawGuides: drawGuides,
    renderStyle: renderStyle,
    validatePack: validatePack,
    primitiveNames: function () { return Object.keys(PRIM).sort(); },
    clamp: clamp, clamp01: clamp01, lerp: lerp, invlerp: invlerp,
    smoothstep: smoothstep, smootherstep: smootherstep, cyc: cyc, pulse: pulse,
    mix: mix, shade: shade, col: col, hex2rgb: hex2rgb
  };
});
