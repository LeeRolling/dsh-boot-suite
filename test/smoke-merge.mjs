// 合并契约测试：一个包、一条 bundle 行、一个 client 模块 id，两半都在
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

/* 隔离：lib/index.js 的宿主半侧在模块加载时读 DSH_HOME，apply() 还会往那里写
   诊断日志 —— 用临时目录，绝不碰真实的 ~/.dsh。 */
const TMP_HOME = path.join(os.tmpdir(), 'dsh-merge-smoke-' + Date.now())
fs.mkdirSync(TMP_HOME, { recursive: true })
process.env.DSH_HOME = TMP_HOME

let pass = 0, fail = 0
const check = (label, ok, extra) => {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  → ' + extra : '')) }
}

console.log('\n[1] 包身份')
const pkg = JSON.parse(read('package.json'))
check('包名 = dsh-boot-suite', pkg.name === 'dsh-boot-suite', pkg.name)
check('版本号是合法 semver', /^\d+\.\d+\.\d+$/.test(pkg.version), pkg.version)
check('有 dsh.bundle.patch', pkg.dsh?.bundle?.patch === './cordis.patch.yml')
check('dsh.client 注入了设置页服务', (pkg.dsh?.client?.inject || []).includes('@deepseek-ai/dsh-client-ui-settings'))

console.log('\n[2] 只有一条 bundle 行')
const patch = read('cordis.patch.yml')
const rows = patch.split('\n').filter((l) => /^\s+- id:/.test(l))
check('cordis.patch.yml 只有 1 条 insert 行', rows.length === 1, rows.join(' | '))
check('行 id = dsh-boot-suite', /- id:\s*dsh-boot-suite\s*$/.test(patch.trim().split('\n').pop() || '') || patch.includes('- id: dsh-boot-suite'))
check('行 name = dsh-boot-suite', patch.includes('name: dsh-boot-suite'))

