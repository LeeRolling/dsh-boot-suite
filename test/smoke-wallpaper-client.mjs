import { fileURLToPath } from 'node:url'
// dsh-chat-wallpaper —— 客户端半边的冒烟测试（node:vm，无需启动 DSH）
//
// v2.13.0 起聊天背景支持「循环视频」：
//   1. ModuleLoader 契约：注册 id 正确、factory 返回带 apply/inject 的模块
//   2. buildCss：底图/横幅/视频三个来源各自生成正确规则（视频层在 #dsh-cw-bg 里，
//      cover 铺满 + opacity 过渡）；有图或视频都要「外壳让开」
//   3. looksDark：标记判定 + 底色亮度兜底
//   4. mountBg：视频元素 #dsh-cw-video（muted/loop/autoplay/playsInline），
//      加载失败移除回落静态图；可见性变化暂停/恢复；幂等 + teardown 清理
//   5. startShuffle / stopShuffle：只有 shuffle 且分钟>0 才建定时器，换片会 fetch /config
import fs from 'node:fs'
import vm from 'node:vm'

const FILE = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const code = fs.readFileSync(FILE, 'utf8')

let captured = null
const createdCount = {}
const docListeners = {}
const intervals = []
let nextTimerId = 1
const fetchCalls = []
let fetchImpl = () => Promise.reject(new Error('no network in test'))

/* ── 最小 DOM 桩（够 buildCss / mountBg / shuffle 用）────────────────────── */
function makeStyle() {
  return {
    _v: {},
    setProperty(k, v) { this._v[k] = String(v); this[k] = String(v) },
    removeProperty(k) { delete this._v[k]; delete this[k] },
  }
}
function mkClassList(el) {
  const set = new Set()
  return {
    _set: set,
    add(...c) { c.forEach((x) => set.add(x)) },
    remove(...c) { c.forEach((x) => set.delete(x)) },
    contains(c) { return set.has(c) },
    toggle(c) { set.has(c) ? set.delete(c) : set.add(c) },
  }
}
function mkEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '', className: '', textContent: '',
    dataset: {}, style: makeStyle(), attrs: {},
    children: [], parentNode: null, _handlers: {},
    /* video 专用属性 */
    muted: false, defaultMuted: false, loop: false, autoplay: false,
    playsInline: false, preload: '', src: '', paused: true, playCalls: 0, pauseCalls: 0,
    setAttribute(k, v) { el.attrs[k] = String(v); if (k === 'id') el.id = String(v) },
    getAttribute(k) { return k in el.attrs ? el.attrs[k] : null },
    removeAttribute(k) { delete el.attrs[k] },
    addEventListener(t, fn) { (el._handlers[t] = el._handlers[t] || []).push(fn) },
    removeEventListener() {},
    fire(t) { (el._handlers[t] || []).forEach((fn) => fn({ type: t, target: el })) },
    appendChild(c) {
      if (c.parentNode) c.parentNode.removeChild(c)
      c.parentNode = el; el.children.push(c); return c
    },
    insertBefore(c, ref) {
      if (c.parentNode) c.parentNode.removeChild(c)
      c.parentNode = el
      const i = ref ? el.children.indexOf(ref) : -1
      if (i >= 0) el.children.splice(i, 0, c); else el.children.push(c)
      return c
    },
    removeChild(c) {
      const i = el.children.indexOf(c)
      if (i >= 0) el.children.splice(i, 1)
      c.parentNode = null
      return c
    },
    remove() { if (el.parentNode) el.parentNode.removeChild(el) },
    querySelector(sel) { return findAll(el, sel)[0] || null },
    querySelectorAll(sel) { return findAll(el, sel) },
    getBoundingClientRect() { const fs2 = parseFloat(el.style.fontSize) || 100; return { width: fs2 * 4.8, height: 120 } },
    play() { el.playCalls++; el.paused = false; return Promise.resolve() },
    pause() { el.pauseCalls++; el.paused = true },
    load() {},
  }
  el.classList = mkClassList(el)
  Object.defineProperty(el, 'firstChild', { get() { return this.children[0] || null } })
  return el
}
function walk(root, fn) { for (const c of root.children || []) { fn(c); walk(c, fn) } }
function findAll(root, sel) {
  const out = []
  const s = String(sel || '')
  const test = (n) => {
    if (s.startsWith('.')) return String(n.className).split(/\s+/).includes(s.slice(1))
    if (s.startsWith('#')) return n.id === s.slice(1)
    return String(n.tagName).toUpperCase() === s.toUpperCase()
  }
  walk(root, (n) => { if (test(n)) out.push(n) })
  return out
}
function findById(root, id) {
  if (root.id === id) return root
  let found = null
  walk(root, (n) => { if (!found && n.id === id) found = n })
  return found
}

