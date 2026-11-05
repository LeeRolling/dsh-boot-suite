/* ============================================================================
 * smoke-update-dryrun.mjs — 更新器 DryRun 端到端校验（不碰真实 profile）
 * 覆盖：正确摘要通过 / 错误摘要拒绝 / 版本不匹配拒绝 / 缺必需文件拒绝。
 * ========================================================================== */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCRIPT = path.join(ROOT, 'tools', 'update-apply.ps1')
let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++ } else { fail++; console.log('FAIL ' + label + (extra === undefined ? '' : '  ' + String(extra).slice(0, 400))) }
}
if (process.platform !== 'win32') {
  console.log('skip: Windows only')
  process.exit(0)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-dryrun-'))
const profileDir = path.join(os.homedir(), '.dsh', 'boot-suite-updates', '9.9.9')
const existedBefore = fs.existsSync(profileDir)

function makeFixture(name, opts) {
  const o = opts || {}
  const src = path.join(tmp, name)
  fs.mkdirSync(path.join(src, 'lib'), { recursive: true })
  fs.mkdirSync(path.join(src, 'tools'), { recursive: true })
  fs.writeFileSync(path.join(src, 'package.json'), JSON.stringify({ name: 'dsh-boot-suite', version: o.version || '9.9.9' }, null, 2))
  fs.writeFileSync(path.join(src, 'lib', 'index.js'), 'export const x = 1\n')
  fs.writeFileSync(path.join(src, 'lib', 'splash.js'), 'export const y = 1\n')
  if (!o.omitClientJs) fs.writeFileSync(path.join(src, 'lib', 'client.js'), 'export const z = 1\n')
  fs.writeFileSync(path.join(src, 'tools', 'install.ps1'), '# fixture\n')
  fs.mkdirSync(path.join(src, 'filler'), { recursive: true })
  for (let i = 0; i < 50; i++) fs.writeFileSync(path.join(src, 'filler', 'f' + String(i).padStart(2, '0') + '.txt'), 'filler\n')
  const zip = path.join(tmp, name + '.zip')
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
    "Compress-Archive -Path '" + src + "\\*' -DestinationPath '" + zip + "' -Force"], { stdio: 'ignore' })
  const buf = fs.readFileSync(zip)
  return { zip, sha: crypto.createHash('sha256').update(buf).digest('hex') }
}

function run(args) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT].concat(args), { encoding: 'utf8', timeout: 120000 })
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') }
}
function args(fx, version, digest) {
  return ['-Zip', fx.zip, '-Version', version || '9.9.9', '-Exe', path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'notepad.exe'), '-Config', path.join(tmp, 'dsh-startup.json'), '-Digest', 'sha256:' + (digest || fx.sha), '-DryRun']
}

const good = makeFixture('good', {})
const r1 = run(args(good))
check('正确摘要 → DryRun 通过', r1.status === 0 && r1.out.includes('DryRun 校验通过'), r1.out.slice(-500))
check('DryRun 不创建真实版本目录', fs.existsSync(profileDir) === existedBefore, profileDir)

const r2 = run(args(good, '9.9.9', '0'.repeat(64)))
check('错误摘要 → 拒绝', r2.status !== 0 && r2.out.includes('SHA-256'), r2.out.slice(-500))

const r3 = run(args(good, '9.9.8'))
check('版本不匹配 → 拒绝', r3.status !== 0 && r3.out.includes('版本不匹配'), r3.out.slice(-500))

const missing = makeFixture('missing-client', { omitClientJs: true })
const r4 = run(args(missing))
check('缺必需文件 → 拒绝', r4.status !== 0 && r4.out.includes('缺少必需文件'), r4.out.slice(-500))

try { fs.rmSync(tmp, { recursive: true, force: true }) } catch (e) {}
console.log('\n============================')
console.log('  通过 ' + pass + ' / 失败 ' + fail)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
