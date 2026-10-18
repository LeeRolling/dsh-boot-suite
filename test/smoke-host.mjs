/* ============================================================================
 * Host 半侧冒烟测试 —— 不装进 DSH，直接用假 ctx 把 apply() 跑一遍。
 * 覆盖：路由注册 / 信任栅栏 / 配置读写落盘 / index.html 注入结果。
 * 用法：node smoke-host.mjs
 * ========================================================================== */
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 找一份真实的 DSH dist/index.html 来做注入测试；找不到就用等价的最小样本。
 *  跨平台：Windows 的 npx 缓存在 %LOCALAPPDATA%，POSIX 在 ~/.npm 或 ~/.cache。 */
function findRealIndex() {
  const candidates = []
  if (process.env.DSH_FRONTEND_INDEX) candidates.push(process.env.DSH_FRONTEND_INDEX)
  const caches = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'),
    path.join(os.homedir(), '.npm', '_npx'),
    path.join(os.homedir(), '.cache', 'npm', '_npx'),
  ].filter(Boolean)
  for (const npx of caches) {
    try {
      for (const d of fs.readdirSync(npx)) {
        candidates.push(path.join(npx, d, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html'))
      }
    } catch { /* 这个缓存目录不存在，换下一个 */ }
  }
  for (const c of candidates) if (fs.existsSync(c)) return { path: c, html: fs.readFileSync(c, 'utf8') }
  /* 样本严格照 DSH dist/index.html 的形状写（属性都带引号），
     这样没装 DSH 的机器上跑到的断言和真机完全一致 */
  return { path: '(内置样本，形状等同 DSH dist/index.html)', html: [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <title>DeepSeek Harness</title>',
    '    <script type="module" crossorigin src="./assets/index-XXX.js"></script>',
    '    <link rel="stylesheet" crossorigin href="./assets/vendor-XXX.css">',
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    '  </body>',
    '</html>',
    '',
  ].join('\n') }
}
const REAL_INDEX = findRealIndex()
const SMOKE_HOME = path.join(os.tmpdir(), 'dsh-startup-smoke-' + Date.now())
fs.mkdirSync(SMOKE_HOME, { recursive: true })
process.env.DSH_HOME = SMOKE_HOME

const ROUTES = new Map()
const TAPS = []
const INJECT_LISTENERS = []
let effects = 0
let rejectNext = undefined

const ctx = {
  webServer: {
    register(route) {
      if (ROUTES.has(route.kind + ' ' + route.path)) throw new Error('duplicate route ' + route.path)
      ROUTES.set(route.kind + ' ' + route.path, route)
      return () => ROUTES.delete(route.kind + ' ' + route.path)
    },
    tapIndex(fn) { TAPS.push(fn); return () => TAPS.splice(TAPS.indexOf(fn), 1) },
  },
  on(name, fn) {
    if (name === 'webserver/index-inject') INJECT_LISTENERS.push(fn)
    return () => { const i = INJECT_LISTENERS.indexOf(fn); if (i >= 0) INJECT_LISTENERS.splice(i, 1) }
  },
  get(name) {
    if (name !== 'connection') return undefined
    return {
      // 官方 dsh-host-open-in-app 同款栅栏：返回 undefined = 放行
      requestRejection() { return rejectNext },
    }
  },
  effect(fn) { effects++; const d = fn(); return () => { if (typeof d === 'function') d() } },
}

class FakeReq extends EventEmitter {
  constructor(method, body, url) {
    super()
    this.method = method
    this.headers = { host: '127.0.0.1:3080' }
    this.url = url || '/'
    process.nextTick(() => {
      if (body !== undefined) this.emit('data', Buffer.from(body))
      this.emit('end')
    })
  }
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: null,
    body: '',
    writeHead(code, headers) { this.statusCode = code; this.headers = headers || {}; return this },
    end(buf) { this.body = buf === undefined ? '' : Buffer.from(buf).toString('utf8') },
  }
}

async function call(kindPath, method = 'GET', body, url) {
  const route = ROUTES.get(kindPath)
  if (!route) throw new Error('route missing: ' + kindPath)
  const res = fakeRes()
  await route.handler(new FakeReq(method, body, url), res)
  return res
}

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  → ' + extra : '')) }
}

