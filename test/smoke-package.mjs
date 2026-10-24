import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const buf = fs.readFileSync(path.join(root, 'package.json'));
if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
  throw new Error('package.json 带 UTF-8 BOM，DSH 会拒绝加载');
}
const pkg = JSON.parse(buf.toString('utf8'));
if (!pkg.version) throw new Error('package.json 缺少 version');
for (const f of ['lib/index.js', 'lib/splash.js', 'lib/client.js', 'templates', 'tools/install.ps1', 'tools/update-apply.ps1']) {
  if (!fs.existsSync(path.join(root, f))) throw new Error('缺少 ' + f);
}
console.log('ok  package.json version=' + pkg.version + '，无 BOM，关键文件齐全');
