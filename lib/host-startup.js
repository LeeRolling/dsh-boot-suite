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
import { spawn } from 'node:child_process'

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
  bedNoise: false,             // 背景底噪（硬盘嗡鸣）：默认关，用户明确打开才铺
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
  glitchB: '#2971b8',
  template: 'archive-warm',   // 第一幕默认：档案暖白
  act2: 'whale-girl-scan',    // 第二幕默认：鲸鱼娘扫描睁眼；'' = 不播
  /* v2.12.0 三段转场：第一幕入场 / 两幕衔接 / 第二幕退场。默认全部交叉叠化。 */
  transitionIn: 'dissolve',
  transitionJoin: 'dissolve',
  transitionOut: 'dissolve',
  transitionMs: 600,
  transitionDir: 'left',      // 仅 scanline / slide 使用：left|right|up|down
  hiddenTemplates: [],        // v2.12.4：被用户「隐藏」的内置模板 id 列表（本地模板删除走文件）
}

const TEXT_KEYS = [
  'template', 'act2',
  'identity', 'identityId', 'accessLevel',
  'brand1', 'brand2', 'brand3a', 'brand3b',
  'orgZh', 'orgEn', 'orgSub', 'welcomeBox', 'footer', 'voiceName'
]
const COLOR_KEYS = ['accent', 'glitchA', 'glitchB']
const TRANSITION_TYPES = ['dissolve', 'flash', 'glitch', 'scanline', 'slide', 'iris', 'black', 'none']
const TRANSITION_DIRS = ['left', 'right', 'up', 'down']
const ENUMS = {
  mode: ['always', 'session', 'daily'],
  theme: ['light', 'dark'],
  voiceLang: ['en', 'zh', 'both'],
  sfx: ['audio', 'synth'],
  voiceSource: ['asset', 'tts'],
  transitionIn: TRANSITION_TYPES,
  transitionJoin: TRANSITION_TYPES,
  transitionOut: TRANSITION_TYPES,
  transitionDir: TRANSITION_DIRS
}
const BOOL_KEYS = ['enabled', 'requireInteraction', 'allowSkip', 'sound', 'bedNoise', 'voice', 'voiceCue']
/** 数值字段的合法区间（越界即夹取）。 */
const RANGES = {
  speed: [0.35, 3],
  transitionMs: [200, 2000],
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
  out.hiddenTemplates = Array.isArray(src.hiddenTemplates)
    ? [...new Set(src.hiddenTemplates.filter((x) => typeof x === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(x)))].slice(0, 60)
    : []
  if (!String(out.identity).trim()) out.identity = DEFAULTS.identity
  if (!String(out.identityId).trim()) {
    out.identityId = String(out.identity).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  }
  if (!String(out.identityId).trim()) out.identityId = 'OPERATOR'
  return out
}

