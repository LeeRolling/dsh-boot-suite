import { fileURLToPath } from 'node:url'
// 聊天壁纸客户端 —— applyNow / watchTheme / teardown 冒烟测试（node:vm，无需启动 DSH）
//
// v2.11.10 起聊天背景**不再有任何视频**：applyNow 只做
//   setThemeClass + injectCss + mountBg + mountBanner
// 这个文件把「没有视频」也当成契约来断言：谁把旧 video 管线塞回来，这里就红。
//
// 覆盖：
//   A. applyNow 后底图（img + 纱）、横幅（span）都在
//   B. 再 applyNow 一次：不重复建层，横幅文字原地更新
//   C. 旧视频配置（mode/placement/video）塞进来：video 计数永远是 0，旧层不出现
//   D. teardown 全撤，之后 html 属性变化不会「复活」任何层
//   E. watchTheme 只改主题 class，不重挂底图/横幅
//   F. buildCss：新选择器、花括号平衡、全程不出现 'video'
import fs from 'node:fs'
import vm from 'node:vm'

const FILE = process.argv[2] || fileURLToPath(new URL('../lib/client.js', import.meta.url))
const code = fs.readFileSync(FILE, 'utf8')

let captured = null
const created = []          // createElement 历史
const createdCount = {}     // tag → 创建次数（★ video 必须永远是 0）
const observers = []        // 活着的 MutationObserver 回调（disconnect 后从数组里移除）
const timers = []
let timerId = 0

/* ── 最小 DOM 桩 ──────────────────────────────────────────────────────────
   只实现壁纸半侧真正用到的那几个能力；绝不给 <video> 留任何特殊通道。 */
function makeStyle() {
  return {
    _v: {},
    setProperty(k, v) { this._v[k] = String(v); this[k] = String(v) },
    removeProperty(k) { delete this._v[k]; delete this[k] },
    getPropertyValue(k) { return this._v[k] || '' },
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
    id: '', className: '', textContent: '', src: '',
    dataset: {}, style: makeStyle(), attributes: [], attrs: {},
    children: [], parentNode: null, _handlers: {},
    setAttribute(k, v) {
      this.attrs[k] = String(v)
      this.attributes.push({ name: k, value: String(v) })
      if (k === 'id') this.id = String(v)
    },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null },
    removeAttribute(k) { delete this.attrs[k] },
    addEventListener(t, fn) { (this._handlers[t] = this._handlers[t] || []).push(fn) },
    removeEventListener() {},
    fire(t) { (this._handlers[t] || []).forEach((fn) => fn({ type: t, target: this })) },
    appendChild(c) {
      if (c.parentNode) c.parentNode.removeChild(c)
      c.parentNode = this
      this.children.push(c)
      return c
    },
    insertBefore(c, ref) {
      if (c.parentNode) c.parentNode.removeChild(c)
      c.parentNode = this
      const i = ref ? this.children.indexOf(ref) : -1
      if (i >= 0) this.children.splice(i, 0, c)
      else this.children.push(c)
      return c
    },
    removeChild(c) {
      const i = this.children.indexOf(c)
      if (i >= 0) this.children.splice(i, 1)
      c.parentNode = null
      return c
    },
    remove() { if (this.parentNode) this.parentNode.removeChild(this) },
    querySelector(sel) { return findAll(this, sel)[0] || null },
    querySelectorAll(sel) { return findAll(this, sel) },
    /* fitBanner 会先设 100px 再量宽度 —— 这里让宽度随字号线性变，量得出来 */
    getBoundingClientRect() {
      const fs = parseFloat(this.style.fontSize) || 100
      return { width: fs * 4.8, height: 120 }
    },
  }
  el.classList = mkClassList(el)
  Object.defineProperty(el, 'firstChild', { get() { return this.children[0] || null } })
  return el
}

const html = mkEl('html')
const head = mkEl('head')
const body = mkEl('body')
html.attributes = []
body.attributes = []

function walk(root, fn) {
  for (const c of root.children || []) { fn(c); walk(c, fn) }
}
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

