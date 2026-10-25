/* ============================================================================
 * v2.12.0 新功能测试：自定义动画导入 + 三段转场配置
 * ----------------------------------------------------------------------------
 * 覆盖：
 *   [1] 路由存在、GET 拒绝、非法扩展名拒绝
 *   [2] mp4/webm/gif/png/jpg/webp 各导入一次：id / name / assets / template.json 结构
 *   [3] /templates 里 source=user、名称保留中文
 *   [4] 空文件 / 超 64MB / 中文+可疑文件名（路径安全）
 *   [5] 写失败不残留
 *   [6] 旧配置（无 transition 字段）读取默认 dissolve/600/left
 *   [7] 新字段保存落盘、非法枚举回落、transitionMs 越界夹取、旧字段不丢
 *
 * ⚠️ 全程用**临时 DSH_HOME**（import 之前设置、finally 删除），绝不碰真实 ~/.dsh。
 * 用法：node test/smoke-import.mjs
 * ========================================================================== */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { fileURLToPath } from 'node:url'

const HOME = path.join(os.tmpdir(), 'dsh-v212-import-' + Date.now() + '-' + Math.random().toString(36).slice(2))
fs.mkdirSync(HOME, { recursive: true })
process.env.DSH_HOME = HOME

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : '')) }
}

/* ── 假 ctx / 假 req / 假 res（与 smoke-host 同款，但事件由测试手动 flush）── */
const ROUTES = new Map()
const TAPS = []
let effects = 0
const webServer = {
  register(route) {
    const key = (route.kind || 'exact') + ' ' + route.path
    if (ROUTES.has(key)) throw new Error('duplicate route ' + route.path)
    ROUTES.set(key, route)
    return () => ROUTES.delete(key)
  },
  tapIndex(fn) { TAPS.push(fn); return () => TAPS.splice(TAPS.indexOf(fn), 1) },
}
const connection = { requestRejection: () => undefined }
const ctx = {
  webServer,
  on() { return () => {} },
  get(name) {
    if (name === 'webServer') return webServer
    if (name === 'connection') return connection
    return undefined
  },
  effect(fn) { effects++; const d = fn(); return () => { if (typeof d === 'function') d() } },
  logger: { warn() {} },
}

class FakeReq extends EventEmitter {
  constructor(method, url, chunks) {
    super()
    this.method = method
    this.headers = { host: '127.0.0.1:3080' }
    this.url = url || '/'
    this._chunks = chunks || []
    this.destroyed = false
  }
  flush() {
    for (const c of this._chunks) this.emit('data', c)
    this.emit('end')
  }
  destroy() { this.destroyed = true }
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

const parse = (res) => { try { return JSON.parse(res.body) } catch { return null } }
const routeKey = (p) => 'exact /dsh-startup/' + p
const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const qs = (params) => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) u.set(k, String(v))
  return '?' + u.toString()
}
const routeOf = (p) => {
  const route = ROUTES.get(routeKey(p))
  if (!route) throw new Error('route missing: ' + p)
  return route
}

/** 发一个请求；body 用 chunks（Buffer 数组）表示，handler 挂完监听后由测试手动发事件 */
async function call(p, opts = {}) {
  const route = routeOf(p)
  const req = new FakeReq(opts.method || 'GET', opts.url || '/dsh-startup/' + p, opts.chunks)
  const res = fakeRes()
  const pending = route.handler(req, res)
  req.flush()
  await pending
  return { res, json: parse(res) }
}

/** 导入：name = 原始文件名（可带扩展名/中文/可疑字符），bytes = 文件字节 */
function importAnim(name, bytes, extraQuery = {}) {
  const url = '/dsh-startup/import-animation' + qs({ name, ...extraQuery })
  return call('import-animation', { method: 'POST', url, chunks: [Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)] })
}

/** 超过 64MB 的请求：用假 chunk（只带 .length）触发 readRawBody 的上限分支，不真分配 64MB */
async function importTooBig() {
  const route = routeOf('import-animation')
  const req = new FakeReq('POST', '/dsh-startup/import-animation' + qs({ name: '超大.mp4' }), [])
  const res = fakeRes()
  const pending = route.handler(req, res)
  req.emit('data', { length: 33 * 1024 * 1024 })
  req.emit('data', { length: 33 * 1024 * 1024 })   // 合计 66MB > 64MB → destroy + null
  await pending
  return { res, json: parse(res) }
}

