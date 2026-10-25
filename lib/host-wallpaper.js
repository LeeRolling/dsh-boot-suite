/**
 * dsh-chat-wallpaper — host half (宿主半边)
 * ----------------------------------------------------------------------------
 * 只做两件事：
 *   1. 决定显示哪张背景图（显式 image 配置 → ~/.dsh/chat-wallpaper/ 里
 *      mtime 最新的那张图 → 无，回落 DSH 默认底色）
 *   2. 用 HTTP 路由把这张图喂给渲染进程
 *      —— 必须走 HTTP，`file://` 在渲染进程里读不到（跨域/权限）
 *
 * 配置：$DSH_HOME/chat-wallpaper.json（不存在就用默认值）
 *
 * 这一半刻意"绝不抛异常"：壁纸坏了只能是没有壁纸，绝不能影响 DSH 启动。
 */
import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join, basename } from 'node:path'

const HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const CONFIG_FILE = join(HOME, 'chat-wallpaper.json')

/** 默认配置。字段与客户端半边一一对应。 */
const DEFAULTS = {
  /* 聊天底图：往 ~/.dsh/chat-wallpaper/ 里丢张图就自动换背景。
     改图 = 改这个路径（绝对路径）；留空 = 自动用目录里 mtime 最新的那张。 */
  image: '',
  imageFit: 'cover',                                // cover | contain

  /* 大字横幅：铺满窗口的一行大字（**矢量文字，不是图片**，放多大都不糊）。
     用途：一进聊天就一眼看到那行字。
     字号按窗口自动算（先设 100px 量一次宽度，再等比放大），不用手调。
     留空 = 不要横幅。 */
  banner: '',
  bannerOpacity: 0.12,                              // 建议 0.08 ~ 0.25：够醒目，又不挡聊天文字

  /* 浅色主题：压白纱，侧栏半透白 */
  veilLightA: 'rgba(253,250,254,.80)',
  veilLightB: 'rgba(250,247,253,.68)',
  sidebarLight: 'rgba(255,255,255,.78)',
  fallbackLight: '#f7f1f8',

  /* 深色主题：压深纱，侧栏半透黑 —— 白纱配深色主题的浅色文字会糊成一片 */
  veilDarkA: 'rgba(8,10,16,.74)',
  veilDarkB: 'rgba(6,8,14,.62)',
  sidebarDark: 'rgba(22,24,32,.74)',
  fallbackDark: '#0b0d12'
}

function readConfig() {
  try {
    if (!existsSync(CONFIG_FILE)) return { ...DEFAULTS }
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
    const out = { ...DEFAULTS }
    /* 只拷贝 DEFAULTS 里有的键：老配置里的视频字段读的时候就被丢掉（有意迁移）。 */
    for (const k of Object.keys(DEFAULTS)) {
      if (parsed[k] === undefined || parsed[k] === null) continue
      out[k] = typeof DEFAULTS[k] === 'number' ? Number(parsed[k]) : parsed[k]
    }
    return out
  } catch {
    return { ...DEFAULTS }        // 配置坏了就用默认，不抛
  }
}

/**
 * 写配置。**用 writeFileSync 且不带 BOM** —— 带 BOM 的 JSON 会让
 * JSON.parse 静默失败并回落默认值（这个坑踩过：整晚的配置都没生效）。
 * 只写 DEFAULTS 里的键：老配置残留的视频键下次保存时自然消失（有意迁移）。
 */
function writeConfig(cfg) {
  try {
    const clean = {}
    for (const k of Object.keys(DEFAULTS)) {
      clean[k] = cfg[k] === undefined ? DEFAULTS[k] : cfg[k]
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(clean, null, 2) + '\n', 'utf8')
    return true
  } catch {
    return false
  }
}

/**
 * 从颜色串里取出 alpha（设置面板的"纱"滑块用）。
 *
 * ⚠️ 只认**四分量**写法。第一版用了个宽松正则 `[,/\s]([\d.]+)\)`，
 * 结果 `rgb(255,255,255)` 被解析成 alpha=255（抓到的是蓝色通道）——
 * 所以这里宁可啰嗦也要把两种合法写法写清楚，其余一律当作完全不透明。
 */
function alphaOf(v) {
  const s = String(v || '')
  // rgba(8,10,16,.50)
  const comma = /rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/.exec(s)
  if (comma) { const a = parseFloat(comma[1]); if (a >= 0 && a <= 1) return a }
  // rgb(8 10 16 / 50%)  或  rgb(8 10 16 / 0.5)
  const slash = /rgba?\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\/\s*([\d.]+)(%?)\s*\)/.exec(s)
  if (slash) {
    let a = parseFloat(slash[1])
    if (slash[2] === '%') a /= 100
    if (a >= 0 && a <= 1) return a
  }
  return 1        // rgb() 没有 alpha / 不认识的写法 → 完全不透明
}

