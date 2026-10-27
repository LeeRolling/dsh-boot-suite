import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const buf = fs.readFileSync(path.join(root, 'package.json'));
if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
  throw new Error('package.json 带 UTF-8 BOM，DSH 会拒绝加载');
}
const pkg = JSON.parse(buf.toString('utf8'));
if (!pkg.version) throw new Error('package.json 缺少 version');
for (const f of ['lib/index.js', 'lib/splash.js', 'lib/client.js', 'lib/assets/default-background.jpg', 'templates', 'tools/install.ps1', 'tools/update-apply.ps1', 'tools/rollback-version.ps1']) {
  if (!fs.existsSync(path.join(root, f))) throw new Error('缺少 ' + f);
}
const installPs1 = fs.readFileSync(path.join(root, 'tools/install.ps1'), 'utf8');
for (const needle of ['rollback-version.ps1', '紧急回滚-V', 'DSH_BOOT_SUITE_ROLLBACK', 'checkpoint']) {
  if (!installPs1.includes(needle)) throw new Error('install.ps1 缺少更新前回滚 checkpoint：' + needle);
}
const rollbackPs1 = fs.readFileSync(path.join(root, 'tools/rollback-version.ps1'), 'utf8');
for (const needle of ['TargetPkg', 'CheckOnly', 'DSH_BOOT_SUITE_ROLLBACK', '回滚日志']) {
  if (!rollbackPs1.includes(needle)) throw new Error('rollback-version.ps1 缺少关键逻辑：' + needle);
}
console.log('ok  package.json version=' + pkg.version + '，无 BOM，关键文件齐全（含更新前回滚 checkpoint）');