function readConfig() {
  try {
    const rawText = fs.readFileSync(CONFIG_FILE, 'utf8')
    const raw = JSON.parse(rawText)
    const cfg = normalize(raw)
    /* 老配置里没有 act2：保持单幕，避免升级后突然多播一段 */
    if (!Object.prototype.hasOwnProperty.call(raw, 'act2')) cfg.act2 = ''
    return cfg
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
  '#dsh-startup-root.dsu-boot{position:fixed;inset:0;z-index:2147483000;background:#000}',
  /* 参考 dsh-550c-boot 的做法：DSH 自己的开机卡片（[data-dsh-boot]，
     "HARNESS / Loading plugins…"）在文档解析阶段就按掉，别让它闪那一帧。
     只在插件接管期间隐藏，出错/关闭时不加 dsu-lock，卡片照常出现。 */
  'html.dsu-lock [data-dsh-boot]{display:none!important}'
].join('')

const BOOTSTRAP_JS = `(function(){try{
var c=window.__DSH_STARTUP__||{};
var root=document.getElementById('dsh-startup-root');
var off=!c.enabled;
if(!off&&c.mode==='session'&&sessionStorage.getItem('dsh-startup-screen:shown')==='1')off=true;
if(!off&&c.mode==='daily'&&localStorage.getItem('dsh-startup-screen:day')===new Date().toISOString().slice(0,10))off=true;
if(off){window.__DSH_STARTUP_SKIP__=true;if(root&&root.parentNode)root.parentNode.removeChild(root);}
else{
document.documentElement.classList.add('dsu-lock');
/* 桌面端标题栏：DSH preload 会造一个内联 background-color:var(--dsw-specific-sidebar-fill)
   的 span 探针，量完颜色用 IPC 让主进程重画 titleBarOverlay。这里在解析阶段就把探针
   改成透明 —— preload 的首次测量发生在 DOMContentLoaded，比这更晚，所以第一帧就是透明。
   片头结束时由 splash.js 移除这条样式，head 变动会触发 DSH 重新测量、还原原色。 */
if(!document.getElementById('dsh-startup-caption')){var st=document.createElement('style');st.id='dsh-startup-caption';st.textContent='body>span[style*="dsw-specific-sidebar-fill"]{background-color:transparent !important;color:#dfe7f3 !important}';document.head.appendChild(st);}/* 兜底：连 splash.js 都没跑起来（404/被拦/语法错）时，9 秒后无条件放行，绝不锁黑屏 */setTimeout(function(){try{var r=document.getElementById('dsh-startup-root');if(r&&r.className&&r.className.indexOf('dsu-boot')!==-1){if(r.parentNode)r.parentNode.removeChild(r);document.documentElement.classList.remove('dsu-lock');if(document.body)document.body.style.overflow='';window.__DSH_STARTUP_FAILED__=true;}}catch(e){}},9000);}
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

  function readRawBody(req, limit = 64 * 1024 * 1024) {
    return new Promise((resolve) => {
      let size = 0
      const chunks = []
      req.on('data', (c) => {
        size += c.length
        if (size > limit) { req.destroy(); resolve(null); return }
        chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', () => resolve(null))
    })
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
        'Cache-Control': 'no-store',
        'Content-Length': String(bytes.length)
      })
      res.end(bytes)
    }
  }))

  /* 模板自带声音：/dsh-startup/template-asset/<模板id>/<文件名>
     先找用户目录 ~/.dsh/startup-templates/<id>/assets/，再找插件自带 templates/<id>/assets/。
     id 与文件名都过白名单，且不接受子路径 —— 模板作者塞不进来任意文件读取。 */
  /* 模板自带素材：音频 + 图片（身份卡头像之类） */
  const AUDIO_FILE_RE = /^[a-z0-9][a-z0-9._-]{0,40}\.(mp3|wav|ogg|m4a|aac|png|jpe?g|webp|gif|svg|json|mp4|webm)$/i
  disposers.push(registerRoute({
    kind: 'prefix',
    path: ROUTE_BASE + '/template-asset',
    handler: (req, res) => {
      const rest = decodeURIComponent(String(req.url || '').split('?')[0])
        .slice((ROUTE_BASE + '/template-asset/').length)
      const parts = rest.split('/')
      const id = String(parts[0] || '')
      const name = String(parts[1] || '')
      if (!TEMPLATE_ID_RE.test(id) || !AUDIO_FILE_RE.test(name) || name.includes('..')) {
        res.writeHead(404); res.end(); return
      }
      const roots = [
        path.join(USER_TPL_ROOT, id, 'assets'),
        path.join(PACKAGE_ROOT, 'templates', id, 'assets')
      ]
      let bytes = null
      for (const root of roots) {
        try { bytes = fs.readFileSync(path.join(root, name)); break } catch (err) { /* 换下一处 */ }
      }
      if (!bytes) { res.writeHead(404); res.end(); return }
      const type = /\.mp3$/i.test(name) ? 'audio/mpeg'
        : /\.wav$/i.test(name) ? 'audio/wav'
        : /\.(ogg|oga)$/i.test(name) ? 'audio/ogg'
        : /\.(m4a|aac)$/i.test(name) ? 'audio/mp4'
        : /\.png$/i.test(name) ? 'image/png'
        : /\.jpe?g$/i.test(name) ? 'image/jpeg'
        : /\.webp$/i.test(name) ? 'image/webp'
        : /\.gif$/i.test(name) ? 'image/gif'
        : /\.mp4$/i.test(name) ? 'video/mp4'
        : /\.webm$/i.test(name) ? 'video/webm'
        : /\.svg$/i.test(name) ? 'image/svg+xml'
        : /\.json$/i.test(name) ? 'application/json; charset=utf-8'
        : 'application/octet-stream'
      const rangeHeader = req.headers && req.headers.range
      if (rangeHeader && /\.(mp4|webm)$/i.test(name)) {
        const rm = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader))
        if (rm) {
          let start = rm[1] ? parseInt(rm[1], 10) : 0
          let end = rm[2] ? parseInt(rm[2], 10) : bytes.length - 1
          if (start >= bytes.length) { res.writeHead(416, { 'Content-Range': 'bytes */' + bytes.length }); res.end(); return }
          if (end >= bytes.length) end = bytes.length - 1
          if (end < start) { res.writeHead(416, { 'Content-Range': 'bytes */' + bytes.length }); res.end(); return }
          const chunk = bytes.slice(start, end + 1)
          res.writeHead(206, {
            'Content-Type': type,
            'Accept-Ranges': 'bytes',
            'Content-Range': 'bytes ' + start + '-' + end + '/' + bytes.length,
            'Content-Length': String(chunk.length),
            'Cache-Control': 'public, max-age=86400'
          })
          res.end(chunk)
          return
        }
      }
      res.writeHead(200, {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
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
        const cfgNow = readConfig()
        /* 顺带把当前模板的整份数据带上：设置页「立即预览」要先换掉运行时手里的模板再重播 */
        sendJson(res, 200, {
          ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS, file: CONFIG_FILE,
          template: readTemplate(cfgNow.template),
          template2: readTemplate(cfgNow.act2)
        })
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
  /** 模板查找顺序：插件自带 templates/ → 用户目录 ~/.dsh/startup-templates/。 */
  const TEMPLATE_ROOTS = [
    path.join(PACKAGE_ROOT, 'templates'),
    path.join(DSH_HOME, 'startup-templates')
  ]
  const TEMPLATE_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/

  function readTemplate(id) {
    if (!id || !TEMPLATE_ID_RE.test(String(id))) return null
    try { if ((readConfig().hiddenTemplates || []).includes(String(id))) return null } catch (err) { /* 配置读不到就不隐藏 */ }
    /* 倒序扫：用户目录优先，同名模板覆盖内置（否则在编辑器里改完保存了也看不到） */
    for (let i = TEMPLATE_ROOTS.length - 1; i >= 0; i--) {
      const root = TEMPLATE_ROOTS[i]
      try {
        const file = path.join(root, String(id), 'template.json')
        const st = fs.statSync(file)
        if (!st.isFile()) continue
        if (st.size > 16 * 1024 * 1024) {
          diag('模板 ' + id + ' 超过 2MB（' + Math.round(st.size / 1024) + 'KB），已跳过')
          continue
        }
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
        parsed.id = String(id)
        parsed.__file = file.replace(/\\/g, '/')
        return parsed
      } catch (err) { /* 这个目录没有，试下一个 */ }
    }
    return null
  }

  /* ── 模板编辑器 ────────────────────────────────────────────────────────
     编辑器是插件自带的一个静态页（tools/editor.html），由宿主路由发出去；
     保存时写进 ~/.dsh/startup-templates/<id>/template.json —— 不用另起服务，
     也不用用户自己去翻文件夹。预览走「草稿」：编辑器把改到一半的模板 POST
     上来，iframe 按 id 取走渲染，这样每次改参数都能立刻看效果。 */
  const USER_TPL_ROOT = path.join(DSH_HOME, 'startup-templates')
  const EDITOR_FILE = path.join(PACKAGE_ROOT, 'tools', 'editor.html')
  const readEditorHtml = makeReader(path.join('tools', 'editor.html'))
  const drafts = new Map()

  /** 校验一份模板能不能落盘：id 合法 + 体积上限 + 分幕数上限。 */
  function sanitizeTemplate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const id = String(raw.id || '').trim()
    if (!TEMPLATE_ID_RE.test(id)) return null
    let json = ''
    try { json = JSON.stringify(raw) } catch (err) { return null }
    if (json.length > 16 * 1024 * 1024) return null
    const out = JSON.parse(json)
    out.id = id
    if (Array.isArray(out.steps)) out.steps = out.steps.slice(0, 24)
    return out
  }

  function previewHtml(tpl, jump, edit) {
    const safe = safeJson(tpl)
    const editJs = edit ? 'window.__DSH_STARTUP_EDIT__=1;' : ''
    const jumpJs = (jump && typeof jump.start === 'number')
      ? 'window.__DSH_STARTUP_JUMP__=' + safeJson({
          start: Math.max(0, Math.min(23, jump.start | 0)),
          count: (typeof jump.count === 'number' && jump.count > 0) ? Math.min(24, jump.count | 0) : undefined
        }) + ';'
      : ''
    const jumpTag = (jump && typeof jump.start === 'number')
      ? ('jump:' + jump.start + ':' + (jump.count === undefined ? '-' : jump.count))
      : 'jump:-'
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<title>' + jumpTag + '</title>' +
      '<link rel="stylesheet" href="' + ROUTE_BASE + '/splash.css">' +
      '<style>html.dsu-lock,html.dsu-lock body{overflow:hidden!important}' +
      '#dsh-startup-root.dsu-boot{position:fixed;inset:0;z-index:2147483000;background:#000}' +
      '.dsu-skip,.dsu-hint{display:none!important}body{margin:0}</style></head><body>' +
      '<div id="dsh-startup-root" class="dsu-root dsu-boot"></div>' +
      '<script>window.__DSH_STARTUP__=' + safeJson({ enabled: true, mode: 'always', theme: 'light', speed: 1, requireInteraction: false, allowSkip: false, sound: false, voice: false, identity: 'JOYCE MOORE', identityId: '0087', accessLevel: '3', accent: '#ff7500', glitchA: '#ff3b30', glitchB: '#2971b8' }) + ';' +
      'window.__DSH_STARTUP_TEMPLATE__=' + safe + ';' + jumpJs + editJs + '</script>' +
      '<script src="' + ROUTE_BASE + '/splash.js"></script></body></html>'
  }

  /* 一键诊断：把环境信息写到桌面，让不会用 AI 的用户也能一键求助 */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/diagnose',
    handler: async (req, res) => {
      try {
        const lines = []
        const add = (s2) => lines.push(s2 == null ? '' : String(s2))
        const now = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds())
        add('dsh-boot-suite 诊断报告')
        add('生成时间：' + now.toLocaleString())
        add('插件版本：' + PLUGIN_VERSION)
        add('DSH_HOME：' + DSH_HOME)
        add('配置路径：' + CONFIG_FILE)
        add('操作系统：' + os.platform() + ' ' + os.release() + ' / ' + os.arch())
        add('Node：' + process.version)
        add('')
        add('=== 当前配置 ===')
        try { add(JSON.stringify(readConfig(), null, 2)) } catch (e) { add('读取失败：' + String(e && e.message)) }
        add('')
        add('=== 内置模板 ===')
        for (const root2 of TEMPLATE_ROOTS) {
          try {
            for (const name of fs.readdirSync(path.join(root2))) {
              if (!TEMPLATE_ID_RE.test(name)) continue
              const jf = path.join(root2, name, 'template.json')
              if (fs.existsSync(jf)) add('- ' + name + '  (' + root2 + ')')
            }
          } catch (e) { /* 跳过不存在的目录 */ }
        }
        add('')
        add('=== profile 安装状态 ===')
        const profilesRoot = path.join(DSH_HOME, 'profiles')
        try {
          for (const prof of fs.readdirSync(profilesRoot)) {
            const pj = path.join(profilesRoot, prof, 'package.json')
            add('[profile] ' + prof)
            if (fs.existsSync(pj)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pj, 'utf8'))
                const deps = pkg && pkg.dependencies ? Object.keys(pkg.dependencies) : []
                add('  插件依赖：' + (deps.filter((x) => x.indexOf('dsh-boot-suite') >= 0 || x.indexOf('dsh-startup-screen') >= 0 || x.indexOf('dsh-chat-wallpaper') >= 0).join(', ') || '(无)'))
                const bundles = pkg && pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles ? pkg.dsh.profile.bundles : []
                add('  bundles：' + (Array.isArray(bundles) ? bundles.join(', ') : '(无)'))
              } catch (e) { add('  package.json 解析失败：' + String(e && e.message)) }
            } else { add('  (没有 package.json)') }
            const nm = path.join(profilesRoot, prof, 'node_modules')
            try {
              const entries = fs.readdirSync(nm).filter((x) => x.indexOf('dsh-boot-suite') >= 0 || x.indexOf('dsh-startup-screen') >= 0 || x.indexOf('dsh-chat-wallpaper') >= 0)
              for (const name of entries) {
                let link = ''
                try { link = fs.lstatSync(path.join(nm, name)).isSymbolicLink() ? ' (符号链接)' : '' } catch (e) {}
                add('  node_modules/' + name + link)
              }
            } catch (e) { /* 无 node_modules */ }
          }
        } catch (e) { add('读取 profiles 失败：' + String(e && e.message)) }
        add('')
        add('=== 最近诊断日志（boot-suite-diag.log 末尾） ===')
        try {
          const log = fs.readFileSync(DIAG_FILE, 'utf8').split(String.fromCharCode(10))
          add(log.slice(-120).join(String.fromCharCode(10)))
        } catch (e) { add('(没有日志文件)') }
        add('')
        add('=== 如果动画没有出现，请检查 ===')
        add('1) 是否装过旧版 dsh-startup-screen / dsh-chat-wallpaper')
        add('2) 安装前是否完全退出 DSH（窗口 + 托盘）')
        add('3) 设置 →「启动动画」第一幕/第二幕是否选中了不存在的模板')
        add('4) 可运行安装目录里的 诊断.cmd 生成更完整的环境报告')

        const desktop = (() => {
          const candidates = [
            process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : '',
            path.join(os.homedir(), 'Desktop'),
            path.join(os.homedir(), 'OneDrive', 'Desktop')
          ]
          for (const c of candidates) { if (c && fs.existsSync(c)) return c }
          return os.homedir()
        })()
        const fileName = stamp + 'dsh-boot-suite 诊断报告，请发送给原作者寻求帮助.txt'
        const file = path.join(desktop, fileName)
        fs.writeFileSync(file, String.fromCharCode(0xFEFF) + lines.join(String.fromCharCode(10)), 'utf8')
        sendJson(res, 200, { ok: true, file, desktop })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  /* ── 模板商店（不建服务器：客户端拉 GitHub raw 的 index.json）────────────────
     拉取放在宿主侧做，一是避开浏览器 CORS，二是能把体积/超时/路径都卡死。 */
  const STORE_INDEX_URL = process.env.DSH_STORE_URL ||
    'https://raw.githubusercontent.com/LeeRolling/dsh-boot-suite-templates/main/index.json'
  const STORE_RAW_BASE = STORE_INDEX_URL.replace(/\/[^/]*$/, '')
  const STORE_TTL_MS = 5 * 60 * 1000
  let storeCache = { at: 0, data: null }

  function fetchText(url, timeoutMs) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000)
    return fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'dsh-boot-suite' } })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text() })
      .finally(() => clearTimeout(timer))
  }

  /* ── 检查更新：读 GitHub 的 latest release（宿主侧拉，避开 CORS）────────── */
  const UPDATE_URL = 'https://api.github.com/repos/LeeRolling/dsh-boot-suite/releases/latest'
  let updateCache = { at: 0, data: null }

  function versionParts(v) {
    return String(v || '').replace(/^v/i, '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0)
  }

  function compareVersions(a, b) {
    const pa = versionParts(a), pb = versionParts(b)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0)
      if (d) return d
    }
    return 0
  }

  async function readLatestRelease(force) {
    const now = Date.now()
    if (!force && updateCache.data && now - updateCache.at < 10 * 60 * 1000) return updateCache.data
    const text = await fetchText(UPDATE_URL, 10000)
    if (text.length > 256 * 1024) throw new Error('响应过大')
    const data = JSON.parse(text)
    const out = {
      latest: String(data.tag_name || '').replace(/^v/i, ''),
      url: String(data.html_url || ''),
      publishedAt: String(data.published_at || ''),
      size: 0,
      digest: ''
    }
    /* 记住正式资产的大小/摘要，下载时按 size 精确校验，截断包当场拒绝 */
    try {
      const assets = Array.isArray(data.assets) ? data.assets : []
      const wanted = 'dsh-boot-suite-win-V' + out.latest + '.zip'
      const hit = assets.find((a) => a && a.name === wanted) || assets.find((a) => a && /-V[0-9].*\.zip$/i.test(String(a.name || '')))
      if (hit) { out.size = Number(hit.size) || 0; out.digest = String(hit.digest || '') }
    } catch (e) { /* 资产列表异常不影响版本判断 */ }
    updateCache = { at: now, data: out }
    return out
  }

  function fetchBinary(url, timeoutMs) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000)
    return fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'dsh-boot-suite' } })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer() })
      .then((ab) => Buffer.from(ab))
      .finally(() => clearTimeout(timer))
  }

  /* zip 完整性校验：PK 头 + 尾部中央目录结束记录（EOCD），发布资产有 size 时再精确比对。
     v2.13.1 的教训：镜像/浏览器下载截断的“半包 zip”头两个字节仍是 PK，
     旧逻辑只看这个，结果 `Expand-Archive` 报“找不到中央目录结尾记录”。 */
  function zipComplete(buf, expectSize) {
    if (!Buffer.isBuffer(buf) || buf.length < 1024 * 1024) return false
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) return false
    if (expectSize && buf.length !== expectSize) return false
    const floor = Math.max(0, buf.length - 65557)
    for (let i = buf.length - 22; i >= floor; i--) {
      if (buf[i] !== 0x50 || buf[i + 1] !== 0x4b || buf[i + 2] !== 0x05 || buf[i + 3] !== 0x06) continue
      const cdSize = buf.readUInt32LE(i + 12)
      const cdOffset = buf.readUInt32LE(i + 16)
      if (cdOffset !== 0xffffffff && cdSize !== 0xffffffff && cdOffset + cdSize > i) continue
      const commentLen = buf.readUInt16LE(i + 20)
      if (i + 22 + commentLen <= buf.length) return true
    }
    return false
  }

  /** 只接受 index 里那种相对路径；带协议、带 ..、带反斜杠的一律拒绝。 */
  function safeStorePath(p) {
    const s = String(p || '').replace(/\\/g, '/').replace(/^\/+/, '')
    if (!s || s.length > 200) return null
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null
    if (s.split('/').some((seg) => seg === '..' || seg === '')) return null
    if (!/^[a-zA-Z0-9._/-]+$/.test(s)) return null
    return s
  }

  function normalizeStoreIndex(parsed) {
    const list = Array.isArray(parsed && parsed.templates) ? parsed.templates : []
    const out = []
    for (const it of list) {
      if (!it || typeof it !== 'object') continue
      const id = String(it.id || '')
      if (!TEMPLATE_ID_RE.test(id)) continue
      const p = safeStorePath(it.path || ('templates/' + id))
      if (!p) continue
      out.push({
        id,
        path: p,
        name: String(it.name || id).slice(0, 40),
        author: String(it.author || '').slice(0, 40),
        adaptedBy: String(it.adaptedBy || '').slice(0, 40),
        basedOn: String(it.basedOn || '').slice(0, 40),
        description: String(it.description || '').slice(0, 140),
        tags: Array.isArray(it.tags) ? it.tags.slice(0, 6).map((t) => String(t).slice(0, 20)) : [],
        preview: STORE_RAW_BASE + '/' + p + '/preview.gif',
        image: STORE_RAW_BASE + '/' + p + '/preview.png'
      })
    }
    return out
  }

  async function readStore(force) {
    const now = Date.now()
    if (!force && storeCache.data && now - storeCache.at < STORE_TTL_MS) return storeCache.data
    const text = await fetchText(STORE_INDEX_URL, 8000)
    if (text.length > 256 * 1024) throw new Error('index.json 太大了（>256KB）')
    const list = normalizeStoreIndex(JSON.parse(text))
    storeCache = { at: now, data: list }
    return list
  }

  /** 列出两处目录里所有可用模板（同 id 以用户目录为准）。 */
  function listTemplates() {
    const out = []
    const seen = new Set()
    for (let i = TEMPLATE_ROOTS.length - 1; i >= 0; i--) {
      const root = TEMPLATE_ROOTS[i]
      let entries = []
      try { entries = fs.readdirSync(root, { withFileTypes: true }) } catch (err) { continue }
      for (const d of entries) {
        if (!d.isDirectory() || !TEMPLATE_ID_RE.test(d.name) || seen.has(d.name)) continue
        const t = readTemplate(d.name)
        if (!t) continue
        seen.add(d.name)
        out.push({
          id: d.name,
          name: String(t.name || d.name).slice(0, 40),
          author: String(t.author || '').slice(0, 40),
          description: String(t.description || '').slice(0, 140),
          source: i === TEMPLATE_ROOTS.length - 1 ? 'user' : 'builtin'
        })
      }
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return out
  }

  function indexInjectionRows() {
    const cfg = readConfig()
    const rows = [
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
    /* 选中的模板以纯数据形式下发（global 行）：运行时只读它，不执行任何代码。
       放在 __DSH_STARTUP__ 之后，保证运行时能同时拿到配置与模板。 */
    const tpl = readTemplate(cfg.template)
    let at = 5
    if (tpl) { rows.splice(at, 0, { kind: 'global', name: '__DSH_STARTUP_TEMPLATE__', value: tpl }); at += 1 }
    const tpl2 = readTemplate(cfg.act2)
    if (tpl2) rows.splice(at, 0, { kind: 'global', name: '__DSH_STARTUP_TEMPLATE2__', value: tpl2 })
    return rows
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

  /* 可用模板列表：设置页的「模板」下拉框用 */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/templates',
    handler: (req, res) => {
      try {
        const cfgNow = readConfig()
        sendJson(res, 200, { ok: true, active: cfgNow.template || '', templates: listTemplates(), hidden: cfgNow.hiddenTemplates || [] })
      }
      catch (err) { sendJson(res, 500, { ok: false, error: String((err && err.message) || err) }) }
    }
  }))

  /* 编辑器读某一份模板（内置或本地都行），返回整份 JSON */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/preview-template',
    handler: (req, res) => {
      const m = /[?&]id=([a-z0-9-]+)/i.exec(String(req.url || ''))
      const tpl = m ? readTemplate(m[1]) : null
      if (!tpl) { sendJson(res, 404, { ok: false, error: 'not found' }); return }
      sendJson(res, 200, { ok: true, template: tpl })
    }
  }))

  /* ── 编辑器与模板读写 ─────────────────────────────────────────────────── */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/editor',
    handler: (req, res) => sendText(res, 'text/html; charset=utf-8', readEditorHtml())
  }))

  /* 身份卡独立页面：任何模板都能用 iframe 引，也可以单独打开看 */
  const IDCARD_HTML = "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">\n<title>身份卡</title>\n<style>\n:root { --acc:#5cc8ff; --bg:#060a10; --ink:#e8f4ff; --soft:#a9c4da; --hair:rgba(140,200,255,.22); }\n* { box-sizing:border-box }\nbody { margin:0; background:transparent; font:13px/1.5 \"Segoe UI\",system-ui,sans-serif; color:var(--ink) }\n.card { position:relative; width:420px; padding:18px 20px 14px; border:1px solid var(--hair); border-radius:10px;\n  background:linear-gradient(160deg, rgba(12,22,34,.92), rgba(6,10,16,.96)); overflow:hidden;\n  box-shadow:0 24px 60px rgba(0,0,0,.55) }\n.card::before { content:\"\"; position:absolute; inset:0; background:repeating-linear-gradient(180deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px); pointer-events:none }\n.hd { display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--hair); padding-bottom:10px }\n.hd b { font-weight:600; letter-spacing:.16em; font-size:12px }\n.hd .seal { width:26px; height:26px; border:1px solid var(--acc); border-radius:50%; position:relative }\n.hd .seal::after { content:\"\"; position:absolute; inset:5px; border-radius:50%; background:var(--acc); opacity:.65 }\n.hd .st { margin-left:auto; font-size:10px; letter-spacing:.2em; color:var(--acc) }\n.name { margin:14px 0 2px; font-size:26px; letter-spacing:.06em; font-weight:600 }\n.code { font:12px/1.4 Consolas,monospace; color:var(--soft); letter-spacing:.18em }\n.grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 16px; margin:14px 0 12px }\n.kv { border-left:2px solid rgba(92,200,255,.35); padding-left:8px }\n.kv span { display:block; font-size:10px; letter-spacing:.18em; color:var(--soft); text-transform:uppercase }\n.kv b { font-weight:500; font-size:13px }\n.ft { display:flex; align-items:center; gap:10px; border-top:1px solid var(--hair); padding-top:10px; font-size:11px; color:var(--soft); letter-spacing:.1em }\n.scan { position:absolute; left:0; right:0; height:2px; background:linear-gradient(90deg, transparent, var(--acc), transparent); opacity:.5;\n  animation:scan 3.2s linear infinite }\n@keyframes scan { 0% { top:-2px } 100% { top:100% } }\n.lock { margin-left:auto; color:var(--acc) }\n</style></head><body>\n<div class=\"card\">\n  <div class=\"scan\"></div>\n  <div class=\"hd\"><div class=\"seal\"></div><b id=\"unit\">DSH // 身份核验终端</b><span class=\"st\" id=\"st\">VERIFIED</span></div>\n  <div class=\"name\" id=\"name\">李·滚动</div>\n  <div class=\"code\" id=\"code\">DSH-00-000000</div>\n  <div class=\"grid\">\n    <div class=\"kv\"><span>等级</span><b id=\"level\">LEVEL 3</b></div>\n    <div class=\"kv\"><span>签发机关</span><b id=\"issuer\">DeepSeek Harness</b></div>\n    <div class=\"kv\"><span>有效期</span><b id=\"validity\">长期有效</b></div>\n    <div class=\"kv\"><span>权限范围</span><b id=\"scope\">LOCAL / MACHINE</b></div>\n  </div>\n  <div class=\"ft\"><span id=\"bio\">指纹 · 虹膜 · 声纹 已核</span><span class=\"lock\" id=\"lock\">ACCESS GRANTED</span></div>\n</div>\n<script>\n(function(){\n  var q = new URLSearchParams(location.search);\n  function set(id, key, def){ var el=document.getElementById(id); var v=q.get(key); if(v) el.textContent=v; else if(def) el.textContent=def }\n  set('name','name'); set('code','code'); set('unit','unit'); set('level','level');\n  set('issuer','issuer'); set('validity','validity'); set('scope','scope'); set('bio','bio'); set('lock','lock'); set('st','status');\n  var acc=q.get('color'); if(acc) document.documentElement.style.setProperty('--acc', acc);\n  var w=q.get('w'); if(w) document.querySelector('.card').style.width=w+'px';\n})();\n</script></body></html>"
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/idcard',
    handler: (req, res) => sendText(res, 'text/html; charset=utf-8', IDCARD_HTML)
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/editor/draft',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false }); return }
      const text = await readBody(req, 16 * 1024 * 1024)
      let body = null
      try { body = JSON.parse(text) } catch (err) { sendJson(res, 400, { ok: false, error: 'invalid json' }); return }
      const tpl = sanitizeTemplate(body && body.template ? body.template : body)
      if (!tpl) { sendJson(res, 400, { ok: false, error: 'template invalid' }); return }
      const id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      /* start/count 跟着草稿一起存：比塞 URL 查询串可靠（不依赖路由怎么解析查询） */
      const start = Number.isInteger(body && body.start) ? body.start : null
      const count = Number.isInteger(body && body.count) && body.count > 0 ? body.count : null
      drafts.set(id, { template: tpl, start, count })
      while (drafts.size > 20) drafts.delete(drafts.keys().next().value)
      sendJson(res, 200, { ok: true, id })
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/editor/preview',
    handler: (req, res) => {
      const q = String(req.url || '')
      const m = /[?&]id=([a-z0-9]+)/i.exec(q)
      const record = m ? drafts.get(m[1]) : null
      const tpl = sanitizeTemplate(record && record.template) || readTemplate('archive-warm')
      /* 草稿里带的跳转参数优先；没有再看查询串（兼容老链接） */
      const ms = /[?&]start=(\d+)/i.exec(q)
      const mc = /[?&]count=(\d+)/i.exec(q)
      let jump = null
      if (record && Number.isInteger(record.start)) jump = { start: record.start, count: record.count === null ? undefined : record.count }
      else if (ms) jump = { start: parseInt(ms[1], 10), count: mc ? parseInt(mc[1], 10) : undefined }
      const edit = /[?&]edit=1/.test(q)
      sendText(res, 'text/html; charset=utf-8', previewHtml(tpl, jump, edit))
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/templates/save',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false }); return }
      const text = await readBody(req, 16 * 1024 * 1024)
      let body = null
      try { body = JSON.parse(text) } catch (err) { sendJson(res, 400, { ok: false, error: 'invalid json' }); return }
      const tpl = sanitizeTemplate(body && body.template ? body.template : body)
      if (!tpl) { sendJson(res, 400, { ok: false, error: '模板不合法（id 只能小写字母/数字/连字符，或体积过大）' }); return }
      try {
        const dir = path.join(USER_TPL_ROOT, tpl.id)
        fs.mkdirSync(dir, { recursive: true })
        const file = path.join(dir, 'template.json')
        /* 覆盖前自动备份：backups/template-YYYYMMDD-HHmmss.json，保留最近 30 份 */
        try {
          if (fs.existsSync(file)) {
            const bdir = path.join(dir, 'backups')
            fs.mkdirSync(bdir, { recursive: true })
            const st2 = fs.statSync(file)
            const d2 = new Date(st2.mtimeMs || Date.now())
            const pad = (n) => String(n).padStart(2, '0')
            const stamp = d2.getFullYear() + pad(d2.getMonth() + 1) + pad(d2.getDate()) + '-' + pad(d2.getHours()) + pad(d2.getMinutes()) + pad(d2.getSeconds())
            fs.copyFileSync(file, path.join(bdir, 'template-' + stamp + '.json'))
            const olds = fs.readdirSync(bdir).filter(f => f.startsWith('template-')).sort()
            while (olds.length > 30) { try { fs.unlinkSync(path.join(bdir, olds.shift())) } catch (eB) {} }
          }
        } catch (eBk) { diag('模板备份失败：' + String((eBk && eBk.message) || eBk)) }
        fs.writeFileSync(file, JSON.stringify(tpl, null, 2) + '\n', 'utf8')
        sendJson(res, 200, { ok: true, id: tpl.id, file: file.replace(/\\/g, '/') })
      } catch (err) { sendJson(res, 500, { ok: false, error: String((err && err.message) || err) }) }
    }
  }))

  /* 音频导入：把用户选的音频文件写进模板 assets 目录（用户目录优先） */
  const AUDIO_UPLOAD_RE = /^[a-z0-9][a-z0-9._-]{0,40}\.(mp3|wav|ogg|m4a|aac)$/i
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/template-assets/upload',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false }); return }
      let body = null
      try {
        const text = await readBody(req, 30 * 1024 * 1024)
        body = JSON.parse(text)
      } catch (err) { sendJson(res, 413, { ok: false, error: '文件过大或不是合法 JSON' }); return }
      const id = String((body && body.id) || '')
      const name = String((body && body.name) || '').toLowerCase()
      const data = String((body && body.data) || '')
      if (!TEMPLATE_ID_RE.test(id) || !AUDIO_UPLOAD_RE.test(name)) {
        sendJson(res, 400, { ok: false, error: 'id 或文件名不合法（文件名只能小写英文/数字/._-）' }); return
      }
      try {
        const dir = path.join(USER_TPL_ROOT, id, 'assets')
        fs.mkdirSync(dir, { recursive: true })
        const bytes = Buffer.from(data, 'base64')
        if (!bytes.length || bytes.length > 20 * 1024 * 1024) { sendJson(res, 413, { ok: false, error: '音频为空或超过 20MB' }); return }
        const file = path.join(dir, name)
        fs.writeFileSync(file, bytes)
        sendJson(res, 200, { ok: true, id: id, name: name, file: file.replace(/\\/g, '/'), size: bytes.length })
      } catch (err) { sendJson(res, 500, { ok: false, error: String((err && err.message) || err) }) }
    }
  }))

  /* 导入自定义动画（v2.12.0）：用户选一个视频 / 动图 / 图片，宿主自动生成一个本地模板，
     文件写进 ~/.dsh/startup-templates/<id>/assets/，template.json 由这里生成 ——
     用户不用手写 JSON，也不碰安装目录；导入后第一幕/第二幕下拉里都能选。 */
  const IMPORT_ANIM_RE = /\.(mp4|webm|gif|png|jpe?g|webp)$/i
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/import-animation',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false }); return }
      let u = null
      try { u = new URL(String(req.url || ''), 'http://localhost') } catch (eU) { sendJson(res, 400, { ok: false, error: 'bad url' }); return }
      const rawName = String(u.searchParams.get('name') || '').trim().slice(0, 120)
      const extMatch = rawName.match(IMPORT_ANIM_RE)
      if (!extMatch) { sendJson(res, 400, { ok: false, error: '只支持 mp4 / webm / gif / png / jpg / webp' }); return }
      const kind = /^\.(mp4|webm)$/i.test(extMatch[0]) ? 'video' : 'image'
      const bytes = await readRawBody(req, 64 * 1024 * 1024)
      if (!bytes || !bytes.length) { sendJson(res, 413, { ok: false, error: '文件为空或超过 64MB' }); return }
      const durRaw = Number(u.searchParams.get('duration'))
      const duration = Math.max(1000, Math.min(60000, Number.isFinite(durRaw) && durRaw > 0 ? Math.round(durRaw) : 6000))
      const wRaw = Number(u.searchParams.get('width'))
      const hRaw = Number(u.searchParams.get('height'))
      const stamp = Date.now().toString(36)
      let id = 'custom-' + stamp
      let seq = 2
      while (fs.existsSync(path.join(USER_TPL_ROOT, id)) && seq < 50) { id = 'custom-' + stamp + '-' + (seq++); }
      if (!TEMPLATE_ID_RE.test(id)) { sendJson(res, 500, { ok: false, error: '生成的模板 id 不合法' }); return }
      const safeFile = 'import-' + stamp + (/^\.jpe?g$/i.test(extMatch[0]) ? '.jpg' : extMatch[0].toLowerCase())
      const dir = path.join(USER_TPL_ROOT, id)
      try {
        fs.mkdirSync(path.join(dir, 'assets'), { recursive: true })
        fs.writeFileSync(path.join(dir, 'assets', safeFile), bytes)
        const display = rawName.replace(/[\\/]/g, '').replace(/\.[a-z0-9]+$/i, '').trim().slice(0, 40) || '自定义动画'
        const bgLayer = { id: 'bg', type: 'panel', pos: [640, 360], panelW: 1280, panelH: 720, fill: '#000000', radius: 0, keyframes: [{ t: 0, opacity: 1 }] }
        let mediaLayer = null
        if (kind === 'video') {
          mediaLayer = { id: 'media', type: 'video', pos: [640, 360], videoW: 1280, videoH: 720, src: safeFile, keyframes: [{ t: 0, opacity: 1 }, { t: duration, opacity: 1 }] }
        } else {
          const iw = Number.isFinite(wRaw) && wRaw > 0 ? wRaw : 1280
          const ih = Number.isFinite(hRaw) && hRaw > 0 ? hRaw : 720
          const scale = Math.max(1280 / iw, 720 / ih, 1)
          mediaLayer = { id: 'media', type: 'image', pos: [640, 360], width: Math.round(iw * scale), height: Math.round(ih * scale), src: safeFile, keyframes: [{ t: 0, opacity: 1 }, { t: duration, opacity: 1 }] }
        }
        const tpl = {
          schemaVersion: 1,
          id: id,
          name: display,
          author: '用户导入',
          homepage: '',
          license: '',
          version: '1.0.0',
          description: '用户导入的自定义动画（仅本机，不上传）',
          tags: ['custom', kind],
          duration: duration,
          segments: [{ name: display, from: 0, to: duration }],
          layers: [bgLayer, mediaLayer],
          effects: []
        }
        fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(tpl, null, 2) + '\n', 'utf8')
        sendJson(res, 200, { ok: true, id: id, name: display, kind: kind, duration: duration, size: bytes.length, file: path.join(dir, 'assets', safeFile).replace(/\\/g, '/') })
      } catch (err) {
        try { fs.rmSync(dir, { recursive: true, force: true }) } catch (e2) { /* 忽略 */ }
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/templates/delete',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false }); return }
      const text = await readBody(req, 8 * 1024)
      let body = null
      try { body = JSON.parse(text) } catch (err) { body = null }
      const id = String((body && body.id) || '')
      if (!TEMPLATE_ID_RE.test(id)) { sendJson(res, 400, { ok: false, error: 'bad id' }); return }
      try {
        const cfgNow = readConfig()
        const hidden = Array.isArray(cfgNow.hiddenTemplates) ? cfgNow.hiddenTemplates : []
        const userDir = path.join(USER_TPL_ROOT, id)
        const builtinFile = path.join(PACKAGE_ROOT, 'templates', id, 'template.json')
        let removed = false
        let hid = false
        if (fs.existsSync(userDir)) {
          fs.rmSync(userDir, { recursive: true, force: true })
          removed = true
          if (hidden.includes(id)) writeConfig({ ...cfgNow, hiddenTemplates: hidden.filter((x) => x !== id) })
        } else if (fs.existsSync(builtinFile)) {
          if (!hidden.includes(id)) writeConfig({ ...cfgNow, hiddenTemplates: [...hidden, id] })
          hid = true
        } else {
          sendJson(res, 404, { ok: false, error: 'not found' }); return
        }
        /* 被删除/隐藏的模板如果正被引用，配置里切回默认，避免下次开机找不到 */
        const after = readConfig()
        const patch = {}
        if (String(after.template || '') === id) patch.template = ''
        if (String(after.act2 || '') === id) patch.act2 = ''
        if (Object.keys(patch).length) writeConfig({ ...after, ...patch })
        sendJson(res, 200, { ok: true, id: id, removed: removed, hidden: hid })
      } catch (err) { sendJson(res, 500, { ok: false, error: String((err && err.message) || err) }) }
    }
  }))

  /* 恢复被隐藏的内置模板：body {} 或 { all: true } = 全部恢复；{ id } = 恢复一个 */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/templates/unhide',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false }); return }
      const text = await readBody(req, 8 * 1024)
      let body = null
      try { body = JSON.parse(text) } catch (err) { body = null }
      try {
        const cfgNow = readConfig()
        const hidden = Array.isArray(cfgNow.hiddenTemplates) ? cfgNow.hiddenTemplates : []
        const id = String((body && body.id) || '')
        let next = []
        if (id) {
          if (!TEMPLATE_ID_RE.test(id)) { sendJson(res, 400, { ok: false, error: 'bad id' }); return }
          next = hidden.filter((x) => x !== id)
        } else {
          next = []
        }
        writeConfig({ ...cfgNow, hiddenTemplates: next })
        sendJson(res, 200, { ok: true, hidden: next })
      } catch (err) { sendJson(res, 500, { ok: false, error: String((err && err.message) || err) }) }
    }
  }))

  /* 商店列表：拉 index.json（带 5 分钟缓存；失败时把上次的列表一起返回） */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/store',
    handler: async (req, res) => {
      const force = /[?&]refresh=1/.test(String(req.url || ''))
      try {
        const list = await readStore(force)
        sendJson(res, 200, { ok: true, repo: STORE_RAW_BASE, count: list.length, templates: list })
      } catch (err) {
        sendJson(res, 200, {
          ok: false,
          repo: STORE_RAW_BASE,
          error: String((err && err.message) || err),
          templates: storeCache.data || []
        })
      }
    }
  }))

  /* 从商店安装：只从固定的 raw 地址取 template.json，校验后落到用户模板目录 */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/store/install',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false }); return }
      const text = await readBody(req, 8 * 1024)
      let body = null
      try { body = JSON.parse(text) } catch (err) { body = null }
      const id = String((body && body.id) || '')
      if (!TEMPLATE_ID_RE.test(id)) { sendJson(res, 400, { ok: false, error: 'bad id' }); return }
      try {
        const list = await readStore(false)
        const entry = list.find((x) => x.id === id)
        if (!entry) { sendJson(res, 404, { ok: false, error: '商店里没有这个模板：' + id }); return }
        const url = STORE_RAW_BASE + '/' + entry.path + '/template.json'
        const raw = await fetchText(url, 12000)
        if (raw.length > 96 * 1024) { sendJson(res, 400, { ok: false, error: '模板太大' }); return }
        let parsed = null
        try { parsed = JSON.parse(raw) } catch (err) { sendJson(res, 400, { ok: false, error: '模板不是合法 JSON' }); return }
        const tpl = sanitizeTemplate(parsed)
        if (!tpl) { sendJson(res, 400, { ok: false, error: '模板内容不合法' }); return }
        if (tpl.id !== id) { sendJson(res, 400, { ok: false, error: '模板 id 与索引不一致：' + tpl.id + ' vs ' + id }); return }
        const dir = path.join(USER_TPL_ROOT, id)
        fs.mkdirSync(dir, { recursive: true })
        const file = path.join(dir, 'template.json')
        fs.writeFileSync(file, JSON.stringify(tpl, null, 2) + '\n', 'utf8')
        /* 模板自带的配音/素材：一起拉下来，否则装完就没有声音 */
        const gotAssets = []
        const missingAssets = []
        if (tpl.assets && typeof tpl.assets === 'object') {
          const adir = path.join(dir, 'assets')
          let total = 0
          const keys = Object.keys(tpl.assets).slice(0, 24)
          for (const key of keys) {
            const name = path.basename(String(tpl.assets[key] || '').replace(/\\/g, '/'))
            if (!AUDIO_FILE_RE.test(name)) { missingAssets.push(name || key); continue }
            try {
              const buf = await fetchBinary(STORE_RAW_BASE + '/' + entry.path + '/assets/' + name, 12000)
              if (!buf || !buf.length || buf.length > 2 * 1024 * 1024) { missingAssets.push(name); continue }
              total += buf.length
              if (total > 12 * 1024 * 1024) { missingAssets.push(name); break }
              fs.mkdirSync(adir, { recursive: true })
              fs.writeFileSync(path.join(adir, name), buf)
              gotAssets.push(name)
            } catch (err) { missingAssets.push(name) }
          }
        }
        sendJson(res, 200, {
          ok: true, id,
          assets: gotAssets,
          missing: missingAssets,
          from: url.replace(/[^/]*$/, ''),
          file: file.replace(/\\/g, '/')
        })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  /* 检查更新：当前版本 vs GitHub 最新 release */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/update-check',
    handler: async (req, res) => {
      const force = /[?&]refresh=1/.test(String(req.url || ''))
      try {
        const rel = await readLatestRelease(force)
        const hasUpdate = !!rel.latest && compareVersions(rel.latest, PLUGIN_VERSION) > 0
        sendJson(res, 200, {
          ok: true,
          current: PLUGIN_VERSION,
          latest: rel.latest,
          hasUpdate,
          url: rel.url,
          publishedAt: rel.publishedAt
        })
      } catch (err) {
        sendJson(res, 200, { ok: false, current: PLUGIN_VERSION, error: String((err && err.message) || err) })
      }
    }
  }))

  let browserDownloadAt = 0

  /** 优先直接调 Chrome：Edge 可能把下载交给 IDM，导致文件不落地；Chrome 通常最稳 */
  function findChrome() {
    const cands = [
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
    ]
    for (const c of cands) { try { if (c && fs.existsSync(c)) return c } catch (e) {} }
    return null
  }

  /** 浏览器可能的下载目录（默认 Downloads + 桌面 + DSH 自己的下载目录） */
  function browserDownloadDirs() {
    const home = os.homedir()
    const out = [path.join(home, 'Downloads'), path.join(home, 'Desktop'), path.join(DSH_HOME, 'downloads')]
    return out
  }


  /* 自动更新（浏览器代理路线）：让系统默认浏览器去下载，插件只负责“接住”文件 */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/update-browser-download',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
      try {
        const rel = await readLatestRelease(false)
        if (!rel.latest) throw new Error('没有拿到最新版本号')
        const url = 'https://github.com/LeeRolling/dsh-boot-suite/releases/download/v' + rel.latest + '/dsh-boot-suite-win-V' + rel.latest + '.zip'
        browserDownloadAt = Date.now()
        const chrome = findChrome()
        if (chrome) {
          spawn(chrome, [url], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
          diag('update-browser-download opened with chrome v' + rel.latest)
          sendJson(res, 200, { ok: true, version: rel.latest, url, browser: 'chrome' })
        } else {
          spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
          diag('update-browser-download opened with default browser v' + rel.latest)
          sendJson(res, 200, { ok: true, version: rel.latest, url, browser: 'default' })
        }
      } catch (err) {
        sendJson(res, 200, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  /* 长轮询：等浏览器把 zip 下到 Downloads，然后复制到更新目录 */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/update-watch-download',
    handler: async (req, res) => {
      try {
        const u = new URL(String(req.url || ''), 'http://localhost')
        const version = String(u.searchParams.get('version') || '').replace(/^v/i, '')
        if (!/^[0-9][0-9A-Za-z.+-]{0,39}$/.test(version)) throw new Error('版本号不合法')
        const dirs = browserDownloadDirs()
        const since = (browserDownloadAt || Date.now()) - 120000
        const deadline = Date.now() + 600000
        diag('update-watch-download start dirs=' + dirs.join('|') + ' since=' + since)
        let found = null
        let bad = null
        while (Date.now() < deadline && !found) {
          for (const dir of dirs) {
            try {
              if (!fs.existsSync(dir)) continue
              for (const f of fs.readdirSync(dir)) {
                if (!/^dsh-boot-suite-win.*\.zip$/i.test(f)) continue
                const fp = path.join(dir, f)
                const st = fs.statSync(fp)
                if (!st.isFile() || st.size < 1024 * 1024) continue
                if (st.mtimeMs < since - 5000) continue
                await new Promise((r) => setTimeout(r, 700))
                const st2 = fs.statSync(fp)
                if (st2.size !== st.size || st2.size <= 1024 * 1024) continue
                const rawCandidate = fs.readFileSync(fp)
                if (zipComplete(rawCandidate)) { found = { file: fp, size: st2.size, name: f }; break }
                /* 大小不再变化但仍不是完整 zip：再等 20 秒（可能是浏览器还在收尾），仍坏就明确报错 */
                if (!bad || bad.file !== fp) bad = { file: fp, at: Date.now() }
                else if (Date.now() - bad.at > 20000) throw new Error('浏览器下载的安装包不完整（zip 校验失败），请重新点「立即更新」，或点「选择安装包」手动指定')
              }
            } catch (e1) {
              if (String((e1 && e1.message) || e1).indexOf('浏览器下载的安装包不完整') >= 0) throw e1
              /* 忽略单个目录/文件错误 */
            }
            if (found) break
          }
          if (!found) await new Promise((r) => setTimeout(r, 1500))
        }
        if (!found) { diag('update-watch-download timeout'); sendJson(res, 200, { ok: false, error: '等待浏览器下载超时（10 分钟）。建议用 Chrome 重新点「立即更新」，或点「选择安装包」手动指定。' }); return }
        const raw = fs.readFileSync(found.file)
        if (!zipComplete(raw)) throw new Error('浏览器下载的安装包不完整（zip 校验失败），请重新下载')
        const outDir = path.join(DSH_HOME, 'boot-suite-updates')
        fs.mkdirSync(outDir, { recursive: true })
        const out = path.join(outDir, version + '.zip')
        fs.writeFileSync(out, raw)
        diag('update-watch-download ok ' + found.name + ' ' + raw.length)
        sendJson(res, 200, { ok: true, version, file: out, size: raw.length, source: found.name })
      } catch (err) {
        diag('update-watch-download failed ' + String((err && err.message) || err))
        sendJson(res, 200, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  /* 自动更新：下载（下载到 ~/.dsh/boot-suite-updates/<版本>.zip，校验完整 zip + 官方资产大小） */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/update-download',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
      try {
        const rel = await readLatestRelease(false)
        if (!rel.latest) throw new Error('没有拿到最新版本号')
        const zipUrl = 'https://github.com/LeeRolling/dsh-boot-suite/releases/download/v' + rel.latest + '/dsh-boot-suite-win-V' + rel.latest + '.zip'
        /* 依次尝试：GitHub 直连 → 国内常用镜像 → PowerShell（系统代理） */
        /* 先镜像（国内常能直连），最后才直连 GitHub；每个只等 25 秒，失败就下一个，避免“没反应” */
        const tries = []
        for (const m of ['https://ghproxy.net/', 'https://gh-proxy.com/', 'https://ghfast.top/']) tries.push(m + zipUrl)
        tries.push(zipUrl)
        const expectSize = rel.size || 0
        let buf = null
        let lastErr = null
        for (let ti = 0; ti < tries.length && !buf; ti++) {
          try {
            const ab = await fetchBinary(tries[ti], 25000)
            const candidate = Buffer.from(ab)
            /* 坏包（半包/截断）当场丢弃，继续换下一个镜像 */
            if (!zipComplete(candidate, expectSize)) throw new Error('安装包不完整（zip 校验失败）')
            buf = candidate
          } catch (e1) {
            lastErr = e1
            diag('update-download try' + (ti + 1) + ' failed: ' + String((e1 && e1.message) || e1))
            await new Promise((r) => setTimeout(r, 300))
          }
        }
        if (!buf) {
          /* 兜底：Node 的 fetch 在部分网络下会卡住，改用 PowerShell 下载（同一台机器实测更快更稳） */
          const tmp = path.join(DSH_HOME, 'boot-suite-updates', 'download-' + Date.now() + '.zip')
          fs.mkdirSync(path.dirname(tmp), { recursive: true })
          const psCmd = 'Invoke-WebRequest -Uri ' + JSON.stringify(zipUrl) + ' -OutFile ' + JSON.stringify(tmp) + ' -UseBasicParsing'
          const code = await new Promise((resolve) => {
            let done = false
            const fin = (v) => { if (!done) { done = true; resolve(v) } }
            try {
              const c = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { windowsHide: true })
              c.on('close', (c2) => fin(typeof c2 === 'number' ? c2 : -1))
              c.on('error', () => fin(-1))
              setTimeout(() => { try { c.kill() } catch (e2) {} ; fin(-1) }, 600000)
            } catch (e3) { fin(-1) }
          })
          diag('update-download powershell exit=' + code)
          if (code === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 1024 * 1024) {
            const candidate = fs.readFileSync(tmp)
            try { fs.unlinkSync(tmp) } catch (e4) {}
            if (zipComplete(candidate, expectSize)) buf = candidate
            else throw new Error('下载的安装包不完整（zip 校验失败），请重试')
          } else {
            try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch (e5) {}
            throw new Error(lastErr ? ('下载失败：' + String((lastErr && lastErr.message) || lastErr)) : '下载失败（网络中断）。请稍后重试，或点「打开下载页」手动下载')
          }
        }
        if (!zipComplete(buf, expectSize)) throw new Error('下载的安装包不完整（zip 校验失败），请重试')
        const dir = path.join(DSH_HOME, 'boot-suite-updates')
        fs.mkdirSync(dir, { recursive: true })
        const file = path.join(dir, rel.latest + '.zip')
        fs.writeFileSync(file, buf)
        diag('update-download ok v' + rel.latest + ' ' + buf.length + ' bytes')
        sendJson(res, 200, { ok: true, version: rel.latest, file, size: buf.length })
      } catch (err) {
        diag('update-download failed ' + String((err && err.message) || err))
        sendJson(res, 200, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  /* 自动更新：用户用浏览器下载好安装包后，从设置页选文件上传过来（不依赖宿主联网） */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/update-upload',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
      try {
        const u = new URL(String(req.url || ''), 'http://localhost')
        const version = String(u.searchParams.get('version') || '').replace(/^v/i, '')
        if (!/^[0-9][0-9A-Za-z.+-]{0,39}$/.test(version)) throw new Error('版本号不合法')
        const raw = await readRawBody(req, 64 * 1024 * 1024)
        if (!raw || raw.length < 1024 * 1024) throw new Error('安装包过小或为空')
        if (!zipComplete(raw)) throw new Error('安装包不完整或已损坏（zip 校验失败），请重新下载')
        const dir = path.join(DSH_HOME, 'boot-suite-updates')
        fs.mkdirSync(dir, { recursive: true })
        const file = path.join(dir, version + '.zip')
        fs.writeFileSync(file, raw)
        diag('update-upload ok v' + version + ' ' + raw.length + ' bytes')
        sendJson(res, 200, { ok: true, version, file, size: raw.length })
      } catch (err) {
        diag('update-upload failed ' + String((err && err.message) || err))
        sendJson(res, 200, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  /* 自动更新：启动外部更新器（本进程不能替换自己，必须等 DSH 退出） */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/update-apply',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
      try {
        const rel = await readLatestRelease(false)
        const version = rel.latest
        const zip = path.join(DSH_HOME, 'boot-suite-updates', version + '.zip')
        if (!fs.existsSync(zip)) throw new Error('安装包不存在，请先下载')
        /* 启动更新器前再校验一次：坏包直接删掉并让用户重下，避免更新器先解压再报“找不到中央目录” */
        let zbuf = null
        try { zbuf = fs.readFileSync(zip) } catch (e0) { throw new Error('安装包读取失败：' + String((e0 && e0.message) || e0)) }
        if (!zipComplete(zbuf, rel.size || 0)) {
          try { fs.unlinkSync(zip) } catch (e1) {}
          diag('update-apply rejected corrupt zip size=' + zbuf.length)
          throw new Error('安装包不完整或已损坏（zip 校验失败，' + zbuf.length + ' 字节），已删除，请重新下载后再更新')
        }
        const exe = process.execPath
        const script = path.join(PACKAGE_ROOT, 'tools', 'update-apply.ps1')
        if (!fs.existsSync(script)) throw new Error('找不到更新脚本')
        const q = (s3) => "'" + String(s3).replace(/'/g, "''") + "'"
        const inner = '& ' + q(script) + ' -Zip ' + q(zip) + ' -Version ' + q(String(version)) + ' -Exe ' + q(exe) + ' -Config ' + q(CONFIG_FILE)
        const encoded = Buffer.from(inner, 'utf16le').toString('base64')
        const outDir = path.join(process.env.LOCALAPPDATA || DSH_HOME, 'dsh-boot-suite-update')
        fs.mkdirSync(outDir, { recursive: true })
        const cmdFile = path.join(outDir, 'run-update.cmd')
        const cmdText = '@echo off' + String.fromCharCode(13, 10) + 'powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ' + encoded + String.fromCharCode(13, 10)
        fs.writeFileSync(cmdFile, cmdText, 'ascii')
        const bootLog = path.join(DSH_HOME, 'boot-suite-updates', 'update-apply-bootstrap.log')
        fs.mkdirSync(path.dirname(bootLog), { recursive: true })
        const blog = (m) => { try { fs.appendFileSync(bootLog, new Date().toISOString() + '  ' + m + String.fromCharCode(10)) } catch (e) {} }
        blog('cmd file=' + cmdFile)
        const child = spawn(cmdFile, [], { shell: true, detached: true, stdio: 'ignore', windowsHide: false })
        child.on('error', (eC) => blog('launch error: ' + String((eC && eC.message) || eC)))
        child.unref()
        blog('launched pid=' + (child.pid || '?'))
        diag('update-apply launched updater window v' + version)
        sendJson(res, 200, { ok: true, version, started: true, manualClose: true })
      } catch (err) {
        diag('update-apply failed ' + String((err && err.message) || err))
        sendJson(res, 200, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

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
