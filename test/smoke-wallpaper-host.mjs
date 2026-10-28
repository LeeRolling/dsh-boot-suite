// 宿主半边的契约测试（v2.13.0）
//
// 在**临时 DSH_HOME** 里真的跑 apply()，然后把 /chat-wallpaper/* 十一条路由的
// handler 一个个调过去，断言：
//   · 恰 11 条壁纸路由（v2.13.0 新增 5 条循环视频路由）
//   · /config 顶层键 {ok,config,image,imageSource,imageOk,video}，config 17 键，
//     且不含旧视频时代字段（mode/placement/loopStart/...）
//   · /images 不再返回 mode/placement；/status 不再有顶层 file/source/loop/userClipDirs
//   · /set 白名单（banner / bgMode / videoMode / videoId / videoShuffleMinutes）与夹取
//   · /videos 扫描（普通文件 + 壁纸引擎 project.json 整夹 = 一段视频）
//   · /video 支持 Range 206；/video-preview 只发项目预览图
//   · /videos/delete 普通文件删文件、项目删整夹、被引用时自动清空 videoId
//   · /videos/roots add/remove/open（默认目录不可移除、remove 不删文件、open 只允许配置目录）
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
  constructor(method, body, url, headers) {
    super()
    this.method = method
    this.headers = Object.assign({ host: '127.0.0.1:3080' }, headers || {})
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

async function callStream(kindPath, url, headers) {
  const route = ROUTES.get(kindPath)
  if (!route) throw new Error('route missing: ' + kindPath)
  const res = fakeStreamRes()
  await new Promise((resolve, reject) => {
    res.on('finish', resolve)
    res.on('error', reject)
    const req = new FakeReq('GET', undefined, url, headers)
    route.handler(req, res)
    req.flush()
  })
  return res
}

const postJson = (kindPath, payload) => callJson(kindPath, 'POST', JSON.stringify(payload))

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
  console.log('\n[2] 假 ctx 跑 apply：恰 11 条壁纸路由（含 5 条循环视频路由）')
  d.apply(ctx)
  const wallPaths = [...ROUTES.keys()].filter((k) => k.includes('/chat-wallpaper/'))
  const wantPaths = [
    'exact /chat-wallpaper/config', 'exact /chat-wallpaper/image', 'exact /chat-wallpaper/images',
    'exact /chat-wallpaper/set', 'exact /chat-wallpaper/open-dir', 'exact /chat-wallpaper/status',
    /* v2.13.0 循环视频 */
    'exact /chat-wallpaper/videos', 'exact /chat-wallpaper/video', 'exact /chat-wallpaper/video-preview',
    'exact /chat-wallpaper/videos/delete', 'exact /chat-wallpaper/videos/roots',
  ]
  check('恰好 11 条 /chat-wallpaper/* 路由', wallPaths.length === 11, String(wallPaths.length) + '：' + wallPaths.join(' | '))
  check('十一条路由路径与新契约一致', wantPaths.every((p) => ROUTES.has(p)), wallPaths.join(' | '))
  check('★ v2.13.0 循环视频路由都在（/videos、/video、/video-preview、/videos/delete、/videos/roots）',
    ['/chat-wallpaper/videos', '/chat-wallpaper/video', '/chat-wallpaper/video-preview',
      '/chat-wallpaper/videos/delete', '/chat-wallpaper/videos/roots'].every((p) => ROUTES.has('exact ' + p)))
  check('用了 ctx.effect 管理生命周期（开机动画 1 + 壁纸 11）', effects === 12, String(effects))

  /* ── [3] /config ────────────────────────────────────────────────────── */
  console.log('\n[3] GET /config：顶层键与 config 字段都是新契约（含 video 对象）')
  let r = await callJson('exact /chat-wallpaper/config')
  check('/config 200', r.res.statusCode === 200, String(r.res.statusCode))
  check('/config 顶层键恰 {ok,config,image,imageSource,imageOk,video}',
    sortKeys(r.json) === 'config,image,imageOk,imageSource,ok,video', sortKeys(r.json))
  check('/config ok=true', r.json && r.json.ok === true, r.json && String(r.json.ok))
  const CONFIG_KEYS = ['banner', 'bannerOpacity', 'fallbackDark', 'fallbackLight', 'image', 'imageFit',
    'sidebarDark', 'sidebarLight', 'veilBlur', 'veilDarkA', 'veilDarkB', 'veilLightA', 'veilLightB',
    /* v2.13.0 循环视频 */
    'bgMode', 'videoMode', 'videoId', 'videoRoots', 'videoShuffleMinutes']
  check('config 恰好 18 个键（12 旧 + 5 循环视频 + 1 镜头模糊）',
    sortKeys(r.json && r.json.config) === CONFIG_KEYS.slice().sort().join(','), sortKeys(r.json && r.json.config))
  const DEAD_KEYS = ['video', 'mode', 'placement', 'loopStart', 'loopEnd', 'oncePerSession',
    'waitForBoot', 'fadeOutMs', 'objectFit', 'opacity', 'playbackRate', 'fps']
  const leaked = DEAD_KEYS.filter((k) => r.json && r.json.config && k in r.json.config)
  check('★ config 里没有任何旧视频时代字段（video/mode/placement/loop*/...）', leaked.length === 0, leaked.join(','))
  check('/config 的 imageOk=true（v2.13.1 起新装默认就有内置底图）', r.json && r.json.imageOk === true, String(r.json && r.json.imageOk))
  check('/config 的 image 指向内置默认图', r.json && typeof r.json.image === 'string' && r.json.image.endsWith('lib/assets/default-background.jpg'), r.json && r.json.image)
  check('/config 的 imageSource = builtin', r.json && r.json.imageSource === 'builtin', String(r.json && r.json.imageSource))
  check('★ v2.13.4 config.imageFit 默认 cover', r.json && r.json.config && r.json.config.imageFit === 'cover', String(r.json && r.json.config && r.json.config.imageFit))
  check('★ v2.13.11 config.veilBlur 默认 0（不模糊）', r.json && r.json.config && r.json.config.veilBlur === 0, String(r.json && r.json.config && r.json.config.veilBlur))
  const v0 = (r.json && r.json.video) || {}
  check('★ /config.video 默认值：enabled=false / mode=single / shuffleMinutes=0 / selectedId 空 / count=0 / current=null',
    v0.enabled === false && v0.mode === 'single' && v0.shuffleMinutes === 0 &&
    v0.selectedId === '' && v0.count === 0 && v0.current === null,
    JSON.stringify({ enabled: v0.enabled, mode: v0.mode, min: v0.shuffleMinutes, selected: v0.selectedId, count: v0.count, current: v0.current }))

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
  check('★ /images 默认列出「默认背景（内置）」，且 marked builtin/selected',
    r.json && Array.isArray(r.json.images) && r.json.images.length === 1 &&
    r.json.images[0].builtin === true && r.json.images[0].selected === true &&
    r.json.images[0].url.includes('__default__'),
    JSON.stringify(r.json && r.json.images))
  check('/images.imageSource = builtin、imageConfig 为空',
    r.json && r.json.imageSource === 'builtin' && r.json.imageConfig === '',
    JSON.stringify({ source: r.json && r.json.imageSource, cfg: r.json && r.json.imageConfig }))

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
  r = await callJson('exact /chat-wallpaper/set', 'POST', JSON.stringify({ imageFit: 'contain' }))
  check('★ v2.13.4 /set 接受 imageFit=contain', r.json && r.json.applied && r.json.applied.imageFit === 'contain', JSON.stringify(r.json && r.json.applied))
  r = await callJson('exact /chat-wallpaper/set', 'POST', JSON.stringify({ imageFit: 'fill' }))
  check('★ v2.13.4 非法 imageFit 被忽略', r.json && r.json.applied && !('imageFit' in r.json.applied), JSON.stringify(r.json && r.json.applied))
  /* ── v2.13.11 镜头模糊 ─────────────────────────────────────────────── */
  r = await postJson('exact /chat-wallpaper/set', { veilBlur: 55 })
  check('★ v2.13.11 /set 接受 veilBlur=55', r.json && r.json.applied && r.json.applied.veilBlur === 55, JSON.stringify(r.json && r.json.applied))
  r = await postJson('exact /chat-wallpaper/set', { veilBlur: 150 })
  check('★ veilBlur 夹到 100', r.json && r.json.applied && r.json.applied.veilBlur === 100, JSON.stringify(r.json && r.json.applied))
  r = await postJson('exact /chat-wallpaper/set', { veilBlur: -5 })
  check('★ veilBlur 下限夹到 0', r.json && r.json.applied && r.json.applied.veilBlur === 0, JSON.stringify(r.json && r.json.applied))
  r = await postJson('exact /chat-wallpaper/set', { veilBlur: 'abc' })
  check('★ 非法 veilBlur 被忽略', r.json && r.json.applied && !('veilBlur' in r.json.applied), JSON.stringify(r.json && r.json.applied))
  r = await callJson('exact /chat-wallpaper/config')
  check('再读 /config：banner = B', r.json && r.json.config && r.json.config.banner === 'B', r.json && r.json.config && r.json.config.banner)
  const cfgFile = path.join(HOME, 'chat-wallpaper.json')
  check('配置文件真的落盘在临时 DSH_HOME', fs.existsSync(cfgFile))
  if (fs.existsSync(cfgFile)) {
    const raw = fs.readFileSync(cfgFile, 'utf8')
    let disk = null
    try { disk = JSON.parse(raw) } catch { /* 下面会红 */ }
    check('落盘 JSON 可解析且无 BOM', !!disk && raw.charCodeAt(0) !== 0xFEFF)
    check('★ 落盘配置里没有旧视频时代字段', !!disk && DEAD_KEYS.every((k) => !(k in disk)), disk && Object.keys(disk).join(','))
    check('落盘配置恰好 17 键（12 旧 + 5 循环视频）', !!disk && sortKeys(disk) === CONFIG_KEYS.slice().sort().join(','), disk && sortKeys(disk))
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

  /* ── [7] /image：新装默认内置图；丢图用自己的；哨兵切回内置/不用图 ─── */
  console.log('\n[7] GET /image：新装默认内置图 → 丢图用自己的 → __default__ / __none__ 哨兵')
  const builtinFile = new URL('../lib/assets/default-background.jpg', import.meta.url)
  const builtinBytes = fs.statSync(builtinFile).size
  let stream = await callStream('exact /chat-wallpaper/image')
  check('★ 新装没丢图时 /image → 200（内置默认背景）', stream.statusCode === 200, String(stream.statusCode))
  check('/image 默认返回 image/jpeg', stream.headers && String(stream.headers['Content-Type']).includes('image/jpeg'),
    stream.headers && stream.headers['Content-Type'])
  check('/image 默认返回内置图的完整字节',
    stream.headers && Number(stream.headers['Content-Length']) === builtinBytes &&
    Buffer.concat(stream._chunks).length === builtinBytes,
    (stream.headers && stream.headers['Content-Length']) + ' / ' + builtinBytes)

  const dropDir = path.join(HOME, 'chat-wallpaper')
  fs.mkdirSync(dropDir, { recursive: true })
  const px = Buffer.alloc(5001, 0x89)          // > 4KB 才会被当成候选图
  fs.writeFileSync(path.join(dropDir, 'smoke-bg.png'), px)

  stream = await callStream('exact /chat-wallpaper/image')
  check('丢图后 /image → 200（用户自己的图优先）', stream.statusCode === 200, String(stream.statusCode))
  check('丢图后 /image 返回 image/png', stream.headers && String(stream.headers['Content-Type']).includes('image/png'),
    stream.headers && stream.headers['Content-Type'])
  check('丢图后 /image 字节数正确且内容发出来了',
    stream.headers && Number(stream.headers['Content-Length']) === px.length &&
    Buffer.concat(stream._chunks).length === px.length,
    (stream.headers && stream.headers['Content-Length']) + ' / ' + Buffer.concat(stream._chunks).length)
  stream = await callStream('exact /chat-wallpaper/image', '/chat-wallpaper/image?name=smoke-bg.png')
  check('/image?name= 指定丢图目录里的图 → 200', stream.statusCode === 200, String(stream.statusCode))
  stream = await callStream('exact /chat-wallpaper/image', '/chat-wallpaper/image?name=__default__')
  check('★ /image?name=__default__ → 200 + image/jpeg（切回内置图）',
    stream.statusCode === 200 && String(stream.headers['Content-Type']).includes('image/jpeg'),
    stream.statusCode + ' / ' + (stream.headers && stream.headers['Content-Type']))
  stream = await callStream('exact /chat-wallpaper/image', '/chat-wallpaper/image?name=../../package.json')
  check('/image?name= 目录穿越被拒 → 404', stream.statusCode === 404, String(stream.statusCode))

  /* 回归：name 指向目录（. / .. / 已存在子目录）不能把宿主 createReadStream 打崩（EISDIR） */
  fs.mkdirSync(path.join(dropDir, 'smoke-dir'), { recursive: true })
  for (const bad of ['.', '..', 'smoke-dir', 'loops']) {
    stream = await callStream('exact /chat-wallpaper/image', '/chat-wallpaper/image?name=' + encodeURIComponent(bad))
    check('★ /image?name=' + bad + '（目录）→ 404 且不崩',
      stream.statusCode === 404, String(stream.statusCode))
  }
  stream = await callStream('exact /chat-wallpaper/image')
  check('★ 目录名请求后 /image 仍正常 → 200（宿主没被打崩）', stream.statusCode === 200, String(stream.statusCode))

  /* 回归：用户目录里恰有 default-background.jpg 时，指定该名字应返回用户的图，而不是内置图 */
  const sameName = path.join(dropDir, 'default-background.jpg')
  fs.writeFileSync(sameName, px)
  stream = await callStream('exact /chat-wallpaper/image', '/chat-wallpaper/image?name=default-background.jpg')
  check('★ 用户图与内置图同名时 /image?name= 返回用户图（5001 B）',
    stream.statusCode === 200 && Number(stream.headers['Content-Length']) === px.length,
    stream.statusCode + ' / ' + (stream.headers && stream.headers['Content-Length']))
  fs.rmSync(sameName, { force: true })

  /* 回归：/set 不接受丢图目录之外的任意绝对路径（本地任意文件读取原语） */
  r = await postJson('exact /chat-wallpaper/set', { image: 'C:/Windows/win.ini' })
  check('★ POST /set 任意绝对路径被拒绝（不在 applied.image 里）',
    r.json && r.json.applied && r.json.applied.image === undefined,
    JSON.stringify(r.json && r.json.applied))
  r = await callJson('exact /chat-wallpaper/config')
  check('拒绝后 imageSource 仍是 your-library（没有被改配置）',
    r.json && r.json.imageSource === 'your-library', r.json && r.json.imageSource)

  r = await callJson('exact /chat-wallpaper/images')
  check('★ 丢图后 /images 列出 2 张：内置默认图在前、用户的在后',
    r.json && Array.isArray(r.json.images) && r.json.images.length === 2 &&
    r.json.images[0].builtin === true && r.json.images[1].name === 'smoke-bg.png',
    JSON.stringify(r.json && r.json.images))
  check('丢图后 /images.current 指向它、imageSource = your-library',
    r.json && typeof r.json.current === 'string' && r.json.current.endsWith('smoke-bg.png') &&
    r.json.imageSource === 'your-library',
    JSON.stringify({ current: r.json && r.json.current, source: r.json && r.json.imageSource }))
  r = await callJson('exact /chat-wallpaper/config')
  check('丢图后 /config imageOk = true', r.json && r.json.imageOk === true, String(r.json && r.json.imageOk))
  check('丢图后 /config imageSource = your-library', r.json && r.json.imageSource === 'your-library', r.json && r.json.imageSource)

  /* 哨兵：__none__ = 明确不用背景图；__default__ = 切回内置图 */
  r = await postJson('exact /chat-wallpaper/set', { image: '__none__' })
  check('★ POST /set image=__none__ 被接受', r.json && r.json.applied && r.json.applied.image === '__none__',
    JSON.stringify(r.json && r.json.applied))
  r = await callJson('exact /chat-wallpaper/config')
  check('★ __none__ 后 /config imageOk=false / image=null / source=none',
    r.json && r.json.imageOk === false && r.json.image === null && r.json.imageSource === 'none',
    JSON.stringify({ ok: r.json && r.json.imageOk, img: r.json && r.json.image, src: r.json && r.json.imageSource }))
  stream = await callStream('exact /chat-wallpaper/image')
  check('__none__ 后 /image → 404（确实不显示背景）', stream.statusCode === 404, String(stream.statusCode))

  r = await postJson('exact /chat-wallpaper/set', { image: '__default__' })
  check('★ POST /set image=__default__ 被接受', r.json && r.json.applied && r.json.applied.image === '__default__',
    JSON.stringify(r.json && r.json.applied))
  r = await callJson('exact /chat-wallpaper/config')
  check('★ __default__ 后 /config imageOk=true / source=builtin / image 指向内置图',
    r.json && r.json.imageOk === true && r.json.imageSource === 'builtin' &&
    typeof r.json.image === 'string' && r.json.image.replace(/\\/g, '/').endsWith('lib/assets/default-background.jpg'),
    JSON.stringify({ ok: r.json && r.json.imageOk, src: r.json && r.json.imageSource, img: r.json && r.json.image }))
  stream = await callStream('exact /chat-wallpaper/image')
  check('__default__ 后 /image → 200 + 内置图完整字节',
    stream.statusCode === 200 && Number(stream.headers['Content-Length']) === builtinBytes,
    stream.statusCode + ' / ' + (stream.headers && stream.headers['Content-Length']))

  r = await postJson('exact /chat-wallpaper/set', { image: '' })
  check('恢复 image=""（自动挑最新图）', r.json && r.json.applied && r.json.applied.image === '',
    JSON.stringify(r.json && r.json.applied))
  r = await callJson('exact /chat-wallpaper/config')
  check('恢复后 imageSource = your-library（目录里有 smoke-bg.png）',
    r.json && r.json.imageSource === 'your-library' && r.json.imageOk === true,
    JSON.stringify({ src: r.json && r.json.imageSource, ok: r.json && r.json.imageOk }))

  /* ── [8] /videos 默认返回 ───────────────────────────────────────────── */
  console.log('\n[8] GET /videos：默认返回（还没建视频目录）')
  r = await callJson('exact /chat-wallpaper/videos')
  check('/videos 200 + ok', r.res.statusCode === 200 && r.json && r.json.ok === true, String(r.res.statusCode))
  check('/videos 默认 bgMode = image', r.json && r.json.bgMode === 'image', r.json && r.json.bgMode)
  check('/videos 默认 videoMode = single', r.json && r.json.videoMode === 'single', r.json && r.json.videoMode)
  check('/videos 默认 selectedId / currentId 为空',
    r.json && r.json.selectedId === '' && r.json.currentId === '', JSON.stringify({ s: r.json && r.json.selectedId, c: r.json && r.json.currentId }))
  check('/videos 默认 items = []（视频目录还没建）', r.json && Array.isArray(r.json.items) && r.json.items.length === 0,
    r.json && String(r.json.items && r.json.items.length))
  check('★ /videos.roots 首位 = 默认 loops 目录、且 removable=false',
    r.json && Array.isArray(r.json.roots) && r.json.roots.length === 1 &&
    r.json.roots[0].path.endsWith('/chat-wallpaper/loops') && r.json.roots[0].removable === false,
    JSON.stringify(r.json && r.json.roots))
  check('默认 loops 目录此时不存在（exists=false）', r.json && r.json.roots[0].exists === false, String(r.json && r.json.roots[0].exists))

  /* ── [9] 造视频数据：普通文件 + 壁纸引擎项目 + 自定义目录 ───────────── */
  console.log('\n[9] 造数据后 /videos 扫描：普通文件、project.json 整夹、自定义目录')
  const loopsDir = path.join(HOME, 'chat-wallpaper', 'loops')
  fs.mkdirSync(loopsDir, { recursive: true })
  const alphaFile = path.join(loopsDir, 'alpha.mp4')
  fs.writeFileSync(alphaFile, Buffer.alloc(2048, 7))
  const projectDir = path.join(loopsDir, 'project-one')
  fs.mkdirSync(projectDir, { recursive: true })
  const projVideo = path.join(projectDir, 'clip.webm')
  fs.writeFileSync(projVideo, Buffer.alloc(4096, 8))
  const projPreview = path.join(projectDir, 'preview.gif')
  fs.writeFileSync(projPreview, Buffer.alloc(512, 9))
  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
    type: 'video', file: 'clip.webm', preview: 'preview.gif', title: '项目一号', tags: ['氛围', '深海'],
  }))
  const customRoot = path.join(HOME, 'custom-loops')
  fs.mkdirSync(customRoot, { recursive: true })
  const betaFile = path.join(customRoot, 'beta.webm')
  fs.writeFileSync(betaFile, Buffer.alloc(1024, 6))

  let addRes = await postJson('exact /chat-wallpaper/videos/roots', { action: 'add', path: customRoot })
  check('roots add 自定义目录成功并返回目录列表',
    addRes.json && addRes.json.ok === true && addRes.json.roots.some((p) => p.includes('custom-loops')), JSON.stringify(addRes.json))

  r = await callJson('exact /chat-wallpaper/videos')
  const items = (r.json && r.json.items) || []
  check('★ 扫描到 3 段视频（普通文件 + 项目整夹 + 自定义目录）', items.length === 3,
    items.map((i) => i.title + ':' + i.kind).join(','))
  const projItem = items.find((i) => i.kind === 'project')
  const plainItem = items.find((i) => i.title === 'alpha')
  const customItem = items.find((i) => i.title === 'beta')
  check('★ project.json 整个文件夹 = 一段视频（kind=project）',
    !!projItem && projItem.title === '项目一号', projItem && JSON.stringify({ kind: projItem.kind, title: projItem.title }))
  check('项目视频的 previewUrl 走 /chat-wallpaper/video-preview?id=',
    !!projItem && String(projItem.previewUrl).includes('/chat-wallpaper/video-preview?id='), projItem && projItem.previewUrl)
  check('项目 tags 透出（≤8 个）', !!projItem && Array.isArray(projItem.tags) && projItem.tags.length === 2, projItem && JSON.stringify(projItem.tags))
  check('普通视频标题 = 文件名去扩展名（kind=file）',
    !!plainItem && plainItem.kind === 'file' && plainItem.title === 'alpha', plainItem && JSON.stringify({ kind: plainItem.kind, title: plainItem.title }))
  check('自定义目录里的视频也扫到', !!customItem && customItem.kind === 'file', customItem && customItem.title)
  check('每段视频都有 videoUrl（/chat-wallpaper/video?id=）',
    items.length > 0 && items.every((i) => String(i.videoUrl).includes('/chat-wallpaper/video?id=')))
  check('roots 现在有 2 项，自定义目录 removable=true 且 exists=true',
    r.json && r.json.roots.length === 2 && r.json.roots[1].removable === true && r.json.roots[1].exists === true,
    JSON.stringify(r.json && r.json.roots))
  r = await callJson('exact /chat-wallpaper/config')
  check('★ /config.video.count 同步为 3', r.json && r.json.video && r.json.video.count === 3, r.json && String(r.json.video.count))
  check('bgMode 仍是 image → video.enabled=false、current=null',
    r.json && r.json.video && r.json.video.enabled === false && r.json.video.current === null)

  /* ── [10] /video（Range）与 /video-preview ──────────────────────────── */
  console.log('\n[10] GET /video（支持 Range 206）与 /video-preview')
  const alphaId = plainItem && plainItem.id
  const projId = projItem && projItem.id
  let vStream = await callStream('exact /chat-wallpaper/video', '/chat-wallpaper/video?id=' + encodeURIComponent(alphaId))
  check('/video 普通视频 → 200 video/mp4', vStream.statusCode === 200 && String(vStream.headers['Content-Type']).includes('video/mp4'),
    String(vStream.statusCode) + ' ' + (vStream.headers && vStream.headers['Content-Type']))
  check('/video 返回全部字节',
    Number(vStream.headers['Content-Length']) === 2048 && Buffer.concat(vStream._chunks).length === 2048,
    (vStream.headers && vStream.headers['Content-Length']) + ' / ' + Buffer.concat(vStream._chunks).length)
  check('/video 支持 Range（Accept-Ranges: bytes）', vStream.headers['Accept-Ranges'] === 'bytes', vStream.headers['Accept-Ranges'])

  vStream = await callStream('exact /chat-wallpaper/video', '/chat-wallpaper/video?id=' + encodeURIComponent(alphaId), { range: 'bytes=0-99' })
  check('★ /video 带 Range → 206 Partial Content', vStream.statusCode === 206, String(vStream.statusCode))
  check('★ Content-Range 正确：bytes 0-99/2048', vStream.headers['Content-Range'] === 'bytes 0-99/2048', vStream.headers['Content-Range'])
  check('Range 响应只发 100 字节', Number(vStream.headers['Content-Length']) === 100 && Buffer.concat(vStream._chunks).length === 100,
    (vStream.headers && vStream.headers['Content-Length']) + ' / ' + Buffer.concat(vStream._chunks).length)

  vStream = await callStream('exact /chat-wallpaper/video', '/chat-wallpaper/video?id=' + encodeURIComponent(alphaId), { range: 'bytes=99999-' })
  check('/video Range 起点越界 → 416', vStream.statusCode === 416, String(vStream.statusCode))
  vStream = await callStream('exact /chat-wallpaper/video', '/chat-wallpaper/video?id=/nope/x.mp4')
  check('★ /video 未知 id → 404（只允许扫描列表内的文件）', vStream.statusCode === 404, String(vStream.statusCode))

  vStream = await callStream('exact /chat-wallpaper/video-preview', '/chat-wallpaper/video-preview?id=' + encodeURIComponent(projId))
  check('★ /video-preview 项目预览图 → 200 image/gif',
    vStream.statusCode === 200 && String(vStream.headers['Content-Type']).includes('image/gif'),
    String(vStream.statusCode) + ' ' + (vStream.headers && vStream.headers['Content-Type']))
  check('预览图字节数正确（512）', Number(vStream.headers['Content-Length']) === 512 && Buffer.concat(vStream._chunks).length === 512)
  vStream = await callStream('exact /chat-wallpaper/video-preview', '/chat-wallpaper/video-preview?id=' + encodeURIComponent(alphaId))
  check('/video-preview 普通视频（没有 preview）→ 404', vStream.statusCode === 404, String(vStream.statusCode))
  vStream = await callStream('exact /chat-wallpaper/video-preview', '/chat-wallpaper/video-preview?id=/nope/x.mp4')
  check('/video-preview 未知 id → 404', vStream.statusCode === 404, String(vStream.statusCode))

  /* ── [11] /set 循环视频白名单与夹取 ─────────────────────────────────── */
  console.log('\n[11] POST /set：循环视频字段白名单 + videoId 必须在扫描列表内 + 夹取')
  r = await postJson('exact /chat-wallpaper/set', { bgMode: 'video', videoMode: 'shuffle', videoId: alphaId, videoShuffleMinutes: 1441 })
  check('/set bgMode/videoMode/videoId 生效',
    r.json.applied.bgMode === 'video' && r.json.applied.videoMode === 'shuffle' && r.json.applied.videoId === alphaId,
    JSON.stringify(r.json.applied))
  check('★ videoShuffleMinutes 1441 被夹到 1440', r.json.applied.videoShuffleMinutes === 1440, String(r.json.applied.videoShuffleMinutes))
  r = await postJson('exact /chat-wallpaper/set', { videoShuffleMinutes: -5 })
  check('videoShuffleMinutes -5 被夹到 0', r.json.applied.videoShuffleMinutes === 0, String(r.json.applied.videoShuffleMinutes))
  r = await postJson('exact /chat-wallpaper/set', { videoShuffleMinutes: 'abc' })
  check('videoShuffleMinutes 非数字 → 忽略（不写进 applied）', !('videoShuffleMinutes' in r.json.applied), JSON.stringify(r.json.applied))
  r = await postJson('exact /chat-wallpaper/set', { videoId: '/not/in/list.mp4' })
  check('★ videoId 不在扫描列表 → 忽略不写（防手改配置乱播）',
    !('videoId' in r.json.applied) && r.json.config.videoId === alphaId, JSON.stringify(r.json.applied))
  r = await postJson('exact /chat-wallpaper/set', { bgMode: 'bogus', videoMode: 'bogus' })
  check('bgMode/videoMode 非法值被忽略',
    !('bgMode' in r.json.applied) && !('videoMode' in r.json.applied), JSON.stringify(r.json.applied))
  r = await callJson('exact /chat-wallpaper/config')
  check('★ /config.video：enabled + count + selectedId + current 全部正确',
    r.json.video.enabled === true && r.json.video.count === 3 && r.json.video.selectedId === alphaId &&
    r.json.video.current && r.json.video.current.id === alphaId,
    JSON.stringify({ enabled: r.json.video.enabled, count: r.json.video.count, selected: r.json.video.selectedId, current: r.json.video.current && r.json.video.current.id }))

  /* ── [12] /videos/delete + 本地删除同步 ─────────────────────────────── */
  console.log('\n[12] /videos/delete：普通文件删文件、项目删整夹、被引用时清空 videoId')
  let del = await callJson('exact /chat-wallpaper/videos/delete')
  check('GET /videos/delete → 405', del.res.statusCode === 405, String(del.res.statusCode))
  del = await postJson('exact /chat-wallpaper/videos/delete', { id: '/nope/none.mp4' })
  check('删除不存在的视频 → 404', del.res.statusCode === 404, String(del.res.statusCode))

  del = await postJson('exact /chat-wallpaper/videos/delete', { id: alphaId })
  check('★ 删除普通视频 → 200、kind=file、文件真的删掉',
    del.json && del.json.ok === true && del.json.kind === 'file' && !fs.existsSync(alphaFile), JSON.stringify(del.json))
  r = await callJson('exact /chat-wallpaper/config')
  check('★ 被删除的 videoId 自动清空（本地删除同步）', r.json.config.videoId === '', JSON.stringify(r.json.config.videoId))
  r = await callJson('exact /chat-wallpaper/videos')
  check('删除后 /videos 少一段（2 段）', r.json.items.length === 2, String(r.json.items.length))

  del = await postJson('exact /chat-wallpaper/videos/delete', { id: projId })
  check('★ 删除壁纸引擎项目 → 200、kind=project、整个文件夹删掉',
    del.json && del.json.ok === true && del.json.kind === 'project' && !fs.existsSync(projectDir), JSON.stringify(del.json))
  r = await callJson('exact /chat-wallpaper/videos')
  check('项目删掉后 /videos 只剩 1 段', r.json.items.length === 1, String(r.json.items.length))

  /* 直接删磁盘文件（不经路由）也要同步清空 videoId */
  const betaId = r.json.items[0] && r.json.items[0].id
  await postJson('exact /chat-wallpaper/set', { videoId: betaId })
  r = await callJson('exact /chat-wallpaper/config')
  check('前置：选中 beta 视频', r.json.config.videoId === betaId, JSON.stringify(r.json.config.videoId))
  fs.rmSync(betaFile)
  r = await callJson('exact /chat-wallpaper/config')
  check('★★ 用户直接删磁盘文件 → 当前解析回落静态（video.current = null）',
    r.json.video && r.json.video.current === null, JSON.stringify(r.json.video && r.json.video.current))
  check('★★ 且磁盘配置里的 videoId 已被自动清空（本地删除同步）', (() => {
    try { return JSON.parse(fs.readFileSync(cfgFile, 'utf8')).videoId === '' } catch { return false }
  })())
  check('★★ 同一次 /config 响应里 selectedId 也立即清空（内存 cfg 同步改）',
    r.json.config.videoId === '' && r.json.video.selectedId === '',
    JSON.stringify({ cfg: r.json.config.videoId, selected: r.json.video.selectedId }))
  r = await callJson('exact /chat-wallpaper/config')
  check('再读一次 /config：videoId 仍然是空', r.json.config.videoId === '', JSON.stringify(r.json.config.videoId))
  r = await callJson('exact /chat-wallpaper/videos')
  check('磁盘删除后 /videos items 归零', r.json.items.length === 0, String(r.json.items.length))

  /* ── [13] /videos/roots：add/remove/open 与边界 ─────────────────────── */
  console.log('\n[13] /videos/roots：add/remove/open 与边界（默认目录不可移除、remove 不删文件）')
  let rootsRes = await callJson('exact /chat-wallpaper/videos/roots')
  check('GET /videos/roots → 405', rootsRes.res.statusCode === 405, String(rootsRes.res.statusCode))

  rootsRes = await postJson('exact /chat-wallpaper/videos/roots', { action: 'add', path: customRoot })
  check('重复 add 同一目录 → 去重（只登记一次）',
    rootsRes.json.ok === true && rootsRes.json.roots.filter((p) => p.toLowerCase().includes('custom-loops')).length === 1,
    JSON.stringify(rootsRes.json))

  const autoRoot = path.join(HOME, 'auto-created-loops')
  rootsRes = await postJson('exact /chat-wallpaper/videos/roots', { action: 'add', path: autoRoot })
  check('★ add 一个还不存在的目录 → 自动创建并登记',
    rootsRes.json.ok === true && fs.existsSync(autoRoot) && rootsRes.json.roots.some((p) => p.includes('auto-created-loops')),
    JSON.stringify(rootsRes.json))

  const notDir = path.join(HOME, 'not-a-dir.txt')
  fs.writeFileSync(notDir, 'x')
  rootsRes = await postJson('exact /chat-wallpaper/videos/roots', { action: 'add', path: notDir })
  check('add 指向文件 → 400', rootsRes.res.statusCode === 400, String(rootsRes.res.statusCode))
  rootsRes = await postJson('exact /chat-wallpaper/videos/roots', { action: 'add', path: '' })
  check('add 空路径 → 400', rootsRes.res.statusCode === 400, String(rootsRes.res.statusCode))

  rootsRes = await postJson('exact /chat-wallpaper/videos/roots', { action: 'remove', path: loopsDir })
  check('★ remove 默认 loops 目录 → 400（默认目录不能移除）',
    rootsRes.res.statusCode === 400 && String(rootsRes.json.error || '').includes('默认'), JSON.stringify(rootsRes.json))

  rootsRes = await postJson('exact /chat-wallpaper/videos/roots', { action: 'open', path: path.join(HOME, 'not-configured-dir') })
  check('★ open 未配置目录 → 400（只允许打开配置目录，避免任意 spawn）',
    rootsRes.res.statusCode === 400, JSON.stringify(rootsRes.json))

  rootsRes = await postJson('exact /chat-wallpaper/videos/roots', { action: 'what' })
  check('未知 action → 400', rootsRes.res.statusCode === 400, String(rootsRes.res.statusCode))

  /* 自定义目录上限：默认 + 8 个自定义；第 9 个自定义 → 400 */
  for (let i = 0; i < 6; i++) {
    const p = path.join(HOME, 'bulk-loops-' + i)
    fs.mkdirSync(p, { recursive: true })
    await postJson('exact /chat-wallpaper/videos/roots', { action: 'add', path: p })
  }
  const overRoot = path.join(HOME, 'over-limit-loops')
  fs.mkdirSync(overRoot, { recursive: true })
  rootsRes = await postJson('exact /chat-wallpaper/videos/roots', { action: 'add', path: overRoot })
  check('★ 自定义视频目录最多 8 个：第 9 个 → 400', rootsRes.res.statusCode === 400, String(rootsRes.res.statusCode))

  rootsRes = await postJson('exact /chat-wallpaper/videos/roots', { action: 'remove', path: customRoot })
  check('★ remove 自定义目录 → 200 且目录本身不被删（只是不再扫描）',
    rootsRes.json.ok === true && fs.existsSync(customRoot), JSON.stringify(rootsRes.json))
  rootsRes = await callJson('exact /chat-wallpaper/videos')
  check('remove 后 /videos.roots 不再含该目录',
    !(rootsRes.json.roots || []).some((root) => root.path.toLowerCase().includes('custom-loops')), JSON.stringify(rootsRes.json.roots))

} catch (e) {
  fail++
  console.log('  FAIL 测试本身抛异常：' + String((e && e.stack) || e))
} finally {
  try { fs.rmSync(HOME, { recursive: true, force: true }) } catch { /* 清理失败不影响结果 */ }
  console.log(`\n${fail === 0 ? '✓ 全部通过' : `✗ ${fail} 项失败`}（${pass} 项通过）`)
  console.log('  临时 DSH_HOME 已删除：', !fs.existsSync(HOME))
  process.exit(fail === 0 ? 0 : 1)
}