const sandbox = {
  window: {
    __ModuleLoader__: { load(o) { captured = o } },
    innerWidth: 1600,
    addEventListener() {},
    removeEventListener() {},
  },
  console,
  document: {
    documentElement: html,
    head,
    body,
    readyState: 'complete',
    createElement(tag) {
      created.push(tag)
      createdCount[tag] = (createdCount[tag] || 0) + 1
      return mkEl(tag)
    },
    getElementById(id) { return findById(body, id) || findById(head, id) },
    querySelector(sel) {
      const m = /style\[data-plugin-css="([^"]+)"\]/.exec(String(sel || ''))
      if (m) {
        return head.children.find((c) => c.tagName === 'STYLE' && c.dataset.pluginCss === m[1]) || null
      }
      if (String(sel).startsWith('#')) return findById(body, String(sel).slice(1)) || findById(head, String(sel).slice(1))
      return null
    },
    querySelectorAll() { return [] },
    addEventListener() {},
    removeEventListener() {},
  },
  getComputedStyle: () => ({ backgroundColor: 'rgb(247, 241, 248)' }),   // 浅色
  /* 记录观察者；disconnect() 必须真的从「活着」数组里移除 —— 复活回归就靠它验 */
  MutationObserver: function (cb) {
    this.observe = () => {}
    this.disconnect = () => {
      const i = observers.indexOf(cb)
      if (i >= 0) observers.splice(i, 1)
    }
    observers.push(cb)
  },
  requestAnimationFrame: (fn) => { if (typeof fn === 'function') fn(); return 1 },
  cancelAnimationFrame: () => {},
  setTimeout(fn, ms) { timers.push({ fn, ms, id: ++timerId, cleared: false }); return timerId },
  clearTimeout(id) { const t = timers.find((x) => x.id === id); if (t) t.cleared = true },
  setInterval() { return 1 },
  clearInterval() {},
  fetch: () => Promise.reject(new Error('no network in test')),
}
vm.createContext(sandbox)
vm.runInContext(code, sandbox, { filename: 'client.js' })

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

let fails = 0
const ok = (cond, label, extra) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}
const byId = (id) => sandbox.document.getElementById(id)
const countTag = (root, tag) =>
  findAll(root, tag).length
const cssTags = () => head.children.filter((t) => t.tagName === 'STYLE' && t.dataset.pluginCss)
const htmlThemes = () => [...html.classList._set].filter((c) => c === 'dsh-cw-dark' || c === 'dsh-cw-light')
const fireMutation = () => { for (const cb of observers.slice()) cb([]) }

/** 每个场景 = 一次「重新加载」：清 DOM / 计数 / 观察者 / 缓存的主题亮度。 */
function reset() {
  try { mod.__teardown() } catch (e) { /* 第一次 reset 时 mod 已就绪，这里只兜底 */ }
  body.children.length = 0
  head.children.length = 0
  created.length = 0
  for (const k of Object.keys(createdCount)) delete createdCount[k]
  observers.length = 0
  timers.length = 0
  html.attributes = []
  html.className = ''
  html.classList._set.clear()
  body.attributes = []
  body.className = ''
  sandbox.getComputedStyle = () => ({ backgroundColor: 'rgb(247, 241, 248)' })
  mod.__resetLum()
}

/* ═══ 0. 测试钩子契约（v2.11.10 的新名单）═══ */
console.log('=== 0. 测试钩子契约（死代码删干净了吗）===')
const removedHooks = [
  '__ROOT_ID', '__mountLayer', '__mountCount', '__bootOverlayPresent',
  '__DEFAULT_LEAVE_CLASSES', '__startWhenFree', '__mountPanel', '__refreshPanel',
  '__preloadVideo', '__beginIntro', '__replayIntro', '__PANEL_ID', '__PANEL_TAG_ID',
]
const stillThere = removedHooks.filter((k) => mod[k] !== undefined)
ok(stillThere.length === 0, '旧视频 / 浮层面板的钩子全部删除', stillThere.join(', '))