const html = mkEl('html')
const head = mkEl('head')
const body = mkEl('body')
html.attributes = []

const documentStub = {
  documentElement: html,
  head,
  body,
  hidden: false,
  createElement(tag) {
    createdCount[tag] = (createdCount[tag] || 0) + 1
    return mkEl(tag)
  },
  getElementById(id) { return findById(body, id) || findById(head, id) },
  querySelector(sel) {
    const m = /style\[data-plugin-css="([^"]+)"\]/.exec(String(sel || ''))
    if (m) {
      const at = head.children.findIndex((c) => c.tagName === 'STYLE' && c.dataset.pluginCss === m[1])
      return at >= 0 ? head.children[at] : null
    }
    if (String(sel).startsWith('#')) return findById(body, String(sel).slice(1))
    return null
  },
  querySelectorAll() { return [] },
  addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn) },
  removeEventListener() {},
}

const sandbox = {
  window: {
    __ModuleLoader__: { load(o) { captured = o } },
    innerWidth: 1600,
    addEventListener() {},
    removeEventListener() {},
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    localStorage: { getItem: () => null, setItem() {} },
  },
  console,
  document: documentStub,
  getComputedStyle: () => ({ backgroundColor: 'rgb(247, 241, 248)' }),   // 浅色
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
  requestAnimationFrame: (fn) => { if (typeof fn === 'function') fn(); return 1 },
  cancelAnimationFrame: () => {},
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0 }, clearTimeout: () => {},
  setInterval(fn, ms) {
    const rec = { id: nextTimerId++, fn, ms, cleared: false }
    intervals.push(rec)
    return rec.id
  },
  clearInterval(id) { const t = intervals.find((x) => x.id === id); if (t) t.cleared = true },
  fetch(url, opts) {
    fetchCalls.push({ url: String(url), opts })
    return fetchImpl(String(url), opts)
  },
}
vm.createContext(sandbox)
vm.runInContext(code, sandbox, { filename: 'client.js' })

let fails = 0
const ok = (cond, label, extra) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}
const js = (v) => JSON.stringify(v)
const byId = (id) => documentStub.getElementById(id)
const liveIntervals = () => intervals.filter((t) => !t.cleared)
const flush = () => new Promise((r) => setImmediate(r))

console.log('=== ① ModuleLoader 契约 ===')
ok(captured !== null, 'window.__ModuleLoader__.load 被调用')
ok(captured && captured.id === 'dsh-boot-suite', '注册 id 与 loader entry 名一致', captured && captured.id)
ok(captured && typeof captured.factory === 'function', 'factory 是函数')

const mod = captured.factory((name) => {
  if (name === 'react') {
    return {
      createElement: () => ({ props: {} }),
      useState: (v) => [v, () => {}],
      useEffect: () => {},
      useMemo: (f) => f(),
      useRef: (v) => ({ current: v }),
    }
  }
  throw new Error('unexpected require: ' + name)
})
ok(typeof mod.apply === 'function', 'exports.apply 是函数')
ok(Array.isArray(mod.inject), 'exports.inject 是数组', js(mod.inject))

