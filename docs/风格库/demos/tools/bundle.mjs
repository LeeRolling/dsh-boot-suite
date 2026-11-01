/**
 * bundle.mjs — 把「风格包 JSON + ir-player.js + 模板」打包成单文件 index.html
 * ---------------------------------------------------------------------------
 * 为什么要打包：
 *   file:// 协议下，浏览器把页面当成 opaque origin，fetch()/XHR 读同目录 JSON
 *   会被 CORS 直接拒绝（Chrome/Edge/Firefox 行为一致）。而需求是「双击就能离线打开」，
 *   所以 JSON 与播放器都内联进 index.html，页面只在内存里用它们。
 *
 * 运行： node tools/bundle.mjs
 * 产物： index.html（唯一入口，无外部依赖）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STYLE_DIR = path.join(ROOT, 'styles');
const TEMPLATE = path.join(__dirname, 'index.template.html');
const PLAYER = path.join(ROOT, 'ir-player.js');
const OUT = path.join(ROOT, 'index.html');

const read = (p) => fs.readFileSync(p, 'utf8');

/* ---------------- 1. 收集风格包（按文件名排序 = 页面里的展示顺序） ---------------- */

const files = fs.readdirSync(STYLE_DIR).filter((f) => f.endsWith('.json')).sort();
if (files.length === 0) {
  console.error('❌ styles/ 下没有 .json');
  process.exit(1);
}

const packs = [];
for (const f of files) {
  const raw = read(path.join(STYLE_DIR, f));
  let pack;
  try {
    pack = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ ${f} 不是合法 JSON: ${err.message}`);
    process.exit(1);
  }
  for (const key of ['id', 'duration', 'timeline']) {
    if (pack[key] == null) {
      console.error(`❌ ${f} 缺字段 ${key}`);
      process.exit(1);
    }
  }
  packs.push(pack);
}

const ids = new Set();
for (const p of packs) {
  if (ids.has(p.id)) {
    console.error(`❌ 风格包 id 重复: ${p.id}`);
    process.exit(1);
  }
  ids.add(p.id);
}

/* ---------------- 2. 内联数据 ---------------- */

// 内联进 <script type="application/json">：把 </ 转义掉，避免提前闭合标签。
const packsJson = JSON.stringify(packs, null, 0)
  .replace(/<\//g, '<\\/')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

let playerJs = read(PLAYER);
if (playerJs.includes('</script')) {
  console.error('❌ ir-player.js 里出现了 </script，无法内联');
  process.exit(1);
}

/* ---------------- 3. 套模板 ---------------- */

let html = read(TEMPLATE);
for (const [token, value] of [['{{PACKS}}', packsJson], ['{{PLAYER}}', playerJs]]) {
  if (!html.includes(token)) {
    console.error(`❌ 模板里找不到占位符 ${token}`);
    process.exit(1);
  }
  html = html.replace(token, () => value);   // 函数形式，避免 $& 之类被当成替换模式
}

/* ---------------- 4. 自检 + 写出 ---------------- */

const bad = [];
if (/https?:\/\//.test(html)) bad.push('产物里出现了 http(s):// 外链');
if (/<link\b[^>]*href=/i.test(html)) bad.push('产物里出现了 <link href> 外部资源');
if (/<script[^>]*\bsrc=/i.test(html)) bad.push('产物里出现了 <script src> 外部脚本');
if (/\bMath\.random\s*\(/.test(playerJs)) bad.push('播放器里出现了 Math.random()');
if (/\bDate\.now\s*\(/.test(playerJs)) bad.push('播放器里出现了 Date.now()');

if (bad.length) {
  console.error('❌ ' + bad.join('\n❌ '));
  process.exit(1);
}

fs.writeFileSync(OUT, html, 'utf8');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`✅ 打包完成：index.html  ${kb(Buffer.byteLength(html, 'utf8'))}`);
console.log(`   风格包 ${packs.length} 个：`);
for (const p of packs) {
  console.log(`     · ${p.id.padEnd(18)} ${String(p.name || '').padEnd(28)} ${p.timeline.length} 条时间线 / ${p.duration}s`);
}
console.log(`   内联：ir-player.js ${kb(Buffer.byteLength(playerJs, 'utf8'))} + styles ${kb(Buffer.byteLength(packsJson, 'utf8'))}`);
console.log(`   打开：${OUT}`);
