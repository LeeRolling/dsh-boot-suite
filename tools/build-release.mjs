import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-release-'));
const out = path.join(root, '..', '03-发布包', 'dsh-boot-suite-win.zip');
const skip = new Set(['.git', 'node_modules', '08-备份']);
function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    if (e.name.endsWith('.zip')) continue;
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
for (const f of ['lib/index.js', 'lib/splash.js', 'lib/client.js', 'templates', '安装.cmd', 'tools/install.ps1', 'tools/update-apply.ps1']) {
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
console.log('RELEASE OK version=' + vpkg.version + ' size=' + fs.statSync(out).size + ' bytes -> ' + out);