console.log('\n=== ② buildCss（底图 + 横幅 + 循环视频）===')
const base = {
  imageFit: 'cover',
  veilLightA: 'rgba(253,250,254,.80)', veilLightB: 'rgba(250,247,253,.68)',
  sidebarLight: 'rgba(255,255,255,.78)', fallbackLight: '#f7f1f8',
  veilDarkA: 'rgba(8,10,16,.74)', veilDarkB: 'rgba(6,8,14,.62)',
  sidebarDark: 'rgba(22,24,32,.74)', fallbackDark: '#0b0d12',
  bannerOpacity: 0.15,
}
const css = mod.__buildCss({ ...base, __imageOk: true, banner: '人类与AI的日常' })
console.log(css.split('\n').map((l) => '    ' + l).join('\n'))

const opens = (css.match(/\{/g) || []).length
const closes = (css.match(/\}/g) || []).length
ok(opens === closes, '花括号平衡', `${opens} { / ${closes} }`)
ok(!/,\s*\{/.test(css), '没有 "…, {" 这种悬空选择器')
ok(css.includes('--dsw-alias-bg-base: transparent'), '外壳透明变量在位')
ok(css.includes('--dsw-specific-sidebar-fill: rgba(255,255,255,.78)'), '浅色侧栏半透白在位')
ok(css.includes('--dsw-specific-sidebar-fill: rgba(22,24,32,.74)'), '深色侧栏半透黑在位')
ok(css.includes('#dsh-cw-bg'), '底图选择器 #dsh-cw-bg 在位')
ok(css.includes('pointer-events: none'), '底图不拦点击')
ok(css.includes('#dsh-cw-bg > img'), '底图的 <img> 规则在位')
ok(css.includes('object-fit: cover'), 'object-fit 生效')
ok(css.includes('html.dsh-cw-light #dsh-cw-bg > .dsh-cw-veil { background: linear-gradient(rgba(253,250,254,.80), rgba(250,247,253,.68)); }'), '浅色主题压白纱')
ok(css.includes('html.dsh-cw-dark #dsh-cw-bg > .dsh-cw-veil { background: linear-gradient(rgba(8,10,16,.74), rgba(6,8,14,.62)); }'), '深色主题压深纱')
/* v2.13.11：镜头模糊只加在纱上（backdrop-filter 模糊纱后面的壁纸/视频，不动纱上面的文字） */
ok(!css.includes('backdrop-filter'), 'veilBlur=0 时不生成模糊规则（默认完全不动）')
const cssBlur55 = mod.__buildCss({ ...base, __imageOk: true, veilBlur: 55 })
ok(cssBlur55.includes('-webkit-backdrop-filter: blur(13.2px)') && cssBlur55.includes('backdrop-filter: blur(13.2px)'), 'veilBlur=55 → 13.2px 模糊', String(cssBlur55.match(/blur\([^)]+\)/)))
const cssBlur100 = mod.__buildCss({ ...base, __imageOk: true, veilBlur: 100 })
ok(cssBlur100.includes('backdrop-filter: blur(24px)'), 'veilBlur=100 → 24px（100 已是最强）')
ok(css.includes('html.dsh-cw-light #dsh-cw-bg { background: #f7f1f8; }'), '浅色兜底底色')
ok(css.includes('html.dsh-cw-dark #dsh-cw-bg { background: #0b0d12; }'), '深色兜底底色')
/* v2.13.5：纱/兜底改跟壁纸亮度走，文字 token 自适应 */
ok(!css.includes('html.dsh-cw-bg-dark #dsh-cw-bg > .dsh-cw-veil'), 'v2.13.9 纱不再按壁纸亮度强塞（用户拖浓度滑块真的生效）')
ok(!css.includes('html.dsh-cw-bg-light #dsh-cw-bg > .dsh-cw-veil'), 'v2.13.9 纱只跟外观主题走')
ok(css.includes('text-shadow: 0 1px 2px'), 'v2.13.9 聊天文字带轻阴影兜底（明暗不均也能读）')
ok(code.includes('function effectiveLum') && code.includes('function veilBlend'), 'v2.13.9 文字颜色按「壁纸 + 纱」实际亮度判定')
ok(css.includes('.dsh-cw-txt-light {') && css.includes('--dsw-alias-label-primary: #f5f7fa !important'), 'v2.13.5 暗背景 → 文字提亮')
ok(css.includes('.dsh-cw-txt-dark {') && css.includes('--dsw-alias-label-primary: #111418 !important'), 'v2.13.5 亮背景 → 文字压深')
ok(mod.__BG_CLASSES.join(',') === 'dsh-cw-bg-dark,dsh-cw-bg-light', '__BG_CLASSES 固定', js(mod.__BG_CLASSES))
ok(mod.__TEXT_CLASSES.join(',') === 'dsh-cw-txt-dark,dsh-cw-txt-light', '__TEXT_CLASSES 固定', js(mod.__TEXT_CLASSES))
ok(mod.__PANEL_CLASSES.join(',') === 'dsh-cw-panel-dark,dsh-cw-panel-light', 'v2.13.6 __PANEL_CLASSES 固定', js(mod.__PANEL_CLASSES))
ok(css.includes('.dsh-cw-txt-light { color: #eef2f8 !important;'), 'v2.13.6 暗背景文字兜底色')
ok(css.includes('.dsh-cw-panel-light { background-color:'), 'v2.13.6 暗背景侧边栏/输入框面板底色')
ok(css.includes('.dsh-cw-txt-dark { color: #10141a !important;'), 'v2.13.6 亮背景文字兜底色')
ok(css.includes('.dsh-cw-panel-dark { background-color:'), 'v2.13.6 亮背景侧边栏/输入框面板底色')
ok(!css.includes('.dsh-cw-panel-light textarea') && !css.includes('.dsh-cw-panel-dark textarea'), 'v2.13.8 输入框不再被插件刷文字色（交回 DSH 原生主题）')
ok(css.includes('.dsh-cw-panel-light { background-color: rgba(8,11,18,.72) !important; }'), 'v2.13.8 深色外观面板底色')
ok(css.includes('.dsh-cw-panel-dark { background-color: rgba(248,250,253,.93) !important; }'), 'v2.13.8 浅色外观面板底色')
ok(!css.includes('fill: currentColor'), 'v2.13.8 不再覆盖图标颜色（避免白底白图标）')
ok(typeof mod.__findHeaderRoot === 'function', 'v2.13.7 顶部标题栏查找导出')
ok(code.includes('chromePanel') && code.includes('var appDark'), 'v2.13.8 外框只垫外观面板、聊天正文跟壁纸亮度')
ok(typeof mod.__markerSaysDark === 'function' && typeof mod.__tokenSaysDark === 'function', 'v2.13.8 主题判定函数可测试导出')
ok(code.includes('el.contains(comp)'), 'v2.13.8 聊天正文根节点停在输入框外面（不把白字漏进输入框）')
ok(css.includes('.dsh-cw-txt-light :not(pre) > code'), 'v2.13.6 行内代码 chip 对比底色')
ok(css.includes('html:not([data-dsh-caption]).dsh-cw-light body>span[style*="dsw-specific-sidebar-fill"]'), 'v2.13.10 浅色：窗口按钮探针浅底深图标')
ok(css.includes('background-color: #f9fafb !important; color: #0f1115 !important'), 'v2.13.10 浅色：固定高对比色对')
ok(css.includes('html:not([data-dsh-caption]).dsh-cw-dark body>span[style*="dsw-specific-sidebar-fill"]'), 'v2.13.10 深色：窗口按钮探针深底浅图标')
ok(css.includes('background-color: #1b1b1c !important; color: #f9fafb !important'), 'v2.13.10 深色：固定高对比色对')
ok(code.includes('function syncCaptionProbe') && code.includes("data-dsh-caption"), 'v2.13.10 片头期间不覆盖探针 + 结束后主动重测')
ok(typeof mod.__findChatRoot === 'function' && typeof mod.__findSidebarRoot === 'function', 'v2.13.6 根节点查找导出（聊天/侧边栏）')
ok(typeof mod.__findComposer === 'function' && typeof mod.__findInputBox === 'function', 'v2.13.6 输入框查找导出')
ok(css.includes('#dsh-cw-banner'), '横幅选择器 #dsh-cw-banner 在位')
ok(css.includes('white-space: nowrap'), '横幅不换行（一行铺满）')
ok(css.includes('font-weight: 800'), '横幅加粗（大字要够分量）')
ok(!css.includes('display: none'), '不再"深色主题直接隐藏"（改成换纱）')
ok(!css.includes('data-ds-dark-theme'), '不再依赖 DSH 的主题标记名（改用自己写的 class）')
ok(!css.includes('#dsh-chat-wallpaper'), '不再有旧视频层 #dsh-chat-wallpaper 的规则')
ok(!css.includes('2147482990'), '旧全屏视频层的 z-index 已清掉')
ok(!css.includes('undefined') && !css.includes('NaN'), '没有 undefined/NaN 泄漏')

