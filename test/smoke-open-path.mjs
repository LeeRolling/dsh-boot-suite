#!/usr/bin/env node
/* ============================================================================
 * smoke-open-path.mjs — 跨平台「打开目录 / 链接」契约测试
 *
 * 事故背景（v2.16.13，macOS）：设置 → 聊天背景 →「打开图片文件夹」直接
 * `spawn('explorer.exe', ...)`，命令不存在时 Node 把 ENOENT 以子进程 'error'
 * 事件异步抛出；没有监听器 → uncaughtException → 整个 DSH 进程退出。
 *
 * 这里锁定三件事：
 *   1) 平台映射：win32 → explorer.exe / darwin → open / 其他 → xdg-open（纯函数，跨平台可测）
 *   2) 打开失败（真实 ENOENT / 同步 throw）只返回 { ok:false }，绝不抛异常、绝不打挂进程
 *   3) 源码约束：lib 里不再出现裸 spawn('explorer.exe') / cmd.exe start 兜底，
 *      打开目录/链接的路由必须走 openTarget
 * ========================================================================== */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'
import { openCommandFor, openTarget } from '../lib/open-path.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra === undefined ? '' : '  → ' + String(extra).slice(0, 400))) }
}

/* ── [1] 平台映射（纯函数，不启动任何进程） ──────────────────────────────── */
console.log('\n[1] openCommandFor：按平台选打开器')
const win = openCommandFor('C:\\Users\\mox\\我的 图片', 'win32')
check('win32 目录 → explorer.exe，参数原样（含空格/中文）',
  win.cmd === 'explorer.exe' && win.args.length === 1 && win.args[0] === 'C:\\Users\\mox\\我的 图片', JSON.stringify(win))
const winUrl = openCommandFor('https://github.com/LeeRolling/dsh-boot-suite', 'win32')
check('win32 链接触发旧行为：cmd.exe /c start "" <url>（windowsHide，避免黑框）',
  winUrl.cmd === 'cmd.exe' && JSON.stringify(winUrl.args) === JSON.stringify(['/c', 'start', '', 'https://github.com/LeeRolling/dsh-boot-suite']) && winUrl.windowsHide === true,
  JSON.stringify(winUrl))
check('win32 盘符路径 C:\\ 不会被当成 URL', openCommandFor('C:\\Users\\mox\\图', 'win32').cmd === 'explorer.exe')
const mac = openCommandFor('/Users/mox/.dsh/chat-wallpaper', 'darwin')
check('darwin 目录 → open，参数原样', mac.cmd === 'open' && mac.args[0] === '/Users/mox/.dsh/chat-wallpaper', JSON.stringify(mac))
const macUrl = openCommandFor('https://example.com/a?b=1', 'darwin')
check('darwin 链接 → open <url>', macUrl.cmd === 'open' && macUrl.args[0] === 'https://example.com/a?b=1', JSON.stringify(macUrl))
const linux = openCommandFor('/home/mox/图片 目录', 'linux')
check('linux 目录 → xdg-open，参数原样', linux.cmd === 'xdg-open' && linux.args[0] === '/home/mox/图片 目录', JSON.stringify(linux))
const linuxUrl = openCommandFor('https://example.com/x', 'linux')
check('linux 链接 → xdg-open <url>', linuxUrl.cmd === 'xdg-open' && linuxUrl.args[0] === 'https://example.com/x', JSON.stringify(linuxUrl))
const other = openCommandFor('/data', 'freebsd')
check('其他平台回落 xdg-open', other.cmd === 'xdg-open', JSON.stringify(other))
const cur = openCommandFor('/tmp/x')
const curExpect = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open'
check('默认 platform 跟随 process.platform（' + process.platform + ' → ' + curExpect + '）', cur.cmd === curExpect, JSON.stringify(cur))

/* ── [2] openTarget 的三种失败/成功形态（假 spawn 注入，进程层面无副作用） ── */
console.log('\n[2] openTarget：spawn 成功 / error 事件 / 同步 throw')
function fakeSpawn(mode, calls) {
  return function (...args) {
    calls.push(args)
    if (mode === 'throw') throw new Error('boom: spawn 同步抛错')
    const child = new EventEmitter()
    child.unref = () => { child.unrefCalled = true }
    if (mode === 'spawn') setTimeout(() => child.emit('spawn'), 0)
    else if (mode === 'error') setTimeout(() => child.emit('error', new Error('spawn open ENOENT')), 0)
    /* mode === 'never'：既不回 'spawn' 也不回 'error'，验证 1s 兜底不会让路由永久挂起 */
    return child
  }
}

let calls = []
let r = await openTarget('/Users/mox/图片 目录', { platform: 'darwin', spawnFn: fakeSpawn('spawn', calls) })
check('成功拉起 → {ok:true, cmd:"open"}', r.ok === true && r.cmd === 'open', JSON.stringify(r))
check('子进程 detached + stdio:ignore + unref（不阻塞宿主）',
  calls.length === 1 && calls[0][2] && calls[0][2].detached === true && calls[0][2].stdio === 'ignore',
  JSON.stringify(calls[0] && calls[0][2]))

calls = []
r = await openTarget('/Users/mox/x', { platform: 'darwin', spawnFn: fakeSpawn('error', calls) })
check('★ 打开器不存在（子进程 error/ENOENT）→ {ok:false}，不抛不崩',
  r.ok === false && r.cmd === 'open' && /ENOENT/.test(String(r.error)), JSON.stringify(r))

