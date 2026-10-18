#!/usr/bin/env node
/* 动效回归检查（借自 motion-web 的"自动化验证"思路）
 *
 * 不靠人眼看：起一个 headless Chrome，按真实时间跑一遍开机动画，断言四件事
 *   1) 没有 JS 异常
 *   2) 画面真的在动（两帧截图字节不同，静止即失败）
 *   3) 分幕文案确实换过（至少 3 种不同状态行）
 *   4) 结束时根节点被移除、done 事件触发（收得干净）
 *
 * 用法：node tools/motion-check.mjs [--template=deep-sonar] [--speed=3] [--chrome=路径]
 * 退出码：0 全过 / 1 有失败 / 2 环境不可用（没 Chrome 等）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const i = a.indexOf('=')
  return i === -1 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)]
}))
const TEMPLATE = args.template || 'deep-sonar'
const SPEED = Number(args.speed || 3)
const CHROME = args.chrome || process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9333

const tplPath = path.join(ROOT, 'templates', TEMPLATE, 'template.json')
if (!fs.existsSync(tplPath)) { console.error('模板不存在: ' + tplPath); process.exit(2) }
if (!fs.existsSync(CHROME)) { console.error('找不到 Chrome: ' + CHROME + '（用 --chrome= 指定）'); process.exit(2) }
const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'))
const libUrl = 'file:///' + path.join(ROOT, 'lib').replace(/\\/g, '/').replace(/ /g, '%20')
const tmp = path.join(os.tmpdir(), 'dsh-motion-' + Date.now() + '.html')
fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${libUrl}/splash.css">
<style>body{margin:0;background:#000}#dsh-startup-root{position:fixed;inset:0}</style></head><body>
<div id="dsh-startup-root" class="dsu-root dsu-boot"></div><script>
window.__DSH_STARTUP__={enabled:true,mode:'always',theme:'light',speed:${SPEED},requireInteraction:false,allowSkip:true,sound:false,voice:false,identity:'MOTION CHECK',identityId:'0000',accessLevel:'1'}
window.__DSH_STARTUP_TEMPLATE__=${JSON.stringify(tpl)}
window.__ERR__=[];window.__DONE__=false
window.addEventListener('error',e=>window.__ERR__.push(String(e.message)))
window.addEventListener('dsh-startup:done',()=>{window.__DONE__=true})
</script><script src="${libUrl}/splash.js"></script></body></html>`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--allow-file-access-from-files', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.join(os.tmpdir(), 'dsh-motion-profile-' + Date.now()), 'about:blank'],
  { stdio: 'ignore' })

let ws, seq = 0
const pending = new Map()
const events = []
function send(method, params = {}) {
  return new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
}

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch (e) { /* 还没起来 */ }
    await sleep(250)
  }
  throw new Error('CDP 连不上')
}

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   [' + detail + ']' : ''))
}

(async () => {
  const url = await connect()
  ws = new WebSocket(url)
  await new Promise((r) => ws.addEventListener('open', r))
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Runtime.exceptionThrown') events.push('EXC: ' + (m.params.exceptionDetails.text || ''))
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
  })
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'file:///' + tmp.replace(/\\/g, '/').replace(/ /g, '%20') })

  const shot = async () => (await send('Page.captureScreenshot', { format: 'png' })).data
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value

  /* 采样点要早：不少模板 1 秒内就把入场演完了，晚采样会误判"没动" */
  await sleep(420)
  const a = await shot()
  const lineA = await ev('(document.querySelector(".dsu-status-zh")||{}).textContent || ""')
  const snapA = await ev('[...document.querySelectorAll(".dsu-tl-layer")].map(function(n){var s=getComputedStyle(n);return s.opacity+"|"+s.transform}).join(";")')
  await sleep(900)
  const b = await shot()
  check('画面在动（两帧不同）', a !== b)

  /* 模型不同，断言不同：
     - 分幕模板（steps[]）：状态行文案必须换过 ≥3 种
     - 时间线模板（layers[]）：图层必须真的在建、且同一图层两时刻的透明度不同 */
  const isTimeline = Array.isArray(tpl.layers) && tpl.layers.length > 0
  if (isTimeline) {
    const layers = await ev('document.querySelectorAll(".dsu-tl-layer").length')
    check('时间线图层建出来了', Number(layers) >= 2, String(layers) + ' 层')
    const s2 = await ev('[...document.querySelectorAll(".dsu-tl-layer")].map(function(n){var s=getComputedStyle(n);return s.opacity+"|"+s.transform}).join(";")')
    check('图层状态随时间变化', snapA !== s2, (snapA === s2 ? '两帧完全相同' : '已变化'))
    /* 时间线按 duration 跑：这里只做粗等，真正收尾下面用轮询等 */
  } else {
    /* 采样要够密：speed=3 时每一幕只有 300–500ms，400ms 采样会跳过中间幕 */
    const seen = new Set([lineA])
    for (let i = 0; i < 40; i++) {
      seen.add(await ev('(document.querySelector(".dsu-status-zh")||{}).textContent || ""'))
      await sleep(150)
    }
    seen.delete('')
    check('分幕文案确实换过（>=3 种）', seen.size >= 3, [...seen].slice(0, 5).join(' / '))
  }

  /* 收尾用轮询等，别赌固定 sleep：不同模型的时长/收尾节奏差很多 */
  const deadline = Date.now() + (isTimeline ? (Number(tpl.duration || 6000) + 6000) : 12000)
  while (Date.now() < deadline) {
    const gone = await ev('!document.getElementById("dsh-startup-root")')
    if (gone) break
    await sleep(250)
  }
  const state = JSON.parse(await ev('JSON.stringify({root: !!document.getElementById("dsh-startup-root"), done: !!window.__DONE__, err: window.__ERR__})'))
  check('结束时根节点被移除', state.root === false)
  check('done 事件触发', state.done === true)
  check('无 JS 异常', state.err.length === 0 && events.length === 0, JSON.stringify(state.err.concat(events)).slice(0, 160))

  const failed = results.filter((r) => !r.ok)
  console.log('')
  console.log('模板 ' + TEMPLATE + ' · speed ' + SPEED + ' → ' + (failed.length ? failed.length + ' 项失败' : '全部通过'))
  ws.close()
  chrome.kill()
  try { fs.unlinkSync(tmp) } catch (e) { /* noop */ }
  process.exit(failed.length ? 1 : 0)
})().catch((e) => {
  console.error('motion-check 出错: ' + (e && e.message))
  try { chrome.kill() } catch (e2) { /* noop */ }
  process.exit(2)
})