/* 只有横幅：没有图/视频就不该生成底图层规则 */
const cssBanner = mod.__buildCss({ ...base, banner: 'X' })
ok(cssBanner.includes('#dsh-cw-banner') && !cssBanner.includes('#dsh-cw-bg'),
  '只配横幅 → 只生成横幅规则（没有底图层）')

/* v2.13.0：只有循环视频、没有静态图 → 底图层里放 video */
const cssVideo = mod.__buildCss({ ...base, __imageOk: false, __videoOk: true })
console.log(cssVideo.split('\n').map((l) => '    ' + l).join('\n'))
ok(cssVideo.includes('#dsh-cw-bg'), '只配循环视频 → 也有 #dsh-cw-bg 底图层')
ok(cssVideo.includes('#dsh-cw-bg > video'), '★ 循环视频的 <video> 规则在位')
ok(cssVideo.includes('object-fit: cover'), '视频 cover 铺满')
ok(cssVideo.includes('transition: opacity 300ms ease'), '视频透明度过渡（轮换换片用）')
ok(cssVideo.includes('--dsw-alias-bg-base: transparent'), '有视频也要外壳让开')
ok(cssVideo.includes('.dsh-cw-veil'), '视频上同样压纱')
ok(!cssVideo.includes('#dsh-cw-bg > img'), '没有静态图 → 不生成 img 规则')
ok((cssVideo.match(/\{/g) || []).length === (cssVideo.match(/\}/g) || []).length, '视频版 CSS 括号平衡')