console.log('\n[1] 模块导出形状（对齐 cordis-plugin-loader 的 unwrapExports）')
const mod = await import(pathToFileURL(path.join(PLUGIN_ROOT, 'lib', 'index.js')).href)
check('有具名 name', typeof mod.name === 'string', mod.name)
check('name 与 cordis.patch.yml 的 id 一致', mod.name === 'dsh-boot-suite', mod.name)
check('有具名 inject', Array.isArray(mod.inject), JSON.stringify(mod.inject))
check('inject 含 webServer + connection', mod.inject.includes('webServer') && mod.inject.includes('connection'))
check('有具名 apply', typeof mod.apply === 'function')
check('default（若有）与具名导出指向同一个插件对象', mod.default === undefined || (mod.default.apply === mod.apply && mod.default.name === mod.name), String(mod.default))
check('没有 Config 导出（普通对象不是 schemastery schema）', mod.Config === undefined, String(mod.Config))

console.log('\n[2] apply(ctx)：路由与注入')
mod.apply(ctx)
check('注册了 21 条路由（开机动画 14 + 聊天壁纸 7）', ROUTES.size === 21, [...ROUTES.keys()].join(' | '))
check('注册了 1 个 tapIndex', TAPS.length === 1)
check('用了 ctx.effect 管理生命周期（开机动画 1 + 壁纸 7）', effects === 8, String(effects))

console.log('\n[3] 静态路由')
let r = await call('exact /dsh-startup/splash.css')
check('splash.css 200 + 正确 MIME', r.statusCode === 200 && /text\/css/.test(r.headers['Content-Type']), r.headers['Content-Type'])
check('splash.css 非空', r.body.length > 10000, r.body.length + ' bytes')
r = await call('exact /dsh-startup/splash.js')
check('splash.js 200 + 正确 MIME', r.statusCode === 200 && /javascript/.test(r.headers['Content-Type']), r.headers['Content-Type'])
check('splash.js 非空', r.body.length > 20000, r.body.length + ' bytes')

console.log('\n[3b] 音频素材路由')
r = await call('prefix /dsh-startup/asset')
check('请求 /asset 无文件名 -> 404', r.statusCode === 404, String(r.statusCode))
r = await call('prefix /dsh-startup/asset', 'GET', undefined, '/dsh-startup/asset/sfx-tick.mp3')
check('sfx-tick.mp3 -> 200 + audio/mpeg', r.statusCode === 200 && r.headers['Content-Type'] === 'audio/mpeg', r.headers['Content-Type'])
check('sfx-tick.mp3 有内容', r.body.length > 500, r.body.length + ' bytes')
r = await call('prefix /dsh-startup/asset', 'GET', undefined, '/dsh-startup/asset/../../package.json')
check('目录穿越被拒 -> 404', r.statusCode === 404, String(r.statusCode))
r = await call('prefix /dsh-startup/asset', 'GET', undefined, '/dsh-startup/asset/nope.mp3')
check('不存在的素材 -> 404', r.statusCode === 404, String(r.statusCode))
for (const f of ['line-1', 'line-2', 'line-3', 'line-4', 'line-5']) {
  const rr = await call('prefix /dsh-startup/asset', 'GET', undefined, '/dsh-startup/asset/' + f + '.mp3')
  check('真声素材 ' + f + '.mp3 -> 200', rr.statusCode === 200 && rr.body.length > 5000, rr.statusCode + ' ' + rr.body.length)
}

console.log('\n[4] 配置读写落盘')
r = await call('exact /dsh-startup/config')
let cfg = JSON.parse(r.body)
check('GET config ok', cfg.ok === true)
check('默认身份名称 = JOYCE MOORE', cfg.config.identity === 'JOYCE MOORE', cfg.config.identity)
check('默认身份编号 = 0087', cfg.config.identityId === '0087', cfg.config.identityId)
check('返回了配置文件路径', typeof cfg.file === 'string' && cfg.file.startsWith(SMOKE_HOME), cfg.file)
check('返回了插件版本号（设置面板顶部要显示它）', typeof cfg.version === 'string' && /^\d+\.\d+\.\d+/.test(cfg.version), cfg.version)