const newHooks = [
  '__buildCss', '__looksDark', '__resetLum', '__applyNow', '__watchTheme',
  '__teardown', '__mountBg', '__mountBanner', '__fitBanner', '__hasCurrent',
]
const missing = newHooks.filter((k) => typeof mod[k] !== 'function')
ok(missing.length === 0, '新钩子齐全', missing.join(', '))

ok(mod.__TAG_ID === 'dsh-chat-wallpaper/main.css', '__TAG_ID 契约', String(mod.__TAG_ID))
ok(mod.__BG_ID === 'dsh-cw-bg', '__BG_ID 契约（底图层）', String(mod.__BG_ID))
ok(mod.__BANNER_ID === 'dsh-cw-banner', '__BANNER_ID 契约（横幅层）', String(mod.__BANNER_ID))
ok(String(mod.__THEME_CLASSES) === 'dsh-cw-dark,dsh-cw-light', '__THEME_CLASSES 契约', JSON.stringify(mod.__THEME_CLASSES))
ok(typeof mod.__BUILD === 'string' && mod.__BUILD.length > 0, '__BUILD 有值（排查旧包用）', String(mod.__BUILD))

/* ═══ A. applyNow 一次 → 底图 + 横幅 ═══ */
console.log('\n=== A. applyNow：底图 + 横幅挂上，绝不创建 video ===')
reset()
mod.__applyNow({ __imageOk: true, banner: 'X' })

const bg = byId('dsh-cw-bg')
ok(!!bg, '★ 挂了底图层 #dsh-cw-bg')
ok(!!bg && bg.parentNode === body, '底图层是 body 的直接子节点')
const bgImgs = bg ? bg.children.filter((c) => c.tagName === 'IMG') : []
ok(bgImgs.length === 1, '★ 底图层里有 1 个 <img>', '实际 ' + bgImgs.length)
ok(!!bgImgs[0] && String(bgImgs[0].src).includes('/chat-wallpaper/image'),
  '★ 图片地址走宿主路由（/chat-wallpaper/image）', bgImgs[0] && bgImgs[0].src)
const veils = bg ? bg.children.filter((c) => String(c.className).split(/\s+/).includes('dsh-cw-veil')) : []
ok(veils.length === 1, '★ 底图上有纱（.dsh-cw-veil）', '实际 ' + veils.length)

const banner = byId('dsh-cw-banner')
ok(!!banner, '★ 挂了横幅层 #dsh-cw-banner')
ok(!!banner && banner.parentNode === body, '横幅层是 body 的直接子节点')
const span = banner ? banner.children[0] : null
ok(!!span && span.tagName === 'SPAN', '★ 横幅里是 <span>', span && span.tagName)
ok(!!span && span.textContent === 'X', '★ 横幅文字 = X', span && JSON.stringify(span.textContent))
ok(!!span && /^\d+px$/.test(String(span.style.fontSize)), '★ 横幅字号量过（铺满窗口）', span && span.style.fontSize)

ok(mod.__hasCurrent() === true, 'current 已置上（__hasCurrent）')
const themes = htmlThemes()
ok(themes.length === 1 && themes[0] === 'dsh-cw-light', '★ <html> 上写了主题 class（浅色）', themes.join(','))
ok(cssTags().length === 1 && cssTags()[0].dataset.pluginCss === 'dsh-chat-wallpaper/main.css',
  '★ 注入了 1 个壁纸样式 tag', cssTags().map((t) => t.dataset.pluginCss).join(','))
ok(cssTags().length === 1 && String(cssTags()[0].textContent).includes('#dsh-cw-bg'),
  '样式内容里有底图规则')
ok(!createdCount.video, '★ 创建元素计数里 video = 0', 'video=' + (createdCount.video || 0))
ok(byId('dsh-chat-wallpaper') === null, "★ 不存在 id='dsh-chat-wallpaper' 的层")