/* 图 + 视频共存 */
const cssBoth = mod.__buildCss({ ...base, __imageOk: true, __videoOk: true })
ok(cssBoth.includes('#dsh-cw-bg > img') && cssBoth.includes('#dsh-cw-bg > video'),
  '图 + 视频共存 → img 与 video 两条规则都在')

console.log('\n=== ③ 主题 class 契约 ===')
ok(mod.__THEME_CLASSES.join(',') === 'dsh-cw-dark,dsh-cw-light', '主题 class 名固定', js(mod.__THEME_CLASSES))

console.log('\n=== ④ looksDark 判定（含亮度缓存）===')
const setAttrs = (htmlAttrs, bodyAttrs, bg) => {
  html.attributes = htmlAttrs
  body.attributes = bodyAttrs
  html.className = ''
  body.className = ''
  sandbox.getComputedStyle = () => ({ backgroundColor: bg })
  mod.__resetLum()
}
setAttrs([], [], 'rgb(247, 241, 248)')
ok(mod.__looksDark() === false, '浅色底 + 无标记 → 浅色')
setAttrs([{ name: 'data-ds-dark-theme', value: '' }], [], 'rgb(247, 241, 248)')
ok(mod.__looksDark() === true, 'html 上有 data-ds-dark-theme → 深色')
setAttrs([], [{ name: 'data-theme', value: 'dark' }], 'rgb(247, 241, 248)')
ok(mod.__looksDark() === true, 'body 上 data-theme="dark" → 深色')
setAttrs([], [], 'rgb(18, 18, 20)')
ok(mod.__looksDark() === true, '无标记但底色很暗 → 深色（亮度兜底）')
setAttrs([], [], 'rgba(0, 0, 0, 0)')
ok(mod.__looksDark() === false, '透明底色 → 不误判为深色')

