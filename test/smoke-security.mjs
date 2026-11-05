/* ============================================================================
 * smoke-security.mjs — 安全修复的单元 + 静态回归测试
 * 覆盖：摘要校验 / 安全解码 / 模板结构校验 / 栅栏 fail-closed 判定，
 *       以及 F-01..F-07 修复点在源码/脚本中的关键标记。
 * 用法：node test/smoke-security.mjs
 * ========================================================================== */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  sha256Hex,
  parseDigest,
  digestMatches,
  safeDecodeURIComponent,
  validateTemplate,
  guardDecision,
  TEMPLATE_ID_RE
} from '../lib/security.js'

const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (rel) => fs.readFileSync(path.join(PLUGIN_ROOT, rel), 'utf8')
const readJson = (rel) => JSON.parse(read(rel))

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++ } else { fail++; console.log('✗ ' + label + (extra === undefined ? '' : '  ' + String(extra).slice(0, 300))) }
}

/* ── [1] SHA-256 与官方摘要 ─────────────────────────────────────────────── */
const abc = Buffer.from('abc')
const abcHash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
check('sha256Hex(abc)', sha256Hex(abc) === abcHash, sha256Hex(abc))
check('parseDigest 合法', parseDigest('sha256:' + abcHash) === abcHash)
check('parseDigest 大写/空格', parseDigest('  SHA256:' + abcHash.toUpperCase() + ' ') === abcHash)
check('parseDigest 非法', parseDigest('md5:' + abcHash) === '' && parseDigest(abcHash) === '' && parseDigest('') === '')
const dmOk = digestMatches(abc, 'sha256:' + abcHash)
check('digestMatches 匹配', dmOk.ok === true, JSON.stringify(dmOk))
const dmBad = digestMatches(Buffer.from('abd'), 'sha256:' + abcHash)
check('digestMatches 不匹配', dmBad.ok === false && dmBad.reason === 'digest-mismatch', JSON.stringify(dmBad))
check('digestMatches 缺摘要=失败', digestMatches(abc, '').ok === false)
check('digestMatches 空 buffer=失败', digestMatches(Buffer.alloc(0), 'sha256:' + abcHash).ok === false)

/* ── [2] safeDecodeURIComponent ───────────────────────────────────────── */
check('safeDecode 正常', safeDecodeURIComponent('%E4%BD%A0') === '你')
check('safeDecode 畸形返回 null', safeDecodeURIComponent('%E0%A4%A') === null)
check('safeDecode 空值', safeDecodeURIComponent(undefined) === '')

