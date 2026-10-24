// 宿主半边的契约测试（v2.11.10 新契约）
//
// 不再只是 7 行壳：这里在**临时 DSH_HOME** 里真的跑 apply()，然后把
// /chat-wallpaper/* 六条路由的 handler 一个个调过去，断言：
//   · 恰 6 条路由、没有 /chat-wallpaper/video（视频死代码已删）
//   · /config 顶层键恰 {ok,config,image,imageSource,imageOk}，config 恰 12 键，
//     且不含任何视频时代的字段（video/mode/placement/loopStart/...）
//   · /images 不再返回 mode/placement
//   · /set 传 placement/mode/video/loopStart 会被忽略，banner 生效并落盘
//   · /status 不再有顶层 file/source/loop/userClipDirs
//   · /image 没图 → 404；丢图目录里放一张 → 200 + 正确的 MIME/长度
//
// ⚠️ DSH_HOME 必须在 import lib/index.js **之前**设好：host-wallpaper 在模块
//    顶层就把它算进 HOME 常量了。全程只碰临时目录，绝不动真的 ~/.dsh。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { Writable } from 'node:stream'

const HOME = path.join(os.tmpdir(), 'dsh-wallpaper-smoke-' + Date.now() + '-' + Math.random().toString(36).slice(2))
fs.mkdirSync(HOME, { recursive: true })
process.env.DSH_HOME = HOME

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : '')) }
}

/* ── 假 ctx / 假 req / 假 res ────────────────────────────────────────────── */
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
const ctx = {
  webServer,
  on() { return () => {} },
  get(name) {
    if (name === 'webServer') return webServer
    if (name === 'connection') return { requestRejection: () => undefined }
    return undefined
  },
  effect(fn) { effects++; const d = fn(); return () => { if (typeof d === 'function') d() } },
  logger: { warn() {} },
}

/** 假请求：**不自动发事件**。handler 是同步挂监听的，挂完我们手动 flush，
    这样测试完全不依赖 process.nextTick / 微任务的调度顺序。 */
