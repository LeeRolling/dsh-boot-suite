/* ============================================================================
 * dsh-startup-screen — Host 半侧
 * ----------------------------------------------------------------------------
 * 做三件事：
 *   1) 在 index.html 里注入「启动界面」：首屏兜底黑幕 + 关键 CSS + 配置 + 运行时
 *   2) 提供 /dsh-startup/splash.css · splash.js · config 三个路由
 *   3) 把配置持久化到 ~/.dsh/dsh-startup.json（设置页经 /dsh-startup/config 读写）
 *
 * 说明：配置刻意不走 settings 命名空间，而是自带一份 JSON + 自带设置面板
 * （与 dsh-meme 同款做法），这样不受 dsh-settings 版本变更影响。
 * ========================================================================== */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-startup.json')

const NS = 'dsh-startup-screen'
const ROUTE_BASE = '/dsh-startup'

/* 首屏注入走的是哪条通道？桌面端（file:// + IPC）与服务端渲染（tapIndex）
   行为不同，出问题时光看现象分不清。这里留一条极轻的诊断：每次挑注入
   通道就写一行日志，最多写 40 行，绝不因为写日志失败影响启动。 */
const DIAG_FILE = path.join(DSH_HOME, 'boot-suite-diag.log')
let diagBudget = 160
let dumpBudget = 3
function diag(line) {
  if (diagBudget <= 0) return
  diagBudget--
  try { fs.appendFileSync(DIAG_FILE, new Date().toISOString() + '  ' + line + '\n', 'utf8') } catch (err) { /* 忽略 */ }
}

/* 把实际下发到浏览器的 index.html 落盘（前 3 次）。出黑屏时这是唯一能证明
   "注入到底进没进去" 的证据。 */
function dumpHtml(html) {
  if (dumpBudget <= 0 || typeof html !== 'string') return
  dumpBudget--
  try { fs.writeFileSync(path.join(DSH_HOME, 'boot-suite-diag-html-' + (dumpBudget + 1) + '.html'), html, 'utf8') } catch (err) { /* 忽略 */ }
}

/** 插件版本：读自己的 package.json，避免源码与版本号两处各写一份。
    读不到就退回占位符（设置页会显示它，不会显示 undefined）。 */
const PLUGIN_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    const v = String(pkg.version || '').trim()
    return v || '0.0.0'
  } catch (err) {
    return '0.0.0'
  }
})()

/** 默认配置：字段与 lib/splash.js 的 DEFAULTS 一一对应。 */
const DEFAULTS = {
  enabled: true,
  mode: 'session',            // always | session | daily
  theme: 'light',             // light | dark
  speed: 1,
  requireInteraction: true,
  allowSkip: true,
  sound: true,                // 界面音效（WebAudio 合成，无音频文件）
  soundVolume: 0.5,
  voice: true,                // 女声播报（Web Speech API）
  voiceLang: 'en',            // en | zh | both
  voiceName: '',              // '' = 自动挑（按分数优先神经网络女声）
  voiceRate: 0.88,            // 电影旁白档：比朗读慢，字与字之间才有重量
  voicePitch: 0.85,           // 压低音调，深沉的 AI 女声
  voiceVolume: 0.9,
  voiceCue: true,             // 念台词前的一声轻提示
  sfx: 'audio',               // 音效来源：audio=lib/assets 里的真素材 / synth=现场合成
  voiceSource: 'asset',       // 语音来源：asset=优先用真声素材（拿不到自动回落 TTS）/ tts=全 TTS
  voiceLead: 240,             // 提示音之后留一小段空白再开口
  identity: 'JOYCE MOORE',    // ← 设置页里可改的「身份名称」
  identityId: '0087',
  accessLevel: '3',
  brand1: 'DEEPSEEK',
  brand2: 'SYNTHESIZE INTELLIGENCE',
  brand3a: 'HARNESS',
  brand3b: 'OS',
  orgZh: '深度求索',
  orgEn: 'DEEPSEEK',
  orgSub: 'DEEPSEEK HARNESS',
  welcomeBox: 'DEEPSEEK HARNESS',
  footer: 'POWERED BY DEEPSEEK',
  accent: '#ff7500',
  glitchA: '#ff3b30',
  glitchB: '#2971b8'
}