setAttrs([], [], 'rgb(247, 241, 248)')
mod.__looksDark()
sandbox.getComputedStyle = () => ({ backgroundColor: 'rgba(0, 0, 0, 0)' })
ok(mod.__looksDark() === false, '亮度已缓存 → 注入 CSS 后不会因透明底翻转成深色')
sandbox.getComputedStyle = () => ({ backgroundColor: 'rgb(247, 241, 248)' })

/* v2.13.8 回归：插件自己的 dsh-cw-* 类不算主题标记；token 支持十六进制 */
html.attributes = []; body.attributes = []
html.className = 'dsh-cw-bg-dark dsh-cw-dark'
body.className = 'dsh-cw-panel-light'
ok(mod.__markerSaysDark() === false, 'v2.13.8 dsh-cw-bg-dark / dsh-cw-panel-light 不被误判成深色外观')
html.className = 'app-dark'
ok(mod.__markerSaysDark() === true, 'v2.13.8 真正的 dark 标记仍能识别')
html.className = ''; body.className = ''
let tok = ''
sandbox.getComputedStyle = () => ({ backgroundColor: 'rgba(0, 0, 0, 0)', getPropertyValue: (k) => (k === '--dsw-alias-label-primary' ? tok : '') })
tok = '#0f1115'
ok(mod.__tokenSaysDark() === false, 'v2.13.8 十六进制深色文字 token → 浅色外观')
tok = '#f9fafb'
ok(mod.__tokenSaysDark() === true, 'v2.13.8 十六进制浅色文字 token → 深色外观')
tok = 'rgb(15, 17, 21)'
ok(mod.__tokenSaysDark() === false, 'v2.13.8 rgb() 深色文字 token → 浅色外观')
tok = ''
sandbox.getComputedStyle = () => ({ backgroundColor: 'rgb(247, 241, 248)' })

console.log('\n=== ⑤ mountBg：循环视频元素（#dsh-cw-video）===')
function resetDom() {
  try { mod.__teardown() } catch (e) { /* 忽略 */ }
  body.children.length = 0
  head.children.length = 0
  for (const k of Object.keys(createdCount)) delete createdCount[k]
  intervals.length = 0
  fetchCalls.length = 0
  documentStub.hidden = false
  mod.__resetLum()
}
const videoCfg = {
  ...base,
  __imageOk: false,
  __videoOk: true,
  __video: { id: '/loops/a.mp4', videoUrl: '/chat-wallpaper/video?id=%2Floops%2Fa.mp4' },
  videoMode: 'single',
  videoShuffleMinutes: 0,
}