/**
 * 背景图目录：**丢张图进去就自动换背景**，这就是"换起来方便"的全部机关。
 * （不设上限、不排序，按 mtime 最新的那张赢。）
 */
function wallpaperImageDir() {
  return join(HOME, 'chat-wallpaper')
}

/** 图片候选：丢图目录里的图，按修改时间从新到旧（"刚丢进去的那张"才是直觉上该用的）。 */
function listImages() {
  const out = []
  const dir = wallpaperImageDir()
  try {
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (!/\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(f)) continue
        const p = join(dir, f)
        try {
          const s = statSync(p)
          if (s.size <= 4 * 1024) continue
          out.push({ file: p, size: s.size, mtime: s.mtimeMs })
        } catch { /* 忽略单个坏文件 */ }
      }
    }
  } catch { /* 忽略 */ }
  out.sort((a, b) => b.mtime - a.mtime)
  return out
}

/** 解析背景图，并说明来源 */
function resolveImage(cfg) {
  if (cfg.image && existsSync(cfg.image)) return { file: cfg.image, source: 'config' }
  const list = listImages()
  if (list.length) return { file: list[0].file, source: 'your-library' }
  return { file: null, source: 'none' }
}

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.bmp': 'image/bmp',
}

export default {
  name: 'dsh-chat-wallpaper',
  inject: ['webServer'],
  apply(ctx) {
    const json = (res, status, data) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(data))
    }

    /** GET /chat-wallpaper/config —— 客户端半边启动时读它 */
    const configHandler = (_req, res) => {
      try {
        const cfg = readConfig()
        const img = resolveImage(cfg)
        json(res, 200, {
          ok: true,
          config: cfg,
          image: img.file ? img.file.replace(/\\/g, '/') : null,
          imageSource: img.source,
          imageOk: !!img.file,
        })
      } catch (e) {
        json(res, 200, {
          ok: false,
          config: { ...DEFAULTS },
          image: null,
          imageSource: 'error',
          imageOk: false,
          error: String(e && e.message),
        })
      }
    }

    /**
     * GET /chat-wallpaper/image —— 背景图本体。
     *   ?name=xxx.jpg  指定丢图目录里的某一张（设置面板里预览用）
     *   不带参数       当前生效的那张
     * 安全：name 只取 basename，强制落在丢图目录内。
     */
    const imageHandler = (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost')
        const want = url.searchParams.get('name')
        let file = null
        if (want) {
          const cand = join(wallpaperImageDir(), basename(String(want)))
          if (existsSync(cand)) file = cand
        } else {
          file = resolveImage(readConfig()).file
        }
        if (!file) { res.writeHead(404, { 'cache-control': 'no-store' }); res.end('no image'); return }
        const stat = statSync(file)
        const ext = (file.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase()
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'image/jpeg',
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache',
        })
        createReadStream(file).pipe(res)
      } catch (e) {
        try { res.writeHead(500, { 'cache-control': 'no-store' }); res.end('image error') } catch { /* 忽略 */ }
      }
    }

    /** GET /chat-wallpaper/images —— 设置面板用：丢图目录里有哪几张、现在选了谁 */
    const imagesHandler = (_req, res) => {
      try {
        const cfg = readConfig()
        const cur = resolveImage(cfg)
        const dir = wallpaperImageDir()
        json(res, 200, {
          ok: true,
          dropDir: dir.replace(/\\/g, '/'),
          dropDirExists: existsSync(dir),
          current: cur.file ? cur.file.replace(/\\/g, '/') : null,
          imageConfig: cfg.image || '',
          banner: cfg.banner || '',
          bannerOpacity: cfg.bannerOpacity == null ? 0.12 : cfg.bannerOpacity,
          images: listImages().map((c) => {
            const name = c.file.split(/[\\/]/).pop()
            return {
              name,
              url: '/chat-wallpaper/image?name=' + encodeURIComponent(name),
              sizeKB: Math.round(c.size / 1024),
              mtime: new Date(c.mtime).toISOString().slice(0, 19).replace('T', ' '),
            }
          }),
          veil: {
            light: alphaOf(cfg.veilLightA),
            dark: alphaOf(cfg.veilDarkA),
          },
        })
      } catch (e) {
        json(res, 200, { ok: false, error: String(e && e.message) })
      }
    }

    /** POST /chat-wallpaper/open-dir —— 让用户直接看到"该往哪丢图" */
    const openDirHandler = (_req, res) => {
      try {
        const dir = wallpaperImageDir()
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref()
        json(res, 200, { ok: true, opened: dir.replace(/\\/g, '/') })
      } catch (e) {
        json(res, 200, { ok: false, error: String(e && e.message) })
      }
    }

    /**
     * POST /chat-wallpaper/set —— 设置面板写回配置。
     * 只接受白名单键，值做长度/类型校验，避免面板把配置写成垃圾。
     */
    const ALLOWED_SET = new Set(['image', 'imageFit', 'veilLightA', 'veilLightB', 'veilDarkA', 'veilDarkB', 'banner', 'bannerOpacity'])
    const setHandler = (req, res) => {
      let body = ''
      req.on('data', (c) => { body += c; if (body.length > 16384) req.destroy() })
      req.on('end', () => {
        try {
          const patch = JSON.parse(body || '{}')
          const cfg = readConfig()
          const applied = {}
          for (const k of Object.keys(patch)) {
            if (!ALLOWED_SET.has(k)) continue
            const v = patch[k]
            if (k === 'image') {
              /* 只允许：空字符串（不用图）、丢图目录里的文件名、或存在的绝对路径 */
              if (v === '') { cfg.image = ''; applied.image = ''; continue }
              const s = String(v)
              const inDir = join(wallpaperImageDir(), basename(s))
              if (existsSync(inDir)) { cfg.image = inDir; applied.image = s }
              else if (existsSync(s)) { cfg.image = s; applied.image = s }
              continue
            }
            if (typeof v === 'number' && Number.isFinite(v)) { cfg[k] = v; applied[k] = v; continue }
            if (typeof v === 'string' && v.length <= 120) { cfg[k] = v; applied[k] = v }
          }
          writeConfig(cfg)
          json(res, 200, { ok: true, applied, config: readConfig() })
        } catch (e) {
          json(res, 200, { ok: false, error: String(e && e.message) })
        }
      })
    }

    /** GET /chat-wallpaper/status —— 诊断：用的是哪张图、丢图目录里有什么 */
    const statusHandler = (_req, res) => {
      try {
        const cfg = readConfig()
        const img = resolveImage(cfg)
        json(res, 200, {
          ok: true,
          configFile: CONFIG_FILE.replace(/\\/g, '/'),
          configFileExists: existsSync(CONFIG_FILE),
          /* 背景图：换背景就看这里。丢图目录 + 候选（谁赢了、为什么赢）+ 现在选了谁 */
          image: {
            source: img.source,
            file: img.file ? img.file.replace(/\\/g, '/') : null,
            bytes: img.file ? (() => { try { return statSync(img.file).size } catch { return 0 } })() : 0,
            dropDir: wallpaperImageDir().replace(/\\/g, '/'),
            candidates: listImages().map((c, i) => ({
              pick: i === 0,
              name: c.file.split(/[\\/]/).pop(),
              sizeMB: +(c.size / 1048576).toFixed(2),
              mtime: new Date(c.mtime).toISOString().slice(0, 19),
            })),
          },
        })
      } catch (e) {
        json(res, 200, { ok: false, error: String(e && e.message) })
      }
    }

    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/config', handler: configHandler }))
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/image', handler: imageHandler }))
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/images', handler: imagesHandler }))
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/set', handler: setHandler }))
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/open-dir', handler: openDirHandler }))
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/status', handler: statusHandler }))

    const cfg = readConfig()
    const img = resolveImage(cfg)
    console.log(`[chat-wallpaper] host ready · 背景图 source=${img.source} · file=${img.file ? img.file.replace(/\\/g, '/') : 'fallback'}`)
    console.log(`[chat-wallpaper] 丢图目录：${wallpaperImageDir().replace(/\\/g, '/')}`)
  },
}

/**
 * 设置面板相关逻辑的测试钩子：把这几个纯函数暴露出来，
 * 这样能在不启动 DSH 的情况下实测，而不是靠读代码推测。
 * Cordis 只取 default 导出，多几个命名导出无害。
 */
export function __alphaOf(v) { return alphaOf(v) }
export function __listImages() {
  return listImages().map((c) => ({ name: c.file.split(/[\\/]/).pop(), sizeKB: Math.round(c.size / 1024) }))
}
export function __imageDir() { return wallpaperImageDir().replace(/\\/g, '/') }
