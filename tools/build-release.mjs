import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';

const root = process.cwd();
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-release-'));
const out = path.join(root, '..', '03-发布包', 'dsh-boot-suite-win.zip');
/* code-motion：另一条工作线（动效研究/验证）的文档与媒体，不属于插件本体，发布包不打包 */
const skip = new Set(['.git', 'node_modules', '08-备份', 'code-motion']);
function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    if (e.name.endsWith('.zip') || e.name.endsWith('.tgz')) continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copy(s, d); else fs.copyFileSync(s, d);
  }
}
function validatePackageJson(file, label) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    throw new Error(label + ' 的 package.json 带 UTF-8 BOM，DSH 会拒绝加载');
  }
  const pkg = JSON.parse(buf.toString('utf8'));
  if (!pkg.version) throw new Error(label + ' 的 package.json 缺少 version');
  return pkg;
}
copy(root, stage);
const pkg = validatePackageJson(path.join(stage, 'package.json'), '源目录');
for (const f of ['lib/index.js', 'lib/splash.js', 'lib/client.js', 'lib/assets/default-background.jpg', 'templates', '安装.cmd', 'tools/install.ps1', 'tools/update-apply.ps1']) {
  if (!fs.existsSync(path.join(stage, f))) throw new Error('发布包缺少 ' + f);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
if (fs.existsSync(out)) fs.renameSync(out, out.replace(/\.zip$/, '') + '-bak-' + Date.now() + '.zip');
execFileSync('powershell.exe', ['-NoProfile', '-Command', "Compress-Archive -Path '" + stage + "\\*' -DestinationPath '" + out + "' -CompressionLevel Optimal"], { stdio: 'inherit' });
const verify = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-verify-'));
execFileSync('powershell.exe', ['-NoProfile', '-Command', "Expand-Archive -Path '" + out + "' -DestinationPath '" + verify + "' -Force"], { stdio: 'inherit' });
const vpkg = validatePackageJson(path.join(verify, 'package.json'), 'zip 内');
if (vpkg.version !== pkg.version) throw new Error('zip 内版本 ' + vpkg.version + ' 与源目录 ' + pkg.version + ' 不一致');
fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(verify, { recursive: true, force: true });

/* 硬性规定（2026-10-28）：每次发版必须带 dsh-boot-suite.tgz ——
   插件市场的安装链接固定指向 latest/download/dsh-boot-suite.tgz，
   少了它市场里的“安装”按钮就会指向旧版。所以打包脚本自己产，不靠手打。 */
const outDir = path.dirname(out);
const tgz = path.join(outDir, 'dsh-boot-suite.tgz');
if (fs.existsSync(tgz)) fs.renameSync(tgz, tgz.replace(/\.tgz$/, '-bak-' + Date.now() + '.tgz'));
/* Node 24 在 Windows 上不允许直接 spawn .cmd（CVE 修复），所以直接找 npm-cli.js
   用当前 node 执行；找不到才退回 shell 调 npm。 */
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
let packOut;
if (fs.existsSync(npmCli)) {
  packOut = execFileSync(process.execPath, [npmCli, 'pack', '--silent', '--pack-destination', outDir], { cwd: root, encoding: 'utf8' }).trim();
} else {
  packOut = execSync('npm pack --silent --pack-destination "' + outDir + '"', { cwd: root, encoding: 'utf8' }).trim();
}
const packName = packOut.split(/\r?\n/).filter(Boolean).pop();
const packed = path.join(outDir, packName);
if (!fs.existsSync(packed)) throw new Error('npm pack 没有产出 tgz: ' + packName);
fs.renameSync(packed, tgz);
const tbuf = fs.readFileSync(tgz);
if (tbuf.length < 3 || tbuf[0] !== 0x1f || tbuf[1] !== 0x8b) throw new Error('dsh-boot-suite.tgz 不是合法的 gzip');
if (tbuf.length < 1024 * 1024) throw new Error('dsh-boot-suite.tgz 太小（' + tbuf.length + ' B），疑似打包不完整');
console.log('TGZ OK version=' + vpkg.version + ' size=' + tbuf.length + ' bytes -> ' + tgz);
console.log('RELEASE OK version=' + vpkg.version + ' size=' + fs.statSync(out).size + ' bytes -> ' + out);