class FakeReq extends EventEmitter {
  constructor(method, body, url) {
    super()
    this.method = method
    this.headers = { host: '127.0.0.1:3080' }
    this.url = url || '/'
    this._body = body
  }
  flush() {
    if (this._body !== undefined) this.emit('data', Buffer.from(this._body))
    this.emit('end')
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

/** /image 走的是 createReadStream(...).pipe(res)，所以这个 res 必须是真的 Writable */
function fakeStreamRes() {
  const chunks = []
  const res = new Writable({
    write(chunk, _enc, cb) { chunks.push(Buffer.from(chunk)); cb() },
  })
  res._chunks = chunks
  res.statusCode = 0
  res.headers = null
  res.writeHead = function (code, headers) { res.statusCode = code; res.headers = headers || {}; return res }
  return res
}

async function callJson(kindPath, method = 'GET', body, url) {
  const route = ROUTES.get(kindPath)
  if (!route) throw new Error('route missing: ' + kindPath)
  const res = fakeRes()
  const req = new FakeReq(method, body, url)
  await route.handler(req, res)     // handler 同步挂监听，再手动发 data/end
  req.flush()
  let json = null
  try { json = JSON.parse(res.body) } catch { /* 非 JSON 就留 null */ }
  return { res, json }
}

async function callStream(kindPath, url) {
  const route = ROUTES.get(kindPath)
  if (!route) throw new Error('route missing: ' + kindPath)
  const res = fakeStreamRes()
  await new Promise((resolve, reject) => {
    res.on('finish', resolve)
    res.on('error', reject)
    const req = new FakeReq('GET', undefined, url)
    route.handler(req, res)
    req.flush()
  })
  return res
}

const sortKeys = (o) => Object.keys(o || {}).sort().join(',')

try {
  console.log('  DSH_HOME（临时，绝不动真的 ~/.dsh）=', HOME)

  /* ── [1] Cordis 契约 ─────────────────────────────────────────────────── */
  console.log('\n[1] Cordis 契约（只认 default 导出）')
  const m = await import(new URL('../lib/index.js', import.meta.url))
  const d = m.default
  check('default 存在且 name 正确', !!d && d.name === 'dsh-boot-suite', d && d.name)
  check('inject 是数组', Array.isArray(d && d.inject), JSON.stringify(d && d.inject))
  check('apply 是函数', typeof (d && d.apply) === 'function')

  /* ── [2] 路由注册 ───────────────────────────────────────────────────── */
  console.log('\n[2] 假 ctx 跑 apply：恰 6 条壁纸路由，没有视频路由')
  d.apply(ctx)
  const wallPaths = [...ROUTES.keys()].filter((k) => k.includes('/chat-wallpaper/'))
  const wantPaths = [
    'exact /chat-wallpaper/config', 'exact /chat-wallpaper/image', 'exact /chat-wallpaper/images',
    'exact /chat-wallpaper/set', 'exact /chat-wallpaper/open-dir', 'exact /chat-wallpaper/status',
  ]
  check('恰好 6 条 /chat-wallpaper/* 路由', wallPaths.length === 6, String(wallPaths.length) + '：' + wallPaths.join(' | '))
  check('六条路由路径与新契约一致', wantPaths.every((p) => ROUTES.has(p)), wallPaths.join(' | '))
  check('★ 没有 /chat-wallpaper/video 路由', !ROUTES.has('exact /chat-wallpaper/video'))
  check('所有已注册路由里都没有 video 字样（不只壁纸前缀）',
    [...ROUTES.keys()].every((k) => !/video/i.test(k)), [...ROUTES.keys()].filter((k) => /video/i.test(k)).join(' | '))
  check('用了 ctx.effect 管理生命周期（开机动画 1 + 壁纸 6）', effects === 7, String(effects))

  /* ── [3] /config ────────────────────────────────────────────────────── */
  console.log('\n[3] GET /config：顶层键与 config 字段都是新契约')
  let r = await callJson('exact /chat-wallpaper/config')
  check('/config 200', r.res.statusCode === 200, String(r.res.statusCode))
  check('/config 顶层键恰 {ok,config,image,imageSource,imageOk}',
    sortKeys(r.json) === 'config,image,imageOk,imageSource,ok', sortKeys(r.json))
  check('/config ok=true', r.json && r.json.ok === true, r.json && String(r.json.ok))
  const CONFIG_KEYS = ['banner', 'bannerOpacity', 'fallbackDark', 'fallbackLight', 'image', 'imageFit',
    'sidebarDark', 'sidebarLight', 'veilDarkA', 'veilDarkB', 'veilLightA', 'veilLightB']
  check('config 恰好 12 个键（默认配置全量）',
    sortKeys(r.json && r.json.config) === CONFIG_KEYS.slice().sort().join(','), sortKeys(r.json && r.json.config))
  const DEAD_KEYS = ['video', 'mode', 'placement', 'loopStart', 'loopEnd', 'oncePerSession',
    'waitForBoot', 'fadeOutMs', 'objectFit', 'opacity', 'playbackRate', 'fps']
  const leaked = DEAD_KEYS.filter((k) => r.json && r.json.config && k in r.json.config)
  check('★ config 里没有任何视频时代字段（video/mode/placement/loop*/...）', leaked.length === 0, leaked.join(','))
  check('/config 的 imageOk=false（临时目录里还没图）', r.json && r.json.imageOk === false, String(r.json && r.json.imageOk))
  check('/config 的 image 为 null', r.json && r.json.image === null, String(r.json && r.json.image))
  check('/config 的 imageSource = none', r.json && r.json.imageSource === 'none', String(r.json && r.json.imageSource))

  /* ── [4] /images ────────────────────────────────────────────────────── */
  console.log('\n[4] GET /images：没有 mode/placement')
  r = await callJson('exact /chat-wallpaper/images')
  check('/images 200 + ok', r.res.statusCode === 200 && r.json && r.json.ok === true, String(r.res.statusCode))
  check('★ /images 顶层没有 mode', r.json && !('mode' in r.json))
  check('★ /images 顶层没有 placement', r.json && !('placement' in r.json))
  check('/images 有 panel 需要的字段（dropDir/current/images/veil/banner/bannerOpacity）',
    r.json && typeof r.json.dropDir === 'string' && Array.isArray(r.json.images) &&
    !!r.json.veil && typeof r.json.veil.light === 'number' && typeof r.json.banner === 'string',
    sortKeys(r.json))
  check('/images 的 dropDir 指向临时 DSH_HOME',
    r.json && r.json.dropDir.includes(HOME.replace(/\\/g, '/')), r.json && r.json.dropDir)

  /* ── [5] /set ───────────────────────────────────────────────────────── */
  console.log('\n[5] POST /set：白名单外（placement/mode/video/loopStart）一律忽略，banner 生效')
  r = await callJson('exact /chat-wallpaper/set', 'POST', JSON.stringify({
    placement: 'behind', mode: 'loop', video: 'x.mp4',
    loopStart: '00:00:05:23', oncePerSession: false, fadeOutMs: 1200,
    banner: 'B',
  }))
  check('/set 200 + ok', r.res.statusCode === 200 && r.json && r.json.ok === true, (r.json && r.json.error) || String(r.res.statusCode))
  check('★ 白名单外字段一个都没写进 applied',
    r.json && r.json.applied && sortKeys(r.json.applied) === 'banner', sortKeys(r.json && r.json.applied))
  check('banner 生效为 B', r.json && r.json.applied && r.json.applied.banner === 'B', JSON.stringify(r.json && r.json.applied))
  r = await callJson('exact /chat-wallpaper/config')
  check('再读 /config：banner = B', r.json && r.json.config && r.json.config.banner === 'B', r.json && r.json.config && r.json.config.banner)
  const cfgFile = path.join(HOME, 'chat-wallpaper.json')
  check('配置文件真的落盘在临时 DSH_HOME', fs.existsSync(cfgFile))
  if (fs.existsSync(cfgFile)) {
    const raw = fs.readFileSync(cfgFile, 'utf8')
    let disk = null
    try { disk = JSON.parse(raw) } catch { /* 下面会红 */ }
    check('落盘 JSON 可解析且无 BOM', !!disk && raw.charCodeAt(0) !== 0xFEFF)
    check('★ 落盘配置里也没有视频字段', !!disk && DEAD_KEYS.every((k) => !(k in disk)), disk && Object.keys(disk).join(','))
    check('落盘配置恰好 12 键', !!disk && sortKeys(disk) === CONFIG_KEYS.slice().sort().join(','), disk && sortKeys(disk))
  }

  /* ── [6] /status ────────────────────────────────────────────────────── */
  console.log('\n[6] GET /status：不再有顶层 file/source/loop/userClipDirs')
  r = await callJson('exact /chat-wallpaper/status')
  check('/status 200 + ok', r.res.statusCode === 200 && r.json && r.json.ok === true, String(r.res.statusCode))
  check('★ /status 没有顶层 file', r.json && !('file' in r.json))
  check('★ /status 没有顶层 source', r.json && !('source' in r.json))
  check('★ /status 没有顶层 loop', r.json && !('loop' in r.json))
  check('★ /status 没有顶层 userClipDirs', r.json && !('userClipDirs' in r.json))
  check('/status 的 image 对象带 source/file/bytes/dropDir/candidates',
    r.json && r.json.image && 'source' in r.json.image && 'file' in r.json.image &&
    'bytes' in r.json.image && 'dropDir' in r.json.image && Array.isArray(r.json.image.candidates),
    r.json && sortKeys(r.json.image))

  /* ── [7] /image：没图 404，有图 200 ─────────────────────────────────── */
  console.log('\n[7] GET /image：没图 → 404；丢一张图进目录 → 200 + MIME/长度')
  r = await callJson('exact /chat-wallpaper/image')
  check('★ 没有图 → 404', r.res.statusCode === 404, String(r.res.statusCode))

  const dropDir = path.join(HOME, 'chat-wallpaper')
  fs.mkdirSync(dropDir, { recursive: true })
  const px = Buffer.alloc(5001, 0x89)          // > 4KB 才会被当成候选图
  fs.writeFileSync(path.join(dropDir, 'smoke-bg.png'), px)

  let stream = await callStream('exact /chat-wallpaper/image')
  check('/image 有图 → 200', stream.statusCode === 200, String(stream.statusCode))
  check('/image 返回 image/png', stream.headers && String(stream.headers['Content-Type']).includes('image/png'),
    stream.headers && stream.headers['Content-Type'])
  check('/image 字节数正确且内容发出来了',
    stream.headers && Number(stream.headers['Content-Length']) === px.length &&
    Buffer.concat(stream._chunks).length === px.length,
    (stream.headers && stream.headers['Content-Length']) + ' / ' + Buffer.concat(stream._chunks).length)
  stream = await callStream('exact /chat-wallpaper/image', '/chat-wallpaper/image?name=smoke-bg.png')
  check('/image?name= 指定丢图目录里的图 → 200', stream.statusCode === 200, String(stream.statusCode))
  stream = await callStream('exact /chat-wallpaper/image', '/chat-wallpaper/image?name=../../package.json')
  check('/image?name= 目录穿越被拒 → 404', stream.statusCode === 404, String(stream.statusCode))

  r = await callJson('exact /chat-wallpaper/images')
  check('丢图后 /images 列出这张图', r.json && r.json.images.length === 1 && r.json.images[0].name === 'smoke-bg.png',
    JSON.stringify(r.json && r.json.images))
  check('丢图后 /images.current 指向它',
    r.json && typeof r.json.current === 'string' && r.json.current.endsWith('smoke-bg.png'), r.json && r.json.current)
  r = await callJson('exact /chat-wallpaper/config')
  check('丢图后 /config imageOk = true', r.json && r.json.imageOk === true, String(r.json && r.json.imageOk))
  check('丢图后 /config imageSource = your-library', r.json && r.json.imageSource === 'your-library', r.json && r.json.imageSource)
} catch (e) {
  fail++
  console.log('  FAIL 测试本身抛异常：' + String((e && e.stack) || e))
} finally {
  try { fs.rmSync(HOME, { recursive: true, force: true }) } catch { /* 清理失败不影响结果 */ }
  console.log(`\n${fail === 0 ? '✓ 全部通过' : `✗ ${fail} 项失败`}（${pass} 项通过）`)
  console.log('  临时 DSH_HOME 已删除：', !fs.existsSync(HOME))
  process.exit(fail === 0 ? 0 : 1)
}