r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { identity: '琉璃', speed: 99, enabled: 'true' } }))
cfg = JSON.parse(r.body)
check('POST config ok', cfg.ok === true)
check('身份名称写入成功（中文）', cfg.config.identity === '琉璃', cfg.config.identity)
check('speed 被夹到上限 3', cfg.config.speed === 3, String(cfg.config.speed))
check('enabled 字符串 "true" 被转成 boolean true', cfg.config.enabled === true, String(cfg.config.enabled))
check('配置已落盘', fs.existsSync(path.join(SMOKE_HOME, 'dsh-startup.json')))

r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { identityId: '' } }))
check('身份编号留空 + 纯中文名 → 兜底 OPERATOR', JSON.parse(r.body).config.identityId === 'OPERATOR', JSON.parse(r.body).config.identityId)
r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { identity: 'Ada Lovelace', identityId: '' } }))
check('身份编号留空 + 英文名 → 自动派生 ADALOVELACE', JSON.parse(r.body).config.identityId === 'ADALOVELACE', JSON.parse(r.body).config.identityId)
r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { speed: 0.01, theme: 'neon', accent: 'javascript:alert(1)' } }))
cfg = JSON.parse(r.body)
check('speed 低于下限被夹到 0.35', cfg.config.speed === 0.35, String(cfg.config.speed))
check('非法 theme 回落到 light', cfg.config.theme === 'light', cfg.config.theme)
check('非法颜色回落到默认橙', cfg.config.accent === '#ff7500', cfg.config.accent)

r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ action: 'reset' }))
check('reset 恢复默认', JSON.parse(r.body).config.identity === 'JOYCE MOORE')

r = await call('exact /dsh-startup/config', 'POST', '{ not json')
check('非法 JSON 返回 400', r.statusCode === 400, String(r.statusCode))
r = await call('exact /dsh-startup/config', 'DELETE')
check('不支持的方法返回 405', r.statusCode === 405, String(r.statusCode))

console.log('\n[5] 信任栅栏（DNS 重绑定 / 未认证请求）')
rejectNext = 403
r = await call('exact /dsh-startup/config')
check('connection 拒绝时返回 403 且不吐配置', r.statusCode === 403 && r.body === '', r.statusCode + ' body=' + JSON.stringify(r.body.slice(0, 40)))
rejectNext = undefined

/* ── DSH 0.2.x 的注入行渲染器（照抄 dsh-host-webserver 的 renderRow/renderIndexInjections 语义：
      head 行插到 <head> 之后、body 行插到 <body> 之后，各自按表内顺序；末尾补 __DSH_BOOT_READY__）。
   桌面端（file:// + IPC）拿的就是这张表，所以这里按表断言才算数。 */
