// 设置面板测试：
//   ① 宿主侧纯函数（alpha 解析 + 图片清单）
//   ② v2.13.0「聊天背景」设置页的「循环视频」组（vm + React 桩真渲染一遍面板，
//      fetch 桩覆盖 /videos、/set、/videos/delete、/videos/roots）
import fs from 'node:fs'
import vm from 'node:vm'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = new URL('../lib/index.js', import.meta.url)
const m = await import(SRC)

let fails = 0
const ok = (cond, label, extra) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

console.log('=== alphaOf：从颜色串取 alpha（滑块要用）===')
console.log('   第一版用宽松正则把 rgb(255,255,255) 解析成 alpha=255（抓到蓝通道）—— 这里就是防它回归\n')
const cases = [
  ['rgba(8,10,16,.50)', 0.5],
  ['rgba(8,10,16,0.50)', 0.5],
  ['rgba(6,8,14,.38)', 0.38],
  ['rgba(22,24,32,0.74)', 0.74],
  ['rgba(253,250,254,.80)', 0.8],
  ['rgb(255,255,255)', 1],            // ← 没有 alpha，必须回落 1（不是 255！）
  ['rgb(8,10,16)', 1],
  ['rgba(8 10 16 / 0.5)', 0.5],
  ['rgba(8 10 16 / 50%)', 0.5],
  ['rgba(8,10,16,1)', 1],
  ['rgba(8,10,16,0)', 0],
  ['garbage', 1],
  ['', 1],
  [null, 1],
  [undefined, 1],
  ['rgba(1,2,3,7)', 1],               // 越界 → 回落 1
]
for (const [input, want] of cases) {
  const got = m.__alphaOf(input)
  ok(got === want, `${JSON.stringify(input)} → ${want}`, got === want ? '' : `实际 ${got}`)
}

console.log('\n=== 丢图目录 + 图片清单 ===')
const dir = m.__imageDir()
console.log('  丢图目录:', dir)
ok(typeof dir === 'string' && dir.includes('.dsh'), '目录在 $DSH_HOME 下')
console.log('  当前目录里的图:', JSON.stringify(m.__listImages()))
console.log('  （现在没图是正常的 —— 用户丢进去就会出现在设置面板里）')

/* ══════════════════════════════════════════════════════════════════════════
 * v2.13.0「聊天背景」设置页：循环视频组（vm + React 桩真渲染一遍面板）
 * ════════════════════════════════════════════════════════════════════════ */
console.log('\n=== v2.13.0「循环视频」设置面板（vm 渲染）===')
const CLIENT_BUNDLE = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const clientCode = fs.readFileSync(CLIENT_BUNDLE, 'utf8')

/* ── 极小 React stub（useState 持久化 + useEffect 只跑一次）── */
const hooks = []
let hookIndex = 0
const ranEffects = new Set()
const React = {
  createElement(type, props, ...children) {
    const kids = children.length === 0 ? undefined : children.length === 1 ? children[0] : children
    return { type, props: Object.assign({}, props || {}, { children: kids }) }
  },
  useState(init) {
    const i = hookIndex++
    if (hooks[i] === undefined) hooks[i] = typeof init === 'function' ? init() : init
    return [hooks[i], (next) => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next }]
  },
  useEffect(fn) {
    const i = hookIndex++
    if (!ranEffects.has(i)) { ranEffects.add(i); fn() }
  },
}
const resetHooks = () => { hookIndex = 0 }