/* ═══ B. 再 applyNow → 不重建、横幅原地更新 ═══ */
console.log('\n=== B. 再 applyNow 一次：不重复建层，横幅文字原地更新 ===')
const bgBefore = byId('dsh-cw-bg')
const bannerBefore = byId('dsh-cw-banner')
const spanBefore = bannerBefore.children[0]
const snap = { img: createdCount.img || 0, div: createdCount.div || 0, span: createdCount.span || 0 }
mod.__applyNow({ __imageOk: true, banner: 'Y' })
ok(byId('dsh-cw-bg') === bgBefore, '★ 底图层复用同一个元素（不重建）')
ok((createdCount.img || 0) === snap.img, '★ 没有新建 <img>', 'img ' + snap.img + ' → ' + (createdCount.img || 0))
ok((createdCount.div || 0) === snap.div, '★ 没有新建底图容器 / 纱', 'div ' + snap.div + ' → ' + (createdCount.div || 0))
ok((createdCount.span || 0) === snap.span, '★ 没有新建横幅 span', 'span ' + snap.span + ' → ' + (createdCount.span || 0))
ok(byId('dsh-cw-banner') === bannerBefore, '★ 横幅层复用同一个元素')
ok(bannerBefore.children[0] === spanBefore, 'span 也是同一个元素')
ok(spanBefore.textContent === 'Y', '★ 横幅文字原地更新为 Y', spanBefore.textContent)
ok(body.children.filter((c) => c.id === 'dsh-cw-bg').length === 1, 'DOM 里只有一个底图层')
ok(cssTags().length === 1, '样式 tag 仍然只有 1 个（旧的被替换）')
ok(!createdCount.video, '★ 依然没有创建 <video>', 'video=' + (createdCount.video || 0))

/* ═══ C. 旧视频配置塞进来 ═══ */
console.log('\n=== C. 旧视频配置（mode/placement/video）塞进来：video 仍为 0 ===')
reset()
mod.__applyNow({
  __imageOk: true, banner: 'V',
  mode: 'once', placement: 'front', fadeOutMs: 1200,
  video: 'x.mp4', videoSrc: '/chat-wallpaper/video?t=1',
  loopStartSec: 5.9583, loopEndSec: 7.0417, objectFit: 'cover', playbackRate: 1,
})
ok(!createdCount.video, '★ 创建元素计数里 video = 0', 'video=' + (createdCount.video || 0))
ok(countTag(body, 'video') === 0, '★ DOM 里没有任何 <video> 元素')
ok(byId('dsh-chat-wallpaper') === null, "★ 不存在 id='dsh-chat-wallpaper' 的旧视频层")
ok(body.children.map((c) => c.id).sort().join(',') === 'dsh-cw-banner,dsh-cw-bg',
  'body 下只有底图 + 横幅两层', body.children.map((c) => c.id).join(','))
const cssOld = cssTags()[0] ? String(cssTags()[0].textContent) : ''
ok(!/video/i.test(cssOld), "★ CSS 里不出现 'video' 字样")
ok(!cssOld.includes('2147482990'), '★ 旧全屏视频层的 z-index（2147482990）已清掉')

/* ═══ D. teardown 之后不复活 ═══ */
console.log('\n=== D. teardown：底图 / 横幅 / CSS / 主题 class 全撤，之后不会复活 ===')
reset()
const cfgD = { __imageOk: true, banner: 'T' }
mod.__applyNow(cfgD)
mod.__watchTheme(cfgD)
ok(observers.length === 1, '主题观察者已装上')
ok(mod.__hasCurrent() === true, '前置：current 非空')

mod.__teardown()
ok(byId('dsh-cw-bg') === null, '★ 底图层被撤掉')
ok(byId('dsh-cw-banner') === null, '★ 横幅层被撤掉')
ok(cssTags().length === 0, '★ 壁纸 CSS 被撤回')
ok(htmlThemes().length === 0, '★ <html> 上的主题 class 被撤掉', htmlThemes().join(','))
ok(mod.__hasCurrent() === false, '★ current 已清空')
ok(observers.length === 0, '★ 主题观察者已断开（disconnect 生效）')