function escAttr(v) { return String(v).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') }
const BS = String.fromCharCode(92)
function escLt(v) { return String(v).split('<').join(BS + 'u003c') }
function renderRows(html, rows) {
  let head = '', body = ''
  for (const row of rows) {
    let r
    if (row.kind === 'global') r = { placement: 'head', markup: '<script>globalThis[' + escLt(JSON.stringify(row.name)) + '] = ' + (row.value === undefined ? 'undefined' : escLt(JSON.stringify(row.value))) + '</script>' }
    else if (row.kind === 'script') r = { placement: row.placement, markup: '<script>' + row.text + '</script>' }
    else if (row.kind === 'script-src') r = { placement: row.placement, markup: '<script src="' + escAttr(row.src) + '"></script>' }
    else if (row.kind === 'script-preload') r = { placement: 'head', markup: '<link rel="preload" as="script" href="' + escAttr(row.src) + '">' }
    else if (row.kind === 'style') r = { placement: 'head', markup: '<style>' + row.text + '</style>' }
    else if (row.kind === 'html') r = { placement: row.placement, markup: row.html }
    else throw new Error('unknown row ' + JSON.stringify(row))
    if (r.placement === 'head') head += r.markup
    else body += r.markup
  }
  body += '<script>(globalThis.__DSH_BOOT_READY__ ??= Promise.withResolvers()).resolve()</script>'
  let out = html
  const ho = /<head(?:\s[^>]*)?>/i.exec(out)
  out = ho === null ? head + out : out.slice(0, ho.index + ho[0].length) + head + out.slice(ho.index + ho[0].length)
  const bo = /<body(?:\s[^>]*)?>/i.exec(out)
  out = bo === null ? out + body : out.slice(0, bo.index + bo[0].length) + body + out.slice(bo.index + bo[0].length)
  return out
}

/** 取当前注入行表（每次渲染都是新表，数据现读） */
function collectRows() {
  const table = []
  for (const fn of INJECT_LISTENERS) fn(table)
  return table
}

/** 从渲染结果里精确抠出内联 JSON 载荷 */
function inlinePayload(html) {
  const a = html.indexOf('globalThis["__DSH_STARTUP__"] = ')
  if (a === -1) return ''
  const start = a + 'globalThis["__DSH_STARTUP__"] = '.length
  const b = html.indexOf('</script>', start)
  return b === -1 ? '' : html.slice(start, b)
}

console.log('\n[6] index.html 注入：结构化注入行（源: ' + REAL_INDEX.path + '）')
const before = REAL_INDEX.html
const rows = collectRows()
check('发出了注入行（9 条）', rows.length === 9, String(rows.length))
const duplicateDeliveryRows = []
for (const fn of INJECT_LISTENERS) { fn(duplicateDeliveryRows); fn(duplicateDeliveryRows) }
check('同一行表被重复通知时仍只注入一次',
  duplicateDeliveryRows.length === 9 &&
  duplicateDeliveryRows.filter((r) => r.kind === 'html' && r.html.includes('dsh-startup-root')).length === 1,
  String(duplicateDeliveryRows.length))
check('行表里有 style 行（首帧黑幕）', rows.some((r) => r.kind === 'style' && r.text.includes('#dsh-startup-root.dsu-boot')))
check('行表里有 splash.css 的 head 行', rows.some((r) => r.kind === 'html' && r.placement === 'head' && r.html.includes('/dsh-startup/splash.css')))
check('行表里有三个 global 行（BOOT / VERSION / 配置）',
  rows.filter((r) => r.kind === 'global').length === 3 &&
  rows.some((r) => r.kind === 'global' && r.name === '__DSH_STARTUP_BOOT__' && r.value === 'index') &&
  rows.some((r) => r.kind === 'global' && r.name === '__DSH_STARTUP_VERSION__') &&
  rows.some((r) => r.kind === 'global' && r.name === '__DSH_STARTUP__'))
check('行表里有挂载点 / 兜底脚本 / 运行时脚本',
  rows.some((r) => r.kind === 'html' && r.html.includes('<div id="dsh-startup-root" class="dsu-root dsu-boot">')) &&
  rows.some((r) => r.kind === 'script' && r.text.includes('__DSH_STARTUP_SKIP__')) &&
  rows.some((r) => r.kind === 'script-src' && r.src === '/dsh-startup/splash.js') &&
  rows.some((r) => r.kind === 'script-preload' && r.src === '/dsh-startup/splash.js'))

const after = renderRows(before, rows)
check('渲染后注入了 splash.css <link>', after.includes('<link rel="stylesheet" href="/dsh-startup/splash.css">'))
check('渲染后注入了首屏兜底 <style>', after.includes('#dsh-startup-root.dsu-boot{position:fixed'))
check('渲染后注入了挂载点 div', after.includes('<div id="dsh-startup-root" class="dsu-root dsu-boot">'))
check('渲染后注入了 __DSH_STARTUP__ 配置', /^\{"enabled":/.test(inlinePayload(after)), inlinePayload(after).slice(0, 60))
check('内联载荷是合法 JSON', (() => { try { JSON.parse(inlinePayload(after)); return true } catch { return false } })())
/* 设置面板顶部的版本号：Host 从自己的 package.json 读出来，再交给浏览器半侧 */
const pkgVersion = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'package.json'), 'utf8')).version
check('注入了 __DSH_STARTUP_VERSION__', after.includes('globalThis["__DSH_STARTUP_VERSION__"] ='), '')
check('注入的版本号 = package.json 的 version', after.includes('globalThis["__DSH_STARTUP_VERSION__"] = ' + JSON.stringify(pkgVersion)), pkgVersion)
check('运行时脚本用 script-src 行（html 行里的 script 在桌面端不执行）', rows.some((r) => r.kind === 'script-src' && r.src === '/dsh-startup/splash.js'))
check('渲染后是真的 <script src>', after.includes('<script src="/dsh-startup/splash.js"></script>'))
check('head 里有 splash.js 的 preload（提前并行下载）', after.includes('<link rel="preload" as="script" href="/dsh-startup/splash.js">'))
check('配置落在 </head> 之前', after.indexOf('#dsh-startup-root.dsu-boot') < after.indexOf('</head>'))
check('挂载点紧跟 <body>', /<body>\s*<div id="dsh-startup-root"/.test(after))
check('幂等：行表已注入后 tapIndex 变成无操作', TAPS[0](after) === after)
check('原 <div id="root"></div> 仍在（应用照常挂载）', after.includes('<div id="root"></div>'))
check('内联载荷里没有裸的 < （防 </script> 提前闭合）', !inlinePayload(after).includes('<'))