const TEXT_KEYS = [
  'identity', 'identityId', 'accessLevel',
  'brand1', 'brand2', 'brand3a', 'brand3b',
  'orgZh', 'orgEn', 'orgSub', 'welcomeBox', 'footer', 'voiceName'
]
const COLOR_KEYS = ['accent', 'glitchA', 'glitchB']
const ENUMS = {
  mode: ['always', 'session', 'daily'],
  theme: ['light', 'dark'],
  voiceLang: ['en', 'zh', 'both'],
  sfx: ['audio', 'synth'],
  voiceSource: ['asset', 'tts']
}
const BOOL_KEYS = ['enabled', 'requireInteraction', 'allowSkip', 'sound', 'voice', 'voiceCue']
/** 数值字段的合法区间（越界即夹取）。 */
const RANGES = {
  speed: [0.35, 3],
  soundVolume: [0, 1],
  voiceRate: [0.5, 2],
  voiceLead: [0, 1200],
  voicePitch: [0, 2],
  voiceVolume: [0, 1]
}

function normalize(input) {
  const out = { ...DEFAULTS }
  const src = input && typeof input === 'object' ? input : {}
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in src) || src[key] === undefined || src[key] === null) continue
    const value = src[key]
    if (BOOL_KEYS.includes(key)) {
      out[key] = value === true || value === 'true' || value === 1 || value === '1'
    } else if (ENUMS[key]) {
      out[key] = ENUMS[key].includes(value) ? value : DEFAULTS[key]
    } else if (key === 'speed' || RANGES[key]) {
      const [lo, hi] = RANGES[key] || RANGES.speed
      const n = Number(value)
      out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[key]
    } else if (COLOR_KEYS.includes(key)) {
      const s = String(value).trim()
      out[key] = /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : DEFAULTS[key]
    } else if (TEXT_KEYS.includes(key)) {
      out[key] = String(value).slice(0, 64)
    } else {
      out[key] = value
    }
  }
  if (!String(out.identity).trim()) out.identity = DEFAULTS.identity
  if (!String(out.identityId).trim()) {
    out.identityId = String(out.identity).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  }
  if (!String(out.identityId).trim()) out.identityId = 'OPERATOR'
  return out
}

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
    return normalize(JSON.parse(raw))
  } catch (err) {
    return { ...DEFAULTS }
  }
}

function writeConfig(next) {
  const cfg = normalize(next)
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}

/** 静态文件按 mtime 缓存，改完插件刷新页面即生效。 */
function makeReader(rel) {
  let cache = null
  return function read() {
    const file = path.join(PACKAGE_ROOT, rel)
    try {
      const st = fs.statSync(file)
      if (!cache || cache.mtimeMs !== st.mtimeMs) {
        cache = { mtimeMs: st.mtimeMs, text: fs.readFileSync(file, 'utf8') }
      }
      return cache.text
    } catch (err) {
      return ''
    }
  }
}

const readSplashCss = makeReader('lib/splash.css')
const readSplashJs = makeReader('lib/splash.js')

/** 内联脚本里绝对不能出现 `</script>`。 */
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '')
}

/** 首屏兜底：在应用挂载前先把窗口盖住，避免闪出界面本体。 */
const CRITICAL_CSS = [
  'html.dsu-lock,html.dsu-lock body{overflow:hidden!important}',
  '#dsh-startup-root.dsu-boot{position:fixed;inset:0;z-index:2147483000;background:#000}'
].join('')