calls = []
r = await openTarget('/Users/mox/x', { platform: 'win32', spawnFn: fakeSpawn('throw', calls) })
check('★ spawn 同步 throw → {ok:false}（不冒泡成未捕获异常）',
  r.ok === false && /boom/.test(String(r.error)), JSON.stringify(r))

calls = []
r = await openTarget('https://github.com/LeeRolling/dsh-boot-suite', { platform: 'win32', spawnFn: fakeSpawn('spawn', calls) })
check('win32 打开链接 → spawn cmd.exe /c start "" <url>（windowsHide:true）',
  r.ok === true && r.cmd === 'cmd.exe' && calls[0][0] === 'cmd.exe' &&
  JSON.stringify(calls[0][1]) === JSON.stringify(['/c', 'start', '', 'https://github.com/LeeRolling/dsh-boot-suite']) &&
  calls[0][2] && calls[0][2].windowsHide === true,
  JSON.stringify(calls[0]))

calls = []
r = await openTarget('https://github.com/LeeRolling/dsh-boot-suite', {
  platform: 'darwin', cmd: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', spawnFn: fakeSpawn('spawn', calls)
})
check('显式 cmd（如已定位的 Chrome）→ 用该命令、参数是 URL',
  r.ok === true && r.cmd === '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' &&
  calls[0][0] === r.cmd && calls[0][1][0] === 'https://github.com/LeeRolling/dsh-boot-suite',
  JSON.stringify(calls[0]))

const t0 = Date.now()
const pendingNever = openTarget('/Users/mox/x', { platform: 'darwin', spawnFn: fakeSpawn('never', []) })
/* 兜底 timer 是 unref 的（宿主里不该为了等兜底而吊住进程），测试里自己留一个 ref 住的 timer
   让事件循环活着，才能观察到 1s 兜底真的 resolve。 */
const keepAlive = setTimeout(() => {}, 1200)
r = await pendingNever
clearTimeout(keepAlive)
const elapsed = Date.now() - t0
check('子进程既不回 spawn 也不回 error → 1s 兜底 resolve（路由不会永久挂起）',
  r.ok === true && r.cmd === 'open' && elapsed >= 900 && elapsed < 5000, 'elapsed=' + elapsed + 'ms ' + JSON.stringify(r))

/* ── [3] 真实 spawn：命令不存在时测试进程必须存活 ─────────────────────────── */
console.log('\n[3] 真实 ENOENT：openTarget 必须返回 {ok:false} 而不是打挂本进程')
const missing = process.platform === 'win32' ? 'dsh-no-such-opener-xyz.exe' : 'dsh-no-such-opener-xyz'
r = await openTarget(path.join(ROOT, 'test'), { cmd: missing })
check('★★★ spawn 不存在的命令 → {ok:false} + error 文本', r.ok === false && String(r.error || '').length > 0, JSON.stringify(r))
check('★★★ 本测试进程存活（上面这行还能跑）', true)
r = await openTarget(path.join(ROOT, 'test'), { platform: 'darwin', cmd: missing })
check('★★ 第二次仍然不抛（error 监听器没被消费掉）', r.ok === false, JSON.stringify(r))

/* ── [4] 源码约束：防止以后又把 Windows-only 的裸 spawn 加回来 ───────────── */
console.log('\n[4] 源码约束：打开目录/链接统一走 openTarget')
function readLib(name) { try { return fs.readFileSync(path.join(ROOT, 'lib', name), 'utf8') } catch (e) { return '' } }
const wall = readLib('host-wallpaper.js')
const startup = readLib('host-startup.js')
check('host-wallpaper.js 不再裸 spawn(\'explorer.exe\')', !/spawn\(\s*'explorer\.exe'/.test(wall) && wall.length > 0)
check('host-wallpaper.js 的打开目录路由走 openTarget（≥2 处）', (wall.match(/openTarget\(/g) || []).length >= 2,
  String((wall.match(/openTarget\(/g) || []).length))
check('host-wallpaper.js 两处打开失败都回写 {ok:false}', (wall.match(/if \(!opened\.ok\)/g) || []).length >= 2,
  String((wall.match(/if \(!opened\.ok\)/g) || []).length))
check('host-startup.js 不再裸 spawn(\'explorer.exe\')', !/spawn\(\s*'explorer\.exe'/.test(startup) && startup.length > 0)
check('host-startup.js 不再有 cmd.exe /c start 直接兜底（改为只在 win32 URL 用，见 open-path.js）',
  !/spawn\(\s*'cmd\.exe'\s*,\s*\[\s*'\/c'\s*,\s*'start'/.test(startup))
check('host-startup.js 的打开下载目录/浏览器走 openTarget（≥2 处）', (startup.match(/openTarget\(/g) || []).length >= 2,
  String((startup.match(/openTarget\(/g) || []).length))
check('host-startup.js 三处打开失败都回写 {ok:false}', (startup.match(/if \(!opened\.ok\)/g) || []).length >= 3,
  String((startup.match(/if \(!opened\.ok\)/g) || []).length))
check('lib/open-path.js 自身监听子进程 error', /child\.on\('error'/.test(readLib('open-path.js')))
check('lib/open-path.js 有 1s 兜底（不依赖单一路径的事件）', /setTimeout\(/.test(readLib('open-path.js')))

/* ── 汇总 ──────────────────────────────────────────────────────────────── */
console.log('\n' + (fail === 0 ? '✓ 全部通过' : '✗ ' + fail + ' 项失败') + '（' + pass + ' 项通过）')
process.exit(fail === 0 ? 0 : 1)