/* ── DOM 桩（面板 apply 会触到 CSS 注入 / 底图层挂载）── */
function mkStyle() { return { _v: {}, setProperty(k, v) { this[k] = String(v) }, removeProperty() {} } }
function mkClassList(el) {
  const set = new Set()
  return { _set: set, add(...c) { c.forEach((x) => set.add(x)) }, remove(...c) { c.forEach((x) => set.delete(x)) }, contains(c) { return set.has(c) }, toggle(c) { set.has(c) ? set.delete(c) : set.add(c) } }
}
function mkEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(), id: '', className: '', textContent: '',
    dataset: {}, style: mkStyle(), attrs: {}, children: [], parentNode: null, _handlers: {},
    setAttribute(k, v) { el.attrs[k] = String(v); if (k === 'id') el.id = String(v) },
    getAttribute(k) { return k in el.attrs ? el.attrs[k] : null },
    removeAttribute(k) { delete el.attrs[k] },
    addEventListener(t, fn) { (el._handlers[t] = el._handlers[t] || []).push(fn) },
    removeEventListener() {},
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = el; el.children.push(c); return c },
    insertBefore(c, ref) {
      if (c.parentNode) c.parentNode.removeChild(c)
      c.parentNode = el
      const i = ref ? el.children.indexOf(ref) : -1
      if (i >= 0) el.children.splice(i, 0, c); else el.children.push(c)
      return c
    },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); c.parentNode = null; return c },
    remove() { if (el.parentNode) el.parentNode.removeChild(el) },
    querySelector() { return null },
    querySelectorAll() { return [] },
    getBoundingClientRect() { return { width: 800, height: 120 } },
    play() { return Promise.resolve() },
    pause() {},
    load() {},
  }
  el.classList = mkClassList(el)
  Object.defineProperty(el, 'firstChild', { get() { return this.children[0] || null } })
  return el
}
const htmlEl = mkEl('html')
const headEl = mkEl('head')
const bodyEl = mkEl('body')
htmlEl.attributes = []
const docListeners = {}
const documentStub = {
  readyState: 'loading',            // 不让 apply 直接 boot（面板测试只关心设置页渲染）
  documentElement: htmlEl,
  head: headEl,
  body: bodyEl,
  hidden: false,
  createElement(tag) { return mkEl(tag) },
  getElementById(id) {
    let found = null
    const visit = (n) => { if (!found && n.id === id) found = n; for (const c of n.children || []) visit(c) }
    visit(bodyEl); if (!found) visit(headEl)
    return found
  },
  querySelector(sel) {
    const mm = /style\[data-plugin-css="([^"]+)"\]/.exec(String(sel || ''))
    if (!mm) return null
    return headEl.children.find((c) => c.tagName === 'STYLE' && c.dataset.pluginCss === mm[1]) || null
  },
  querySelectorAll() { return [] },
  addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn) },
  removeEventListener() {},
}

/* ── fetch 桩：模拟宿主 /chat-wallpaper/* 与 /dsh-startup/* ── */
const ITEM_A = {
  id: 'C:/tmp/.dsh/chat-wallpaper/loops/alpha.mp4', title: 'alpha', kind: 'file',
  folder: 'C:/tmp/.dsh/chat-wallpaper/loops', previewUrl: '',
  videoUrl: '/chat-wallpaper/video?id=alpha', sizeMB: 1.2, mtime: '2026-10-26 01:00:00', tags: [],
}
const MODEL = {
  files: [ITEM_A],
  roots: [
    { path: 'C:/tmp/.dsh/chat-wallpaper/loops', exists: true, removable: false },
    { path: 'C:/loops-extra', exists: true, removable: true },
  ],
  bgMode: 'image', videoMode: 'single', selectedId: '', currentId: '', shuffleMinutes: 0,
  lastSetBody: null, lastRootsBody: null, lastDeleteId: null,
}
const requests = []
const fetchStub = (url, init) => {
  const u = String(url)
  requests.push({ url: u, init })
  const method = (init && init.method) || 'GET'
  const body = init && init.body ? JSON.parse(String(init.body)) : null
  const reply = (payload) => Promise.resolve({ json: () => Promise.resolve(payload), ok: true })
  if (u.includes('/dsh-startup')) return reply({ ok: true, config: { enabled: false } })
  if (u.includes('/chat-wallpaper/videos/roots')) {
    MODEL.lastRootsBody = body
    if (body && body.action === 'add') MODEL.roots.push({ path: body.path, exists: true, removable: true })
    if (body && body.action === 'remove') MODEL.roots = MODEL.roots.filter((r) => r.path !== body.path)
    return reply({ ok: true, roots: MODEL.roots.map((r) => r.path) })
  }
  if (u.includes('/chat-wallpaper/videos/delete')) {
    MODEL.lastDeleteId = body && body.id
    MODEL.files = MODEL.files.filter((f) => f.id !== MODEL.lastDeleteId)
    if (MODEL.selectedId === MODEL.lastDeleteId) MODEL.selectedId = ''
    if (MODEL.currentId === MODEL.lastDeleteId) MODEL.currentId = ''
    return reply({ ok: true, id: MODEL.lastDeleteId })
  }
  if (u.includes('/chat-wallpaper/videos')) {
    return reply({
      ok: true, bgMode: MODEL.bgMode, videoMode: MODEL.videoMode, selectedId: MODEL.selectedId,
      currentId: MODEL.currentId, shuffleMinutes: MODEL.shuffleMinutes,
      roots: MODEL.roots.map((r) => Object.assign({}, r)), items: MODEL.files.map((f) => Object.assign({}, f)),
    })
  }
  if (u.includes('/chat-wallpaper/images')) {
    return reply({
      ok: true, dropDir: 'C:/tmp/.dsh/chat-wallpaper', dropDirExists: true, current: null,
      imageConfig: '', banner: '', bannerOpacity: 0.12, images: [], veil: { light: 0.8, dark: 0.5 },
    })
  }
  if (u.includes('/chat-wallpaper/set')) {
    MODEL.lastSetBody = body
    if (body) {
      if (body.bgMode) MODEL.bgMode = body.bgMode
      if (body.videoMode) MODEL.videoMode = body.videoMode
      if (body.videoShuffleMinutes != null) MODEL.shuffleMinutes = body.videoShuffleMinutes
      if (body.videoId) { MODEL.selectedId = body.videoId; MODEL.currentId = body.videoId; MODEL.bgMode = 'video' }
    }
    return reply({ ok: true, applied: body, config: {} })
  }
  if (u.includes('/chat-wallpaper/config')) {
    return reply({
      ok: true,
      config: { banner: '', bannerOpacity: 0.12, veilLightA: 'rgba(253,250,254,.80)', veilDarkA: 'rgba(8,10,16,.74)' },
      image: null, imageOk: false,
      video: {
        enabled: MODEL.bgMode === 'video', mode: MODEL.videoMode, shuffleMinutes: MODEL.shuffleMinutes,
        selectedId: MODEL.selectedId, count: MODEL.files.length,
        current: MODEL.files.find((f) => f.id === MODEL.currentId) || null,
      },
    })
  }
  if (u.includes('/chat-wallpaper/open-dir')) return reply({ ok: true })
  return reply({ ok: true })
}

