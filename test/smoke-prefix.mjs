/* ============================================================================
 * 反代/子路径前缀回归测试 —— 不装进 DSH，直接加载浏览器半侧源码验证：
 *   1) client.js 的 mountPrefix / withBase：根部署前缀必须是空串（回归项），
 *      子路径部署（fnOS 网关 /app/fn-deepseek-harness）必须补全前缀；
 *   2) splash.js 的 DSU_ROUTE：从脚本自身 src 反推路由根，根部署与子路径都对；
 *   3) 非根绝对 URL（https://…、相对路径）必须原样返回，不能被二次改写。
 * 用法：node test/smoke-prefix.mjs
 * ========================================================================== */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : '')) }
}

/* ── 极小的浏览器外壳：够 client.js / splash.js 顶层执行 ────────────────── */
function makeDocument() {
  const el = () => ({
    dataset: {}, style: {}, children: [],
    setAttribute() {}, appendChild() {}, removeChild() {},
    addEventListener() {}, removeEventListener() {},
    classList: { add() {}, remove() {}, contains: () => false },
  })
  return {
    currentScript: null,
    readyState: 'complete',
    createElement: el,
    createElementNS: el,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    head: { appendChild() {} },
    body: Object.assign(el(), { appendChild() {} }),
    documentElement: Object.assign(el(), { classList: { add() {}, remove() {}, contains: () => false } }),
  }
}

const ReactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: () => {},
  useRef: (init) => ({ current: init === undefined ? null : init }),
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  Fragment: 'Fragment',
}

/** 加载 lib/client.js，拿到 factory 的 exports（含 __mountPrefix/__withBase 钩子）。 */
function loadClient(pathname) {
  const code = fs.readFileSync(path.join(ROOT, 'lib', 'client.js'), 'utf8')
  let entry = null
  const windowStub = {
    location: { pathname },
    __ModuleLoader__: { load: (e) => { entry = e } },
    addEventListener() {},
    localStorage: { getItem: () => null, setItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
  }
  const documentStub = makeDocument()
  const fetchStub = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' })
  const noop = () => {}
  const fn = new Function(
    'window', 'document', 'location', 'self', 'fetch',
    'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame',
    code,
  )
  fn(
    windowStub, documentStub, windowStub.location, windowStub, fetchStub,
    class { observe() {} disconnect() {} },
    (cb) => setTimeout(cb, 0), noop,
  )
  if (!entry || !entry.factory) throw new Error('client.js 没有注册 ModuleLoader 模块')
  return entry.factory((id) => (id === 'react' ? ReactStub : {}))
}

/** 加载 lib/splash.js（带 LOADED 守卫时只跑前缀计算），返回它写下的路由根。 */
function loadSplashRoute(currentScriptSrc) {
  const code = fs.readFileSync(path.join(ROOT, 'lib', 'splash.js'), 'utf8')
  const windowStub = { __DSH_STARTUP_LOADED__: true }
  const documentStub = { currentScript: currentScriptSrc === null ? null : { src: currentScriptSrc } }
  const fn = new Function('window', 'document', code)
  fn(windowStub, documentStub)
  return windowStub.__DSH_STARTUP_API_BASE__
}

/* ── 1. 根部署（127.0.0.1:3080）：前缀必须为空串（回归项）───────────────── */
console.log('根部署 /')
{
  const mod = loadClient('/')
  check('mountPrefix 为空串', mod.__mountPrefix === '', JSON.stringify(mod.__mountPrefix))
  check('withBase 保持 /dsh-startup/config 不变', mod.__withBase('/dsh-startup/config') === '/dsh-startup/config', mod.__withBase('/dsh-startup/config'))
  check('withBase 保持 /chat-wallpaper 不变', mod.__withBase('/chat-wallpaper') === '/chat-wallpaper', mod.__withBase('/chat-wallpaper'))
  check('splash DSU_ROUTE 为 /dsh-startup', loadSplashRoute('http://127.0.0.1:3080/dsh-startup/splash.js') === '/dsh-startup', loadSplashRoute('http://127.0.0.1:3080/dsh-startup/splash.js'))
}

/* ── 2. fnOS 应用网关子路径：必须补全挂载前缀 ───────────────────────────── */
console.log('子路径部署 /app/fn-deepseek-harness')
{
  const MOUNT = '/app/fn-deepseek-harness'
  const mod = loadClient(MOUNT)
  check('mountPrefix 等于挂载目录', mod.__mountPrefix === MOUNT, JSON.stringify(mod.__mountPrefix))
  check('配置接口补前缀', mod.__withBase('/dsh-startup/config') === MOUNT + '/dsh-startup/config', mod.__withBase('/dsh-startup/config'))
  check('模板接口补前缀', mod.__withBase('/dsh-startup/templates') === MOUNT + '/dsh-startup/templates', mod.__withBase('/dsh-startup/templates'))
  check('聊天背景接口补前缀', mod.__withBase('/chat-wallpaper/config') === MOUNT + '/chat-wallpaper/config', mod.__withBase('/chat-wallpaper/config'))
  check('宿主下发视频 URL 补前缀', mod.__withBase('/chat-wallpaper/video?id=a') === MOUNT + '/chat-wallpaper/video?id=a', mod.__withBase('/chat-wallpaper/video?id=a'))
  check('宿主下发缩略图 URL 补前缀', mod.__withBase('/chat-wallpaper/image?name=a.jpg') === MOUNT + '/chat-wallpaper/image?name=a.jpg', mod.__withBase('/chat-wallpaper/image?name=a.jpg'))
  check('带尾斜杠的挂载路径不重复加斜杠', loadClient(MOUNT + '/').__mountPrefix === MOUNT, loadClient(MOUNT + '/').__mountPrefix)
  const src = 'https://fn.hlhk.fun:5443/app/fn-deepseek-harness/dsh-startup/splash.js?t=1'
  check('splash DSU_ROUTE 补前缀', loadSplashRoute(src) === MOUNT + '/dsh-startup', loadSplashRoute(src))
}

/* ── 3. 不应该被改写的 URL ─────────────────────────────────────────────── */
console.log('URL 透传')
{
  const mod = loadClient('/app/fn-deepseek-harness')
  check('https 绝对 URL 原样返回', mod.__withBase('https://example.test/a') === 'https://example.test/a', mod.__withBase('https://example.test/a'))
  check('相对路径原样返回', mod.__withBase('plugins/a.js') === 'plugins/a.js', mod.__withBase('plugins/a.js'))
  check('空值不抛异常', mod.__withBase(null) === '' && mod.__withBase(undefined) === '', mod.__withBase(null))
}

console.log('\n%d 通过，%d 失败', pass, fail)
if (fail > 0) process.exit(1)