/* DSH 一直在改 html/body 的属性 —— 模拟属性变化，壁纸不许自己回来 */
html.attributes = [{ name: 'data-ds-dark-theme', value: '' }]
fireMutation(); fireMutation(); fireMutation()
ok(byId('dsh-cw-bg') === null, '★★ 属性变化后底图没有复活')
ok(byId('dsh-cw-banner') === null, '★★ 属性变化后横幅没有复活')
ok(cssTags().length === 0, 'CSS 也没有复活')
ok(!createdCount.video, '依然没有 video')
let threw = false
try { mod.__teardown() } catch (e) { threw = true }
ok(!threw, 'teardown 可重复调用不炸')

/* ═══ E. watchTheme 只换 class ═══ */
console.log('\n=== E. watchTheme：主题切换只改 class，不重挂任何元素 ===')
reset()
const cfgE = { __imageOk: true, banner: 'W' }
mod.__applyNow(cfgE)
const bgE = byId('dsh-cw-bg')
const bannerE = byId('dsh-cw-banner')
const divE = createdCount.div || 0
const imgE = createdCount.img || 0
const cssCountE = cssTags().length
mod.__watchTheme(cfgE)
ok(observers.length === 1, '观察者装上')

html.attributes = [{ name: 'data-ds-dark-theme', value: '' }]   // 浅色 → 深色
fireMutation()
ok(htmlThemes().includes('dsh-cw-dark'), '★ 切到深色 → class 变成 dsh-cw-dark', htmlThemes().join(','))
ok(!htmlThemes().includes('dsh-cw-light'), '同时不再留浅色 class')
ok(byId('dsh-cw-bg') === bgE, '★ 底图元素实例不变（没有重挂）')
ok(byId('dsh-cw-banner') === bannerE, '★ 横幅元素实例不变')
ok((createdCount.div || 0) === divE && (createdCount.img || 0) === imgE, '★ 没有创建任何新元素')
ok(cssTags().length === cssCountE, '★ CSS 没有重注入（换纱由主题 class 驱动）')

html.attributes = []                                           // 深色 → 浅色
fireMutation()
ok(htmlThemes().includes('dsh-cw-light'), '切回浅色 → class 变回 dsh-cw-light', htmlThemes().join(','))
ok(byId('dsh-cw-bg') === bgE && byId('dsh-cw-banner') === bannerE, '★ 切回浅色也不重挂')