const confirmCalls = []
let confirmReturn = true
let captured = null
const sandbox = {
  window: {
    __ModuleLoader__: { load(o) { captured = o } },
    addEventListener() {}, removeEventListener() {},
    innerWidth: 1600,
    confirm(msg) { confirmCalls.push(String(msg)); return confirmReturn },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    localStorage: { getItem: () => null, setItem() {} },
    location: { reload() {} },
  },
  console,
  document: documentStub,
  fetch: fetchStub,
  getComputedStyle: () => ({ backgroundColor: 'rgb(247, 241, 248)' }),
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
  requestAnimationFrame: (fn) => { if (typeof fn === 'function') fn(); return 1 },
  cancelAnimationFrame: () => {},
  setTimeout: (fn, ms) => { if ((ms || 0) <= 400) { try { fn() } catch (e) { /* 忽略 */ } } return 0 },
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
}
vm.createContext(sandbox)
vm.runInContext(clientCode, sandbox, { filename: 'client.js' })
const wallMod = captured.factory((name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
})

const registrations = []
wallMod.apply({
  slots: {
    inject(name, fn) { fn() },
    register(options, render) { registrations.push({ options, render }); return { dispose() {} } },
  },
})
const wallReg = registrations.find((r) => r.options && r.options.id === 'chat-wallpaper')
ok(!!wallReg, '注册了设置页「聊天背景」节')
ok(!!wallReg && wallReg.options.order === 27 && wallReg.options.label === '聊天背景',
  '设置节 id=chat-wallpaper / order=27 / label=聊天背景', wallReg && JSON.stringify(wallReg.options))

const flushP = () => new Promise((r) => setImmediate(r))
function walkNode(node, out = []) {
  if (node === null || node === undefined) return out
  if (typeof node !== 'object') return out
  if (Array.isArray(node)) { node.forEach((n) => walkNode(n, out)); return out }
  if (node.type) { out.push(node); walkNode(node.props && node.props.children, out) }
  return out
}
const findNode = (tree2, pred) => walkNode(tree2).find(pred)
function renderPanel() {
  const el = wallReg.render({ close() {} })
  resetHooks()
  return el.type(el.props)
}
const textsOf = (tree2) => walkNode(tree2).filter((n) => typeof n.props.children === 'string').map((n) => n.props.children)
const hasText = (tree2, needle) => textsOf(tree2).some((t) => String(t).includes(needle)) || JSON.stringify(tree2).includes(needle)

let tree = renderPanel()
ok(JSON.stringify(tree).includes('读取中'), '首屏显示「读取中…」')
await flushP(); await flushP(); await flushP()
tree = renderPanel()

ok(hasText(tree, '循环视频'), '渲染出「循环视频」组')
ok(hasText(tree, '背景类型'), '渲染出「背景类型」下拉')
ok(hasText(tree, '播放模式'), '渲染出「播放模式」下拉')
ok(hasText(tree, '视频目录'), '渲染出「视频目录」区块')
ok(hasText(tree, '视频列表（1）'), '渲染出「视频列表（1）」')
ok(JSON.stringify(tree).includes('alpha'), '视频条目显示标题 alpha')
ok(!!findNode(tree, (n) => n.type === 'button' && n.props.children === '使用'), '有「使用」按钮')
ok(!!findNode(tree, (n) => n.type === 'button' && n.props.children === '删除'), '有「删除」按钮')
ok(JSON.stringify(tree).includes('🎬'), '没有预览图的视频用 🎬 占位')
ok(textsOf(tree).includes('默认目录'), '默认 loops 目录显示「默认目录」（不可移除）')

