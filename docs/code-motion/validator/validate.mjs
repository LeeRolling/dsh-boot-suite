#!/usr/bin/env node
// dsh-boot-suite validator：静态检查 + 画面指标 + 评分门槛
// 用法：
//   node validate.mjs --submission <目录或单个txt> [--video <mp4>] [--report <md>]
//   node validate.mjs --submission ... --render --composition SignalClaude [--project .]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const arg = (k, d = '') => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);
const submission = arg('--submission');
const videoArg = arg('--video');
const reportPath = arg('--report');
const project = path.resolve(arg('--project', process.cwd()));
const here = path.dirname(fileURLToPath(import.meta.url));
const expect = { width: 1280, height: 720, fps: 50, frames: 600, ...(arg('--expect') ? JSON.parse(arg('--expect')) : {}) };

if (!submission) { console.error('用法：node validate.mjs --submission <目录|txt> [--video mp4]'); process.exit(2); }

const lines = [];
const result = { checks: [], score: {}, pass: true };
const add = (name, ok, detail = '', fatal = true) => {
  result.checks.push({ name, ok, detail });
  if (!ok && fatal) result.pass = false;
  lines.push((ok ? '✓' : '✗') + ' ' + name + (detail ? '  — ' + detail : ''));
};

// ── 读取提交：目录或单个 txt（=== FILE: x === 块）────────────────────────
function readSubmission(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    const files = {};
    for (const f of fs.readdirSync(p)) {
      const fp = path.join(p, f);
      if (fs.statSync(fp).isFile() && /\.(tsx?|jsx?|md|txt|json)$/.test(f)) files[f] = fs.readFileSync(fp, 'utf8');
    }
    return files;
  }
  const text = fs.readFileSync(p, 'utf8');
  const files = {};
  const re = /^=== FILE: (.+?) ===\s*$/gm;
  const matches = [...text.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim();
    const from = matches[i].index + matches[i][0].length;
    const to = i + 1 < matches.length ? matches[i + 1].index : text.length;
    let body = text.slice(from, to);
    const cut = body.search(/^---\s*$/m);
    if (cut > 0 && /^\d+[.、]\s/m.test(body.slice(cut + 1))) body = body.slice(0, cut);
    files[name] = body.trim() + '\n';
  }
  return files;
}

const files = readSubmission(submission);
const names = Object.keys(files);
const all = Object.values(files).join('\n');
const codeText = names.filter((n) => /\.(tsx?|jsx?|json)$/i.test(n)).map((n) => files[n]).join('\n');

// ── A. 结构 ────────────────────────────────────────────────────────────────
const hasFile = (re) => names.some((n) => re.test(n));
add('文件：tokens 存在', hasFile(/tokens\.(ts|js)$/));
add('文件：parts 存在', hasFile(/parts\.(tsx?|jsx?)$/));
add('文件：Main 存在', hasFile(/^Main\.(tsx?|jsx?)$/i));
const shotCount = names.filter((n) => /shot/i.test(n)).length;
add('文件：至少 3 个镜头文件', shotCount >= 3, '实际 ' + shotCount);
add('文件块没有混入说明文字', !/^\d+[.、]\s*(过程日志|自检|风险)/m.test(codeText));

// ── B. 硬指标（从代码里抽）───────────────────────────────────────────────
const num = (re, d) => { const m = all.match(re); return m ? Number(m[1]) : d; };
const tokensText = files[names.find((n) => /tokens\./i.test(n)) || ''] || all;
const tnum = (re, d) => { const m = tokensText.match(re); return m ? Number(m[1]) : d; };
const width = tnum(/(?:width|WIDTH)\s*[:=]\s*(\d{3,4})/, expect.width);
const height = tnum(/(?:height|HEIGHT)\s*[:=]\s*(\d{3,4})/, expect.height);
const fps = tnum(/(?:fps|FPS)\s*[:=]\s*(\d{1,3})/, expect.fps);
const frames = tnum(/(?:frames|FRAMES|durationInFrames)\s*[:=]\s*(\d{2,5})/, expect.frames);
add('分辨率 ' + expect.width + '×' + expect.height, width === expect.width && height === expect.height, width + '×' + height);
add('帧率 ' + expect.fps + 'fps', fps === expect.fps, fps + 'fps');
add('帧数 ' + expect.frames, frames === expect.frames, frames + ' 帧');