console.log('\n[6b] 模板：选中的模板以 global 行下发')
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { template: 'archive-warm' } }))
{
  const rowsWithTpl = collectRows()
  const tplRow = rowsWithTpl.find((r) => r.kind === 'global' && r.name === '__DSH_STARTUP_TEMPLATE__')
  check('选了模板时多一行 __DSH_STARTUP_TEMPLATE__（9 → 10）', rowsWithTpl.length === 10, String(rowsWithTpl.length))
  check('模板行带 id（来自插件自带 templates/）', !!tplRow && tplRow.value.id === 'archive-warm', tplRow && tplRow.value.id)
}
{
  const r2 = await call('exact /dsh-startup/templates')
  const list = JSON.parse(r2.body)
  const ids = (list.templates || []).map((x) => x.id)
  check('/dsh-startup/templates 列出内置模板', r2.statusCode === 200 && list.ok === true && ids.includes('archive-warm') && ids.includes('deep-sonar'), ids.join(','))
  /* 设置页「立即预览」要靠 /config 顺带返回模板整份数据 */
  const r3 = await call('exact /dsh-startup/config')
  const cfgNow = JSON.parse(r3.body)
  check('/config 带上当前模板的整份数据（预览换模板用）',
    !!cfgNow.template && cfgNow.template.id === 'archive-warm' && Array.isArray(cfgNow.template.steps) && cfgNow.template.steps.length === 5,
    cfgNow.template && cfgNow.template.id)
  check('模板列表带 active 字段', typeof list.active === 'string')
}
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { template: '../etc/passwd' } }))
check('非法的模板 id 被忽略（不读文件、不多行）', collectRows().length === 9)
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { template: 'no-such-template' } }))
check('模板不存在时回落内置（不报错、不多行）', collectRows().length === 9)
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { template: '' } }))

console.log('\n[6c] 编辑器：模板读写')
{
  const mine = { id: 'my-test', name: '测试模板', author: 'smoke', steps: [{ zh: '一', en: 'ONE' }, { zh: '二', en: 'TWO' }, { zh: '三', en: 'THREE' }] }
  const saved = await call('exact /dsh-startup/templates/save', 'POST', JSON.stringify({ template: mine }))
  const savedJson = JSON.parse(saved.body)
  check('保存模板成功', saved.statusCode === 200 && savedJson.ok === true && savedJson.id === 'my-test', saved.body.slice(0, 120))
  check('文件真的落到 ~/.dsh/startup-templates/ 下', fs.existsSync(path.join(SMOKE_HOME, 'startup-templates', 'my-test', 'template.json')))
  const listUser = JSON.parse((await call('exact /dsh-startup/templates')).body)
  const mineEntry = listUser.templates.find((x) => x.id === 'my-test')
  check('列表里能看到它、且标成本地', !!mineEntry && mineEntry.source === 'user', JSON.stringify(mineEntry))
  const preview = await call('exact /dsh-startup/preview-template', 'GET', undefined, '/dsh-startup/preview-template?id=my-test')
  const pv = JSON.parse(preview.body)
  check('按 id 能读回模板整份数据', preview.statusCode === 200 && pv.ok === true && pv.template.steps.length === 3)
  const bad = await call('exact /dsh-startup/templates/save', 'POST', JSON.stringify({ template: { id: '../evil' } }))
  check('非法 id 拒写（防目录穿越）', bad.statusCode === 400)
  const editor = await call('exact /dsh-startup/editor')
  check('编辑器页面能发出来', editor.statusCode === 200 && editor.body.includes('模板编辑器') && editor.body.includes('/dsh-startup'), editor.body.length + ' bytes')
  const del = await call('exact /dsh-startup/templates/delete', 'POST', JSON.stringify({ id: 'my-test' }))
  check('删除模板成功', del.statusCode === 200 && JSON.parse(del.body).ok === true)
  check('文件确实删掉了', !fs.existsSync(path.join(SMOKE_HOME, 'startup-templates', 'my-test')))
  /* 同名模板：用户目录必须覆盖内置，否则在编辑器里改完内置模板等于白改 */
  await call('exact /dsh-startup/templates/save', 'POST', JSON.stringify({ template: { id: 'deep-sonar', name: '覆盖测试', steps: [{ zh: '覆盖' }] } }))
  const ov = JSON.parse((await call('exact /dsh-startup/preview-template', 'GET', undefined, '/dsh-startup/preview-template?id=deep-sonar')).body)
  check('同名模板：用户目录覆盖内置', ov.ok === true && ov.template.name === '覆盖测试', ov.template && ov.template.name)
  const ovList = JSON.parse((await call('exact /dsh-startup/templates')).body)
  check('列表里同名项标成本地', (ovList.templates.filter((x) => x.id === 'deep-sonar')[0] || {}).source === 'user')
  await call('exact /dsh-startup/templates/delete', 'POST', JSON.stringify({ id: 'deep-sonar' }))
  const backTpl = JSON.parse((await call('exact /dsh-startup/preview-template', 'GET', undefined, '/dsh-startup/preview-template?id=deep-sonar')).body)
  check('删掉本地覆盖后回到内置', backTpl.ok === true && backTpl.template.name === '深海声呐', backTpl.template && backTpl.template.name)
}

