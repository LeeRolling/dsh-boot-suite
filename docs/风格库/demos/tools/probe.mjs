/**
 * probe.mjs — 生成「单风格多时间点」探针页，配合 headless Chrome 截图做目视检查
 * ---------------------------------------------------------------------------
 * 为什么需要它：网格页 index.html 一次只能看到 10 个 demo 的同一个时刻，
 * 判断一个风格好不好看，需要看它在 0 / 0.5 / … / 2.95s 的形态与接缝。
 *
 * 实现要点：先在 1920×1080 的离屏 canvas 上按 IR 画（不依赖 CSS 布局，
 * 避免 clientWidth 为 0 时缩放算错），再 drawImage 缩放贴到小格子里。
 *
 * 用法：
 *   node tools/probe.mjs
 *   chrome --headless=new --screenshot=out.png --window-size=1920,1080 \
 *     "file:///…/tools/_probe.html?p=k22-origami&ts=0,0.6,1.2,1.8,2.4,2.95&cols=3&w=640"
 *
 * 参数：p=风格包 id   ts=逗号分隔的时间点   cols=每行几张   w=单张宽度（高按 16:9）
 *       bg=页面底色   label=1|0 是否画时间标注
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const files = fs.readdirSync(path.join(ROOT, 'styles')).filter((f) => f.endsWith('.json')).sort();
const packs = files.map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'styles', f), 'utf8')));
const player = fs.readFileSync(path.join(ROOT, 'ir-player.js'), 'utf8');

const esc = (s) => String(s).replace(/<\//g, '<\\/').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>IR probe</title>
<style>
  html, body { margin: 0; padding: 0; background: #0a0c10; }
  #wrap { display: flex; flex-wrap: wrap; }
  .cell { position: relative; background: #000; }
  .cell canvas { display: block; }
  .tag { position: absolute; left: 8px; bottom: 6px; font: 600 13px/1.4 "Cascadia Mono", Consolas, monospace;
         color: #9fb0c8; background: rgba(0,0,0,.6); padding: 2px 7px; border-radius: 3px; letter-spacing: .04em; }
</style>
</head>
<body>
<div id="wrap"></div>
<script id="packs" type="application/json">${esc(JSON.stringify(packs))}</script>
<script>${player}</script>
<script>
(function () {
  var PACKS = {};
  JSON.parse(document.getElementById('packs').textContent).forEach(function (p) { PACKS[p.id] = p; });
  var Q = new URLSearchParams(location.search);
  var id = Q.get('p') || Object.keys(PACKS)[0];
  var pack = PACKS[id];
  if (!pack) {
    document.body.innerHTML = '<pre style="color:#f66;font:16px monospace">unknown pack: ' + id + '</pre>';
    return;
  }
  var ts = (Q.get('ts') || '0').split(',').map(Number).filter(function (v) { return isFinite(v); });
  // solo=<primitive>：只保留这一种原语的 entry，用来单独特写排查某个原语画成什么样
  var solo = Q.get('solo');
  if (solo) {
    pack = JSON.parse(JSON.stringify(pack));
    pack.timeline = pack.timeline.filter(function (e) { return e.primitive === solo; });
  }
  var cols = Math.max(1, parseInt(Q.get('cols') || '3', 10));
  var W = Math.max(80, parseInt(Q.get('w') || '640', 10));
  var H = Math.round(W * 9 / 16);
  var showLabel = Q.get('label') !== '0';
  document.body.style.background = Q.get('bg') || '#0a0c10';
  var wrap = document.getElementById('wrap');
  wrap.style.width = (cols * W) + 'px';

  // 离屏满尺寸画布：IR 按 1920×1080 画，不受 CSS 布局影响
  var big = document.createElement('canvas');
  big.width = 1920; big.height = 1080;

  ts.forEach(function (t) {
    var cell = document.createElement('div');
    cell.className = 'cell';
    cell.style.width = W + 'px';
    cell.style.height = H + 'px';

    var tmp = document.createElement('canvas');
    tmp.width = 1920; tmp.height = 1080;
    if (Q.get('strict')) {
      try {
        IR.renderStyle(pack, Math.min(Math.max(t, 0), pack.duration), tmp, { dpr: 1, fit: 'cover', lod: 1, strict: true });
      } catch (err) {
        var pre = document.createElement('pre');
        pre.id = 'strict-error';
        pre.style.cssText = 'position:fixed;left:0;top:0;z-index:9;color:#f66;background:#000;font:14px monospace;padding:12px;white-space:pre-wrap;max-width:100%';
        pre.textContent = 'STRICT ERROR @t=' + t + ' :: ' + (err && err.stack ? err.stack : String(err));
        document.body.appendChild(pre);
        document.title = 'ERR ' + (err && err.message ? err.message : String(err));
        return;
      }
    } else {
      IR.renderStyle(pack, Math.min(Math.max(t, 0), pack.duration), tmp, { dpr: 1, fit: 'cover', lod: 1 });
    }

    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.getContext('2d').drawImage(tmp, 0, 0, 1920, 1080, 0, 0, W, H);
    cell.appendChild(cv);
    wrap.appendChild(cell);

    if (showLabel) {
      var tag = document.createElement('div');
      tag.className = 'tag';
      tag.textContent = 't=' + t.toFixed(2) + 's';
      cell.appendChild(tag);
    }
  });
  document.title = 'probe ' + id;
})();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '_probe.html'), html, 'utf8');
console.log('✅ tools/_probe.html  (' + packs.length + ' 包)');
