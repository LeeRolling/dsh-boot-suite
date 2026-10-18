#!/usr/bin/env node
/**
 * 帧序列导出：把任意模板按 fps 逐帧渲染成 PNG（剪辑软件可当图片序列导入）。
 *
 * 用法：
 *   node tools/export-frames.mjs --template=550c-homage --fps=30 --out=05-素材/导出/550c
 *   可选：--from=0 --to=16000（毫秒，默认整段）  --width=1280 --height=720
 *
 * 输出：<out>/frame_00001.png ... 以及 <out>/manifest.json（帧率/时长/尺寸）
 * 说明：不依赖 ffmpeg；需要本机有 Chrome。若之后装了 ffmpeg，可用：
 *   ffmpeg -framerate 30 -i frame_%05d.png -c:v libx264 -pix_fmt yuv420p out.mp4
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)=?(.*)$/)
  return m ? [m[1], m[2] || 'true'] : [a, 'true']
}))
const tplId = args.template
if (!tplId) { console.error('缺 --template=<模板id>'); process.exit(2) }
const fps = Math.max(1, Math.min(60, Number(args.fps) || 30))
const W = Number(args.width) || 1280
const H = Number(args.height) || 720
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const tplDir = path.join(root, 'templates', tplId)
const outDir = path.resolve(args.out || path.join('05-素材', '导出', tplId))
const chromePath = args.chrome || process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

function readTpl() {
  const raw = fs.readFileSync(path.join(tplDir, 'template.json'), 'utf8')
  const tpl = JSON.parse(raw)
  for (const L of tpl.layers || []) {
    if (L.ringsFile && (!L.rings || !L.rings.length)) {
      const f = path.join(tplDir, 'assets', String(L.ringsFile))
      if (fs.existsSync(f)) {
        const d = JSON.parse(fs.readFileSync(f, 'utf8'))
        L.rings = Array.isArray(d) ? d : (d.rings || [])
      }
    }
  }
  return tpl
}
const tpl = readTpl()
const duration = Number(tpl.duration) || 6000
const from = Math.max(0, Number(args.from) || 0)
const to = Math.min(duration, Number(args.to) || duration)
const frames = Math.max(1, Math.round(((to - from) / 1000) * fps))

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-export-'))
const libUrl = 'file:///' + path.join(root, 'lib').replace(/\\/g, '/')
const pagePath = path.join(tmp, 'stage.html')
fs.writeFileSync(pagePath, `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${libUrl}/splash.css">
<style>body{margin:0;background:#000;overflow:hidden}</style></head><body>
<div id="dsh-startup-root" class="dsu-root dsu-boot"></div>
<script>
window.__DSH_STARTUP__={enabled:true,mode:'always',theme:'dark',speed:1,requireInteraction:false,allowSkip:false,sound:false,voice:false,identity:'X',identityId:'1',accessLevel:'1'}
window.__DSH_STARTUP_TEMPLATE__=${JSON.stringify(tpl)}
window.__DSH_STARTUP_TPL_BASE__=''
window.__DSH_STARTUP_EDIT__=1
</script><script src="${libUrl}/splash.js"></script></body></html>`)

const profile = path.join(tmp, 'profile')
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--allow-file-access-from-files', '--remote-debugging-port=9333', `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function cdp() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9333/json')).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch (e) { /* 等 chrome 起来 */ }
    await sleep(250)
  }
  throw new Error('连不上 Chrome 调试端口 9333')
}
const page = await cdp()
const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
})
await new Promise((r) => ws.addEventListener('open', r))
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'file:///' + pagePath.replace(/\\/g, '/') })
await sleep(2200)
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result.value
await ev('window.__DSH_STARTUP_API__ && window.__DSH_STARTUP_API__.pause()')

fs.mkdirSync(outDir, { recursive: true })
for (let i = 0; i < frames; i++) {
  const t = from + (i * 1000) / fps
  await ev('window.__DSH_STARTUP_API__.seek(' + Math.round(t) + ')')
  await sleep(45)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const name = 'frame_' + String(i + 1).padStart(5, '0') + '.png'
  fs.writeFileSync(path.join(outDir, name), Buffer.from(shot.data, 'base64'))
  if ((i + 1) % 30 === 0) console.log('  ' + (i + 1) + '/' + frames)
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
  template: tplId, fps, width: W, height: H, from, to, frames,
  note: 'PNG 序列：剪辑软件按"图片序列"导入即可；有 ffmpeg 可直接编码 mp4'
}, null, 2))
try { chrome.kill() } catch (e) { /* noop */ }
console.log('完成：' + frames + ' 帧 → ' + outDir)