console.log('\n[3] 浏览器半：只注册一次模块')
const client = read('lib/client.js')
const loads = client.match(/__ModuleLoader__\.load\(/g) || []
check('ModuleLoader.load 只调用 1 次', loads.length === 1, String(loads.length))
check('注册 id = dsh-boot-suite', client.includes("id: 'dsh-boot-suite'"))
check('地址栏常量没有被误改（/dsh-startup 与 /chat-wallpaper 都还在）',
  client.includes("var API = '/dsh-startup/config'") && client.includes("var API = '/chat-wallpaper'"))
check('开机动画半侧的设置页契约还在（exports.apply / inject slots）',
  client.includes('exports.apply = apply') && client.includes('module.exports.inject = __bootHalf.inject'))
check('壁纸半侧的测试钩子还在（__applyNow / __buildCss / __teardown）',
  client.includes('exports.__applyNow = applyNow') &&
  client.includes('exports.__buildCss = buildCss') &&
  client.includes('exports.__teardown = teardown'))
check('聊天壁纸的视频死管线已删掉（无 mountLayer / preloadVideo / startWhenFree / video 路由）',
  !client.includes('__mountLayer') && !client.includes('__preloadVideo') &&
  !client.includes('__startWhenFree') && !client.includes('/chat-wallpaper/video'),
  ['__mountLayer', '__preloadVideo', '__startWhenFree', '/chat-wallpaper/video'].filter((s) => client.includes(s)).join(', '))
/* v2.12.0 起 client 合法地创建一次 <video>：设置页「导入动画」时探测用户视频的时长。
   这条断言把它钉在"唯一且只用于导入探测"上，防止旧聊天壁纸视频管线借壳回来。 */
const videoCreateCount = (client.match(/createElement\('video'\)/g) || []).length
check('client 只在「导入动画探时长」里创建 <video>（不是聊天壁纸视频层）',
  videoCreateCount === 1 && !client.includes('/chat-wallpaper/video'),
  'createElement(video) × ' + videoCreateCount)
/* 不带 __ 前缀的普通 token 扫描：防止有人换个名字把视频/浮层面板塞回来 */
const deadTokens = ['mountLayer', 'preloadVideo', 'startWhenFree', 'mountPanel', 'replayIntro', '__PANEL_ID', '/chat-wallpaper/video']
const foundTokens = deadTokens.filter((t) => client.includes(t))
check('普通 token 扫描：mountLayer/preloadVideo/startWhenFree/mountPanel/replayIntro/__PANEL_ID//chat-wallpaper/video 一个都不剩',
  foundTokens.length === 0, foundTokens.join(', '))
check('壁纸半侧确实被受管调用（module.exports.apply 里调 __wallHalf.apply）',
  client.includes('__wallHalf.apply(ctx)'))
check('版本号兜底常量与 package.json 一致', client.includes("FALLBACK_VERSION = '" + pkg.version + "'"))

console.log('\n[4] 两套配置文件名没动（老用户设置原样生效）')
const hostStartup = read('lib/host-startup.js')
const hostWall = read('lib/host-wallpaper.js')
check('开机动画仍读 dsh-startup.json', hostStartup.includes("dsh-startup.json"))
check('聊天壁纸仍读 chat-wallpaper.json', hostWall.includes("chat-wallpaper.json"))
const index = read('lib/index.js')
check('index.js 同时 import 两个宿主半', index.includes("./host-startup.js") && index.includes("./host-wallpaper.js"))
check('导出里只剩三个纯函数（__alphaOf / __listImages / __imageDir）',
  index.includes('__alphaOf') && index.includes('__listImages') && index.includes('__imageDir'))
check('视频解析钩子已从导出删掉（parseTimecode / __resolveForTest）',
  !index.includes('parseTimecode') && !index.includes('__resolveForTest'))

console.log('\n[5] 两半的 DOM / 全局命名没有互相污染')
check('开机动画根节点 id 未被改', client.includes("'dsh-startup-root'"))
check('壁纸层 id 契约未变（底图 #dsh-cw-bg / 横幅 #dsh-cw-banner）',
  client.includes("BG_ID = 'dsh-cw-bg'") && client.includes("BANNER_ID = 'dsh-cw-banner'"))
check('两套样式 tag 键仍各自独立',
  client.includes("'dsh-startup-screen/main.css'") && client.includes("'dsh-chat-wallpaper/main.css'"))
check('开机动画全局标记未被改', client.includes('__DSH_STARTUP_BOOT__') && client.includes('__DSH_STARTUP__'))
check('壁纸"一轮会话只放一次"的标记已删（视频不播了，不需要它）', !client.includes('intro-shown'))

console.log('\n[6] 运行时两半都起得来（假 ctx）')
const mod = await import(pathToFileURL(path.join(ROOT, 'lib', 'index.js')).href)
const routes = new Map()
let taps = 0
const webServer = {
  register(route) { routes.set((route.kind || 'exact') + ' ' + route.path, route); return () => {} },
  tapIndex(fn) { taps++; return () => {} },
}
const connection = { requestRejection: () => false }
const ctx = {
  get: (svc) => (svc === 'webServer' ? webServer : svc === 'connection' ? connection : undefined),
  connection,
  logger: { warn() {} },
  effect: (fn) => { const d = fn(); return d },
  webServer,
}
mod.apply(ctx)
check('开机动画路由都在', ['/dsh-startup/splash.css', '/dsh-startup/splash.js', '/dsh-startup/config'].every((p) => routes.has('exact ' + p)))
const wallpaperPaths = [
  '/chat-wallpaper/config', '/chat-wallpaper/image', '/chat-wallpaper/images',
  '/chat-wallpaper/set', '/chat-wallpaper/open-dir', '/chat-wallpaper/status',
]
check('壁纸路由都在（config/image/images/set/open-dir/status）',
  wallpaperPaths.every((p) => routes.has('exact ' + p)))
const wallRoutes = [...routes.keys()].filter((k) => k.includes('/chat-wallpaper/'))
check('★ 视频路由 /chat-wallpaper/video 已删除', !routes.has('exact /chat-wallpaper/video'))
check('壁纸路由数量 = 6（没有遗留路由）', wallRoutes.length === 6, wallRoutes.join(' | '))
check('tapIndex 只注册 1 次', taps === 1, String(taps))
/* 2.1.1 的坑：把 <script> 包进 html 行，桌面端页面侧解释器按文本插入，脚本永不执行，
   开机动画整段消失。运行时脚本必须是 script-src 这种一等公民行。 */
check('运行时脚本用的是 script-src 行，没塞进 html 行',
  hostStartup.includes("kind: 'script-src'") && !/html:\s*'[^']*<script/i.test(hostStartup))
check('无 webServer 时 apply 不炸', (() => {
  try { mod.apply({ get: () => undefined, effect: (f) => f(), logger: { warn() {} } }); return true } catch (e) { return false }
})())

console.log('\n' + (fail === 0 ? '合并契约：全部通过（' + pass + ' 项）' : fail + ' 项失败 / ' + pass + ' 项通过'))
try { fs.rmSync(TMP_HOME, { recursive: true, force: true }) } catch { /* 清理失败不影响结果 */ }
process.exit(fail === 0 ? 0 : 1)
