/* ============================================================================
 * v2.12.1 回归：时间线片尾不再内嵌淡出 + 自定义 transitionOut 换场紧贴片尾
 * ----------------------------------------------------------------------------
 * 用户实测 bug：v2.12.0 里「第二幕→闪白」时，闪白过程中仍能看到第二幕淡出。
 * 根因是 splash.js 的 runTimeline 结束分支自己 `classList.add('dsu-out-content')`
 * 再等 220ms（内嵌淡出），和转场引擎的覆盖层叠在一起。
 *
 * 这里用一条极简 v2 时间线模板 + **受控 rAF** 真跑一遍（不需要真视频）：
 *   · 片尾之前：没有覆盖层、root 没被加过 dsu-out-content
 *   · 跨过片尾：第 1 时间由转场引擎接管（transitionOut=flash 的覆盖层/状态出现）
 *   · 全程：root 从未被加过 dsu-out-content（内嵌淡出真的删了）
 *
 * 单独成文件（而不是塞进 smoke-splash.mjs）的原因：这个测试需要 `await` 推微任务，
 * 而 smoke-splash 是纯同步的 —— 里面有若干用例的动画 Promise 链不会跑完；一旦在
 * 文件里 await，它们会在 await 期间被调度并抛出延迟异常，干扰断言。
 *
 * 用法：node test/smoke-splash-tl.mjs
 * ========================================================================== */
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const BUNDLE = fileURLToPath(new URL('../lib/splash.js', import.meta.url))

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : '')) }
}
const flush = () => new Promise((r) => setTimeout(r, 0))

/* ── 最小 DOM 桩（时间线路径够用即可）────────────────────────────────────── */
let MARKUP = ''
const MISSED = new Set()
const lookupCache = new Map()
/** 选择器桩：只认 markup 里出现过的 class（和 smoke-splash 同款） */
function lookup(sel) {
  if (!sel) return null
  const key = String(sel)
  if (lookupCache.has(key)) return lookupCache.get(key)
  const m = /\.([A-Za-z0-9_-]+)/.exec(key)
  const cls = m ? m[1] : null
  const found = cls !== null && MARKUP.includes(cls)
  if (!found) MISSED.add(key)
  const node = found ? makeEl('div') : null
  lookupCache.set(key, node)
  return node
}
function makeEl(tag) {
  const el = {
    tagName: tag,
    _cls: '',
    _text: '',
    _html: '',
    style: {
      _v: {},
      setProperty(k, v) { this[k] = String(v) },
      removeProperty(k) { delete this[k] },
    },
    dataset: {},
    children: [],
    hidden: false,
    offsetWidth: 1,
    parentNode: null,
    appendChild(c) { this.children.push(c); if (c) c.parentNode = this; return c },
    insertBefore(c) { this.children.unshift(c); if (c) c.parentNode = this; return c },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c },
    setAttribute() {},
    getAttribute() { return null },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    animate() { return { cancel() {}, finish() {} } },
    getTotalLength() { return 120 },
    querySelector(sel) { return lookup(sel) },
    querySelectorAll() { return [] },
    focus() {},
    contains() { return false },
  }
  Object.defineProperty(el, 'className', {
    get() { return el._cls },
    set(v) { el._cls = v == null ? '' : String(v) },
  })
  Object.defineProperty(el, 'textContent', {
    get() { return el._text },
    set(v) { el._text = v == null ? '' : String(v) },
  })
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html },
    set(v) { el._html = v == null ? '' : String(v); MARKUP = el._html },
  })
  el.classList = {
    add(...cs) { cs.forEach((c) => { el._classAdds.push(c); if (!el._cls.split(' ').includes(c)) el._cls = (el._cls + ' ' + c).trim() }) },
    remove(...cs) { cs.forEach((c) => { el._cls = el._cls.split(' ').filter((x) => x && x !== c).join(' ') }) },
    toggle(c, on) {
      const has = el._cls.split(' ').includes(c)
      const want = on === undefined ? !has : !!on
      if (want && !has) el.classList.add(c)
      if (!want && has) el.classList.remove(c)
    },
    contains(c) { return el._cls.split(' ').includes(c) },
  }
  el._classAdds = []
  return el
}