const BOOTSTRAP_JS = `(function(){try{
var c=window.__DSH_STARTUP__||{};
var root=document.getElementById('dsh-startup-root');
var off=!c.enabled;
if(!off&&c.mode==='session'&&sessionStorage.getItem('dsh-startup-screen:shown')==='1')off=true;
if(!off&&c.mode==='daily'&&localStorage.getItem('dsh-startup-screen:day')===new Date().toISOString().slice(0,10))off=true;
if(off){window.__DSH_STARTUP_SKIP__=true;if(root&&root.parentNode)root.parentNode.removeChild(root);}
else{document.documentElement.classList.add('dsu-lock');/* 兜底：连 splash.js 都没跑起来（404/被拦/语法错）时，9 秒后无条件放行，绝不锁黑屏 */setTimeout(function(){try{var r=document.getElementById('dsh-startup-root');if(r&&r.className&&r.className.indexOf('dsu-boot')!==-1){if(r.parentNode)r.parentNode.removeChild(r);document.documentElement.classList.remove('dsu-lock');if(document.body)document.body.style.overflow='';window.__DSH_STARTUP_FAILED__=true;}}catch(e){}},9000);}
}catch(e){} })()`

const name = NS
const inject = ['webServer', 'connection']

/**
 * 取得 HTTP 载体服务。
 *
 * web profile 与桌面端（DeepSeek Harness Desktop）都会挂 `@deepseek-ai/dsh-web-app`，
 * 其中 `webserver` 这一行提供 `webServer`；但 Electron 也可能改成 `file://` + IPC
 * 直接下发前端（`dsh-host-webserver` 的文档注释就写着 "Electron uses file:// plus
 * IPC instead"）。那种情况下没有 webServer，本插件不该把一颗 fiber 炸掉 ——
 * 交给客户端半侧自举（`lib/client.js` 的 selfBoot）。
 */
function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch (err) { /* 取不到就当没有 */ }
  return ctx.webServer
}

function hasRoutes(server) {
  /* 只要求 register：tapIndex 只是 web 部署的兜底通道，DSH 未来版本可能撤掉它，
     而注入行（webserver/index-inject）才是桌面端与静态部署都认的主通道。 */
  return !!server && typeof server.register === 'function'
}