resetDom()
const bg = mod.__mountBg(videoCfg)
ok(!!bg && bg.id === 'dsh-cw-bg', '有循环视频 → 挂底图层 #dsh-cw-bg')
const videoEl = bg && bg.children.find((c) => c.tagName === 'VIDEO')
ok(!!videoEl && videoEl.id === 'dsh-cw-video', '★ 底图层里有 video#dsh-cw-video', bg && bg.children.map((c) => c.tagName + '#' + c.id).join(' | '))
ok(!!videoEl && videoEl.muted === true && videoEl.defaultMuted === true, '静音：muted + defaultMuted')
ok(!!videoEl && videoEl.loop === true, '循环：loop = true')
ok(!!videoEl && videoEl.autoplay === true && videoEl.playsInline === true, '自动播放：autoplay + playsInline')
ok(!!videoEl && videoEl.preload === 'auto', 'preload = auto')
ok(!!videoEl && String(videoEl.src).includes('/chat-wallpaper/video?id='), '★ src 走宿主 /chat-wallpaper/video?id=', videoEl && videoEl.src)
ok(!!videoEl && String(videoEl.src).includes('%2Floops%2Fa.mp4') && /[?&]t=/.test(String(videoEl.src)),
  'src 带 id + 时间戳（绕缓存）', videoEl && videoEl.src)
ok(!!videoEl && videoEl.playCalls === 1, '挂载后自动 play 一次', videoEl && String(videoEl.playCalls))
ok(!bg.children.some((c) => c.tagName === 'IMG'), '只配视频（没图）→ 底图层里没有 <img>')
ok(bg.children.some((c) => String(c.className).includes('dsh-cw-veil')), '视频上也有纱（.dsh-cw-veil）')
ok(documentStub.body.children.includes(bg), '底图层挂在 body 上')

/* 幂等 */
const bg2 = mod.__mountBg(videoCfg)
ok(bg2 === bg, '再次 mountBg 复用同一个底图层（幂等）')
ok(!createdCount.video || createdCount.video === 1, 'video 元素只创建了 1 次', 'video × ' + (createdCount.video || 0))

/* 加载失败 → 移除 video 回退静态图 */
const videoEl2 = bg.children.find((c) => c.tagName === 'VIDEO')
videoEl2.fire('error')
ok(!bg.children.some((c) => c.tagName === 'VIDEO'), '★ 视频加载失败 → 移除 <video>（回落静态底图/默认底色）')

/* 可见性变化：后台暂停，回前台恢复 */
resetDom()
mod.__mountBg(videoCfg)
const vEl = byId('dsh-cw-video')
documentStub.hidden = true
;(docListeners.visibilitychange || []).forEach((fn) => fn({ type: 'visibilitychange' }))
ok(vEl.pauseCalls === 1 && vEl.paused === true, '★ 页面切到后台 → 暂停视频')
documentStub.hidden = false
;(docListeners.visibilitychange || []).forEach((fn) => fn({ type: 'visibilitychange' }))
ok(vEl.playCalls === 2 && vEl.paused === false, '★ 回到前台 → 恢复播放')

/* 图和视频共存：img 在前、video 居中、纱最后 */
resetDom()
mod.__mountBg({ ...videoCfg, __imageOk: true })
const bgBoth = byId('dsh-cw-bg')
ok(!!bgBoth && bgBoth.children.filter((c) => c.tagName === 'IMG').length === 1 &&
  bgBoth.children.filter((c) => c.tagName === 'VIDEO').length === 1,
  '图 + 视频共存 → img 与 video 都在底图层里')
ok(!!bgBoth && String(bgBoth.children[bgBoth.children.length - 1].className).includes('dsh-cw-veil'),
  '纱永远压在最后（盖在图上）')

/* 什么都没有 → 不挂层 */
resetDom()
ok(mod.__mountBg({ ...base }) === null, '没有图也没有视频 → 不挂底图层')
ok(!byId('dsh-cw-bg'), 'DOM 里也没有 #dsh-cw-bg')

/* teardown：底图层（含 video）和 CSS 一起撤 */
resetDom()
mod.__applyNow(videoCfg)
ok(!!byId('dsh-cw-video'), '前置：applyNow 后视频挂上了')
mod.__teardown()
ok(!byId('dsh-cw-bg') && !byId('dsh-cw-video'), '★ teardown 撤掉整个底图层（含 video）')
ok(head.children.filter((t) => t.dataset && t.dataset.pluginCss === 'dsh-chat-wallpaper/main.css').length === 0,
  'teardown 也撤掉壁纸 CSS')