/* ── [3] validateTemplate ─────────────────────────────────────────────── */
const tplDirs = fs.readdirSync(path.join(PLUGIN_ROOT, 'templates'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
let tplTotal = 0
for (const dir of tplDirs) {
  const p = path.join('templates', dir, 'template.json')
  if (!fs.existsSync(path.join(PLUGIN_ROOT, p))) continue
  tplTotal++
  const raw = readJson(p)
  const r = validateTemplate(raw)
  check('内置模板通过结构校验: ' + dir, r.ok === true, r.reason || '')
}
check('内置模板数量 >= 3', tplTotal >= 3, '共 ' + tplTotal + ' 个')

const base = { id: 'demo-safety', duration: 1000, layers: [{ type: 'bg', color: '#000' }] }
check('合法模板通过', validateTemplate(base).ok === true)
check('拒绝坏 id', validateTemplate({ ...base, id: 'Bad_ID!' }).ok === false)
check('拒绝 layers 非数组', validateTemplate({ ...base, layers: 'nope' }).ok === false)
check('拒绝 layer 非对象', validateTemplate({ ...base, layers: ['nope'] }).ok === false)
check('拒绝 iframe 坏 entry', validateTemplate({ ...base, engine: 'iframe', entry: '../evil.html' }).ok === false)
check('接受 iframe 好 entry', validateTemplate({ ...base, engine: 'iframe', entry: 'index.html' }).ok === true)
check('steps 截断到 24', (() => {
  const r = validateTemplate({ ...base, steps: Array.from({ length: 40 }, (_, i) => ({ t: i })) })
  return r.ok === true && r.value.steps.length === 24
})())
check('拒绝非有限数字', validateTemplate({ ...base, weird: Infinity }).ok === false)
check('拒绝过深嵌套', (() => {
  let o = { deep: 1 }
  for (let i = 0; i < 14; i++) o = { deep: o }
  return validateTemplate({ ...base, nested: o }).ok === false
})())
check('拒绝不可序列化', validateTemplate({ ...base, bad: () => 1 }).ok === false)
check('丢弃 __proto__/constructor 键', (() => {
  const r = validateTemplate(JSON.parse('{"id":"proto-probe","duration":1,"layers":[],"__proto__":{"polluted":1},"constructor":1}'))
  return r.ok === true && Object.prototype.polluted === undefined && !Object.prototype.hasOwnProperty.call(r.value, '__proto__')
})())
check('超长字符串被截断到 4000', (() => {
  const r = validateTemplate({ ...base, title: 'x'.repeat(9000) })
  return r.ok === true && r.value.title.length === 4000
})())
check('TEMPLATE_ID_RE 规则', TEMPLATE_ID_RE.test('archive-warm') && !TEMPLATE_ID_RE.test('../x'))

/* ── [4] guardDecision（fail-closed） ─────────────────────────────────── */
check('guardDecision 放行', guardDecision(false).reject === false && guardDecision(undefined).reject === false && guardDecision(null).reject === false)
check('guardDecision 401', (() => { const r = guardDecision(401); return r.reject === true && r.status === 401 })())
check('guardDecision 403', (() => { const r = guardDecision(403); return r.reject === true && r.status === 403 })())
check('guardDecision 异常→403', (() => { const r = guardDecision(0, new Error('boom')); return r.reject === true && r.status === 403 && r.reason === 'guard-error' })())
check('guardDecision 未知 truthy→403', (() => { const r = guardDecision('???'); return r.reject === true && r.status === 403 })())

/* ── [5] F-01..F-07 修复点静态断言 ───────────────────────────────────── */
const host = read('lib/host-startup.js')
const splash = read('lib/splash.js')
const installPs1 = read('tools/install.ps1')
const updatePs1 = read('tools/update-apply.ps1')
const buildRelease = read('tools/build-release.mjs')
const pkg = readJson('package.json')

check('F-01 host 使用官方摘要校验', host.includes('digestMatches(') && host.includes('parseDigest('))
check('F-01 更新器强制 -Digest', updatePs1.includes('[string]$Digest') && updatePs1.includes('SHA256 与官方发布一致'))
check('F-01 更新器缺少摘要即拒绝', updatePs1.includes('缺少官方 SHA-256 摘要，拒绝更新'))
check('F-01 在线安装校验 SHA256SUMS', read('install-online.ps1').includes('SHA256SUMS.txt') && read('安装-在线.ps1').includes('SHA256SUMS.txt'))
check('F-01 构建产出 SHA256SUMS.txt', buildRelease.includes('SHA256SUMS.txt'))
check('F-02 watch-download 校验 latest/size/digest', host.includes('update-watch-download') && /digestMatches\([\s\S]{0,200}?relWatch/.test(host))
check('F-03 frame-session 路由存在', host.includes("'/frame-session'"))
check('F-03 能力 token 路由存在', host.includes("'/template-frame'") && host.includes('frameTokens'))
check('F-03 iframe 按 untrusted 加 sandbox', splash.includes('frame-session') && splash.includes("setAttribute('sandbox'"))
check('F-03 父页只认本 iframe 消息', splash.includes('e.source !== frame.contentWindow'))
check('F-03 模板只认父窗口消息', read('templates/division-bigfish-codex/app.js').includes('e.source!==parent'))
check('F-04 模板结构校验', host.includes('validateTemplate('))
check('F-05 安全解码替换裸 decode', host.includes('safeDecodeURIComponent('))
check('F-06 PowerShell 参数化下载', host.includes("'-File', psScript") || host.includes("'-File',"))
check('F-07 回滚按钮 EncodedCommand', installPs1.includes('EncodedCommand') && installPs1.includes('ASCIIEncoding'))
check('fail-closed 标记', host.includes('trust guard fail-closed') && host.includes('guardDecision'))
check('测试链包含本文件', String(pkg.scripts.test).includes('smoke-security.mjs'))
check('security.js 已被 host 引用', host.includes("from './security.js'") || host.includes('from "./security.js"'))

/* ── [5b] 第二轮红队/独立验证发现（R-01..R-08）的回归断言 ──────────────── */
const onlinePs1 = read('install-online.ps1')
const onlinePs1Copy = read('安装-在线.ps1')
check('R-01 发布资产按前缀匹配（不再要求 -V<版本>）', host.includes('dsh-boot-suite-win.*\\.zip') && !host.includes("'dsh-boot-suite-win-V' + out.latest"))
check('R-01 下载 URL 使用官方 browser_download_url/资产名', host.includes('rel.zipUrl') && host.includes('rel.zipName'))
check('R-02 在线安装 sums 下载与 zip 解耦', onlinePs1.includes('$haveSums = $false') && onlinePs1.includes('if ($haveSums)'))
check('R-02 在线安装 API 摘要回退可达', onlinePs1.includes("$asset.digest") && onlinePs1.includes("-like 'dsh-boot-suite-win*.zip'"))
check('R-02 两份在线安装脚本一致', onlinePs1 === onlinePs1Copy)
check('R-03 watch-download 缺摘要 fail-closed', host.includes('浏览器下载通道已拒绝'))
check('R-04 frame-session 失败回退也强制 sandbox', splash.includes('fallback template-file (sandboxed)') && splash.includes('sandboxed = true'))
check('R-04 sandbox 不再授予 allow-forms', !splash.includes('allow-scripts allow-forms'))
check('R-05 回滚 inner 使用单引号字面量构造', installPs1.includes('$sq = { param([string]$v)') && installPs1.includes('(& $sq ([string]$checkpoint.path))'))
check('R-06 更新器启动改用 cmd.exe /c', host.includes("spawn('cmd.exe', ['/c', cmdFile]"))
check('R-07 打包对称性保护', buildRelease.includes('打包内容里夹带了归档文件'))

/* ── [6] 汇总 ─────────────────────────────────────────────────────────── */
/* ── [5c] 残余风险收尾（2026-11-05）────────────────────────────── */
check('template-asset 路由做 realpath 包含性校验', /template-asset[\s\S]{0,1500}isFileInsideRoot\(file, root\)/.test(host), '')
check('template-asset 响应含 nosniff', (host.match(/X-Content-Type-Options/g) || []).length >= 3, '')
check('第三方 iframe HTML 带 CSP', host.includes('Content-Security-Policy') && host.includes("connect-src 'none'"))
check('sandbox 模板不能控 BGM/配音', splash.includes('if (sandboxed) return'))
check('ui:detect 锁定 impeccable 版本', /impeccable@\d+\.\d+\.\d+/.test(String(pkg.scripts['ui:detect'] || '')), String(pkg.scripts['ui:detect'] || ''))
check('CI workflow 存在', fs.existsSync(path.join(PLUGIN_ROOT, '.github/workflows/test.yml')))
const ci = read('.github/workflows/test.yml')
check('CI workflow 跑 npm test', ci.includes('npm test') && ci.includes('windows-latest'))
const agentsMd = read('AGENTS.md')
check('AGENTS 隔离测试铁律', agentsMd.includes('DSH_HOME') && agentsMd.includes('$home'))
check('AGENTS 发布清单含 SHA256SUMS', agentsMd.includes('SHA256SUMS.txt'))
check('update-apply 支持 DryRun', updatePs1.includes('[switch]$DryRun') && updatePs1.includes('DryRun 校验通过'))
check('测试链含 DryRun 测试', String(pkg.scripts.test).includes('smoke-update-dryrun.mjs'))

check('N-06 第三方模板 HTML 带 sandbox CSP', host.includes("'sandbox allow-scripts'") && host.includes("untrustedTarget"), '')
check('N-07 模板素材 SVG 带禁脚本 CSP', (host.match(/default-src 'none'; style-src 'unsafe-inline'; img-src data:/g) || []).length >= 2, '')
check('N-08 template-frame 仅允许 GET/HEAD', host.includes("Allow: 'GET, HEAD'"), '')
check('N-11 商店路径合法性校验', host.includes('商店条目的路径不合法'), '')
check('身份卡参数收紧（color/w）', host.includes("/^#[0-9a-f]{3,8}$/i.test(acc)") && host.includes("w>=200 && w<=800"), '')

console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
