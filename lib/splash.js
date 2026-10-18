/* ============================================================================
 * dsh-startup-screen — 启动动画运行时（浏览器端，零依赖）
 * ----------------------------------------------------------------------------
 * 由 Host 半侧注入到 index.html，在 React 应用挂载之前接管首屏：
 *
 *   第一幕  黑幕 + DeepSeek 鲸鱼标识／"深度求索"／"DEEPSEEK"（字距收紧 + 扫光）
 *   过场    过曝洗白（黑 → 灰 → 暖白底板），对应参考片的硬切洗白
 *   第二幕  暖白"技术档案"底板：左上品牌块左→右擦出、右下 POWERED BY、进度条
 *   序列    需要访问许可 → 身份资料确认 → 接收访问需求 → 读取完毕 → 验证通过
 *           → 欢迎 <身份名称> 访问；每步中文大字 + 英文等宽字幕 + 底部长句日志
 *   交互    第 1、2 步等待用户确认（按钮 / Enter / 空格 / 点击），可跳过
 *   终幕    WELCOME TO / [DEEPSEEK HARNESS] / 鲸鱼标识，青红色散故障后揭幕
 *
 * 配置来自 window.__DSH_STARTUP__（Host 侧注入），也可用
 * window.__DSH_STARTUP_API__.replay() 重播。
 * ========================================================================== */