console.log('\n=== ⑥ startShuffle / stopShuffle（随机轮换）===')
resetDom()
mod.__startShuffle({ __videoOk: true, videoMode: 'single', videoShuffleMinutes: 5 })
ok(liveIntervals().length === 0, '非 shuffle 模式 → 不建定时器')
mod.__startShuffle({ __videoOk: true, videoMode: 'shuffle', videoShuffleMinutes: 0 })
ok(liveIntervals().length === 0, 'shuffle 但分钟 = 0（每次启动随机）→ 不建定时器')
mod.__startShuffle({ __videoOk: false, videoMode: 'shuffle', videoShuffleMinutes: 5 })
ok(liveIntervals().length === 0, '没有可用视频（__videoOk=false）→ 不建定时器')

resetDom()
mod.__mountBg(videoCfg)
mod.__startShuffle({ __videoOk: true, videoMode: 'shuffle', videoShuffleMinutes: 5 })
let live = liveIntervals()
ok(live.length === 1, '★ shuffle + 5 分钟 → 建了 1 个定时器', '实际 ' + live.length)
ok(live[0] && live[0].ms === 5 * 60000, '定时器间隔 = 5 分钟', live[0] && String(live[0].ms))
/* 再启动一次：先停旧的，保证只有 1 个 */
mod.__startShuffle({ __videoOk: true, videoMode: 'shuffle', videoShuffleMinutes: 5 })
ok(liveIntervals().length === 1, '重复 startShuffle → 旧定时器被停掉，仍只有 1 个')

/* 定时器触发：fetch /config 拿新片 → 换 src */
fetchImpl = (url) => {
  if (String(url).includes('/chat-wallpaper/config')) {
    return Promise.resolve({
      json: () => Promise.resolve({
        ok: true,
        video: { enabled: true, mode: 'shuffle', shuffleMinutes: 5, selectedId: '', count: 2, current: { id: '/loops/b.mp4', videoUrl: '/chat-wallpaper/video?id=%2Floops%2Fb.mp4' } },
      }),
    })
  }
  return Promise.reject(new Error('unexpected fetch ' + url))
}
const beforeSrc = byId('dsh-cw-video').src
;liveIntervals()[0].fn()
await flush(); await flush(); await flush()
ok(fetchCalls.some((c) => c.url.includes('/chat-wallpaper/config')), '★ 触发轮换 → fetch /chat-wallpaper/config 换片', fetchCalls.map((c) => c.url).join(','))
const afterSrc = byId('dsh-cw-video').src
ok(afterSrc !== beforeSrc && afterSrc.includes('%2Floops%2Fb.mp4'), '★ 新片 src 已换上', afterSrc)

/* stopShuffle：清掉定时器 */
const timerCount = liveIntervals().length
mod.__stopShuffle()
ok(liveIntervals().length === 0, '★ stopShuffle 清理定时器', '之前 ' + timerCount)
ok(intervals.every((t) => t.cleared) || intervals.length === 0, '旧的 interval 已全部 clearInterval（不会在后台继续轮换）',
  intervals.map((t) => (t.cleared ? 'cleared' : 'live')).join(','))

console.log('\n=== ⑦ v2.13.0 测试钩子 / BUILD ===')
ok(mod.__BUILD === 'cw-42', '__BUILD = cw-42（排查浏览器跑的是不是新包）', String(mod.__BUILD))
ok(mod.__VIDEO_ID === 'dsh-cw-video', '__VIDEO_ID = dsh-cw-video', String(mod.__VIDEO_ID))
ok(typeof mod.__startShuffle === 'function', '__startShuffle 导出')
ok(typeof mod.__stopShuffle === 'function', '__stopShuffle 导出')

console.log(`\n${fails === 0 ? '✓ 全部通过' : `✗ ${fails} 项失败`}\n`)
process.exit(fails === 0 ? 0 : 1)