console.log('\n[6d] 模板商店：拉取与安装（stub 掉网络）')
{
  const realFetch = globalThis.fetch
  const storeIndex = {
    templates: [
      { id: 'store-demo', name: '商店示例', author: '社区', path: 'templates/store-demo', description: '示例条目' },
      { id: '../evil', name: '坏人', path: 'templates/evil' }
    ]
  }
  globalThis.fetch = async (url) => {
    const u = String(url)
    if (u.endsWith('index.json')) return { ok: true, status: 200, text: async () => JSON.stringify(storeIndex) }
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'store-demo', name: '商店示例', steps: [{ zh: '一' }] }) }
  }
  try {
    const st = JSON.parse((await call('exact /dsh-startup/store', 'GET', undefined, '/dsh-startup/store?refresh=1')).body)
    check('商店能拉到列表', st.ok === true && st.count === 1, st.count + ' 条 ' + (st.error || ''))
    check('非法 id 的条目被过滤（防目录穿越）', st.templates.every((x) => /^[a-z0-9][a-z0-9-]*$/.test(x.id)))
    check('缩略图指向固定 raw 地址', st.templates[0].preview.includes('/templates/store-demo/preview.gif'))
    const inst = JSON.parse((await call('exact /dsh-startup/store/install', 'POST', JSON.stringify({ id: 'store-demo' }))).body)
    check('从商店安装写进用户模板目录', inst.ok === true && fs.existsSync(path.join(SMOKE_HOME, 'startup-templates', 'store-demo', 'template.json')), inst.body)
    const bad = await call('exact /dsh-startup/store/install', 'POST', JSON.stringify({ id: '../evil' }))
    check('非法 id 拒绝安装', bad.statusCode === 400)
    const missing = await call('exact /dsh-startup/store/install', 'POST', JSON.stringify({ id: 'nope-nope' }))
    check('商店里没有的 id 返回 404', missing.statusCode === 404)
  } finally {
    globalThis.fetch = realFetch
  }
}

console.log('\n[7] XSS 边界：身份名称里的尖括号不会逃出内联脚本')
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { identity: '</script><img src=x onerror=alert(1)>' } }))
const payload = inlinePayload(renderRows(before, collectRows()))
check('尖括号被转义成 \\u003c', payload.includes(BS + 'u003c'), payload.slice(0, 120))
check('载荷里没有 </script>', !payload.includes('</script>'))
check('转义后仍是合法 JSON 且值可还原', (() => {
  try { return JSON.parse(payload).identity === '</script><img src=x onerror=alert(1)>' } catch { return false }
})())

fs.rmSync(SMOKE_HOME, { recursive: true, force: true })
console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