/* ═══ F. buildCss ═══ */
console.log('\n=== F. buildCss：新选择器、花括号平衡、全程没有 video ===')
const base = {
  imageFit: 'cover',
  veilLightA: 'rgba(253,250,254,.80)', veilLightB: 'rgba(250,247,253,.68)',
  sidebarLight: 'rgba(255,255,255,.78)', fallbackLight: '#f7f1f8',
  veilDarkA: 'rgba(8,10,16,.74)', veilDarkB: 'rgba(6,8,14,.62)',
  sidebarDark: 'rgba(22,24,32,.74)', fallbackDark: '#0b0d12',
  bannerOpacity: 0.15,
}
const cssBoth = mod.__buildCss({ ...base, __imageOk: true, banner: 'X' })
const cssImage = mod.__buildCss({ ...base, __imageOk: true })
const cssBanner = mod.__buildCss({ ...base, banner: 'X' })
const cssEmpty = mod.__buildCss({ ...base })
for (const [name, css] of [['图+横幅', cssBoth], ['只图', cssImage], ['只横幅', cssBanner], ['空配置', cssEmpty]]) {
  const opens = (css.match(/\{/g) || []).length
  const closes = (css.match(/\}/g) || []).length
  ok(opens === closes, `花括号平衡（${name}）`, `${opens} { / ${closes} }`)
  ok(!/,\s*\{/.test(css), `没有 "…, {" 这种悬空选择器（${name}）`)
}

ok(cssBoth.includes('#dsh-cw-bg'), '有底图 → 生成 #dsh-cw-bg 规则')
ok(cssBoth.includes('#dsh-cw-banner'), '有横幅 → 生成 #dsh-cw-banner 规则')
ok(cssBoth.includes('.dsh-cw-veil'), '底图的纱选择器在位')
ok(cssBoth.includes('linear-gradient('), '纱用渐变')
ok(cssBoth.includes('--dsw-alias-bg-base: transparent'), '外壳透明变量在位')
ok(cssBoth.includes('z-index: -2'), '底图层在最底层（z-index:-2）')
ok(cssBoth.includes('z-index: -1'), '横幅层在内容之下（z-index:-1）')
ok(cssBoth.includes('white-space: nowrap'), '横幅不换行（一行铺满）')
ok(cssBoth.includes('font-weight: 800'), '横幅加粗')

ok(cssImage.includes('#dsh-cw-bg') && !cssImage.includes('#dsh-cw-banner'),
  '只配图 → 只生成底图规则，不生成横幅规则')
ok(cssBanner.includes('#dsh-cw-banner') && !cssBanner.includes('#dsh-cw-bg'),
  '只配横幅 → 只生成横幅规则，不生成底图规则')
ok(!cssEmpty.includes('#dsh-cw-bg') && !cssEmpty.includes('#dsh-cw-banner'),
  '什么都没配 → 两层规则都不生成')

const allCss = cssBoth + cssImage + cssBanner + cssEmpty
ok(!/video/i.test(allCss), "★★ 所有生成的 CSS 里都不出现 'video' 字样")
ok(!allCss.includes('2147482990'), '旧全屏视频层的 z-index 已清掉')
ok(!/undefined|NaN/.test(allCss), '没有 undefined / NaN 泄漏')

/* ═══ G. 真实启动路径：apply() → boot() → fetch /chat-wallpaper/config → applyNow ═══
   A~F 都是直接调 __applyNow。这一节走生产路径，专防「视频门删了但 boot 里
   还留着别的门」：即使宿主回 ok:false、且配置里根本没有视频字段，底图 + 横幅
   也必须照样挂上。每节用**全新 vm 上下文**（boot() 有 booted 单例，不能复用）。 */
console.log('\n=== G. 真实启动路径：apply → boot → /config → applyNow ===')
const reactStub = {
  createElement: () => ({ props: {} }),
  useState: (v) => [v, () => {}],
  useEffect: () => {},
  useMemo: (f) => f(),
  useRef: (v) => ({ current: v }),
}
/** 造一个全新的「页面环境」：独立 body/head、独立 booted 单例、可控 fetch */
function makeLaunchEnv(payload) {
  const env = { created: [], createdCount: {}, head: mkEl('head'), body: mkEl('body'), html: mkEl('html') }
  env.html.attributes = []
  env.body.attributes = []
  let cap = null
  const doc = {
    documentElement: env.html,
    head: env.head,
    body: env.body,
    readyState: 'complete',
    createElement(tag) {
      env.created.push(tag)
      env.createdCount[tag] = (env.createdCount[tag] || 0) + 1
      return mkEl(tag)
    },
    getElementById(id) { return findById(env.body, id) || findById(env.head, id) },
    querySelector(sel) {
      const m = /style\[data-plugin-css="([^"]+)"\]/.exec(String(sel || ''))
      if (m) return env.head.children.find((c) => c.tagName === 'STYLE' && c.dataset.pluginCss === m[1]) || null
      if (String(sel).startsWith('#')) return findById(env.body, String(sel).slice(1))
      return null
    },
    querySelectorAll() { return [] },
    addEventListener() {},
    removeEventListener() {},
  }
  const sb = {
    window: { __ModuleLoader__: { load(o) { cap = o } }, innerWidth: 1600, addEventListener() {}, removeEventListener() {} },
    console,
    document: doc,
    getComputedStyle: () => ({ backgroundColor: 'rgb(247, 241, 248)' }),
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
    requestAnimationFrame: (fn) => { if (typeof fn === 'function') fn(); return 1 },
    cancelAnimationFrame: () => {},
    setTimeout(fn, ms) { env.timers = (env.timers || []).concat([{ fn, ms }]); return env.timers.length },
    clearTimeout() {},
    setInterval() { return 1 },
    clearInterval() {},
    fetch(url) {
      const u = String(url)
      /* 壁纸半侧的配置接口：用被测的那份 payload */
      if (u.includes('/chat-wallpaper/config')) {
        return Promise.resolve({ json: () => Promise.resolve(payload) })
      }
      /* 开机动画半侧的自举：enabled=false 让它别在测试里建根节点/挂脚本 */
      if (u.includes('/dsh-startup/config')) {
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, config: { enabled: false } }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve('') })
    },
  }
  vm.createContext(sb)
  vm.runInContext(code, sb, { filename: 'client.js' })
  env.mod = cap.factory((name) => {
    if (name === 'react') return reactStub
    throw new Error('unexpected require: ' + name)
  })
  env.sandbox = sb
  return env
}
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)) }
const cfgKeysForBoot = {
  banner: 'B', bannerOpacity: 0.2, imageFit: 'cover',
  veilLightA: 'rgba(253,250,254,.80)', veilLightB: 'rgba(250,247,253,.68)',
  sidebarLight: 'rgba(255,255,255,.78)', fallbackLight: '#f7f1f8',
  veilDarkA: 'rgba(8,10,16,.74)', veilDarkB: 'rgba(6,8,14,.62)',
  sidebarDark: 'rgba(22,24,32,.74)', fallbackDark: '#0b0d12',
}