function apply(ctx) {
  const disposers = []
  const webServer = resolveWebServer(ctx)

  /** 没有可注册路由的 HTTP 载体：桌面端若走 IPC 下发前端就是这种形态。
      什么都不注册（plugin 仍然 APPLIED，不报错），页面由客户端半侧自举。 */
  if (!hasRoutes(webServer)) {
    try {
      ctx.logger?.warn?.(
        '[' + NS + '] 当前 profile 没有可用的 webServer（桌面端可能用 file:// + IPC 下发前端）；' +
        'Host 半侧跳过路由与首屏注入，改由浏览器半侧自举启动界面。'
      )
    } catch (err) { /* 日志失败不影响加载 */ }
    return
  }

  /** 浏览器信任栅栏：自定义路由必须过一遍，否则可被任意网页读写。 */
  function rejected(req, res) {
    try {
      const conn = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
      if (!conn || typeof conn.requestRejection !== 'function') return false
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch (err) {
      return false
    }
  }

  function registerRoute(route) {
    const inner = route && route.handler
    const wrapped = Object.assign({}, route, {
      handler: async (req, res) => {
        if (rejected(req, res)) return
        return inner(req, res)
      }
    })
    return webServer.register(wrapped)
  }

  function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function readBody(req, limit = 64 * 1024) {
    return new Promise((resolve) => {
      let size = 0
      const chunks = []
      req.on('data', (c) => {
        size += c.length
        if (size > limit) {
          req.destroy()
          resolve('')
          return
        }
        chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => resolve(''))
    })
  }

  function sendText(res, type, text) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.css',
    handler: (req, res) => sendText(res, 'text/css; charset=utf-8', readSplashCss())
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.js',
    handler: (req, res) => sendText(res, 'application/javascript; charset=utf-8', readSplashJs())
  }))

  /* 音频素材：从用户提供的音轨里抠出来的音效（选项/确认音）。
     只读、白名单、不含子路径 —— 杜绝目录穿越。素材缺失时浏览器会自动回落到合成音。 */
  disposers.push(registerRoute({
    kind: 'prefix',
    path: ROUTE_BASE + '/asset',
    handler: (req, res) => {
      const name = path.basename(decodeURIComponent((req.url || '').split('?')[0]))
      if (!/^[a-z0-9._-]+\.mp3$/i.test(name) || name.includes('..')) {
        res.writeHead(404); res.end(); return
      }
      const file = path.join(PACKAGE_ROOT, 'lib', 'assets', name)
      let bytes
      try { bytes = fs.readFileSync(file) } catch (err) {
        res.writeHead(404); res.end(); return
      }
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': String(bytes.length)
      })
      res.end(bytes)
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/config',
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()
      if (method === 'GET') {
        sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: readConfig(), defaults: DEFAULTS, file: CONFIG_FILE })
        return
      }
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const text = await readBody(req)
      let payload = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (err) {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }
      try {
        if (payload && payload.action === 'reset') {
          const cfgNow = writeConfig(DEFAULTS)
          sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS })
          return
        }
        const current = readConfig()
        const patch = payload && typeof payload.patch === 'object' && payload.patch ? payload.patch : payload
        const cfgNow = writeConfig({ ...current, ...patch })
        sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  /* ── 首屏注入：结构化注入行（主通道）+ 原始 tapIndex（兜底） ─────────────
   *
   * DSH 0.2.x 的桌面端改成 file:// + IPC：index.html 是打包好的静态壳
   * （里面只有一个 <div id="root"></div>），启动数据以「注入行表」经 IPC
   * 下发，由页面侧解释器渲染。那种部署里 webServer.tapIndex 的原始字符串
   * 变换**不会被执行** —— 表现就是 DSH 自己的启动界面先出现、开机动画要等
   * 浏览器半侧自举才补上（老版本首帧就是黑幕，因为那时 index 是服务端渲染的）。
   *
   * 行表是两种呈现方式唯一共用的载体：服务端渲染 renderIndexInjections()
   * 把行拼进 HTML，静态部署把同一张表塞进 boot payload。所以这里以行表为主。
   * tapIndex 保留作 web 部署的兜底 —— 它的幂等守卫认 /splash.js 标记，
   * 行表已经把标记写进 HTML 之后它就自动退化成无操作，不会重复注入。 */
  function indexInjectionRows() {
    const cfg = readConfig()
    return [
      /* head：先兜底样式，保证首帧就是黑幕，不是 DSH 的启动界面 */
      { kind: 'style', text: CRITICAL_CSS },
      { kind: 'html', placement: 'head', html: '<link rel="stylesheet" href="' + ROUTE_BASE + '/splash.css">' },
      { kind: 'global', name: '__DSH_STARTUP_BOOT__', value: 'index' },
      { kind: 'global', name: '__DSH_STARTUP_VERSION__', value: PLUGIN_VERSION },
      { kind: 'global', name: '__DSH_STARTUP__', value: cfg },
      /* body：挂载点 → 兜底脚本 → 运行时 */
      { kind: 'html', placement: 'body', html: '<div id="dsh-startup-root" class="dsu-root dsu-boot"></div>' },
      { kind: 'script', placement: 'body', text: BOOTSTRAP_JS },
      /* 运行时脚本必须用 script-src（一等公民行），**不能**包在 html 行里：
         桌面端（file:// + IPC）的页面侧解释器按 HTML 文本插入行，innerHTML 里的
         <script> 不会执行 —— 实测脚本标签在文档里躺着、splash.js 从不运行，
         表现为开机动画整段消失、直接进壁纸。DSH 自己的 bundle 也是用 script-src。
         placement=body 让它排在挂载点之后、应用主包之前（不再等主包 2~4 秒）。 */
      { kind: 'script-preload', src: ROUTE_BASE + '/splash.js' },
      { kind: 'script-src', placement: 'body', src: ROUTE_BASE + '/splash.js' }
    ]
  }

  function contributeRows(table) {
    try {
      if (!Array.isArray(table)) return
      /* 同一个宿主上下文可能同时把 webserver/index-inject 暴露在父 ctx 与
         注入后的 webCtx 上。无论事件被订阅几次，同一张行表只能贡献一次；
         否则会生成两个同 id 的启动根节点，后插入的空黑层会盖住正常动画。 */
      const alreadyInjected = table.some((row) =>
        row && (
          (row.kind === 'global' && row.name === '__DSH_STARTUP_BOOT__') ||
          (typeof row.html === 'string' && row.html.includes('dsh-startup-root'))
        )
      )
      if (alreadyInjected) {
        diag('index-inject skipped duplicate rows=' + String(table.length))
        return
      }
      table.push(...indexInjectionRows())
      diag('index-inject rows=' + String(table.length))
    } catch (err) {
      diag('index-inject failed: ' + String((err && err.message) || err))
      try { ctx.logger?.warn?.('[' + NS + '] 注入行生成失败：' + String((err && err.message) || err)) } catch (e2) { /* 忽略 */ }
    }
  }

  /* 订阅注入行优先用官方写法（remote-access / client-modules 都这么写）：
     ctx.inject(['webServer'], webCtx => webCtx.on(...))。只有宿主根本不提供 inject
     时才回退 ctx.on；不能在 inject 回调尚未执行时同步订阅 ctx.on，否则同一事件
     会被两个监听器处理，生成两个互相覆盖的启动根节点。 */
  let rowsSubscribed = false
  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['webServer'], (webCtx) => {
        if (!webCtx || typeof webCtx.on !== 'function') { diag('webCtx 没有 on'); return }
        const off = webCtx.on('webserver/index-inject', contributeRows)
        rowsSubscribed = true
        diag('rows 订阅成功')
        if (typeof off === 'function') disposers.push(off)
      })
    } catch (err) { diag('ctx.inject 订阅失败: ' + String((err && err.message) || err)) }
  } else {
    if (typeof ctx.on === 'function') {
      try {
        const off = ctx.on('webserver/index-inject', contributeRows)
        rowsSubscribed = true
        diag('rows 订阅成功（直连 ctx.on）')
        if (typeof off === 'function') disposers.push(off)
      } catch (err) { diag('ctx.on 订阅失败: ' + String((err && err.message) || err)) }
    } else {
      diag('no ctx.on / ctx.inject — 只能走 tapIndex')
    }
  }

  /* 客户端取证通道：浏览器半侧/运行时把错误回传到这里，写进同一份诊断日志。 */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/diag',
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()
      if (method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
      const text = await readBody(req, 8 * 1024)
      diag('client: ' + String(text || '').slice(0, 1200))
      sendJson(res, 200, { ok: true })
    }
  }))

  disposers.push(webServer.tapIndex((html) => {
    diag('tapIndex len=' + (html ? html.length : 0))
    if (html && html.length > 1000) dumpHtml(html)
    if (!html || html.includes(ROUTE_BASE + '/splash.js')) return html
    const cfg = readConfig()
    const head =
      '<link rel="stylesheet" href="' + ROUTE_BASE + '/splash.css">' +
      '<style id="dsh-startup-critical">' + CRITICAL_CSS + '</style>'
    const body =
      '<div id="dsh-startup-root" class="dsu-root dsu-boot"></div>' +
      '<script>window.__DSH_STARTUP_BOOT__="index";window.__DSH_STARTUP_VERSION__=' + safeJson(PLUGIN_VERSION) + ';window.__DSH_STARTUP__=' + safeJson(cfg) + ';' + BOOTSTRAP_JS + '</script>' +
      '<script defer src="' + ROUTE_BASE + '/splash.js"></script>'

    let out = html
    if (out.includes('</head>')) out = out.replace('</head>', head + '</head>')
    else out = head + out
    if (out.includes('<body>')) out = out.replace('<body>', '<body>' + body)
    else if (out.includes('</body>')) out = out.replace('</body>', body + '</body>')
    else out = out + body
    return out
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* noop */ }
    }
  })
}

/* 导出形状对齐 DSH 内部插件（如 dsh-host-open-in-app）：
   只给具名 name / inject / apply。
   两点刻意不做：
   1) 不导出 default —— cordis-plugin-loader 的 unwrapExports 是
      `exports.default ?? exports`，一旦有 default 就只认 default，
      两边都写反而多一个"改一处忘一处"的坑；
   2) 不导出 Config —— Cordis 约定 Config 是 schemastery schema，
      我这份只是普通默认值对象，当 schema 用会炸。本插件也不吃 profile 配置。 */
export { apply, inject }
