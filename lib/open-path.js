/**
 * dsh-open-path — 跨平台「用系统默认方式打开目录 / 链接」
 * ----------------------------------------------------------------------------
 * 为什么单独抽出来：
 *   1. 各平台打开器不同：Windows 用 explorer.exe、macOS 用 open、Linux 用 xdg-open；
 *   2. 更要命的是「打开器不存在」时 Node 不会同步抛错，而是把 ENOENT 以子进程
 *      'error' 事件异步抛出来——没有监听器就变成未捕获异常，直接打挂整个 DSH
 *      进程（v2.16.13 在 macOS 上点「打开图片文件夹」的真实事故）。
 * 所以这里统一做两件事：按平台选命令 + 永远监听 'error'。
 * 打开失败只返回 { ok:false, error }，绝不 throw / reject，绝不影响宿主存活。
 */
import { spawn } from 'node:child_process'

/** 是不是「明确带 scheme 的 URL」（只认 http(s)/mailto；Windows 盘符 C:\ 不算 URL） */
function isUrl(target) {
  return /^(https?|mailto):/i.test(String(target))
}

/**
 * 各平台「打开目录 / 链接」的系统命令。纯函数，方便单测；不真的启动进程。
 * @param {string} target 目录或 URL
 * @param {string} [platform] 默认取 process.platform（测试可注入）
 * @returns {{ cmd: string, args: string[], windowsHide?: boolean }}
 */
export function openCommandFor(target, platform = process.platform) {
  const arg = String(target)
  if (platform === 'win32') {
    /* URL 交给默认浏览器：cmd.exe /c start "" <url> 是 Windows 上最稳的方式
       （explorer.exe <url> 也常能转交，但那是 shell 的隐式行为，不依赖它）。
       这条分支与 v2.16.13 行为保持一致，只是外面多了 'error' 监听。 */
    if (isUrl(arg)) return { cmd: 'cmd.exe', args: ['/c', 'start', '', arg], windowsHide: true }
    return { cmd: 'explorer.exe', args: [arg] }
  }
  if (platform === 'darwin') return { cmd: 'open', args: [arg] }
  return { cmd: 'xdg-open', args: [arg] }
}

/**
 * 用系统默认方式打开目录或链接。永远 resolve、永远不抛：
 *   · 正常拉起   → { ok:true, cmd }
 *   · 命令不存在 → { ok:false, cmd, error }（ENOENT 被 'error' 监听器接住）
 *   · 同步 throw → { ok:false, cmd, error }
 * 子进程 detached + unref，不阻塞宿主，也不拖住 DSH 退出。
 * @param {string} target 目录或 URL
 * @param {{ platform?: string, cmd?: string, args?: string[], spawnFn?: Function }} [opts]
 *   cmd：显式指定打开器（例如已定位到的 Chrome 可执行文件）；spawnFn：仅测试注入。
 * @returns {Promise<{ ok: boolean, cmd: string, error?: string }>}
 */
export function openTarget(target, opts = {}) {
  const platform = opts.platform || process.platform
  const picked = opts.cmd
    ? { cmd: String(opts.cmd), args: Array.isArray(opts.args) ? opts.args : [String(target)] }
    : openCommandFor(target, platform)
  const spawnFn = opts.spawnFn || spawn
  const spawnOpts = { detached: true, stdio: 'ignore' }
  if (picked.windowsHide !== undefined) spawnOpts.windowsHide = picked.windowsHide
  return new Promise((resolve) => {
    let settled = false
    let timer = null
    const done = (result) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(result)
    }
    /* Node >= 20 的 spawn 一定会发 'spawn' 或 'error' 二者之一，正常不会等到这个兜底；
       留着只是防止将来行为变化时路由永久挂起（ENOENT 的 'error' 在同一 tick 更早到达）。 */
    timer = setTimeout(() => done({ ok: true, cmd: picked.cmd }), 1000)
    if (timer && typeof timer.unref === 'function') timer.unref()
    let child
    try {
      child = spawnFn(picked.cmd, picked.args, spawnOpts)
    } catch (err) {
      done({ ok: false, cmd: picked.cmd, error: errorText(err) })
      return
    }
    /* 关键一步：不监听 'error' 的话，spawn 找不到命令会变成 uncaughtException */
    if (child && typeof child.on === 'function') {
      child.on('error', (err) => done({ ok: false, cmd: picked.cmd, error: errorText(err) }))
      child.on('spawn', () => done({ ok: true, cmd: picked.cmd }))
    } else {
      done({ ok: true, cmd: picked.cmd })
    }
    try { if (child && typeof child.unref === 'function') child.unref() } catch (err) { /* 忽略 */ }
  })
}

function errorText(err) {
  return String((err && err.message) || err || 'unknown error')
}