{
  /* G1：宿主回 ok:false + 完全没有视频字段 —— 旧代码的「解析到视频」门会在这里放弃 */
  const env = makeLaunchEnv({
    ok: false,
    config: cfgKeysForBoot,
    imageOk: true, image: 'x.jpg', imageSource: 'your-library',
  })
  let bootHalfErr = null
  try { env.mod.apply({}) } catch (e) { bootHalfErr = e }   // 开机半侧没有 ctx.slots，必抛；壁纸半侧不许抛
  ok(!!bootHalfErr && /inject/.test(String(bootHalfErr && bootHalfErr.message)),
    'apply({}) 只抛开机半侧缺 ctx.slots 的错（预期，已 catch）', bootHalfErr && bootHalfErr.message)
  await settle()
  const bgG = findById(env.body, 'dsh-cw-bg')
  const bannerG = findById(env.body, 'dsh-cw-banner')
  ok(!!bgG, '★★ /config 返回 ok:false 也照样挂底图（视频门已删）')
  ok(!!bannerG, '★★ 横幅也照样挂上')
  ok(!!bannerG && bannerG.children[0] && bannerG.children[0].textContent === 'B',
    '★ 横幅文字来自 /config（B）', bannerG && bannerG.children[0] && bannerG.children[0].textContent)
  ok(env.mod.__hasCurrent() === true, 'boot 路径上 current 已置上')
  ok(!env.createdCount.video, 'boot 路径也没有创建 <video>', 'video=' + (env.createdCount.video || 0))
  ok(findById(env.body, 'dsh-chat-wallpaper') === null, "没有 id='dsh-chat-wallpaper' 的层")
  ok(env.head.children.some((t) => t.tagName === 'STYLE' && t.dataset.pluginCss === 'dsh-chat-wallpaper/main.css'),
    'boot 路径注入了壁纸 CSS')
}
{
  /* G2：/config 里没有 config 字段 → 壁纸半侧静默放弃，不抛、不挂 */
  const env = makeLaunchEnv({})
  let err = null
  try { env.mod.apply({}) } catch (e) { err = e }
  await settle()
  ok(err === null || /inject/.test(String(err && err.message)),
    '壁纸半侧没有抛错（唯一异常只能来自开机半侧缺 ctx.slots）', err && err.message)
  ok(env.body.children.length === 0, '★ /config 没有 config → 静默放弃（不挂任何层）',
    env.body.children.map((c) => c.id).join(','))
  ok(env.mod.__hasCurrent() === false, 'current 保持空')
  ok(env.head.children.filter((t) => t.dataset && t.dataset.pluginCss === 'dsh-chat-wallpaper/main.css').length === 0,
    '也没有注入壁纸 CSS')
  ok(!env.createdCount.video, '依然没有 video')
}

console.log(`\n${fails === 0 ? '✓ 全部通过' : `✗ ${fails} 项失败`}\n`)
process.exit(fails === 0 ? 0 : 1)