// ── C. 禁用项 ──────────────────────────────────────────────────────────────
const forbidden = [
  [/Math\.random\s*\(/, 'Math.random'],
  [/Date\.now\s*\(/, 'Date.now'],
  [/setTimeout\s*\(/, 'setTimeout'],
  [/setInterval\s*\(/, 'setInterval'],
  [/animation\s*:/, 'CSS animation'],
  [/transition\s*:/, 'CSS transition'],
];
for (const [re, label] of forbidden) add('禁用：' + label, !re.test(codeText));

// ── D. 颜色 / 字体 ─────────────────────────────────────────────────────────
const hexes = new Set((codeText.match(/#[0-9a-fA-F]{6}\b/g) || []).map((x) => x.toLowerCase()));
add('颜色 ≤4 色', hexes.size <= 4, '实际 ' + hexes.size + '：' + [...hexes].join(' '));
const fontFams = new Set((codeText.match(/fontFamily:\s*[\"']([^\"']+)/g) || []).map((x) => x));
add('字体族 ≤2', fontFams.size <= 2, '实际 ' + fontFams.size);

// ── E. 必含能力（关键词启发式）────────────────────────────────────────────
const feature = [
  ['网格', /grid|网格/i],
  ['准星', /reticle|crosshair|准星/i],
  ['打字机/光标', /typewriter|caret|cursor|打字/i],
  ['3D 面板', /perspective|rotateY|3D/i],
  ['进度/计数', /progress|percent|87|计数/i],
  ['扫描', /scan|sweep|radar|conic-gradient/i],
  ['粒子', /particle|粒子/i],
  ['几何描边', /hex|polygon|strokeDashoffset|描边/i],
  ['故障/闪白', /glitch|flash|故障|闪白/i],
];
for (const [label, re] of feature) add('能力：' + label, re.test(codeText), '', false);

// ── F. 交付纪律 ───────────────────────────────────────────────────────────
add('交付：ASSUMPTION 标注', /ASSUMPTION/i.test(all));
const hasStory = /分镜|storyboard/i.test(all);
add('交付：分镜表', hasStory);
add('交付：自检表', /自检|self.?check/i.test(all));
add('交付：风险/取舍说明', /风险|取舍|trade.?off/i.test(all), '', false);
add('ASSUMPTION 有编号（警告）', /ASSUMPTION[^\n]{0,12}[#\[（(]?\s*\d|ASSUMPTION-[0-9A-Z]/i.test(all), '', false);

// ── G. 画面指标（给定视频时）──────────────────────────────────────────────
let metrics = null;
let mp4 = videoArg;
if (has('--render')) {
  const composition = arg('--composition');
  if (!composition) { add('渲染：缺少 --composition', false); }
  else {
    const tmp = path.join(project, 'out', '_validator_render_' + Date.now() + '.mp4');
    try {
      execFileSync(process.execPath, [path.join(project, 'node_modules', '@remotion', 'cli', 'remotion-cli.js'),
        'render', 'src/index.ts', composition, tmp,
        '--browser-executable=' + (process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'),
        '--codec=h264'], { cwd: project, stdio: 'pipe', timeout: 10 * 60 * 1000 });
      add('渲染：成功出片', true, tmp);
      mp4 = tmp;
    } catch (e) { add('渲染：失败', false, String(e.message).slice(0, 200)); }
  }
}
if (mp4 && fs.existsSync(mp4)) {
  try {
    const py = process.env.PYTHON || 'python';
    const out = execFileSync(py, [path.join(here, 'metrics.py'), mp4], { encoding: 'utf8', timeout: 120000 });
    metrics = JSON.parse(out.trim().split('\n').pop());
    add('画面：能读帧', metrics.ok, '采样 ' + (metrics.sampled || 0));
    add('画面：平均亮度 ≥10', metrics.avgY >= 10, 'Yavg=' + metrics.avgY);
    add('画面：近黑帧 ≤5%', metrics.darkPct <= 5, '暗帧 ' + metrics.darkPct + '%');
    add('画面：内容覆盖率（参考）', true, '亮部 ' + metrics.brightPct + '%（暗色设计不设门槛）', false);
  } catch (e) { add('画面指标：失败', false, String(e.message).slice(0, 200)); }
} else if (videoArg) {
  add('画面：视频不存在', false, videoArg);
}

// ── 汇总 ──────────────────────────────────────────────────────────────────
const groups = [
  ['结构', /^文件/], ['规格', /^(分辨率|帧率|帧数)/], ['确定性', /^禁用/],
  ['视觉约束', /^(颜色|字体)/], ['能力覆盖', /^能力/], ['交付', /^(交付|ASSUMPTION)/],
  ['画面', /^画面/],
];
for (const [label, re] of groups) {
  const items = result.checks.filter((c) => re.test(c.name));
  const ok = items.filter((c) => c.ok).length;
  result.score[label] = ok + '/' + items.length;
}
// 门槛：硬性项全过 + 文件/交付/画面三项达标
result.pass = result.pass && result.checks.filter((c) => /^交付/.test(c.name)).every((c) => c.ok)
  && result.checks.filter((c) => /^画面/.test(c.name)).every((c) => c.ok);
const verdict = result.pass ? 'PASS' : 'FAIL';
const md = ['# Validator 报告', '', '提交：' + submission, '结论：**' + verdict + '**', '',
  ...lines.map((l) => '- ' + l), '', '## 分组', ...Object.entries(result.score).map(([k, v]) => '- ' + k + '：' + v), ''].join('\n');
console.log(md);
if (reportPath) fs.writeFileSync(reportPath, md, 'utf8');
fs.writeFileSync(path.join(path.dirname(reportPath || path.join(project, 'out', 'x.md')), 'validator-report.json'), JSON.stringify(result, null, 2));
process.exit(result.pass ? 0 : 1);