/* ── 起一个受控 rAF 的页面环境，跑一遍 splash.js ─────────────────────────── */
function boot(cfgOverride, template) {
  MARKUP = ''
  lookupCache.clear()
  const root = makeEl('div')
  root._cls = 'dsu-root dsu-boot'
  const head = makeEl('head')
  const body = makeEl('body')
  const htmlEl = makeEl('html')
  const rafQueue = []

  const documentStub = {
    readyState: 'complete',
    head, body,
    documentElement: htmlEl,
    getElementById: (id) => (id === 'dsh-startup-root' ? root : null),
    createElement: (t) => makeEl(t),
    createElementNS: (_ns, t) => makeEl(t),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  }

  const timers = []
  const windowStub = {
    __DSH_STARTUP__: Object.assign({
      enabled: true, mode: 'always', theme: 'light', speed: 1,
      requireInteraction: false, allowSkip: false, sound: false, voice: false,
      identity: 'JOYCE MOORE', identityId: '0087', accessLevel: '3',
    }, cfgOverride || {}),
    AudioContext: function () {
      return {
        state: 'running', currentTime: 0, sampleRate: 48000, destination: {},
        resume() {},
        createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} } },
        createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } },
        createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) } },
        createBufferSource() { return { buffer: null, connect() {}, start() {} } },
        createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} } },
      }
    },
    location: { host: '127.0.0.1:3080', href: 'http://127.0.0.1:3080/' },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    sessionStorage: { getItem: () => null, setItem() {} },
    localStorage: { getItem: () => null, setItem() {} },
    /* 受控 rAF：回调排队，由测试按假时间一帧帧泵 */
    requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length },
    cancelAnimationFrame() {},
    /* 转场引擎的 wait() 走 200–2000ms 定时器；半程 300ms 同步执行让换场立即完成，
       更长的（兜底清理）入队不执行 —— 和 smoke-splash 同款策略 */
    setTimeout: (fn, ms) => {
      if ((ms || 0) <= 400) { fn(); return -1 }
      timers.push({ fn, ms })
      return timers.length
    },
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    CustomEvent: function (t) { this.type = t },
  }
  windowStub.window = windowStub
  windowStub.__DSH_STARTUP_TEMPLATE__ = template

  const sandbox = {
    window: windowStub,
    document: documentStub,
    console,
    Promise, Object, Array, JSON, String, Number, Math, Date, Error, RegExp, isFinite,
    setTimeout: windowStub.setTimeout,
    clearTimeout: windowStub.clearTimeout,
    setInterval: windowStub.setInterval,
    clearInterval: windowStub.clearInterval,
    requestAnimationFrame: windowStub.requestAnimationFrame,
    cancelAnimationFrame: windowStub.cancelAnimationFrame,
  }
  sandbox.globalThis = sandbox
  sandbox.self = sandbox

  vm.createContext(sandbox)
  let thrown = null
  try {
    vm.runInContext(fs.readFileSync(BUNDLE, 'utf8'), sandbox, { filename: 'splash.js' })
  } catch (e) { thrown = e }
  return { windowStub, root, body, rafQueue, timers, thrown }
}

/* ═══ 开跑 ═════════════════════════════════════════════════════════════════ */
console.log('=== v2.12.1 时间线片尾：不再内嵌淡出、换场紧贴片尾 ===')

const tlTpl = {
  id: 'tl-smoke', duration: 1000,
  layers: [{
    id: 'bg', type: 'panel', pos: [640, 360], panelW: 1280, panelH: 720,
    fill: '#000000', radius: 0,
    keyframes: [{ t: 0, opacity: 1 }, { t: 1000, opacity: 1 }],
  }],
}
const page = boot({ transitionIn: 'none', transitionJoin: 'none', transitionOut: 'flash', transitionMs: 600 }, tlTpl)
check('时间线模板（v2 layers）初始化不抛异常', page.thrown === null, page.thrown && page.thrown.message)

const state = () => page.windowStub.__DSH_TRANSITION_STATE__ || {}
const pumpFrames = (n) => {
  let t = page.fakeNow || 0
  for (let i = 0; i < n; i++) {
    t += 16
    const cbs = page.rafQueue.splice(0, page.rafQueue.length)
    cbs.forEach((fn) => fn(t))
  }
  page.fakeNow = t
}

await flush(); await flush()
check('时间线已开跑（rAF 循环在排队）', page.rafQueue.length > 0, String(page.rafQueue.length))

pumpFrames(30)                       // ≈480ms < 1000ms：还在片尾之前
await flush()
check('片尾之前没有转场覆盖层', state().overlays === 0, String(state().overlays))
check('片尾之前 root 没有被加 dsu-out-content（内嵌淡出已删）',
  !page.root._classAdds.includes('dsu-out-content'), page.root._classAdds.join(','))

pumpFrames(60)                       // 跨过片尾（约 1440ms）
await flush(); await flush(); await flush()
check('★ 跨过片尾后由转场引擎接管（transitionOut=flash 真的执行了）',
  state().lastType === 'flash', JSON.stringify({ lastType: state().lastType, overlays: state().overlays }))
check('★★ 正常时间线路径全程没有 dsu-out-content（两幕独立，边界只归转场引擎）',
  !page.root._classAdds.includes('dsu-out-content'),
  page.root._classAdds.filter((c) => /out-content|handoff/.test(c)).join(','))
check('转场引擎收尾后覆盖层无残留（overlays 归零）', state().overlays === 0, String(state().overlays))

/* 反向验证：默认 transitionOut=dissolve 时同样没有内嵌淡出（旧行为里这也是走 220ms 尾巴的路径） */
{
  const page2 = boot({ transitionIn: 'none', transitionJoin: 'none', transitionOut: 'dissolve' }, tlTpl)
  check('默认 dissolve 退场：时间线模板初始化不抛异常', page2.thrown === null, page2.thrown && page2.thrown.message)
  await flush(); await flush()
  let t = 0
  for (let i = 0; i < 90 && page2.rafQueue.length > 0; i++) {
    t += 16
    const cbs = page2.rafQueue.splice(0, page2.rafQueue.length)
    cbs.forEach((fn) => fn(t))
  }
  await flush(); await flush(); await flush()
  check('★ 默认 dissolve 路径也没有 dsu-out-content（不再多等 220ms 内嵌淡出）',
    !page2.root._classAdds.includes('dsu-out-content'),
    page2.root._classAdds.filter((c) => /out-content|handoff/.test(c)).join(','))
}

console.log(`\n${fail === 0 ? '✓ 全部通过' : `✗ ${fail} 项失败`}（${pass} 项通过）\n`)
process.exit(fail === 0 ? 0 : 1)