(function () {
  'use strict'

  if (window.__DSH_STARTUP_LOADED__) return
  window.__DSH_STARTUP_LOADED__ = true

  var ROOT_ID = 'dsh-startup-root'

  /* ── DeepSeek 官方鲸鱼标识（取自 DSH 自带 favicon.svg 的路径数据）──────── */
  var WHALE_PATH =
    'M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 ' +
    '47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 ' +
    '12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 ' +
    '10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 ' +
    '7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 ' +
    '34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 ' +
    '16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 ' +
    '36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 ' +
    '20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 ' +
    '13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 ' +
    '26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 ' +
    '8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 ' +
    '14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 ' +
    '18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 ' +
    '38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 ' +
    '31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 ' +
    '40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 ' +
    '35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 ' +
    '21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 ' +
    '19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 ' +
    '49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 ' +
    '37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 ' +
    '34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 ' +
    '36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 ' +
    '37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 ' +
    '24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 ' +
    '19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 ' +
    '25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 ' +
    '28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 ' +
    '39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 ' +
    '23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 ' +
    '24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 ' +
    '24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 ' +
    '24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 ' +
    '28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 ' +
    '26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 ' +
    '23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 ' +
    '23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 ' +
    '22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 ' +
    '21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 ' +
    '24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 ' +
    '26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z'

  /* ── 默认配置（与 Host 侧 lib/index.js 的 DEFAULTS 保持一致）──────────── */
  var DEFAULTS = {
    enabled: true,
    mode: 'session',            // always | session | daily
    theme: 'light',             // light | dark
    speed: 1,
    requireInteraction: true,   // 第 1、2 步等待用户确认
    allowSkip: true,
    sound: true,                // 界面音效（WebAudio 合成，无音频文件）
    soundVolume: 0.5,
    voice: true,                // 女声播报
    voiceLang: 'en',            // en | zh | both
    voiceName: '',              // '' = 自动挑女声（见 FEMALE_HINTS）
    voiceRate: 0.88,            // 电影旁白档：比朗读慢，字与字之间才有重量
    voicePitch: 0.85,           // 压低音调，深沉的 AI 女声
    voiceVolume: 0.9,
    voiceCue: true,             // 念台词前的一声轻提示
    sfx: 'audio',               // audio=真素材（用户音频里抠的音效）/ synth=现场合成
    voiceSource: 'asset',       // asset=优先用真声素材 / tts=全部 TTS 合成
    voiceLead: 240,             // 提示音之后留一小段空白再开口
    identity: 'JOYCE MOORE',    // ← 设置页可改的"身份名称"
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

  /* ── 序列脚本：中文主字 + 英文等宽字幕 + 底部日志 ───────────────────────
     `say` 是专门给语音播报用的自然语句（照着参考片里女声念状态行的节奏，
     正好卡在各自文字出现的时间点上）。 */
  /* ── 序列脚本 ──────────────────────────────────────────────────────────
     文字与真声素材一一对应（来自你给的音频）：
       line-1.mp3 = V1 需要访问许可
       line-2.mp3 = V2 身份资料确认
       line-3.mp3 = V4 接收访问需求
       line-4.mp3 = V5 开始读取权限
       line-5.mp3 = V6 读取完毕 · 核验通过
     V3 是用户名字独白，按你的要求不用。
     `say` 是素材拿不到时的 TTS 兜底文本；`audio` 是素材文件名（不含扩展名）。 */
  /* ── 分幕数据（模板化）───────────────────────────────────────────────────
     分幕不再写死：优先用 window.__DSH_STARTUP_TEMPLATE__（宿主从
     ~/.dsh/startup-templates/<id>/template.json 或插件自带 templates/<id>/ 读出来的纯 JSON），
     没选模板就用下面这份内置默认。

     模板可以是**任意幕数**：1 ~ 24 幕都行，每一幕的文案、音频槽、按钮、
     停留时长、进度都是数据。最后一幕之后的「终幕欢迎」仍由引擎负责 ——
     它要用设置里的身份名称，属于运行时状态而不是模板内容。 */
  var BUILTIN_STEPS = [
    {
      zh: '需要访问许可',
      en: 'ACCESS PERMISSION REQUIRED',
      say: 'Access permission required.',
      audio: 'line-1',
      log: '等待用户授权…',
      logEn: 'AWAITING OPERATOR CONSENT',
      badge: 'AUTHORIZATION',
      action: 'grant',
      btnZh: '授予访问权限',
      btnEn: 'GRANT ACCESS',
      hold: 900,
      progress: 0.34
    },
    {
      zh: '身份资料确认',
      en: 'IDENTITY VERIFICATION',
      say: 'Identity verification.',
      audio: 'line-2',
      log: '核对身份资料…',
      logEn: 'MATCHING OPERATOR RECORD',
      badge: 'IDENTITY',
      action: 'confirm',
      btnZh: '确认身份',
      btnEn: 'CONFIRM IDENTITY',
      hold: 700,
      progress: 0.5
    },
    {
      zh: '接收访问需求',
      en: 'ACCESS REQUEST RECEIVED',
      say: 'Access request received.',
      audio: 'line-3',
      log: '接收访问需求，建立会话通道…',
      logEn: 'HANDSHAKE ESTABLISHED',
      badge: 'REQUEST',
      action: 'auto',
      hold: 1200,
      progress: 0.66,
      assembleLogo: true
    },
    {
      zh: '开始读取权限',
      en: 'PERMISSION READ STARTED',
      say: 'Beginning permission read.',
      audio: 'line-4',
      log: '开始读取权限，索引工作区与会话…',
      logEn: 'READING PERMISSION SET',
      badge: 'READ',
      action: 'auto',
      hold: 1200,
      progress: 0.8,
      hex: true
    },
    {
      zh: '读取完毕 · 核验通过',
      en: 'READ COMPLETE · VERIFIED',
      say: 'Read complete. Verification passed.',
      audio: 'line-5',
      log: '读取完毕，核验通过，权限已授予',
      logEn: 'PERMISSION AUTHORIZED',
      badge: 'VERIFY',
      action: 'auto',
      hold: 1600,
      progress: 0.93,
      reticle: true
    }
  ]

  var STEP_ACTIONS = { grant: 1, confirm: 1, auto: 1 }
  var AUDIO_SLOTS = { 'line-1': 1, 'line-2': 1, 'line-3': 1, 'line-4': 1, 'line-5': 1, 'line-6': 1 }

  /* 声音优先用「模板自带」的那份：模板 JSON 里写
       "assets": { "line-1": "assets/line-1.mp3", ... }
     就会去 /dsh-startup/template-asset/<模板id>/line-1.mp3 取；
     没有就回落全局 lib/assets/line-N.mp3（原来的行为）。
     这样不同模板可以有各自的配音，互不覆盖。 */
  function assetUrl(name) {
    var map = (TEMPLATE && TEMPLATE.assets) || null
    var file = (map && map[name]) ? String(map[name]).replace(/^.*\//, '') : ''
    if (file && /^[a-z0-9][a-z0-9._-]{0,40}\.(mp3|wav|ogg|m4a|aac)$/i.test(file) && TEMPLATE && TEMPLATE.id) {
      return '/dsh-startup/template-asset/' + encodeURIComponent(TEMPLATE.id) + '/' + file
    }
    return '/dsh-startup/asset/' + name + '.mp3'
  }
  var MAX_STEPS = 24

  function tplText(v, fallback, max) {
    var s = (v === undefined || v === null) ? '' : String(v).trim()
    if (!s) return fallback
    return s.slice(0, max)
  }

  function tplNum(v, fallback, lo, hi) {
    var n = Number(v)
    if (!isFinite(n)) return fallback
    return Math.min(hi, Math.max(lo, n))
  }

  /** 把模板里的 steps 归一化成引擎能吃的数据：缺字段回落内置、越界夹取、幕数夹到 1~24。 */
  function normalizeSteps(raw) {
    var list = Array.isArray(raw) ? raw : []
    var out = []
    for (var i = 0; i < list.length && out.length < MAX_STEPS; i++) {
      var s = (list[i] && typeof list[i] === 'object') ? list[i] : {}
      var base = BUILTIN_STEPS[Math.min(i, BUILTIN_STEPS.length - 1)]
      out.push({
        zh: tplText(s.zh, base.zh, 40),
        en: tplText(s.en, base.en, 60),
        say: tplText(s.say, base.say, 200),
        audio: (typeof s.audio === 'string' && AUDIO_SLOTS[s.audio]) ? s.audio : base.audio,
        log: tplText(s.log, base.log, 48),
        logEn: tplText(s.logEn, base.logEn, 60),
        badge: tplText(s.badge, base.badge, 24),
        action: (typeof s.action === 'string' && STEP_ACTIONS[s.action]) ? s.action : 'auto',
        btnZh: tplText(s.btnZh, base.btnZh || '继续', 20),
        btnEn: tplText(s.btnEn, base.btnEn || 'CONTINUE', 24),
        hold: tplNum(s.hold, base.hold, 200, 8000),
        progress: (typeof s.progress === 'number' && isFinite(s.progress)) ? Math.min(1, Math.max(0, s.progress)) : null,
        assembleLogo: s.assembleLogo === true,
        reticle: s.reticle === true,
        hex: s.hex === true,
        /* 终端风：这一幕的版式（默认 log；card = 整块换成身份卡） */
        screen: (s.screen === 'card' || s.screen === 'none') ? s.screen : 'log',
        cardStatus: tplText(s.cardStatus, '', 24)
      })
    }
    if (!out.length) {
      for (var j = 0; j < BUILTIN_STEPS.length; j++) out.push(BUILTIN_STEPS[j])
    }
    /* 没写进度的按位置均分（n 幕 + 终幕 = n+1 段），这样任意幕数都不会把进度条走飞 */
    var total = out.length + 1
    for (var k = 0; k < out.length; k++) {
      if (out[k].progress === null) out[k].progress = Math.round(((k + 1) / total) * 100) / 100
    }
    return out
  }

  var TEMPLATE = (window.__DSH_STARTUP_TEMPLATE__ && typeof window.__DSH_STARTUP_TEMPLATE__ === 'object')
    ? window.__DSH_STARTUP_TEMPLATE__
    : null
  var STEPS = normalizeSteps(TEMPLATE && TEMPLATE.steps)
  /* v2 时间线模板：有 layers[] 就走图层关键帧渲染，否则走原来的分幕流程 */
  var TIMELINE = (TEMPLATE && Array.isArray(TEMPLATE.layers) && TEMPLATE.layers.length) ? TEMPLATE.layers : null

  function cfg() {
    var raw = (window.__DSH_STARTUP__ && typeof window.__DSH_STARTUP__ === 'object')
      ? window.__DSH_STARTUP__
      : {}
    var out = {}
    for (var k in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) out[k] = DEFAULTS[k]
    for (var k2 in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, k2) && raw[k2] !== undefined && raw[k2] !== null) {
        out[k2] = raw[k2]
      }
    }
    out.speed = Math.min(3, Math.max(0.35, Number(out.speed) || 1))
    out.identity = String(out.identity || DEFAULTS.identity).slice(0, 48)
    /* 代号取身份名称里的字母数字；纯中文名字取不到时退回 OPERATOR */
    out.identityId = String(out.identityId || out.identity).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
    if (!out.identityId) out.identityId = 'OPERATOR'
    return out
  }

  var C = cfg()

  /* 模板的配色。两条规矩：
     1) 用户手动挑过的颜色优先 —— 只有配置还是默认值时才让模板改；
     2) 底/字色没有对应配置项，模板说了算（这就是换皮肤的主要手段）。
     返回的 CSS 变量等根节点建好之后再 setProperty（见下面 root 那段）。 */
  function tplColor(v) {
    if (typeof v !== 'string') return ''
    var s = v.trim()
    if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s
    if (/^rgba?\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.test(s)) return s
    return ''
  }

  var TEMPLATE_CSS_VARS = (function () {
    var th = TEMPLATE && TEMPLATE.theme
    if (!th || typeof th !== 'object') return {}
    var userOwned = { accent: 'accent', glitchA: 'glitchA', glitchB: 'glitchB' }
    for (var k in userOwned) {
      if (!Object.prototype.hasOwnProperty.call(userOwned, k)) continue
      var c = tplColor(th[k])
      if (c && String(C[userOwned[k]]) === String(DEFAULTS[userOwned[k]])) C[userOwned[k]] = c
    }
    /* 模板要求深色、而用户没手动切过主题时，切到深色版式 */
    if (th.mode === 'dark' && String(C.theme) === String(DEFAULTS.theme)) C.theme = 'dark'
    var mapVars = {
      bg: '--dsu-bg', bg2: '--dsu-bg-2', ink: '--dsu-ink', inkSoft: '--dsu-ink-soft',
      muted: '--dsu-muted', hair: '--dsu-hair', hairSoft: '--dsu-hair-soft'
    }
    var out = {}
    for (var key in mapVars) {
      if (!Object.prototype.hasOwnProperty.call(mapVars, key)) continue
      var v = tplColor(th[key])
      if (v) out[mapVars[key]] = v
    }
    return out
  })()

  /** 重播：把运行时脚本重新挂一次（配置/身份名称改动后 preview 用它）。 */
  function injectSelf() {
    window.__DSH_STARTUP_LOADED__ = false
    var old = document.getElementById(ROOT_ID)
    if (old && old.parentNode) old.parentNode.removeChild(old)
    window.__DSH_STARTUP_SKIP__ = false
    var s = document.createElement('script')
    /* 正式运行时由 Host 路由提供（加时间戳绕开缓存）；
       离线预览页会把相对路径写进 __DSH_STARTUP_SCRIPT_URL__，file:// 下不加查询串。 */
    if (window.__DSH_STARTUP_SCRIPT_URL__) {
      s.src = window.__DSH_STARTUP_SCRIPT_URL__
    } else {
      s.src = '/dsh-startup/splash.js?t=' + Date.now()
    }
    document.head.appendChild(s)
  }

  /* Host 侧的首屏兜底脚本已经判定"这次不播"（未启用 / 本会话已播 / 今日已播）：
     这里不再建 DOM，但仍然暴露 API，方便设置页按需重播。 */
  if (window.__DSH_STARTUP_SKIP__ === true) {
    window.__DSH_STARTUP_API__ = {
      steps: STEPS,
      template: (TEMPLATE && TEMPLATE.id) || '',
      replay: injectSelf,
      pause: pause,
      resume: resume,
      paused: function () { return PAUSED },
      skip: function () {},
      finish: function () {},
      config: C
    }
    return
  }

  /* 最后一道保险：无论前面哪一步抛异常，都不许把用户留在黑幕里 */
  setTimeout(function () {
    try {
      var r = document.getElementById(ROOT_ID)
      if (r && r.classList && r.classList.contains('dsu-boot')) {
        if (r.parentNode) r.parentNode.removeChild(r)
        document.documentElement.classList.remove('dsu-lock')
        if (document.body) document.body.style.overflow = ''
        window.__DSH_STARTUP_FAILED__ = true
      }
    } catch (e) { /* 兜底本身不许再抛 */ }
  }, 9000)

  /* ── 小工具 ───────────────────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  function svgWhale(cls) {
    var ns = 'http://www.w3.org/2000/svg'
    var svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', '0 0 50 50')
    svg.setAttribute('aria-hidden', 'true')
    if (cls) svg.setAttribute('class', cls)
    var p = document.createElementNS(ns, 'path')
    p.setAttribute('d', WHALE_PATH)
    p.setAttribute('fill-rule', 'nonzero')
    svg.appendChild(p)
    return svg
  }

  /** 逐字渐显：比逐字截断更稳（居中排版不会因为字宽变化而抖动） */
  function typeIn(host, text, stagger) {
    host.textContent = ''
    var frag = document.createDocumentFragment()
    var n = 0
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i)
      if (ch === ' ') {
        frag.appendChild(document.createTextNode('\u00a0'))
        continue
      }
      var s = el('span', 'dsu-ch', ch)
      s.style.transitionDelay = Math.round(n * stagger) + 'ms'
      frag.appendChild(s)
      n++
    }
    host.appendChild(frag)
  }

  function setIn(node, on, cls) {
    if (!node) return
    node.classList.toggle(cls || 'dsu-in', !!on)
  }

  /* ── DOM 搭建 ─────────────────────────────────────────────────────────── */
  var root = document.getElementById(ROOT_ID)
  if (!root) {
    root = el('div')
    root.id = ROOT_ID
    root.className = 'dsu-root'
    document.body.appendChild(root)
  }
  root.classList.toggle('dsu-dark', C.theme === 'dark')
  /* 模板声明 style:"terminal" 时切到终端版式（等宽、扫描线、日志行、身份卡） */
  var TERMINAL = !!(TEMPLATE && TEMPLATE.style === 'terminal')
  if (TERMINAL) root.classList.add('dsu-terminal')
  if (TIMELINE) root.classList.add('dsu-tl')
  root.style.setProperty('--dsu-speed', String(C.speed))
  root.style.setProperty('--dsu-accent', C.accent)
  root.style.setProperty('--dsu-glitch-a', C.glitchA)
  root.style.setProperty('--dsu-glitch-b', C.glitchB)
  /* 模板自定义的底/字色（内联样式优先级最高，压过 .dsu-dark 那套预设） */
  for (var tplVar in TEMPLATE_CSS_VARS) {
    if (Object.prototype.hasOwnProperty.call(TEMPLATE_CSS_VARS, tplVar)) root.style.setProperty(tplVar, TEMPLATE_CSS_VARS[tplVar])
  }

  var ui = {}
  var clockTimer = null
  var html =
    '<div class="dsu-plate"></div>' +
    '<div class="dsu-vignette"></div>' +
    '<div class="dsu-watermark"></div>' +
    '<div class="dsu-grain"></div>' +
    '<div class="dsu-black">' +
      '<div class="dsu-black-inner"></div>' +
      '<div class="dsu-sweep"></div>' +
    '</div>' +
    '<div class="dsu-wash"></div>' +
    '<header class="dsu-brand">' +
      '<div class="dsu-brand-1"></div><div class="dsu-brand-2"></div>' +
      '<div class="dsu-brand-3"><b></b><span></span></div>' +
    '</header>' +
    '<div class="dsu-stepcount">[ 00 / 06 ] INIT</div>' +
    '<div class="dsu-center">' +
      '<div class="dsu-status"><span class="dsu-status-zh"></span><i class="dsu-caret"></i></div>' +
      '<div class="dsu-sub-en"></div>' +
      '<div class="dsu-rule"></div>' +
      '<div class="dsu-logo"></div>' +
      '<div class="dsu-dots" hidden></div>' +
    '</div>' +
    '<div class="dsu-idline"></div>' +
    '<div class="dsu-reticle"></div>' +
    '<div class="dsu-hex"></div>' +
    '<div class="dsu-welcome">' +
      '<div class="dsu-w1">WELCOME TO</div>' +
      '<div class="dsu-w2"></div>' +
      '<div class="dsu-w3"></div>' +
      '<div class="dsu-w4"></div>' +
    '</div>' +
    '<div class="dsu-action">' +
      '<div class="dsu-card" hidden></div>' +
      '<button class="dsu-btn" type="button">' +
        '<span class="dsu-btn-zh"></span><span class="dsu-btn-en"></span>' +
      '</button>' +
      '<div class="dsu-hint"></div>' +
    '</div>' +
    '<div class="dsu-frame">' +
      '<i class="dsu-corner dsu-c-tl"></i><i class="dsu-corner dsu-c-tr"></i>' +
      '<i class="dsu-corner dsu-c-bl"></i><i class="dsu-corner dsu-c-br"></i>' +
      '<div class="dsu-scanline"></div>' +
    '</div>' +
    '<div class="dsu-slats"></div>' +
    '<div class="dsu-voice"><i></i><i></i><i></i><i></i><i></i></div>' +
    '<div class="dsu-meta"><span class="dsu-meta-1"></span><span class="dsu-meta-2"></span></div>' +
    '<div class="dsu-skip">SKIP ▸</div>' +
    '<footer class="dsu-foot"><span></span><i></i></footer>' +
    '<div class="dsu-subtitle">' +
      '<span class="dsu-sub-zh"></span><span class="dsu-sub-en2"></span>' +
    '</div>' +
    '<div class="dsu-progress"><i></i></div>' +
    '<div class="dsu-bloom"></div>' +
    '<div class="dsu-streak"></div>' +
    '<div class="dsu-flash"></div>'

  root.innerHTML = html

  function q(sel) { return root.querySelector(sel) }
  ui.plate = q('.dsu-plate')
  ui.watermark = q('.dsu-watermark')
  ui.black = q('.dsu-black')
  ui.blackInner = q('.dsu-black-inner')
  ui.sweep = q('.dsu-sweep')
  ui.wash = q('.dsu-wash')
  ui.flash = q('.dsu-flash')
  ui.bloom = q('.dsu-bloom')
  ui.streak = q('.dsu-streak')
  ui.vignette = q('.dsu-vignette')
  ui.brand = q('.dsu-brand')
  ui.center = q('.dsu-center')
  ui.brand1 = q('.dsu-brand-1')
  ui.brand2 = q('.dsu-brand-2')
  ui.brand3b = q('.dsu-brand-3 b')
  ui.brand3s = q('.dsu-brand-3 span')
  ui.stepcount = q('.dsu-stepcount')
  ui.status = q('.dsu-status')
  ui.statusZh = q('.dsu-status-zh')
  ui.caret = q('.dsu-caret')
  ui.subEn = q('.dsu-sub-en')
  ui.rule = q('.dsu-rule')
  ui.logo = q('.dsu-logo')
  ui.dots = q('.dsu-dots')
  ui.idline = q('.dsu-idline')
  ui.reticle = q('.dsu-reticle')
  ui.hex = q('.dsu-hex')
  ui.welcome = q('.dsu-welcome')
  ui.w1 = q('.dsu-w1')
  ui.w2 = q('.dsu-w2')
  ui.w3 = q('.dsu-w3')
  ui.w4 = q('.dsu-w4')
  ui.action = q('.dsu-action')
  ui.card = q('.dsu-card')
  ui.btn = q('.dsu-btn')
  ui.btnZh = q('.dsu-btn-zh')
  ui.btnEn = q('.dsu-btn-en')
  ui.hint = q('.dsu-hint')
  ui.skip = q('.dsu-skip')
  ui.foot = q('.dsu-foot')
  ui.footText = q('.dsu-foot span')
  ui.subZh = q('.dsu-sub-zh')
  ui.subEn2 = q('.dsu-sub-en2')
  ui.progress = q('.dsu-progress')
  ui.bar = q('.dsu-progress i')
  ui.frame = q('.dsu-frame')
  ui.scanline = q('.dsu-scanline')
  ui.slats = q('.dsu-slats')
  ui.voice = q('.dsu-voice')
  ui.meta = q('.dsu-meta')
  ui.meta1 = q('.dsu-meta-1')
  ui.meta2 = q('.dsu-meta-2')

  /* 内容填充 */
  ui.brand1.textContent = C.brand1
  ui.brand2.textContent = C.brand2
  ui.brand3b.textContent = C.brand3a
  ui.brand3s.textContent = C.brand3b
  ui.footText.textContent = C.footer
  ui.w2.textContent = C.welcomeBox
  ui.w4.textContent = '欢迎 ' + C.identity + ' 访问'
  ui.idline.textContent = '· ID CONFIRMED : ' + C.identityId

  ;(function blackStage() {
    var inner = ui.blackInner
    var whale = svgWhale('dsu-whale')
    inner.appendChild(whale)
    inner.appendChild(el('div', 'dsu-black-zh', C.orgZh))
    var en = el('div', 'dsu-black-en', C.orgEn)
    inner.appendChild(en)
    inner.appendChild(el('div', 'dsu-black-sub', C.orgSub))
    ui.blackEn = en
  })()

  ;(function logoStage() {
    ui.logo.appendChild(svgWhale())
    ui.logo.appendChild(el('div', 'dsu-logolabel', 'D E E P S E E K'))
  })()

  ;(function welcomeLogo() {
    ui.w3.appendChild(svgWhale())
    ui.w3.appendChild(el('span', 'dsu-w3label', 'D E E P S E E K  ·  H A R N E S S'))
  })()

  ;(function watermark() {
    var boxes = [
      [0.60, 0.02, 0.16, 0.96], [0.78, 0.02, 0.16, 0.96], [0.96, 0.02, 0.16, 0.96],
      [0.05, 0.02, 0.10, 0.5]
    ]
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i]
      var n = el('div', 'dsu-wm')
      n.style.left = (b[0] * 100) + '%'
      n.style.top = (b[1] * 100) + '%'
      n.style.width = (b[2] * 100) + '%'
      n.style.height = (b[3] * 100) + '%'
      ui.watermark.appendChild(n)
    }
  })()

  /* 左侧六格阶段柱 + 品牌块下方的小字数据行 + 实时时钟 */
  ;(function slatsAndMeta() {
    for (var i = 0; i < STEPS.length + 1; i++) ui.slats.appendChild(el('i', 'dsu-slat'))
    ui.meta1.textContent = 'REV 0.1.0 · WEB PROFILE'
    paintClock()
    clockTimer = setInterval(paintClock, 1000)
  })()

  ;(function reticle() {
    var ns = 'http://www.w3.org/2000/svg'
    var svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', '0 0 400 400')
    function arc(cx, cy, r, a0, a1, cls, cap) {
      var rad = function (d) { return (d - 90) * Math.PI / 180 }
      var x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0))
      var x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1))
      var large = (a1 - a0) > 180 ? 1 : 0
      var p = document.createElementNS(ns, 'path')
      p.setAttribute('d', 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) +
        ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2))
      p.setAttribute('class', cls)
      if (cap) p.setAttribute('stroke-linecap', cap)
      return { node: p, x: x1, y: y1, x0: x0, y0: y0 }
    }
    var gA = document.createElementNS(ns, 'g')
    gA.setAttribute('class', 'dsu-ret-rot-a')
    /* 300° 弧，缺口留在正下方 6 点钟方向：底部字幕永远不会被压到，
       弧末端圆点落在 5 点钟位置，和原片一致。 */
    var a = arc(200, 200, 150, 215, 505, 'dsu-ring-a', 'round')
    gA.appendChild(a.node)
    var da = document.createElementNS(ns, 'circle')
    da.setAttribute('class', 'dsu-dot-a')
    da.setAttribute('cx', a.x.toFixed(2)); da.setAttribute('cy', a.y.toFixed(2)); da.setAttribute('r', '7')
    gA.appendChild(da)
    svg.appendChild(gA)

    var gB = document.createElementNS(ns, 'g')
    gB.setAttribute('class', 'dsu-ret-rot-b')
    var b = arc(200, 200, 104, 200, 490, 'dsu-ring-b', 'round')
    gB.appendChild(b.node)
    var db = document.createElementNS(ns, 'circle')
    db.setAttribute('class', 'dsu-dot-b')
    db.setAttribute('cx', b.x0.toFixed(2)); db.setAttribute('cy', b.y0.toFixed(2)); db.setAttribute('r', '4')
    gB.appendChild(db)
    svg.appendChild(gB)

    var gC = document.createElementNS(ns, 'g')
    var bl = arc(200, 200, 62, 118, 242, 'dsu-bracket', 'round')
    var br = arc(200, 200, 62, 298, 62, 'dsu-bracket', 'round')
    gC.appendChild(bl.node); gC.appendChild(br.node)
    svg.appendChild(gC)

    var pts = [[152, 132], [252, 268], [278, 150]]
    for (var i = 0; i < pts.length; i++) {
      var c = document.createElementNS(ns, 'circle')
      c.setAttribute('class', 'dsu-dot-o')
      c.setAttribute('cx', pts[i][0]); c.setAttribute('cy', pts[i][1]); c.setAttribute('r', '2.8')
      svg.appendChild(c)
    }
    ui.reticle.appendChild(svg)
  })()

  /* ── 时间线引擎 ───────────────────────────────────────────────────────── */
  var timers = []
  var waiters = []
  var skipped = false
  var finished = false
  var hexTimer = null

  function ms(base) { return Math.round(base / C.speed) }

  /* ── 暂停 / 继续（只在模板编辑器的预览里用，不影响真实开机）────────────────
     做法是「软暂停」：每个等待点进门先过一道闸门，暂停时闸门关着 ——
     当前这一小段计时会走完，然后停在这一幕，不会把界面切成半帧。
     音频同步暂停（speechSynthesis），恢复时接着念。 */
  var PAUSED = false
  var resumeQueue = []

  function whenResumed() {
    if (!PAUSED) return Promise.resolve()
    return new Promise(function (res) { resumeQueue.push(res) })
  }

  function pause() {
    if (PAUSED) return false
    PAUSED = true
    try { if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) speechSynthesis.pause() } catch (e) { /* 没语音就算了 */ }
    return true
  }

  function resume() {
    if (!PAUSED) return false
    PAUSED = false
    try { if (typeof speechSynthesis !== 'undefined' && speechSynthesis.paused) speechSynthesis.resume() } catch (e) { /* noop */ }
    var q = resumeQueue
    resumeQueue = []
    for (var i = 0; i < q.length; i++) { try { q[i]() } catch (e2) { /* noop */ } }
    return true
  }

  function wait(base) {
    return whenResumed().then(function () {
      return waitTimer(base)
    })
  }

  function waitTimer(base) {
    return new Promise(function (resolve) {
      if (skipped) return resolve()
      var done = false
      function fin() {
        if (done) return
        done = true
        var i = waiters.indexOf(fin)
        if (i >= 0) waiters.splice(i, 1)
        resolve()
      }
      var t = setTimeout(fin, Math.max(0, ms(base)))
      timers.push(t)
      waiters.push(fin)
    })
  }

  function waitAction() {
    return new Promise(function (resolve) {
      if (skipped || !C.requireInteraction) return resolve()
      var done = false
      function fin() {
        if (done) return
        done = true
        cleanup()
        resolve()
      }
      function onKey(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); fin() }
      }
      function onClick(e) { e.preventDefault(); fin() }
      function cleanup() {
        ui.btn.removeEventListener('click', onClick)
        ui.action.removeEventListener('click', onClick)
        document.removeEventListener('keydown', onKey)
        var i = waiters.indexOf(fin)
        if (i >= 0) waiters.splice(i, 1)
      }
      ui.btn.addEventListener('click', onClick)
      ui.action.addEventListener('click', onClick)
      document.addEventListener('keydown', onKey)
      waiters.push(fin)
    })
  }

  function releaseAll() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i])
    timers.length = 0
    var list = waiters.slice()
    waiters.length = 0
    for (var j = 0; j < list.length; j++) { try { list[j]() } catch (err) { /* noop */ } }
  }

  function setProgress(p) {
    var pct = Math.max(0, Math.min(1, p))
    ui.bar.style.width = Math.round(pct * 100) + '%'
  }

  /** 六格阶段柱：走过的压暗、当前的拉满并点亮主题橙 */
  function setSlats(active) {
    var items = ui.slats.children
    for (var i = 0; i < items.length; i++) {
      var idx = i + 1
      items[i].classList.toggle('dsu-on', idx === active)
      items[i].classList.toggle('dsu-past', idx < active)
    }
  }

  /** 扫描线自上而下扫一遍（底板洗白后一次，验准时再一次） */
  function sweep() {
    if (!ui.scanline) return
    ui.scanline.classList.remove('dsu-go')
    void ui.scanline.offsetWidth
    ui.scanline.classList.add('dsu-go')
  }

  function paintClock() {
    var d = new Date()
    var pad = function (n) { return (n < 10 ? '0' : '') + n }
    ui.meta2.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  }

  function setSubtitle(zh, en) {
    ui.subZh.classList.remove('dsu-in')
    ui.subEn2.classList.remove('dsu-in')
    setTimeout(function () {
      ui.subZh.textContent = zh || ''
      ui.subEn2.textContent = en || ''
      ui.subZh.classList.add('dsu-in')
      if (en) ui.subEn2.classList.add('dsu-in')
    }, ms(140))
  }

  function setStepCount(i, code) {
    var totalSteps = STEPS.length + 1
    ui.stepcount.textContent = '[ ' + String(i).padStart(2, '0') + ' / ' +
      String(totalSteps).padStart(2, '0') + ' ] ' + code
  }

  function startHex() {
    var lines = 12
    function line() {
      var s = ''
      for (var i = 0; i < 26; i++) {
        s += '0123456789ABCDEF'.charAt(Math.floor(Math.random() * 16))
        if (i % 2 === 1) s += ' '
      }
      return s
    }
    function paint() {
      var out = []
      for (var i = 0; i < lines; i++) out.push(line())
      ui.hex.innerHTML = out.join('<br>')
    }
    paint()
    ui.hex.classList.add('dsu-in')
    audio.tickRun()
    hexTimer = setInterval(paint, 110)
  }
  function stopHex() {
    if (hexTimer) { clearInterval(hexTimer); hexTimer = null }
    ui.hex.classList.remove('dsu-in')
  }

  /* ── 声音 ──────────────────────────────────────────────────────────────
   * 两条独立的通道，都不依赖任何音频文件：
   *   audio —— 界面音效，WebAudio 现场合成（咔哒 / 双音确认 / 噪声扫频 / 和声钟）
   *   voice —— 女声播报，Web Speech API 念每一行的英文（照参考片的女声节奏：
   *            7.3-9.3s 念状态行、19.6-21.2s 念 PERMISSION AUTHORIZED）
   * 浏览器策略要求"先有用户手势"，所以第一次点击/按键会补一次解锁 + 补播。 */
  function clamp01(v, lo, hi) {
    var n = Number(v)
    return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo
  }

  var audio = (function () {
    var ctx = null
    function ac(force) {
      /* 语音素材要独立于「界面音效」开关：force=true 时无视 C.sound */
      if (!C.sound && !force) return null
      try {
        var AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return null
        if (!ctx) ctx = new AC()
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume()
        return ctx
      } catch (e) { return null }
    }
    function vol(gain) { return Math.max(0.0002, (gain == null ? 0.05 : gain) * clamp01(C.soundVolume, 0, 1) * 2) }
    function tone(freq, dur, type, gain, delay, glideTo) {
      var c = ac(); if (!c) return
      try {
        var t0 = c.currentTime + (delay || 0)
        var o = c.createOscillator(), g = c.createGain()
        o.type = type || 'sine'
        o.frequency.setValueAtTime(freq, t0)
        if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur)
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.exponentialRampToValueAtTime(vol(gain), t0 + Math.min(0.02, dur * 0.3))
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
        o.connect(g); g.connect(c.destination)
        o.start(t0); o.stop(t0 + dur + 0.03)
      } catch (e) { /* 静默降级 */ }
    }
    function noise(dur, gain) {
      var c = ac(); if (!c) return
      try {
        var n = Math.floor(c.sampleRate * dur)
        var buf = c.createBuffer(1, n, c.sampleRate)
        var d = buf.getChannelData(0)
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
        var src = c.createBufferSource(); src.buffer = buf
        var f = c.createBiquadFilter(); f.type = 'bandpass'
        f.frequency.value = 1500; f.Q.value = 0.6
        var g = c.createGain(); g.gain.value = vol(gain)
        src.connect(f); f.connect(g); g.connect(c.destination)
        src.start()
      } catch (e) { /* 静默降级 */ }
    }
    /* 从 /dsh-startup/asset/ 拉真素材（用户音频里抠出来的"哒"）并解码缓存；
       拿不到就自动回落到下面合成的音，功能不依赖网络/素材存在与否。 */
    var buffers = {}
    var fetching = {}
    function loadAsset(name) {
      if (C.sfx === 'synth') return
      if (buffers[name] || fetching[name]) return
      fetching[name] = true
      try {
        fetch(assetUrl(name))
          .then(function (r) { return r.ok ? r.arrayBuffer() : null })
          .then(function (ab) { return ab ? ac().decodeAudioData(ab) : null })
          .then(function (buf) { if (buf) buffers[name] = buf })
          .catch(function () { /* 没素材就走合成音 */ })
      } catch (e) { /* fetch 不存在也一样降级 */ }
    }
    /* 素材预加载：fetch + decodeAudioData 不需要用户手势，所以加载时就拉，
       这样第一步就能用真声，而不用等用户第一次点击。 */
    var pending = {}
    function ensureAsset(name) {
      if (buffers[name]) return Promise.resolve(true)
      if (pending[name]) return pending[name]
      if (C.voiceSource === 'tts') return Promise.resolve(false)
      pending[name] = new Promise(function (resolve) {
        try {
          fetch(assetUrl(name))
            .then(function (r) { return r.ok ? r.arrayBuffer() : null })
            .then(function (ab) { if (!ab) return null; return ac(true).decodeAudioData(ab) })
            .then(function (buf) {
              if (buf) { buffers[name] = buf; resolve(true) } else { resolve(false) }
            })
            .catch(function () { resolve(false) })
        } catch (e) { resolve(false) }
      })
      return pending[name]
    }

    /** 播素材并等它播完，resolve 实际时长(ms)。拿不到素材 resolve 0。 */
    function playAssetAndWait(name, gain) {
      return new Promise(function (resolve) {
        var c = ac(true)
        var buf = buffers[name]
        if (!c || !buf) { resolve(0); return }
        try {
          var src = c.createBufferSource()
          src.buffer = buf
          var g = c.createGain()
          g.gain.value = Math.min(1, (gain == null ? 0.85 : gain) * clamp01(C.voiceVolume, 0, 1) * 1.6)
          src.connect(g); g.connect(c.destination)
          src.onended = function () { resolve(Math.round(buf.duration * 1000)) }
          src.start()
        } catch (e) { resolve(0) }
      })
    }

    function playAsset(name, gain) {
      var c = ac(); if (!c) return false
      var buf = buffers[name]
      if (!buf) { loadAsset(name); return false }
      try {
        var src = c.createBufferSource()
        src.buffer = buf
        var g = c.createGain()
        g.gain.value = Math.min(1, (gain == null ? 0.55 : gain) * clamp01(C.soundVolume, 0, 1) * 2)
        src.connect(g); g.connect(c.destination)
        src.start()
        return true
      } catch (e) { return false }
    }

    /* ── 本地补丁：全局底噪床 ──────────────────────────────────────────
       6 幕是 6 个独立音频文件，幕间还有 240ms 过渡；底噪若只存在于文件里，
       留白与幕间就会"断信号"，安静环境下极易出戏。这里改为一条贯穿整段
       开机的循环底噪，揭幕时才停 —— 也就是影视混音里的"通道常开"。
       电平由预设②差分实测：白噪声 8.086e-3 + 120Hz 交流声 6.181e-3，
       并乘上与语音相同的增益，保证与人声同比例。 */
    var bedSrc = null, bedGain = null, bedLevel = 0, bedStartAt = 0, bedWanted = false
    /* 自动播放策略会让 AudioContext 一开始处于 suspended：这时候排进去的增益变化
       不会走，等上下文恢复（通常是用户第一次点击）时一次性生效 —— 听起来就是
       "底噪播到一半突然冒出来/断掉"。所以：上下文没跑起来就先等 statechange，
       等到真的 running 那一刻再从 0 淡入 0.3 秒，保证一听就是连续的一条。 */
    function bedStart() {
      try {
        if (bedSrc) return
        bedWanted = true
        var c = ac(true); if (!c) return
        if (c.state === 'suspended') {
          var onState = function () {
            try { c.removeEventListener('statechange', onState) } catch (e0) {}
            if (!bedWanted || bedSrc) return
            if (c.state === 'running' || c.state === 'interrupted') startBed(c)
          }
          try { c.addEventListener('statechange', onState) } catch (e1) {}
          if (typeof c.resume === 'function') { try { c.resume() } catch (e2) {} }
          return
        }
        startBed(c)
      } catch (e) { /* 静默失败，绝不影响动画 */ }
    }
    function startBed(c) {
      try {
        if (bedSrc) return
        var len = Math.round(c.sampleRate * 2)
        var buf = c.createBuffer(1, len, c.sampleRate)
        var d = buf.getChannelData(0)
        for (var i = 0; i < len; i++) {
          /* 底噪床 v4：再 ×0.7（累计 -15dB）；交流声同步 ×0.7（累计 -19.5dB） */
          d[i] = (Math.random() * 2 - 1) * 0.001415 + Math.sin(2 * Math.PI * 120 * i / c.sampleRate) * 0.000649
        }
        bedGain = c.createGain()
        /* 底噪床 v4：改回「线性」淡入。
           v3 的指数淡入方向搞反了 —— 从 5e-5 指数爬升时，前 2.9 秒都在听阈以下，
           最后 0.1 秒才窜到目标值，听起来反而"突然出现"。
           淡入要线性/S 曲线；指数只适合淡出。 */
        var bedTarget = Math.min(1, 0.85 * clamp01(C.voiceVolume, 0, 1) * 1.6)
        var bedT0 = c.currentTime
        bedLevel = bedTarget
        bedStartAt = bedT0
        bedGain.gain.setValueAtTime(0, bedT0)
        /* 0.3 秒淡入就够了：它要的是「从第一帧就一直在」，不是慢慢出现 */
        bedGain.gain.linearRampToValueAtTime(bedTarget, bedT0 + 0.3)
        bedSrc = c.createBufferSource()
        bedSrc.buffer = buf
        bedSrc.loop = true
        bedSrc.connect(bedGain); bedGain.connect(c.destination)
        bedSrc.start()
      } catch (e) { /* 静默失败，绝不影响动画 */ }
    }
    function bedStop() {
      bedWanted = false
      try {
        if (bedSrc && bedGain) {
          var c = ac()
          var s = bedSrc
          if (c) {
            var t = c.currentTime
            /* 底噪床 v4：线性淡出，并修复起步值。
               不能用 gain.value 取"当前"增益 —— Web Audio 的 .value 返回最后一次
               设定值（即淡入起点的 0），不是插值结果，所以 v2/v3 的淡出实际是从 ~0
               淡到 0，等于瞬间静音。这里按线性公式自己算当前值。 */
            var g = bedGain.gain
            var elapsed = t - bedStartAt
            var cur = bedLevel * Math.max(0, Math.min(1, elapsed / 0.3))
            try { g.cancelScheduledValues(t) } catch (e3) {}
            g.setValueAtTime(cur, t)
            g.linearRampToValueAtTime(0, t + 2)
            setTimeout(function () { try { s.stop(); s.disconnect() } catch (e2) {} }, 2200)
          } else { s.stop() }
        }
      } catch (e) {}
      bedSrc = null
      try { if (bedGain) { bedGain.disconnect(); bedGain = null } } catch (e) {}
    }

    return {
      bedStart: bedStart,
      bedStop: bedStop,
      resume: function () { ac(); loadAsset('sfx-tick'); loadAsset('sfx-ticks-run') },
      preload: function () { loadAsset('sfx-tick'); loadAsset('sfx-ticks-run') },
      ensureAsset: ensureAsset,
      playAssetAndWait: playAssetAndWait,
      /* 文字渐显 / 阶段推进 / 按钮确认 —— 优先用真素材 */
      tick: function () { if (!playAsset('sfx-tick', 0.45)) tone(1760, 0.035, 'square', 0.022) },
      confirm: function () { if (!playAsset('sfx-tick', 0.85)) { tone(660, 0.09, 'triangle', 0.07); tone(990, 0.17, 'triangle', 0.055, 0.085) } },
      tickRun: function () { playAsset('sfx-ticks-run', 0.5) },
      step: function () { if (!playAsset('sfx-tick', 0.6)) { tone(880, 0.05, 'sine', 0.05); tone(1320, 0.07, 'sine', 0.028, 0.045) } },
      hover: function () { tone(2200, 0.02, 'sine', 0.018) },
      confirm: function () { tone(660, 0.09, 'triangle', 0.07); tone(990, 0.17, 'triangle', 0.055, 0.085) },
      sweep: function () { noise(0.75, 0.035) },
      /* 念台词之前的两声轻提示：这一笔让 TTS 从"浏览器念字"变成"系统播报" */
      cue: function () { tone(1046.5, 0.05, 'sine', 0.028); tone(1568, 0.06, 'sine', 0.02, 0.075) },
      rise: function () { tone(220, 1.1, 'sine', 0.032, 0, 990) },
      chime: function () {
        tone(659.25, 0.9, 'sine', 0.055)
        tone(830.61, 0.9, 'sine', 0.04, 0.09)
        tone(987.77, 1.3, 'sine', 0.045, 0.18)
      }
    }
  })()

  var voice = (function () {
    var supported = typeof window !== 'undefined' && !!window.speechSynthesis &&
      typeof window.SpeechSynthesisUtterance === 'function'
    var voices = []
    var picked = { en: null, zh: null }
    var meter = null
    var saidOnce = false
    var pending = { en: '', zh: '' }

    /* 想让它听起来像"AI 播报"，音色本身比什么都重要。
       同一台机器上，"Microsoft Zira Desktop" 是上世纪拼接合成，念长句塑料味很重；
       Edge 的 "... Online (Natural)"、Chrome 的 "Google ..."、macOS 的 Siri 才是神经网络音色。
       所以这里按分数挑，而不是挨个名字第一个命中。 */
    var NATURAL_HINTS = ['natural', 'neural', 'online', 'premium', 'enhanced', 'siri', 'google']
    var FEMALE_HINTS = [
      'aria', 'jenny', 'michelle', 'emma', 'ava', 'libby', 'sonia', 'maisie',
      'zira', 'samantha', 'karen', 'moira', 'tessa', 'victoria', 'serena', 'allison',
      'susan', 'fiona', 'hazel', 'female', 'woman',
      'xiaoxiao', 'xiaoyi', 'xiaomo', 'huihui', 'yaoyao', '晓晓', '晓伊', '女声'
    ]
    var MALE_HINTS = ['david', 'mark', 'guy', 'ryan', 'george', 'daniel', 'alex', 'fred',
      'male', 'yunxi', 'yunjian', 'kangkang']

    /** 给一个音色打分：神经网络 > 女声 > 语种吻合 > 本地 */
    function score(v, want) {
      var name = String(v.name || '').toLowerCase()
      var lang = String(v.lang || '').toLowerCase()
      var sc = 0
      for (var i = 0; i < NATURAL_HINTS.length; i++) {
        if (name.indexOf(NATURAL_HINTS[i]) !== -1) { sc += 60; break }
      }
      for (var j = 0; j < FEMALE_HINTS.length; j++) {
        if (name.indexOf(FEMALE_HINTS[j]) !== -1) { sc += 40; break }
      }
      for (var k = 0; k < MALE_HINTS.length; k++) {
        if (name.indexOf(MALE_HINTS[k]) !== -1) { sc -= 45; break }
      }
      if (lang.indexOf(want) === 0) sc += 25
      if (v.localService) sc += 4          /* 本地音色起播快，不会先卡半秒 */
      if (v.default) sc += 3
      return sc
    }

    /** 挑某语种最合适的一个音色（want 传 'en' / 'zh' 这样的两字母前缀） */
    function bestFor(want) {
      if (!voices.length) return null
      if (C.voiceName) {
        for (var i = 0; i < voices.length; i++) {
          var v = voices[i]
          if (v.name === C.voiceName && String(v.lang || '').toLowerCase().indexOf(want) === 0) return v
        }
      }
      var pool = []
      for (var j = 0; j < voices.length; j++) {
        if (String(voices[j].lang || '').toLowerCase().indexOf(want) === 0) pool.push(voices[j])
      }
      if (!pool.length) pool = voices.slice()
      var best = null
      var bs = -1e9
      for (var n = 0; n < pool.length; n++) {
        var sc = score(pool[n], want)
        if (sc > bs) { bs = sc; best = pool[n] }
      }
      return best
    }

    function setMeter(on) { if (meter) meter.classList.toggle('dsu-on', !!on) }

    function load() {
      if (!supported) return
      try { voices = window.speechSynthesis.getVoices() || [] } catch (e) { voices = [] }
      picked.en = bestFor('en')
      picked.zh = bestFor('zh')
    }

    /** 全大写名字有些引擎会一个字母一个字母念，转成 Title Case 更像在叫名字 */
    function spokenName(name) {
      return String(name || '').replace(/\S+/g, function (w) {
        return (/^[A-Z0-9.\-]+$/.test(w) && w.length > 1) ? w.charAt(0) + w.slice(1).toLowerCase() : w
      })
    }

    function utter(text, lang) {
      try {
        var u = new window.SpeechSynthesisUtterance(text)
        var v = lang.indexOf('zh') === 0 ? picked.zh : picked.en
        if (v) { u.voice = v; u.lang = v.lang || lang } else u.lang = lang
        /* 神经网络音色在 .95 / 1.02 这个档位最像"系统在播报"：
           再快就赶，再慢就假；音调略抬一点显得干净利落 */
        u.rate = clamp01(C.voiceRate, 0.5, 2)
        u.pitch = clamp01(C.voicePitch, 0, 2)
        u.volume = clamp01(C.voiceVolume, 0, 1)
        u.onstart = function () { setMeter(true) }
        u.onend = function () { setMeter(false) }
        u.onerror = function () { setMeter(false) }
        window.speechSynthesis.speak(u)
        return true
      } catch (e) { return false }
    }

    /** 一句话的时长估算（个别引擎不触发 onend 时兜底；中文按字、英文按字符） */
    function estimateMs(items) {
      var chars = 0
      var rate = clamp01(C.voiceRate, 0.5, 2) || 1
      for (var i = 0; i < items.length; i++) {
        var t = String(items[i].t || '')
        chars += /[\u4e00-\u9fa5]/.test(t) ? t.length * 1.7 : t.length
      }
      return Math.round((chars / 13) * 1000 / rate) + 460
    }

    function buildUtter(text, lang) {
      var u = new window.SpeechSynthesisUtterance(text)
      var v = lang.indexOf('zh') === 0 ? picked.zh : picked.en
      if (v) { u.voice = v; u.lang = v.lang || lang } else u.lang = lang
      u.rate = clamp01(C.voiceRate, 0.5, 2)
      u.pitch = clamp01(C.voicePitch, 0, 2)
      u.volume = clamp01(C.voiceVolume, 0, 1)
      return u
    }

    return {
      supported: supported,
      load: load,
      attach: function (node) { meter = node },

      /**
       * 念一行，返回"这一行实际花了多久(ms)"的 Promise。
       *
       * 三个关键决定：
       *  - **不 cancel 上一句**。原来每步都 cancel，用户点快一点、或者
       *    hold 短于台词长度，语音就被硬生生掐断 —— 那正是要避免的。
       *    speechSynthesis 本身是队列，不 cancel 就是顺序播报。
       *  - 提示音响过之后留 `voiceLead` 的空白再开口，这是旁白的呼吸感。
       *  - 等 `onend` 才 resolve，动画据此决定这一步停多久；个别引擎不触发
       *    onend 时按估算兜底，绝不把动画卡死。
       */
      line: function (en, zh, asset) {
        /* 有真声素材就优先用素材（音色就是你给的那个）；拿不到再回落 TTS */
        if (asset && C.voice && C.voiceSource !== 'tts' && !finished) {
          return audio.ensureAsset(asset).then(function (ok) {
            if (!ok || finished) return 0
            if (C.voiceCue !== false) audio.cue()
            return audio.playAssetAndWait(asset, 0.85).then(function (ms) {
              if (ms > 0) setMeter(true)
              return ms
            })
          }).then(function (ms) {
            if (ms > 0) { saidOnce = true; return ms }
            return ttsLine(en, zh)
          })
        }
        return ttsLine(en, zh)
      },

      /** TTS 路径：素材缺失 / voiceSource=tts / 终幕那条动态名字 */
      tts: function (en, zh) { return ttsLine(en, zh) },

      /** 不等待的版本：设置页试听 / 任何"念完就行"的场合 */
      say: function (en, zh) { return this.line(en, zh) },

      /** 浏览器要求"先有用户手势"才放声：第一次点击/按键解锁 + 补播当前行 */
      unlock: function () {
        try { if (supported) window.speechSynthesis.resume() } catch (e) {}
        audio.resume()
        /* 预热：先无声念一个空格，把引擎唤醒，避免第一句被吃掉开头半个字 */
        if (supported && !saidOnce) {
          try {
            var w = new window.SpeechSynthesisUtterance(' ')
            w.volume = 0
            var v = picked.en || picked.zh
            if (v) { w.voice = v; w.lang = v.lang }
            window.speechSynthesis.speak(w)
          } catch (e) { /* noop */ }
        }
        if (!saidOnce && C.voice && (pending.en || pending.zh)) this.say(pending.en, pending.zh)
      },
      speakName: spokenName,
      current: function () {
        var a = picked.en ? picked.en.name : ''
        var b = picked.zh ? picked.zh.name : ''
        return a === b ? a : (a + (b ? '  /  ' + b : ''))
      },
      listVoices: function () { return voices.slice() },
      /** 只有这里才真的掐断语音（跳过 / 揭幕） */
      stop: function () { try { if (supported) window.speechSynthesis.cancel() } catch (e) {} setMeter(false) }
    }

    /** TTS 合成并等它念完，resolve 实际时长(ms)；拿不到引擎时 resolve 0。 */
    function ttsLine(en, zh) {
      return new Promise(function (resolve) {
        if (!supported || !C.voice || finished) { resolve(0); return }
        pending = { en: en || '', zh: zh || '' }
        var items = []
        var mode = C.voiceLang
        if (mode === 'zh') { if (zh) items.push({ t: zh, l: 'zh-CN' }) }
        else if (mode === 'both') {
          if (zh) items.push({ t: zh, l: 'zh-CN' })
          if (en) items.push({ t: en, l: 'en-US' })
        } else if (en) { items.push({ t: en, l: 'en-US' }) }
        if (!items.length) { resolve(0); return }

        saidOnce = true
        if (C.voiceCue !== false) audio.cue()

        var startedAt = Date.now()
        var est = estimateMs(items)
        var lead = clamp01(C.voiceLead, 0, 1200)
        var settled = false
        var watchdog = null

        function settle() {
          if (settled) return
          settled = true
          if (watchdog) clearTimeout(watchdog)
          setMeter(false)
          resolve(Math.max(0, Date.now() - startedAt))
        }

        setTimeout(function () {
          if (finished) { settle(); return }
          var last = items.length - 1
          for (var i = 0; i <= last; i++) {
            var u = buildUtter(items[i].t, items[i].l)
            if (i === last) {
              u.onstart = function () { setMeter(true) }
              u.onend = settle
              u.onerror = settle
            }
            try { window.speechSynthesis.speak(u) } catch (e) { if (i === last) settle() }
          }
          watchdog = setTimeout(settle, est + 900)
        }, lead)
      })
    }
  })()

  /* 语音/音效接线：声卡要等用户手势才能出声，这里挂一次性解锁 */
  voice.attach(q('.dsu-voice'))
  ;(function preloadVoices() {
    if (C.voiceSource === 'tts') return
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].audio) audio.ensureAsset(STEPS[i].audio)
    audio.ensureAsset('line-6')   /* 终幕欢迎语 */
  })()
  ;(function wireSound() {
    voice.load()
    if (voice.supported && typeof window.speechSynthesis.addEventListener === 'function') {
      try { window.speechSynthesis.addEventListener('voiceschanged', function () { voice.load() }) } catch (e) {}
    }
    var unlocked = false
    function unlock() {
      if (unlocked) return
      unlocked = true
      voice.unlock()
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('keydown', unlock, true)
      document.removeEventListener('touchstart', unlock, true)
    }
    document.addEventListener('pointerdown', unlock, true)
    document.addEventListener('keydown', unlock, true)
    document.addEventListener('touchstart', unlock, true)
  })()

  /* ── 时间线 ───────────────────────────────────────────────────────────── */
  /* 模板编辑器的预览要能从任意一幕开始（或者只播一幕）——
     宿主会注入 __DSH_STARTUP_JUMP__ = { start, count }，这里直接跳过开场直接进那一幕。 */
  var JUMP = (window.__DSH_STARTUP_JUMP__ && typeof window.__DSH_STARTUP_JUMP__ === 'object') ? window.__DSH_STARTUP_JUMP__ : null

  /** 把画面直接切到「档案底板已就位」的状态（跳过开场四段）。 */
  function jumpToStage() {
    try {
      ui.black.style.transition = 'opacity ' + ms(160) + 'ms linear'
      ui.black.style.opacity = '0'
      ui.plate.style.opacity = '1'
      ui.watermark.style.opacity = '1'
      ui.brand.classList.add('dsu-in')
      ui.foot.classList.add('dsu-in')
      ui.stepcount.classList.add('dsu-in')
      ui.idline.classList.add('dsu-in')
      ui.frame.classList.add('dsu-in')
      ui.slats.classList.add('dsu-in')
      ui.meta.classList.add('dsu-in')
      ui.vignette.classList.add('dsu-in')
      ui.voice.classList.add('dsu-in')
      if (C.allowSkip) ui.skip.classList.add('dsu-in')
      ui.black.style.display = 'none'
      sweep()
    } catch (e) { /* 跳转失败就按正常开场走 */ }
    return wait(160)
  }

  function run() {
    audio.bedStart()   /* 本地补丁：开机即"开通道"，底噪一路铺到揭幕 */
    /* v2 时间线模板：不演档案开场，直接跑图层时序 */
    if (TIMELINE) {
      return runTimeline()
        .then(function () { return finish() })
        .catch(function (err) {
          try { console.warn('[dsh-startup-screen] 时间线异常，直接收尾：', err) } catch (e2) {}
          return finish()
        })
    }
    if (JUMP && typeof JUMP.start === 'number' && JUMP.start >= 0) {
      return Promise.resolve()
        .then(jumpToStage)
        .then(function () { return stepLoop(JUMP.start, JUMP.count) })
        .then(function () {
          /* 只播 N 幕（编辑器「▶ 本幕」）时**停在那一幕上**，不接终幕 ——
             否则第 N 幕一完就跳去揭幕，看起来像「一下闪到最后一屏」。 */
          if (typeof JUMP.count === 'number' && JUMP.count > 0) return null
          return finale()
        })
        .catch(function (err) {
          try { console.warn('[dsh-startup-screen] 跳转播放异常，直接揭幕：', err) } catch (e2) {}
          return finish()
        })
    }
    return Promise.resolve()
      /* 第一幕：黑幕 --> DeepSeek 标识 */
      .then(function () { return wait(820) })
      .then(function () {
        ui.blackInner.classList.add('dsu-in')
        audio.rise()
        return wait(240)
      })
      .then(function () {
        ui.blackEn.classList.add('dsu-tighten')
        return wait(880)
      })
      .then(function () {
        ui.sweep.classList.add('dsu-go')
        return wait(760)
      })
      /* 过场：过曝洗白 */
      .then(function () {
        ui.blackInner.classList.add('dsu-out')
        audio.sweep()
        ui.wash.style.transition = 'opacity ' + ms(220) + 'ms linear'
        ui.wash.style.opacity = '1'
        return wait(260)
      })
      .then(function () {
        ui.plate.style.transition = 'opacity ' + ms(900) + 'ms ease'
        ui.plate.style.opacity = '1'
        ui.watermark.style.transition = 'opacity ' + ms(1100) + 'ms ease'
        ui.watermark.style.opacity = '1'
        ui.wash.style.transition = 'opacity ' + ms(720) + 'ms cubic-bezier(.2,.9,.2,1)'
        ui.wash.style.opacity = '0'
        ui.black.style.transition = 'opacity ' + ms(720) + 'ms ease'
        ui.black.style.opacity = '0'
        return wait(760)
      })
      /* 第二幕：品牌块 / 页脚 / 进度条 */
      .then(function () {
        ui.brand.classList.add('dsu-in')
        ui.foot.classList.add('dsu-in')
        ui.stepcount.classList.add('dsu-in')
        ui.idline.classList.add('dsu-in')
        ui.frame.classList.add('dsu-in')
        ui.slats.classList.add('dsu-in')
        ui.meta.classList.add('dsu-in')
        ui.vignette.classList.add('dsu-in')
        ui.voice.classList.add('dsu-in')
        setProgress(0.12)
        setStepCount(0, 'BOOT')
        setSlats(0)
        setSubtitle('系统自检中…', 'SYSTEM SELF-CHECK')
        if (C.allowSkip) ui.skip.classList.add('dsu-in')
        return wait(700)
      })
      .then(function () { ui.black.style.display = 'none'; sweep() })
      /* 六个阶段 */
      .then(function () { return stepLoop() })
      /* 终幕 */
      .then(function () { return finale() })
      .catch(function (err) {
        try { console.warn('[dsh-startup-screen] 动画异常，直接揭幕：', err) } catch (e2) {}
        return finish()
      })
  }

  /* ══ 时间线（v2 模板：layers[] + 关键帧）═════════════════════════════════
     v1 是"分幕"，v2 是"图层 + 关键帧"。两者共存：模板里有 layers 就走这里，
     否则走原来的分幕流程。M1 只做渲染器，编辑器界面是 M2。 */
  var TL_MAX_LAYERS = 40
  var TL_MAX_KF = 32

  var EASES = {
    linear: function (t) { return t },
    inCubic: function (t) { return t * t * t },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3) },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 },
    outQuint: function (t) { return 1 - Math.pow(1 - t, 5) },
    outBack: function (t) {
      var c1 = 1.70158, c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    }
  }

  function easeOf(name) { return EASES[name] || EASES.outCubic }

  /** 在一组关键帧上取某个属性在 t 时刻的值（线性/命名缓动插值）。 */
  function kfAt(kfs, t, prop, fallback) {
    if (!kfs || !kfs.length) return fallback
    var prev = null
    for (var i = 0; i < kfs.length; i++) {
      var kf = kfs[i]
      if (kf.t === undefined) continue
      if (t < kf.t) {
        if (!prev) return (kf[prop] !== undefined ? kf[prop] : fallback)
        var span = kf.t - prev.t
        var p = span > 0 ? (t - prev.t) / span : 1
        p = Math.max(0, Math.min(1, p))
        /* 缓动挂在**段起始帧**上：这一帧的 ease 决定它到下一帧怎么走。
           （之前取的是段尾帧，跟编辑器文案对不上，改了曲线看不出效果） */
        var e = easeOf((prev && prev.ease) || kf.ease)
        var a = prev[prop] !== undefined ? prev[prop] : fallback
        var b = kf[prop] !== undefined ? kf[prop] : a
        return a + (b - a) * e(p)
      }
      prev = kf
    }
    return prev && prev[prop] !== undefined ? prev[prop] : fallback
  }

  function tlNumber(v, fallback) {
    var n = Number(v)
    return isFinite(n) ? n : fallback
  }

  var tlUi = null

  /** 把模板的 layers 建成 DOM；返回 {stage, nodes, duration} */
  var TL_W = 1280, TL_H = 720

  /** 按窗口大小给舞台定缩放（letterbox 居中）—— 逻辑坐标永远是 1280×720 */
  function fitStage(stage) {
    var w = window.innerWidth || TL_W
    var h = window.innerHeight || TL_H
    var s = Math.min(w / TL_W, h / TL_H)
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')'
  }

  function buildTimeline() {
    var stage = el('div'); stage.className = 'dsu-tl-stage'
    fitStage(stage)
    window.addEventListener('resize', function () { fitStage(stage) })
    root.appendChild(stage)
    var nodes = []
    var list = timelineLayers()
    for (var i = 0; i < list.length; i++) {
      var L = list[i]
      var node = el('div')
      node.className = 'dsu-tl-layer dsu-tl-' + String(L.type || 'text')
      node.setAttribute('data-layer', String(L.id || ('layer-' + i)))
      if (L.type === 'image') {
        var file = String(L.src || '').replace(/^.*\//, '')
        if (file) node.style.backgroundImage = 'url("/dsh-startup-template-asset/' + encodeURIComponent((TEMPLATE && TEMPLATE.id) || '') + '/' + file + '")'
      } else if (L.type === 'line') {
        node.style.width = tlNumber(L.width, 400) + 'px'
      } else if (L.type === 'text') {
        node.textContent = String(L.text || '')
        if (L.font) {
          if (L.font.size) node.style.fontSize = tlNumber(L.font.size, 40) + 'px'
          if (L.font.weight) node.style.fontWeight = String(L.font.weight)
          if (L.font.tracking) node.style.letterSpacing = tlNumber(L.font.tracking, 0) + 'em'
        }
        if (L.color) node.style.color = String(L.color)
        node.style.whiteSpace = 'pre'
      }
      stage.appendChild(node)
      nodes.push({ def: L, node: node })
    }
    /* 叠层效果：全部走同一套壳，各自一个类；时间窗由 applyTimeline 控制 */
    var FX_TYPES = {
      scanline: 1, vignette: 1, glitch: 1, codes: 1, radar: 1, sonar: 1,
      grid: 1, crt: 1, letterbox: 1, hud: 1, bloom: 1
    }
    var fx = Array.isArray(TEMPLATE.effects) ? TEMPLATE.effects : []
    var fxNodes = []
    for (var f = 0; f < fx.length && f < 12; f++) {
      var e = fx[f] || {}
      var type = String(e.type || '')
      if (!FX_TYPES[type]) continue
      var node = el('div')
      node.className = 'dsu-fx dsu-fx-' + type
      node.style.opacity = String(tlNumber(e.opacity, 0.6))
      if (e.speed) node.style.setProperty('--fx-speed', String(tlNumber(e.speed, 1)))
      if (type === 'codes') {
        /* 伪代码雨：几列等宽文字，CSS 里循环滚动 */
        var cols = Math.max(3, Math.min(14, tlNumber(e.columns, 8)))
        for (var c = 0; c < cols; c++) {
          var col = el('div'); col.className = 'dsu-fx-code-col'
          col.style.left = (c * (100 / cols) + 1) + '%'
          col.style.animationDelay = (-(c * 0.7)) + 's'
          var txt = ''
          for (var L2 = 0; L2 < 18; L2++) txt += pseudoCodeLine(c * 7 + L2) + '\n'
          col.textContent = txt
          node.appendChild(col)
        }
      } else if (type === 'radar') {
        var sweep2 = el('div'); sweep2.className = 'dsu-fx-radar-sweep'; node.appendChild(sweep2)
        for (var r2 = 1; r2 <= 3; r2++) { var ring = el('div'); ring.className = 'dsu-fx-radar-ring'; ring.style.width = ring.style.height = (r2 * 26) + '%'; node.appendChild(ring) }
      } else if (type === 'sonar') {
        for (var s2 = 0; s2 < 3; s2++) { var wv = el('div'); wv.className = 'dsu-fx-sonar-ring'; wv.style.animationDelay = (s2 * 1.1) + 's'; node.appendChild(wv) }
      } else if (type === 'hud') {
        ;['tl', 'tr', 'bl', 'br'].forEach(function (k) { var cn = el('i'); cn.className = 'dsu-fx-hud-corner ' + k; node.appendChild(cn) })
      }
      stage.appendChild(node)
      fxNodes.push({ def: e, node: node })
    }
    function pseudoCodeLine(seed) {
      var pool = ['0x7F3A', 'SYS.OK', 'SCAN 41%', 'AUTH 3', '[####----]', 'PING 12ms', 'NODE 07', 'CRC 9F2C', 'GPU IDLE', '>- READY', 'KERNEL 6.1', 'SYNC ok']
      return pool[(seed * 7 + seed * seed) % pool.length]
    }
    return {
      stage: stage,
      nodes: nodes,
      fx: fxNodes,
      duration: Math.max(600, Math.min(30000, tlNumber(TEMPLATE.duration, 6000))),
      cues: (Array.isArray(TEMPLATE.audio) ? TEMPLATE.audio : []).filter(function (a) { return a && isFinite(Number(a.t)) && AUDIO_SLOTS[a.slot] }).slice(0, 24)
    }
  }

  /** 安全化：层数与每层关键帧数上限，防止模板把浏览器拖死 */
  function timelineLayers() {
    var out = []
    var raw = TIMELINE || []
    for (var i = 0; i < raw.length && out.length < TL_MAX_LAYERS; i++) {
      var L = raw[i]
      if (!L || typeof L !== 'object') continue
      var kfs = Array.isArray(L.keyframes) ? L.keyframes.filter(function (k) { return k && isFinite(Number(k.t)) }).slice(0, TL_MAX_KF) : []
      kfs.sort(function (a, b) { return a.t - b.t })
      out.push({
        id: L.id, type: L.type, text: L.text, font: L.font, color: L.color,
        src: L.src, width: L.width, pos: L.pos, size: L.size,
        keyframes: kfs
      })
    }
    return out
  }

  /** 把 t 时刻的状态应用到所有图层 */
  function applyTimeline(tl, t) {
    /* 效果层：带 from/to 时间窗，窗外隐藏 */
    if (tl.fx) {
      for (var f2 = 0; f2 < tl.fx.length; f2++) {
        var it2 = tl.fx[f2], d2 = it2.def || {}
        var from = d2.from === undefined ? -Infinity : Number(d2.from)
        var to = d2.to === undefined ? Infinity : Number(d2.to)
        var base = d2.opacity === undefined ? 0.6 : Number(d2.opacity)
        it2.node.style.opacity = String(t >= from && t <= to ? base : 0)
      }
    }
    for (var i = 0; i < tl.nodes.length; i++) {
      var it = tl.nodes[i], L = it.def, node = it.node
      var op = kfAt(L.keyframes, t, 'opacity', 1)
      var ox = kfAt(L.keyframes, t, 'offsetX', 0)
      var oy = kfAt(L.keyframes, t, 'offsetY', 0)
      var sc = kfAt(L.keyframes, t, 'scale', 1)
      var rot = kfAt(L.keyframes, t, 'rotate', 0)
      var baseX = L.pos && L.pos[0] !== undefined ? tlNumber(L.pos[0], 0) : 640
      var baseY = L.pos && L.pos[1] !== undefined ? tlNumber(L.pos[1], 0) : 360
      var sw = 0, sh = 0
      if (L.size && L.size[0]) {
        node.style.width = tlNumber(L.size[0], 100) + 'px'
        node.style.height = tlNumber(L.size[1], 100) + 'px'
      }
      node.style.opacity = String(Math.max(0, Math.min(1, op)))
      var tx = baseX + ox, ty = baseY + oy
      node.style.transform = 'translate(-50%, -50%) translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ') rotate(' + rot + 'deg)'
      if (L.type === 'line') {
        var reveal = kfAt(L.keyframes, t, 'reveal', 1)
        node.style.transform += ' scaleX(' + Math.max(0, Math.min(1, reveal)) + ')'
      }
    }
  }

  /** 时间线控制器：编辑器靠它拖播放头（暂停时 seek 也能看任意时刻） */
  var tlCtl = { seek: null, duration: 0 }

  function exposeTl(ctl) {
    tlCtl = ctl
    try { window.__DSD_TL__ = ctl } catch (e) { /* noop */ }
    try { window.__DSH_STARTUP_TL__ = ctl } catch (e2) { /* noop */ }
  }

  /** 跑时间线：与现有引擎共用暂停、跳过、收尾 */
  function runTimeline() {
    var tl = tlUi || (tlUi = buildTimeline())
    var duration = tl.duration
    var elapsed = 0
    if (JUMP && isFinite(Number(JUMP.at))) elapsed = Math.max(0, Math.min(duration - 1, Number(JUMP.at)))
    var cuesFired = {}
    var last = 0
    /* 编辑器预览模式：到终点**不卸层**，停在最后一帧，允许来回拖。
       真实开机没有这个标记，收尾逻辑完全不变。 */
    var EDIT = false
    try {
      EDIT = !!window.__DSH_STARTUP_EDIT__ ||
        /[?&]edit=1/.test(String((window.location && window.location.search) || ''))
    } catch (e4) { EDIT = false }
    /* 暴露给编辑器：seek 直接把播放头挪到 ms 并重绘 */
    exposeTl({
      duration: duration,
      seek: function (ms2) {
        elapsed = Math.max(0, Math.min(duration, Number(ms2) || 0))
        applyTimeline(tl, elapsed)
      },
      playhead: function () { return elapsed },
      layers: function () { return tl.nodes.length }
    })
    return new Promise(function (resolve) {
      function loop(now) {
        if (finished) return resolve()
        if (!last) last = now
        var dt = Math.min(120, now - last)
        last = now
        if (!PAUSED && !skipped) elapsed += dt
        applyTimeline(tl, elapsed)
        for (var c = 0; c < tl.cues.length; c++) {
          var cue = tl.cues[c]
          var at = Number(cue.t)
          if (!cuesFired[c] && elapsed >= at) { cuesFired[c] = 1; try { voice.line(null, null, cue.slot) } catch (e) { /* 缺素材不播 */ } }
        }
        if (elapsed >= duration) {
          if (EDIT) {
            /* 编辑模式：钳在终点、保持循环（暂停时不动），绝不 resolve/卸层 */
            elapsed = duration
            applyTimeline(tl, duration)
            requestAnimationFrame(loop)
            return
          }
          root.classList.add('dsu-out-content')
          setTimeout(function () { resolve() }, 220)
          return
        }
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    })
  }

  /* ══ 终端层：日志行 + 身份卡 ═══════════════════════════════════════════
     只在该模板声明 style:"terminal" 时启用；档案暖白 / 深海声呐完全不受影响。 */
  var termUi = null
  var CARD_ON = false

  function hashHex(s) {
    var h = 2166136261
    s = String(s || '')
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
    return (h >>> 0).toString(16).toUpperCase().slice(0, 8)
  }

  function ensureTerm() {
    if (!TERMINAL) return null
    if (termUi) return termUi
    if (!root) return null
    var log = el('div'); log.className = 'dsu-term-log'
    var card = el('div'); card.className = 'dsu-term-card'
    root.appendChild(log); root.appendChild(card)
    termUi = { log: log, card: card, cardBuilt: false }
    return termUi
  }

  function termLog(step) {
    var t = ensureTerm(); if (!t) return
    if (CARD_ON) { t.card.classList.remove('on'); CARD_ON = false; root.classList.remove('dsu-term-card-on') }
    var line = el('div'); line.className = 'dsu-term-line'
    var tag = el('span'); tag.className = 'tag'; tag.textContent = '[ OK ] '
    var body = el('span'); body.textContent = (step.logEn || step.log || '')
    line.appendChild(tag); line.appendChild(body)
    t.log.appendChild(line)
    while (t.log.children.length > 7) t.log.removeChild(t.log.firstChild)
    requestAnimationFrame(function () { line.classList.add('on') })
  }

  function termCard(step) {
    var t = ensureTerm(); if (!t) return
    var cfg = (TEMPLATE && TEMPLATE.card) || {}
    if (!t.cardBuilt) { buildCard(t.card, cfg); t.cardBuilt = true }
    fillCard(t.card, step, cfg)
    t.card.classList.add('on')
    CARD_ON = true
    root.classList.add('dsu-term-card-on')
  }

  function buildCard(card, cfg) {
    while (card.firstChild) card.removeChild(card.firstChild)
    var head = el('div'); head.className = 'dsu-term-card-head'
    var en = el('span'); en.className = 'en'; en.textContent = cfg.headEn || 'ACCESS PERMIT'
    var zh = el('span'); zh.className = 'zh'; zh.textContent = cfg.headZh || '身份许可'
    head.appendChild(en); head.appendChild(zh); card.appendChild(head)
    var rule = el('div'); rule.className = 'dsu-term-card-rule'; card.appendChild(rule)

    var body = el('div'); body.className = 'dsu-term-card-body'
    var left = el('div'); left.className = 'dsu-term-card-id'
    var photo = el('div'); photo.className = 'dsu-term-card-photo'; photo.setAttribute('data-photo', '1')
    var cap = el('span'); cap.textContent = cfg.photoCaption || ''
    photo.appendChild(cap); left.appendChild(photo)
    body.appendChild(left)

    var main = el('div'); main.className = 'dsu-term-card-main'
    var no = el('div'); no.className = 'dsu-term-card-no'; no.setAttribute('data-no', '1')
    var name = el('div'); name.className = 'dsu-term-card-name'; name.setAttribute('data-name', '1')
    var fields = el('div'); fields.className = 'dsu-term-card-fields'; fields.setAttribute('data-fields', '1')
    main.appendChild(no); main.appendChild(name); main.appendChild(fields)
    body.appendChild(main)

    var side = el('div'); side.className = 'dsu-term-card-side'
    var qr = el('div'); qr.className = 'dsu-term-card-qr'
    var canvas = el('canvas'); canvas.width = 25; canvas.height = 25
    qr.appendChild(canvas); side.appendChild(qr)
    body.appendChild(side)
    card.appendChild(body)

    /* 右下核验清单：把卡片中间那片空白填满，也让"核验"这件事有层次 */
    var checks = el('div'); checks.className = 'dsu-term-card-checks'; checks.setAttribute('data-checks', '1')
    side.appendChild(checks)

    var foot = el('div'); foot.className = 'dsu-term-card-foot'
    var wave = el('div'); wave.className = 'dsu-term-card-wave'
    for (var w = 0; w < 48; w++) {
      var bar = el('i')
      bar.style.animationDelay = ((w * 37) % 900) + 'ms'
      bar.style.animationDuration = (820 + ((w * 53) % 520)) + 'ms'
      wave.appendChild(bar)
    }
    var ft = el('div'); ft.className = 'foot'; ft.setAttribute('data-footer', '1')
    foot.appendChild(wave); foot.appendChild(ft); card.appendChild(foot)
  }

  function fillCard(card, step, cfg) {
    var idText = String(C.identityId || '0000')
    var serial = (cfg.serialPrefix || 'DSH') + '-' + idText + '-' + hashHex(idText + '|' + C.identity)
    var no = card.querySelector('[data-no]'); if (no) no.textContent = idText
    var nm = card.querySelector('[data-name]')
    if (nm) nm.textContent = String(C.identity || 'OPERATOR').toUpperCase() + (cfg.unit ? '  ·  ' + cfg.unit : '')
    var photo = card.querySelector('[data-photo]')
    if (photo && cfg.avatar && !photo.getAttribute('data-img')) {
      photo.setAttribute('data-img', '1')
      photo.style.backgroundImage = 'url(' + JSON.stringify('/dsh-startup/template-asset/' + encodeURIComponent((TEMPLATE && TEMPLATE.id) || '') + '/' + String(cfg.avatar).replace(/^.*\//, '')) + ')'
    }
    var fields = card.querySelector('[data-fields]')
    if (fields) {
      while (fields.firstChild) fields.removeChild(fields.firstChild)
      var rows = [
        ['证件编号', serial],
        ['签发机构', cfg.issuer || ''],
        ['授权等级', 'LEVEL ' + String(C.accessLevel || '1') + (cfg.levelScope ? ' · ' + cfg.levelScope : '')],
        ['有效期', cfg.validity || ''],
        ['许可范围', cfg.scope || ''],
        ['生物特征', cfg.biometrics || ''],
        ['核验状态', step.cardStatus || cfg.status || '比对完成']
      ]
      for (var r = 0; r < rows.length; r++) {
        if (!rows[r][1]) continue
        var f = el('div'); f.className = 'dsu-term-card-field'
        var lb = el('label'); lb.textContent = rows[r][0]
        var b = el('b'); b.textContent = rows[r][1]
        f.appendChild(lb); f.appendChild(b); fields.appendChild(f)
      }
    }
    var checks = card.querySelector('[data-checks]')
    if (checks) {
      while (checks.firstChild) checks.removeChild(checks.firstChild)
      var list = cfg.checks && cfg.checks.length ? cfg.checks : ['虹膜比对', '指纹比对', '证件校验', '权限判定']
      for (var c2 = 0; c2 < list.length; c2++) {
        var row = el('div')
        var name2 = el('span'); name2.textContent = String(list[c2])
        var ok = el('b'); ok.textContent = 'PASS'
        row.appendChild(name2); row.appendChild(ok); checks.appendChild(row)
      }
    }
    var ft = card.querySelector('[data-footer]'); if (ft) ft.textContent = cfg.footer || ''
    var cv = card.querySelector('canvas'); if (cv) drawQr(cv, serial + (step.cardStatus || ''))
  }

  /* 确定性伪二维码：同一身份每次画出来一样，不同身份不一样（装饰用，不是真二维码） */
  function drawQr(canvas, seed) {
    try {
      var ctx = canvas.getContext('2d'); if (!ctx) return
      var n = canvas.width
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, n, n)
      var h = 2166136261, s = String(seed || '')
      for (var k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619) }
      ctx.fillStyle = '#0b0f13'
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          h ^= h << 13; h ^= h >>> 17; h ^= h << 5
          if (((h >>> 0) % 100) < 47) ctx.fillRect(x, y, 1, 1)
        }
      }
      function marker(cx, cy) {
        ctx.fillStyle = '#0b0f13'; ctx.fillRect(cx, cy, 7, 7)
        ctx.fillStyle = '#ffffff'; ctx.fillRect(cx + 1, cy + 1, 5, 5)
        ctx.fillStyle = '#0b0f13'; ctx.fillRect(cx + 2, cy + 2, 3, 3)
      }
      marker(0, 0); marker(n - 7, 0); marker(0, n - 7)
    } catch (e) { /* 装饰品，失败忽略 */ }
  }

  function stepLoop(startIndex, limit) {
    var from = Math.max(0, Math.min(STEPS.length - 1, Number(startIndex) || 0))
    var list = STEPS.slice(from)
    if (typeof limit === 'number' && limit > 0) list = list.slice(0, limit)
    var chain = Promise.resolve()
    list.forEach(function (step, k) {
      var i = from + k
      chain = chain.then(function () { return whenResumed() }).then(function () {
        if (finished) return
        var n = i + 1
        /* 本地补丁：这行读数与身份核验同进退 —— 第 3 幕起收掉。
           原代码只在 finale 里 remove('dsu-in')，所以它会一路挂到终幕。 */
        if (i >= 2) ui.idline.classList.remove('dsu-in')
        setStepCount(n, step.badge)
        setSlats(n)
        setProgress(step.progress)
        setSubtitle(step.log, step.logEn)
        /* 终端风：这一幕要么往日志里加一行，要么整块换成身份卡 */
        if (TERMINAL) {
          if (step.screen === 'card') termCard(step)
          else termLog(step)
        }
        audio.step()
        /* 语音在这里起头，但**不阻塞**下面的文字渐显 —— 两者同时发生 */
        var spoke = voice.line(step.say, step.zh, step.audio)

        ui.status.classList.toggle('dsu-zhline', true)
        /* 先摘掉 dsu-in 并强制一次样式计算，新的逐字 span 才会重新走渐显动画 */
        ui.status.classList.remove('dsu-in')
        ui.subEn.classList.remove('dsu-in')
        void ui.status.offsetWidth
        typeIn(ui.statusZh, step.zh, 46)
        typeIn(ui.subEn, step.en, 13)
        ui.caret.classList.toggle('dsu-on', !!step.action && step.action !== 'auto')
        requestAnimationFrame(function () {
          if (finished) return
          ui.status.classList.add('dsu-in')
          ui.subEn.classList.add('dsu-in')
        })
        ui.rule.classList.add('dsu-in')

        if (step.assembleLogo) assembleLogo()
        if (step.reticle) {
          /* 照原片：准星出现时中央只留状态字，鲸鱼标识和虚线收掉，别挤成一团 */
          ui.logo.classList.remove('dsu-in')
          ui.dots.hidden = true
          ui.reticle.classList.add('dsu-in')
          sweep()
        }
        if (step.hex) startHex()

        /* 这一步停多久 = max(视觉基准, 实际播报时长 + 收尾留白) —— 台词长就多停，
           台词短也不会干等。用户点得快时同样等这一句念完，不掐断。 */
        function holdFor(spoken) {
          var target = Math.max(ms(step.hold), (spoken || 0) + ms(240))
          return wait(Math.max(0, target - (spoken || 0)))
        }

        if (step.action === 'grant' || step.action === 'confirm') {
          showAction(step)
          return wait(520).then(function () { return waitAction() }).then(function () {
            hideAction()
            audio.confirm()
            ui.caret.classList.remove('dsu-on')
            return spoke
          }).then(function () { return wait(ms(320)) })
        }
        if (step.hex) {
          return spoke.then(holdFor).then(function () { stopHex() })
        }
        return spoke.then(holdFor)
      })
    })
    return chain
  }

  function assembleLogo() {
    ui.logo.classList.add('dsu-in')
    ui.dots.hidden = false
    var path = ui.logo.querySelector('path')
    if (path && typeof path.getTotalLength === 'function') {
      try {
        var len = path.getTotalLength()
        path.style.fill = 'none'
        path.style.stroke = 'currentColor'
        path.style.strokeWidth = '1.1'
        path.style.strokeDasharray = len
        path.style.strokeDashoffset = len
        /* 参考片的"一笔画成"：先勾线，再落墨成面 */
        path.animate(
          [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
          { duration: ms(1400), easing: 'cubic-bezier(.55,.06,.24,1)', fill: 'forwards' }
        )
        setTimeout(function () {
          path.style.transition = 'fill ' + ms(420) + 'ms ease, stroke-width ' + ms(420) + 'ms ease'
          path.style.fill = ''
          path.style.strokeWidth = '0'
        }, ms(1450))
      } catch (err) { /* Web Animations 不可用时直接落墨 */ }
    }
    return wait(300)
  }

  function showAction(step) {
    ui.btnZh.textContent = step.btnZh
    ui.btnEn.textContent = step.btnEn
    ui.card.hidden = step.action !== 'confirm'
    if (step.action === 'confirm') {
      ui.card.innerHTML = ''
      /* 纯中文标签 + 数字/名称，去掉英文双写与主机行，别堆信息 */
      var rows = [
        ['身份名称', C.identity, true],
        ['身份编号', C.identityId, false],
        ['权限等级', C.accessLevel, false]
      ]
      rows.forEach(function (r) {
        var row = el('div', 'dsu-card-row')
        row.appendChild(el('span', null, r[0]))
        row.appendChild(el('b', r[2] ? 'dsu-zhname' : null, r[1]))
        ui.card.appendChild(row)
      })
    }
    ui.hint.innerHTML = '按 <kbd>Enter</kbd> / <kbd>Space</kbd>，或点击按钮继续'
    ui.action.classList.add('dsu-in')
    ui.btn.classList.add('dsu-pulse')
  }

  function hideAction() {
    ui.action.classList.remove('dsu-in')
    ui.btn.classList.remove('dsu-pulse')
  }

  function finale() {
    if (finished) return Promise.resolve()
    setStepCount(6, 'WELCOME')
    setSlats(6)
    setProgress(1)
    /* 底部日志和终幕里的「欢迎 xxx 访问」区分开，避免同一句出现两遍 */
    setSubtitle('身份验证完成，会话已建立', 'IDENTITY VERIFIED · SESSION ESTABLISHED')
    audio.chime()
    /* 终幕欢迎语：用从 Video Project 3 截出来的真声素材（line-6）。
       素材缺失 / voiceSource=tts / voice 关闭时自动静音，不会退回 TTS 念白 ——
       因为这条素材是「欢迎访问」整句，和动态身份名称无关。 */
    var welcome = voice.line(null, null, 'line-6')

    ui.status.classList.remove('dsu-in')
    ui.subEn.classList.remove('dsu-in')
    ui.rule.classList.remove('dsu-in')
    ui.reticle.classList.remove('dsu-in')
    stopHex()
    /* 中央区（状态行/分隔线/鲸鱼/虚线）整体退场：不清掉会和 WELCOME 版式叠字 */
    ui.center.classList.add('dsu-off')
    ui.dots.hidden = true

    return wait(360)
      .then(function () {
        ui.welcome.classList.add('dsu-in')
        ui.idline.classList.remove('dsu-in')
        return wait(420)
      })
      .then(function () {
        /* 结尾色散故障：分片位移 + 0.5px 模糊 + 混合模式，读起来像镜头色散 */
        var targets = [ui.w1, ui.w2, ui.w4]
        targets.forEach(function (t) {
          t.classList.add('dsu-glitch')
          t.setAttribute('data-text', t.textContent)
        })
        ui.w2.classList.add('dsu-glitch-box')   /* 黑底白字那块换加色混合 */
        void ui.welcome.offsetWidth
        targets.forEach(function (t) { t.classList.add('dsu-on') })
        return wait(640)
      })
      /* 光晕从中心炸开 + 变形光条横扫 + 文字青色 halation */
      .then(function () {
        root.classList.add('dsu-peak')
        ui.bloom.classList.add('dsu-go')
        ui.streak.classList.add('dsu-go')
        return wait(430)
      })
      /* 光晕最亮那一下补一记极短高光（是"眨一下"，不是长时间糊白） */
      .then(function () {
        ui.flash.style.transition = 'opacity ' + ms(70) + 'ms linear'
        ui.flash.style.opacity = '0.72'
        return wait(90)
      })
      .then(function () {
        ui.flash.style.transition = 'opacity ' + ms(340) + 'ms cubic-bezier(0.4, 0, 0.2, 1)'
        ui.flash.style.opacity = '0'
        return wait(320)
      })
      /* 欢迎语没播完就不揭幕（素材缺失时这个 Promise 立刻 resolve，不影响节奏） */
      .then(function () { return welcome })
      /* 揭幕两段：① 内容先化进自己的底色（200ms）② 机位后撤 + 底色淡出（420ms）。
         两段加起来 620ms，和 finish() 的移除定时器对齐。 */
      .then(function () {
        root.classList.add('dsu-out-content')
        return wait(200)
      })
      .then(function () {
        root.classList.add('dsu-handoff')
        return wait(440)
      })
      .then(function () { return finish() })
  }

  function finish() {
    if (finished) return
    finished = true
    audio.bedStop()   /* 本地补丁：通道常开，到这里才关 */
    releaseAll()
    stopHex()
    voice.stop()
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
    try {
      if (C.mode === 'session') window.sessionStorage.setItem('dsh-startup-screen:shown', '1')
      if (C.mode === 'daily') {
        window.localStorage.setItem('dsh-startup-screen:day', new Date().toISOString().slice(0, 10))
      }
    } catch (err) { /* 隐私模式下不可写，忽略 */ }
    /* 解锁：Host 注入的关键样式用 html.dsu-lock 锁滚动，这里必须一并摘掉，
       否则揭幕后主界面会永远滚不动。 */
    /* 标题栏还回去：移除探针样式会让 DSH 重新测量一次，恢复它自己的颜色 */
    try {
      var capStyle = document.getElementById('dsh-startup-caption')
      if (capStyle && capStyle.parentNode) capStyle.parentNode.removeChild(capStyle)
    } catch (e3) { /* noop */ }
    document.documentElement.classList.remove('dsu-lock')
    document.documentElement.style.overflow = ''
    if (document.body) document.body.style.overflow = ''
    root.classList.remove('dsu-boot')
    /* 正常揭幕时内容与底色都已经淡完，只剩收尾；跳过/异常路径没走两段，用 dsu-gone 兜一层。 */
    var faded = (root.className || '').indexOf('dsu-handoff') !== -1
    root.classList.add('dsu-gone')
    setTimeout(function () {
      if (root && root.parentNode) root.parentNode.removeChild(root)
      try { window.dispatchEvent(new CustomEvent('dsh-startup:done')) } catch (err) { /* noop */ }
    }, faded ? ms(200) : ms(900))
  }

  function requestSkip() {
    if (skipped || finished) return
    skipped = true
    releaseAll()
    finish()
  }

  if (C.allowSkip && ui.skip) {
    ui.skip.hidden = false
    ui.skip.addEventListener('click', function (e) { e.stopPropagation(); requestSkip() })
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') requestSkip()
    })
  } else if (ui.skip) {
    ui.skip.hidden = true
  }

  /* 对外 API：settings 面板里的"立即预览"按钮和重播都走它 */
  window.__DSH_STARTUP_API__ = {
    steps: STEPS,
    template: (TEMPLATE && TEMPLATE.id) || '',
    pause: pause,
    resume: resume,
    paused: function () { return PAUSED },
    seek: function (ms2) { try { return tlCtl.seek ? tlCtl.seek(ms2) : null } catch (e) { return null } },
    duration: function () { return tlCtl.duration || 0 },
    /* 设置页试听与冒烟测试用：直接念一行 */
    speak: function (en, zh) { voice.say(en, zh) },
    speakName: function (n) { return voice.speakName(n) },
    get voice() { return voice.current() },
    replay: injectSelf,
    skip: requestSkip,
    finish: finish,
    config: C
  }

  /* 锁滚动，动画期间不露出下面的应用 */
  document.documentElement.classList.add('dsu-lock')
  document.documentElement.style.overflow = 'hidden'
  if (document.body) document.body.style.overflow = 'hidden'
  setProgress(0.05)
  root.classList.remove('dsu-boot')

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { run() })
  } else {
    run()
  }
})()