/** 发一个 JSON POST（用于 /templates/delete、/config 这类小请求） */
function postJson(p, body) {
  return call(p, {
    method: 'POST',
    url: '/dsh-startup/' + p,
    chunks: [Buffer.from(JSON.stringify(body))],
  })
}

const USER_ROOT = () => path.join(HOME, 'startup-templates')
const CONFIG_FILE = () => path.join(HOME, 'dsh-startup.json')
const slash = (p) => String(p).replace(/\\/g, '/')

try {
  console.log('  临时 DSH_HOME =', HOME)

  /* ── [1] 装载 + 路由 / 方法 / 扩展名 ─────────────────────────────────── */
  console.log('\n[1] /dsh-startup/import-animation：路由存在、GET 405、非法扩展名 400')
  const m = await import(new URL('../lib/index.js', import.meta.url))
  check('lib/index.js 能导入且 default 是插件对象', !!m.default && typeof m.default.apply === 'function')
  m.default.apply(ctx)
  check('注册了 POST /dsh-startup/import-animation', ROUTES.has(routeKey('import-animation')),
    [...ROUTES.keys()].filter((k) => k.includes('import')).join(' | '))

  let r = await call('import-animation')
  check('GET 方法被拒（405）', r.res.statusCode === 405 && r.json && r.json.ok === false, String(r.res.statusCode))
  for (const badName of ['文档.txt', '动画.exe', 'noext', '', '.zip']) {
    r = await importAnim(badName, Buffer.from('x'))
    check('非法扩展名被拒：' + JSON.stringify(badName) + ' → 400',
      r.res.statusCode === 400 && r.json && r.json.ok === false, String(r.res.statusCode) + ' ' + (r.json && r.json.error))
  }

  /* ── [2] 六种扩展名各导入一次 ───────────────────────────────────────── */
  console.log('\n[2] 六种扩展名：导入成功 + 用户模板结构合法')
  const CASES = [
    { name: '我的开场动画.mp4', kind: 'video', q: { duration: 2500, width: 1920, height: 1080 }, display: '我的开场动画', bytes: Buffer.from('fake-mp4-bytes-0001') },
    { name: '淡入过渡.webm', kind: 'video', q: { duration: 1200 }, display: '淡入过渡', bytes: Buffer.from('fake-webm-bytes-0002') },
    { name: '循环动图.gif', kind: 'image', q: { duration: 3000, width: 800, height: 600 }, display: '循环动图', bytes: Buffer.from('fake-gif-bytes-0003') },
    { name: '静帧大图.PNG', kind: 'image', q: { width: 2560, height: 1440 }, display: '静帧大图', bytes: Buffer.from('fake-png-bytes-0004') },
    { name: '照片.jpeg', kind: 'image', q: { width: 640, height: 480 }, display: '照片', bytes: Buffer.from('fake-jpeg-bytes-0005') },
    { name: '背景图.webp', kind: 'image', q: {}, display: '背景图', bytes: Buffer.from('fake-webp-bytes-0006') },
  ]
  const ids = []
  const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
  const SAFE_FILE_RE = /^import-[a-z0-9]+(-[0-9]+)?\.(mp4|webm|gif|png|jpg|webp)$/
  for (const c of CASES) {
    r = await importAnim(c.name, c.bytes, c.q)
    check('导入 ' + c.name + ' → 200', r.res.statusCode === 200 && r.json && r.json.ok === true,
      String(r.res.statusCode) + ' ' + (r.json && r.json.error))
    const j = r.json || {}
    ids.push(j.id)
    check('  · id 合法（小写字母数字连字符，≤40）', typeof j.id === 'string' && ID_RE.test(j.id), String(j.id))
    check('  · id 带 custom- 前缀（一眼看出是用户导入）', typeof j.id === 'string' && j.id.indexOf('custom-') === 0, String(j.id))
    check('  · name 保留中文且去掉扩展名', j.name === c.display, JSON.stringify(j.name))
    check('  · kind = ' + c.kind, j.kind === c.kind, String(j.kind))
    const expectedDuration = Math.max(1000, Math.min(60000, Number.isFinite(Number(c.q.duration)) && Number(c.q.duration) > 0 ? Math.round(Number(c.q.duration)) : 6000))
    check('  · duration 取前端探测值（缺省 6000，夹在 1–60s）', j.duration === expectedDuration, String(j.duration) + ' vs ' + expectedDuration)
    check('  · size = 实际字节数', j.size === c.bytes.length, String(j.size))
    check('  · 返回的 file 在临时 DSH_HOME/startup-templates 下',
      typeof j.file === 'string' && slash(j.file).startsWith(slash(USER_ROOT()) + '/'), slash(j.file))
    const fileBase = path.basename(String(j.file || ''))
    check('  · assets 文件名安全（生成名，不含用户输入/路径分隔符）', SAFE_FILE_RE.test(fileBase), fileBase)
    const expectedExt = /\.jpe?g$/i.test(c.name) ? 'jpg' : (c.name.match(/\.[a-z0-9]+$/i) || [''])[0].slice(1).toLowerCase()
    check('  · 落盘扩展名正确（jpeg→jpg、大写转小写）', fileBase.endsWith('.' + expectedExt), fileBase + ' vs .' + expectedExt)

    const dir = path.join(USER_ROOT(), String(j.id))
    const tplFile = path.join(dir, 'template.json')
    const assetFile = path.join(dir, 'assets', fileBase)
    check('  · template.json 落盘', fs.existsSync(tplFile))
    check('  · 原始文件按字节落盘', fs.existsSync(assetFile) && Buffer.compare(fs.readFileSync(assetFile), c.bytes) === 0)
    let tpl = null
    try { tpl = JSON.parse(fs.readFileSync(tplFile, 'utf8')) } catch { /* 下面红 */ }
    check('  · template.json 可解析', !!tpl)
    if (tpl) {
      check('  · schemaVersion = 1', tpl.schemaVersion === 1, String(tpl.schemaVersion))
      check('  · tpl.id 与返回 id 一致', tpl.id === j.id, tpl.id)
      check('  · tpl.name 保留中文（去扩展名）', tpl.name === c.display, JSON.stringify(tpl.name))
      check('  · tpl.author = 用户导入', tpl.author === '用户导入', String(tpl.author))
      check('  · duration 与响应一致', tpl.duration === j.duration, String(tpl.duration))
      check('  · segments 是一段 [0, duration]',
        Array.isArray(tpl.segments) && tpl.segments.length === 1 &&
        tpl.segments[0].from === 0 && tpl.segments[0].to === j.duration,
        JSON.stringify(tpl.segments))
      check('  · layers = 黑底 panel + media 两层', Array.isArray(tpl.layers) && tpl.layers.length === 2,
        JSON.stringify((tpl.layers || []).map((l) => l && l.type)))
      if (Array.isArray(tpl.layers)) {
        const bg = tpl.layers[0] || {}
        const media = tpl.layers[1] || {}
        check('  · 底层是 panel 且铺满画布', bg.type === 'panel' && bg.panelW === 1280 && bg.panelH === 720, JSON.stringify({ type: bg.type, w: bg.panelW, h: bg.panelH }))
        check('  · 媒体层 pos 在画布中心 [640,360]', Array.isArray(media.pos) && media.pos[0] === 640 && media.pos[1] === 360, JSON.stringify(media.pos))
        check('  · 媒体层 src 只写文件名（不写绝对路径）',
          typeof media.src === 'string' && media.src === fileBase && media.src.indexOf('/') === -1 && media.src.indexOf('\\') === -1,
          String(media.src))
        check('  · 媒体层类型正确（' + c.kind + '）', media.type === c.kind, String(media.type))
        if (c.kind === 'video') {
          check('  · 视频层有 videoW / videoH', typeof media.videoW === 'number' && typeof media.videoH === 'number',
            media.videoW + 'x' + media.videoH)
        } else {
          const iw = Number(c.q.width) > 0 ? Number(c.q.width) : 1280
          const ih = Number(c.q.height) > 0 ? Number(c.q.height) : 720
          check('  · 图片层按 cover 铺满 1280x720（不缩小、不变形）',
            typeof media.width === 'number' && typeof media.height === 'number' &&
            media.width >= 1280 && media.height >= 720 &&
            Math.abs(media.width / media.height - iw / ih) < 0.01,
            media.width + 'x' + media.height + '（原图 ' + iw + 'x' + ih + '）')
        }
        check('  · 关键帧覆盖到 duration 结尾',
          Array.isArray(media.keyframes) && media.keyframes.some((k) => k && k.t === j.duration),
          JSON.stringify((media.keyframes || []).map((k) => k && k.t)))
      }
    }
  }
  check('六次导入的 id 全唯一', ids.length === new Set(ids).size, ids.join(','))
  check('六次导入的 template 目录都存在',
    ids.every((id) => fs.existsSync(path.join(USER_ROOT(), id, 'template.json'))), ids.join(','))

  /* ── [3] /templates 列出用户模板 ────────────────────────────────────── */
  console.log('\n[3] GET /dsh-startup/templates：导入的模板 source=user、中文名保留')
  const tplList = await call('templates')
  check('/templates 200 + ok', tplList.res.statusCode === 200 && tplList.json && tplList.json.ok === true, String(tplList.res.statusCode))
  const listed = (tplList.json && tplList.json.templates) || []
  check('/templates 返回数组', Array.isArray(listed), typeof listed)
  for (const c of CASES) {
    const hit = listed.find((t) => t && t.name === c.display && t.source === 'user')
    check('  · ' + c.name + ' 以 source=user 出现在模板列表', !!hit, JSON.stringify(listed.slice(0, 6)))
  }
  check('内置模板仍以 source=builtin 列出', listed.some((t) => t && t.source === 'builtin'),
    [...new Set(listed.map((t) => t && t.source))].join(','))

  /* ── [4] 边界与路径安全 ─────────────────────────────────────────────── */
  console.log('\n[4] 边界：空文件 413 / 超 64MB 413 / 中文+可疑文件名安全')
  r = await importAnim('空文件.png', Buffer.alloc(0))
  check('空文件被拒（413）', r.res.statusCode === 413 && r.json && r.json.ok === false, String(r.res.statusCode) + ' ' + (r.json && r.json.error))
  r = await importTooBig()
  check('超过 64MB 被拒（413），且没有写坏内存', r.res.statusCode === 413 && r.json && r.json.ok === false,
    String(r.res.statusCode) + ' ' + (r.json && r.json.error))

  r = await importAnim('../目录/我的动画.mp4', Buffer.from('fake-path-safe'))
  check('可疑文件名（../ 目录穿越）仍能导入（文件名只当显示名）',
    r.res.statusCode === 200 && r.json && r.json.ok === true, String(r.res.statusCode) + ' ' + (r.json && r.json.error))
  if (r.json && r.json.ok) {
    const j = r.json
    check('  · 生成的 id 仍合法', ID_RE.test(String(j.id)), String(j.id))
    check('  · 落盘路径没有跑出 startup-templates 目录',
      path.relative(USER_ROOT(), path.dirname(String(j.file))).split(path.sep).indexOf('..') === -1,
      slash(j.file))
    check('  · assets 文件名里没有路径分隔符', !/[\\/]/.test(path.basename(String(j.file))), path.basename(String(j.file)))
    check('  · template.json 不含绝对路径（src 只有文件名）', (function () {
      try {
        const t = JSON.parse(fs.readFileSync(path.join(USER_ROOT(), String(j.id), 'template.json'), 'utf8'))
        return JSON.stringify(t).indexOf(slash(HOME)) === -1
      } catch { return false }
    })())
  }
  r = await importAnim('.mp4', Buffer.from('fake-only-ext'))
  check('只有扩展名（.mp4）→ 显示名回落「自定义动画」', r.res.statusCode === 200 && r.json && r.json.name === '自定义动画',
    String(r.res.statusCode) + ' ' + (r.json && r.json.name))

  /* ── [5] 写失败不残留（破坏 startup-templates 根目录后最后一次导入）── */
  console.log('\n[5] 写失败不残留：目录建不出来时返回 500，且不留残骸')
  const beforeDirs = fs.readdirSync(USER_ROOT()).filter((n) => /^custom-/.test(n)).length
  check('前置：已有 ' + beforeDirs + ' 个用户模板目录', beforeDirs > 0, String(beforeDirs))
  fs.rmSync(USER_ROOT(), { recursive: true, force: true })
  fs.writeFileSync(USER_ROOT(), 'blocked')          // 让 mkdirSync(<root>/<id>/assets) 抛 ENOTDIR
  r = await importAnim('写失败.mp4', Buffer.from('fake-fail'))
  check('写失败 → 500 + ok:false', r.res.statusCode === 500 && r.json && r.json.ok === false,
    String(r.res.statusCode) + ' ' + (r.json && r.json.error))
  check('startup-templates 仍是那个占位文件（没有生成半成品目录）',
    fs.existsSync(USER_ROOT()) && fs.statSync(USER_ROOT()).isFile())
  check('家目录下没有残留的 custom-* 目录',
    fs.readdirSync(HOME).filter((n) => /^custom-/.test(n)).length === 0,
    fs.readdirSync(HOME).join(','))
  fs.rmSync(USER_ROOT(), { force: true })
  fs.mkdirSync(USER_ROOT(), { recursive: true })
  check('清理后目录已恢复（后续测试不受影响）', fs.statSync(USER_ROOT()).isDirectory())

  /* ── [5b] /templates/delete + /templates/unhide：本地删文件、内置隐藏可恢复 ── */
  console.log('\n[5b] /templates/delete：本地模板删文件；内置模板隐藏进 hiddenTemplates（可 unhide 恢复）')
  r = await importAnim('待删除动画.mp4', Buffer.from('fake-delete-target'), { duration: 1000 })
  check('前置：导入一个用于删除的用户模板', r.res.statusCode === 200 && r.json && r.json.ok === true,
    String(r.res.statusCode) + ' ' + (r.json && r.json.error))
  const delId = r.json && r.json.id
  const delDir = path.join(USER_ROOT(), String(delId))
  const BUILTIN_ID = 'archive-warm'
  const SECOND_BUILTIN = 'whale-girl-scan'
  const builtinFile = path.join(PKG_ROOT, 'templates', BUILTIN_ID, 'template.json')
  const secondBuiltinFile = path.join(PKG_ROOT, 'templates', SECOND_BUILTIN, 'template.json')
  const builtinRaw = fs.existsSync(builtinFile) ? fs.readFileSync(builtinFile, 'utf8') : null
  const secondBuiltinRaw = fs.existsSync(secondBuiltinFile) ? fs.readFileSync(secondBuiltinFile, 'utf8') : null
  check('前置：真的存在内置模板 ' + BUILTIN_ID, !!builtinRaw)
  check('前置：真的存在第二个内置模板 ' + SECOND_BUILTIN, !!secondBuiltinRaw)
  const readDiskCfg = () => {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8')) } catch { return null }
  }
  const listedIds = (j) => ((j && Array.isArray(j.templates)) ? j.templates : []).map((t) => t && t.id)
  const hiddenOf = (j) => (j && Array.isArray(j.hidden) ? j.hidden : [])

  let del = await call('templates/delete')
  check('GET /templates/delete → 405', del.res.statusCode === 405 && del.json && del.json.ok === false,
    String(del.res.statusCode))
  for (const badId of ['', 'BAD ID!', '../evil', 'x'.repeat(41), 'a/b']) {
    del = await postJson('templates/delete', { id: badId })
    check('非法 id ' + JSON.stringify(badId.length > 12 ? badId.slice(0, 12) + '…' : badId) + ' → 400',
      del.res.statusCode === 400 && del.json && del.json.ok === false,
      String(del.res.statusCode) + ' ' + (del.json && del.json.error))
  }
  del = await call('templates/delete', { method: 'POST', url: '/dsh-startup/templates/delete', chunks: [Buffer.from('not-json')] })
  check('body 不是合法 JSON → 400（按非法 id 处理）', del.res.statusCode === 400, String(del.res.statusCode))

  del = await postJson('templates/delete', { id: 'custom-does-not-exist' })
  check('不存在的模板 → 404', del.res.statusCode === 404 && del.json && del.json.ok === false,
    String(del.res.statusCode) + ' ' + (del.json && del.json.error))

  /* ── 内置模板：删除 = 隐藏（写 hiddenTemplates，不删安装文件） ── */
  let cfgPost = await postJson('config', { patch: { template: BUILTIN_ID } })
  check('前置：把第一幕设为内置 ' + BUILTIN_ID, cfgPost.res.statusCode === 200 && cfgPost.json.config.template === BUILTIN_ID,
    JSON.stringify(cfgPost.json && cfgPost.json.config && cfgPost.json.config.template))
  let pv = await call('preview-template', { url: '/dsh-startup/preview-template?id=' + BUILTIN_ID })
  check('隐藏前 /preview-template 能读到内置模板', pv.res.statusCode === 200 && pv.json && pv.json.template && pv.json.template.id === BUILTIN_ID,
    String(pv.res.statusCode))

  del = await postJson('templates/delete', { id: BUILTIN_ID })
  check('★ 删除内置模板 → 200 {hidden:true, removed:false}',
    del.res.statusCode === 200 && del.json && del.json.ok === true &&
    del.json.hidden === true && del.json.removed === false,
    JSON.stringify(del.json))
  check('★ 内置模板安装文件原封不动（只是隐藏，没有删）',
    fs.existsSync(builtinFile) && fs.readFileSync(builtinFile, 'utf8') === builtinRaw)
  let diskCfg = readDiskCfg()
  check('config 文件的 hiddenTemplates 含 ' + BUILTIN_ID,
    !!diskCfg && Array.isArray(diskCfg.hiddenTemplates) && diskCfg.hiddenTemplates.includes(BUILTIN_ID),
    diskCfg && JSON.stringify(diskCfg.hiddenTemplates))
  check('★ 被引用的 template 被宿主自动清空（避免下次开机找不到）',
    !!diskCfg && (diskCfg.template || '') === '', diskCfg && JSON.stringify(diskCfg.template))
  let tplNow = await call('templates')
  check('★ /templates 不再列出被隐藏的内置模板',
    !listedIds(tplNow.json).includes(BUILTIN_ID), listedIds(tplNow.json).slice(0, 5).join(','))
  check('★ /templates 的 hidden 数组含 ' + BUILTIN_ID,
    hiddenOf(tplNow.json).includes(BUILTIN_ID), JSON.stringify(hiddenOf(tplNow.json)))
  pv = await call('preview-template', { url: '/dsh-startup/preview-template?id=' + BUILTIN_ID })
  check('隐藏后 /preview-template → 404（readTemplate 对 hidden 返回 null）', pv.res.statusCode === 404, String(pv.res.statusCode))

  /* ── unhide {id}：恢复单个 ── */
  let unh = await postJson('templates/unhide', { id: BUILTIN_ID })
  check('★ POST /templates/unhide {id} → 200 且 hidden 里没有它',
    unh.res.statusCode === 200 && unh.json && unh.json.ok === true &&
    Array.isArray(unh.json.hidden) && !unh.json.hidden.includes(BUILTIN_ID),
    JSON.stringify(unh.json))
  tplNow = await call('templates')
  check('恢复后 /templates 重新列出 ' + BUILTIN_ID, listedIds(tplNow.json).includes(BUILTIN_ID))
  check('恢复后 hidden 数组为空', hiddenOf(tplNow.json).length === 0, JSON.stringify(hiddenOf(tplNow.json)))
  pv = await call('preview-template', { url: '/dsh-startup/preview-template?id=' + BUILTIN_ID })
  check('恢复后 /preview-template 又能读到（200）', pv.res.statusCode === 200, String(pv.res.statusCode))
  check('恢复后内置模板安装文件字节仍未变',
    fs.existsSync(builtinFile) && fs.readFileSync(builtinFile, 'utf8') === builtinRaw)

  /* ── 隐藏两个 → unhide {} 全部恢复 ── */
  await postJson('templates/delete', { id: BUILTIN_ID })
  await postJson('templates/delete', { id: SECOND_BUILTIN })
  diskCfg = readDiskCfg()
  check('连隐藏两个后 hiddenTemplates 有 2 项',
    !!diskCfg && Array.isArray(diskCfg.hiddenTemplates) && diskCfg.hiddenTemplates.length === 2,
    JSON.stringify(diskCfg && diskCfg.hiddenTemplates))
  tplNow = await call('templates')
  check('两个内置模板都从 /templates 列表消失',
    !listedIds(tplNow.json).includes(BUILTIN_ID) && !listedIds(tplNow.json).includes(SECOND_BUILTIN),
    listedIds(tplNow.json).slice(0, 5).join(','))
  check('/templates.hidden 同时含两个', hiddenOf(tplNow.json).length === 2, JSON.stringify(hiddenOf(tplNow.json)))
  let unhAll = await postJson('templates/unhide', {})
  check('★ POST /templates/unhide {} → hidden=[] 全部恢复',
    unhAll.res.statusCode === 200 && unhAll.json && unhAll.json.ok === true &&
    Array.isArray(unhAll.json.hidden) && unhAll.json.hidden.length === 0, JSON.stringify(unhAll.json))
  tplNow = await call('templates')
  check('恢复后两个内置模板重新列出',
    listedIds(tplNow.json).includes(BUILTIN_ID) && listedIds(tplNow.json).includes(SECOND_BUILTIN))
  check('恢复后 hidden 为空', hiddenOf(tplNow.json).length === 0, JSON.stringify(hiddenOf(tplNow.json)))
  check('两个内置模板安装文件字节都未变',
    fs.readFileSync(builtinFile, 'utf8') === builtinRaw &&
    fs.readFileSync(secondBuiltinFile, 'utf8') === secondBuiltinRaw)

  /* ── unhide {all:true} 等价于 {} ── */
  await postJson('templates/delete', { id: BUILTIN_ID })
  unhAll = await postJson('templates/unhide', { all: true })
  check('POST /templates/unhide {all:true} 也能全部恢复',
    unhAll.res.statusCode === 200 && Array.isArray(unhAll.json.hidden) && unhAll.json.hidden.length === 0,
    JSON.stringify(unhAll.json))

  /* ── unhide 的方法/参数边界 ── */
  let badUnh = await call('templates/unhide')
  check('GET /templates/unhide → 405', badUnh.res.statusCode === 405 && badUnh.json && badUnh.json.ok === false,
    String(badUnh.res.statusCode))
  badUnh = await postJson('templates/unhide', { id: 'BAD ID!' })
  check('unhide 非法 id → 400', badUnh.res.statusCode === 400 && badUnh.json && badUnh.json.ok === false,
    String(badUnh.res.statusCode) + ' ' + (badUnh.json && badUnh.json.error))

  /* ── 本地模板删除路径不变：removed:true，且不进 hidden ── */
  del = await postJson('templates/delete', { id: delId })
  check('★ 删除用户模板 → 200 {removed:true, hidden:false}',
    del.res.statusCode === 200 && del.json && del.json.ok === true &&
    del.json.removed === true && del.json.hidden === false, JSON.stringify(del.json))
  check('★ 用户模板目录（含 assets）已被整个删掉', !fs.existsSync(delDir))
  tplNow = await call('templates')
  check('★ /templates 不再列出被删的本地模板',
    !listedIds(tplNow.json).includes(delId), delId)
  check('本地模板删除不会进 hidden', !hiddenOf(tplNow.json).includes(delId), JSON.stringify(hiddenOf(tplNow.json)))
  del = await postJson('templates/delete', { id: delId })
  check('再删一次（已经不存在）→ 404', del.res.statusCode === 404, String(del.res.statusCode))

  /* ── [6] 旧配置兼容：没有 transition 字段 → 默认 dissolve/600/left ──── */
  console.log('\n[6] 旧配置（v2.11 及以前，无 transition 字段）→ 默认 dissolve / 600 / left')
  const legacyCfg = {
    identity: '老用户', identityId: '0001', enabled: true, speed: 1.4,
    template: 'archive-warm', allowSkip: true,
  }
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(legacyCfg, null, 2), 'utf8')
  r = await call('config')
  let cfg = (r.json && r.json.config) || {}
  check('GET /config 200 + ok', r.res.statusCode === 200 && r.json && r.json.ok === true, String(r.res.statusCode))
  check('transitionIn 缺省 = dissolve', cfg.transitionIn === 'dissolve', String(cfg.transitionIn))
  check('transitionJoin 缺省 = dissolve', cfg.transitionJoin === 'dissolve', String(cfg.transitionJoin))
  check('transitionOut 缺省 = dissolve', cfg.transitionOut === 'dissolve', String(cfg.transitionOut))
  check('transitionMs 缺省 = 600', cfg.transitionMs === 600, String(cfg.transitionMs))
  check('transitionDir 缺省 = left', cfg.transitionDir === 'left', String(cfg.transitionDir))
  check('旧字段照样生效（identity / speed / template 不丢）',
    cfg.identity === '老用户' && cfg.speed === 1.4 && cfg.template === 'archive-warm',
    JSON.stringify({ identity: cfg.identity, speed: cfg.speed, template: cfg.template }))
  check('旧配置没有 act2 → 保持单幕（沿用原有迁移规则）', cfg.act2 === '', JSON.stringify(cfg.act2))
  const defaults = (r.json && r.json.defaults) || {}
  check('GET /config 的 defaults 里也带转场默认值',
    defaults.transitionIn === 'dissolve' && defaults.transitionMs === 600 && defaults.transitionDir === 'left',
    JSON.stringify({ in: defaults.transitionIn, ms: defaults.transitionMs, dir: defaults.transitionDir }))
  check('GET 不会顺手改写配置文件（旧文件里仍然没有 transition 字段）',
    JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8')).transitionIn === undefined)

  /* ── [7] 保存：新字段落盘、非法回落、越界夹取、旧字段不丢 ───────────── */
  console.log('\n[7] POST /config：新字段保存落盘、非法枚举回落、transitionMs 越界夹取')
  const postCfg = async (patch) => {
    const r0 = await call('config', {
      method: 'POST',
      url: '/dsh-startup/config',
      chunks: [Buffer.from(JSON.stringify({ patch }))],
    })
    return { res: r0.res, json: r0.json, cfg: (r0.json && r0.json.config) || {} }
  }

  r = await postCfg({ transitionIn: 'glitch', transitionJoin: 'flash', transitionOut: 'scanline', transitionMs: 5000, transitionDir: 'up' })
  check('保存三类转场 + 方向（200 + ok）', r.res.statusCode === 200 && r.json && r.json.ok === true, String(r.res.statusCode))
  check('transitionMs 5000 被夹到上限 2000', r.cfg.transitionMs === 2000, String(r.cfg.transitionMs))
  check('三类转场都存下来了',
    r.cfg.transitionIn === 'glitch' && r.cfg.transitionJoin === 'flash' && r.cfg.transitionOut === 'scanline',
    JSON.stringify({ a: r.cfg.transitionIn, b: r.cfg.transitionJoin, c: r.cfg.transitionOut }))
  check('方向 up 存下来了', r.cfg.transitionDir === 'up', String(r.cfg.transitionDir))
  let disk = JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8'))
  check('dsh-startup.json 里真的有新字段',
    disk.transitionIn === 'glitch' && disk.transitionJoin === 'flash' && disk.transitionOut === 'scanline' &&
    disk.transitionMs === 2000 && disk.transitionDir === 'up',
    JSON.stringify({ i: disk.transitionIn, j: disk.transitionJoin, o: disk.transitionOut, ms: disk.transitionMs, d: disk.transitionDir }))
  check('保存不丢旧字段（identity / speed / template 还在）',
    disk.identity === '老用户' && disk.speed === 1.4 && disk.template === 'archive-warm',
    JSON.stringify({ identity: disk.identity, speed: disk.speed, template: disk.template }))

  r = await postCfg({ transitionMs: 50 })
  check('transitionMs 50 被夹到下限 200', r.cfg.transitionMs === 200, String(r.cfg.transitionMs))

  r = await postCfg({ transitionIn: 'bogus', transitionJoin: 'DISSOLVE', transitionOut: '', transitionDir: 'diagonal', transitionMs: 'abc' })
  check('非法枚举全部回落 dissolve（大小写不宽容）',
    r.cfg.transitionIn === 'dissolve' && r.cfg.transitionJoin === 'dissolve' && r.cfg.transitionOut === 'dissolve',
    JSON.stringify({ a: r.cfg.transitionIn, b: r.cfg.transitionJoin, c: r.cfg.transitionOut }))
  check('非法方向回落 left', r.cfg.transitionDir === 'left', String(r.cfg.transitionDir))
  check('非数字 transitionMs 回落 600', r.cfg.transitionMs === 600, String(r.cfg.transitionMs))

  r = await postCfg({ identity: '新名字' })
  check('只改无关字段时，转场配置保持上一次的值',
    r.cfg.transitionIn === 'dissolve' && r.cfg.transitionMs === 600 && r.cfg.transitionDir === 'left' && r.cfg.identity === '新名字',
    JSON.stringify({ identity: r.cfg.identity, in: r.cfg.transitionIn, ms: r.cfg.transitionMs }))

  /* 8 种转场 × 4 个方向，逐一保存并读回 —— 枚举表必须全通 */
  const TYPES = ['dissolve', 'flash', 'glitch', 'scanline', 'slide', 'iris', 'black', 'none']
  let typesOk = true
  for (const t of TYPES) {
    const rr = await postCfg({ transitionIn: t, transitionJoin: t, transitionOut: t })
    if (!(rr.cfg.transitionIn === t && rr.cfg.transitionJoin === t && rr.cfg.transitionOut === t)) { typesOk = false; break }
  }
  check('8 种转场类型全部能保存并读回：' + TYPES.join('/'), typesOk)

  const DIRS = ['left', 'right', 'up', 'down']
  let dirsOk = true
  for (const d of DIRS) {
    const rr = await postCfg({ transitionDir: d })
    if (rr.cfg.transitionDir !== d) { dirsOk = false; break }
  }
  check('4 个方向全部能保存并读回：' + DIRS.join('/'), dirsOk)

  check('壁纸/旧视频字段没有被塞进启动动画配置', (function () {
    const dk = JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8'))
    return ['placement', 'video', 'loopStart', 'loopEnd', 'fadeOutMs', 'objectFit', 'oncePerSession', 'waitForBoot']
      .every((k) => !(k in dk))
  })())
} catch (e) {
  fail++
  console.log('  FAIL 测试本身抛异常：' + String((e && e.stack) || e))
} finally {
  try { fs.rmSync(HOME, { recursive: true, force: true }) } catch { /* 清理失败不影响结果 */ }
  console.log(`\n${fail === 0 ? '✓ 全部通过' : `✗ ${fail} 项失败`}（${pass} 项通过）`)
  console.log('  临时 DSH_HOME 已删除：', !fs.existsSync(HOME))
  process.exit(fail === 0 ? 0 : 1)
}