/* 使用：POST /set {videoId, bgMode:'video'} + 重新 load */
let before = requests.length
findNode(tree, (n) => n.type === 'button' && n.props.children === '使用').props.onClick()
await flushP(); await flushP(); await flushP(); await flushP()
let setReq = requests.slice(before).find((r) => r.url.includes('/chat-wallpaper/set'))
let setBody = setReq && JSON.parse(setReq.init.body)
ok(!!setBody && setBody.videoId === ITEM_A.id && setBody.bgMode === 'video',
  '★ 点「使用」→ POST /chat-wallpaper/set {videoId, bgMode:"video"}', JSON.stringify(setBody))
ok(requests.slice(before).some((r) => r.url.includes('/chat-wallpaper/videos')), '使用后重新加载 /videos 列表')
tree = renderPanel()
ok(JSON.stringify(tree).includes('重播'), '使用后该条按钮变成「重播」')

/* 删除：confirm → POST /videos/delete */
confirmCalls.length = 0
const beforeDel = requests.length
findNode(tree, (n) => n.type === 'button' && n.props.children === '删除').props.onClick()
ok(confirmCalls.length === 1 && String(confirmCalls[0]).includes('alpha'),
  '★ 删除视频先 confirm（文案带视频标题）', String(confirmCalls[0]))
await flushP(); await flushP(); await flushP(); await flushP()
ok(MODEL.lastDeleteId === ITEM_A.id, '★ 删除走 POST /videos/delete {id}', String(MODEL.lastDeleteId))
tree = renderPanel()
ok(hasText(tree, '还没有视频'), '删除后列表为空并提示「还没有视频」')

/* 添加目录：POST /videos/roots {action:add} */
const beforeAdd = requests.length
const rootInput = findNode(tree, (n) => n.type === 'input' && n.props && String(n.props.placeholder || '').includes('wallpapers'))
ok(!!rootInput, '有「添加目录」输入框')
rootInput.props.onChange({ target: { value: 'C:/new-loops' } })
tree = renderPanel()
findNode(tree, (n) => n.type === 'button' && n.props.children === '添加目录').props.onClick()
await flushP(); await flushP(); await flushP(); await flushP()
ok(MODEL.lastRootsBody && MODEL.lastRootsBody.action === 'add' && MODEL.lastRootsBody.path === 'C:/new-loops',
  '★ 添加目录 → POST /videos/roots {action:"add", path}', JSON.stringify(MODEL.lastRootsBody))
ok(requests.slice(beforeAdd).some((r) => r.url.includes('/chat-wallpaper/videos/roots')), '添加目录走 /videos/roots 路由')

/* 移除目录：POST /videos/roots {action:remove} */
tree = renderPanel()
const removeBtn = findNode(tree, (n) => n.type === 'button' && n.props.children === '移除')
ok(!!removeBtn, '自定义视频目录旁有「移除」按钮')
removeBtn.props.onClick()
await flushP(); await flushP(); await flushP(); await flushP()
ok(MODEL.lastRootsBody && MODEL.lastRootsBody.action === 'remove' && String(MODEL.lastRootsBody.path).includes('loops-extra'),
  '★ 移除目录 → POST /videos/roots {action:"remove", path}', JSON.stringify(MODEL.lastRootsBody))

/* 背景类型切到「循环视频」：POST /set {bgMode:'video'} */
const beforeMode = requests.length
tree = renderPanel()
const modeSel = findNode(tree, (n) =>
  n.type === 'select' && Array.isArray(n.props.children) &&
  n.props.children.some((o) => o && o.type === 'option' && o.props.value === 'video'))
ok(!!modeSel, '「背景类型」下拉含「循环视频」选项')
modeSel.props.onChange({ target: { value: 'video' } })
await flushP(); await flushP(); await flushP(); await flushP()
const modeReq = requests.slice(beforeMode).find((r) => r.url.includes('/chat-wallpaper/set'))
const modeBody = modeReq && JSON.parse(modeReq.init.body)
ok(!!modeBody && modeBody.bgMode === 'video', '★ 背景类型切到循环视频 → POST /set {bgMode:"video"}', JSON.stringify(modeBody))

console.log(`\n${fails === 0 ? '✓ 全部通过' : `✗ ${fails} 项失败`}\n`)
process.exit(fails === 0 ? 0 : 1)
