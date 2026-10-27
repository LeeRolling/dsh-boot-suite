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
import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join, basename, resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const CONFIG_FILE = join(HOME, 'chat-wallpaper.json')

/* v2.13.1：插件自带一张默认背景图（随安装包上传，新装用户开箱就有底图）。
   两个哨兵值写进 config.image：
     __default__ = 明确选内置默认图（用户自己的图不参与自动挑选）
     __none__    = 明确不要背景图（否则空字符串在"丢图目录里有图"时会自动挑最新那张） */
const BUILTIN_IMAGE = join(dirname(fileURLToPath(import.meta.url)), 'assets', 'default-background.jpg')
const BUILTIN_IMAGE_ID = '__default__'
const NO_IMAGE_ID = '__none__'

/** 默认配置。字段与客户端半边一一对应。 */
const DEFAULTS = {
  /* 聊天底图：往 ~/.dsh/chat-wallpaper/ 里丢张图就自动换背景。
     改图 = 改这个路径（绝对路径）；留空 = 内置默认图 / 丢图目录 mtime 最新那张；
     '__default__' = 强制内置默认图；'__none__' = 明确不要背景图。 */
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
  fallbackDark: '#0b0d12',

  /* v2.13.0 聊天背景循环视频（默认关，仍是静态底图） */
  bgMode: 'image',                     // image | video
  videoMode: 'single',                 // single 手动选 / shuffle 随机轮换
  videoId: '',                         // 选中的视频 id（视频文件的绝对路径规范化）
  videoRoots: [],                      // 额外的视频存放目录（默认 loops 始终包含）
  videoShuffleMinutes: 0               // 0 = 每次启动随机；>0 = 每 N 分钟换一段
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
function isImageFile(p) {
  try { return statSync(p).isFile() } catch { return false }
}
function resolveImage(cfg) {
  if (cfg.image === NO_IMAGE_ID) return { file: null, source: 'none' }
  if (cfg.image === BUILTIN_IMAGE_ID) {
    return isImageFile(BUILTIN_IMAGE) ? { file: BUILTIN_IMAGE, source: 'builtin' } : { file: null, source: 'none' }
  }
  if (cfg.image && isImageFile(cfg.image)) return { file: cfg.image, source: 'config' }
  const list = listImages()
  if (list.length) return { file: list[0].file, source: 'your-library' }
  if (isImageFile(BUILTIN_IMAGE)) return { file: BUILTIN_IMAGE, source: 'builtin' }
  return { file: null, source: 'none' }
}


/* ══ v2.13.0 循环视频库 ═══════════════════════════════════════════════════
   目录结构（两种都认）：
     1) 普通视频：<任意子目录>/xxx.mp4|webm
     2) 壁纸引擎项目：<子目录>/project.json + file 指向的视频 + preview
   只存本机；宿主只允许播放/删除配置目录内的文件。 */
const VIDEO_RE = /\.(mp4|webm)$/i
const VIDEO_MAX_DEPTH = 4

function defaultVideoRoot() {
  return join(HOME, 'chat-wallpaper', 'loops')
}

/** 实际生效的视频目录：默认 loops 永远在第一位 + 用户自定义目录 */
function videoRootList(cfg) {
  const out = [defaultVideoRoot()]
  const extra = Array.isArray(cfg.videoRoots) ? cfg.videoRoots : []
  for (const raw of extra) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    const p = resolve(raw)
    if (!out.some((x) => x.toLowerCase() === p.toLowerCase())) out.push(p)
    if (out.length >= 9) break
  }
  return out
}

function isInside(pathOne, root) {
  try {
    const p = resolve(pathOne).toLowerCase()
    const r = resolve(root).toLowerCase()
    return p === r || p.startsWith(r + '\\') || p.startsWith(r + '/')
  } catch { return false }
}

function videoItemFromFile(file, root, project) {
  try {
    const st = statSync(file)
    if (!st.isFile() || st.size <= 0) return null
    const folder = dirname(file)
    return {
      id: file.replace(/\\/g, '/'),
      kind: project ? 'project' : 'file',
      title: project ? String(project.title || basename(folder)) : basename(file).replace(/\.[^.]+$/, ''),
      file: file.replace(/\\/g, '/'),
      folder: folder.replace(/\\/g, '/'),
      root: root.replace(/\\/g, '/'),
      preview: project && project.preview ? resolve(folder, project.preview) : '',
      tags: project && Array.isArray(project.tags) ? project.tags.slice(0, 8).map(String) : [],
      sizeMB: +(st.size / 1048576).toFixed(1),
      mtime: new Date(st.mtimeMs).toISOString().slice(0, 19).replace('T', ' ')
    }
  } catch { return null }
}

function readProjectMeta(dir) {
  try {
    const p = join(dir, 'project.json')
    if (!existsSync(p)) return null
    const raw = JSON.parse(readFileSync(p, 'utf8'))
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    if (String(raw.type || '').toLowerCase() !== 'video') return null
    const file = String(raw.file || '').trim()
    if (!file) return null
    return {
      title: String(raw.title || '').slice(0, 80),
      file: file,
      preview: raw.preview ? String(raw.preview) : '',
      tags: raw.tags
    }
  } catch { return null }
}

/** 扫描全部视频目录（递归；壁纸引擎项目文件夹视为一段视频，不再往里递归） */
function scanVideos(cfg) {
  const out = []
  const seenFiles = new Set()
  const roots = videoRootList(cfg)
  function walk(dir, root, depth) {
    if (depth > VIDEO_MAX_DEPTH) return
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    const project = readProjectMeta(dir)
    if (project) {
      const vf = resolve(dir, project.file)
      if (VIDEO_RE.test(vf) && existsSync(vf)) {
        const item = videoItemFromFile(vf, root, project)
        if (item && !seenFiles.has(item.id)) { seenFiles.add(item.id); out.push(item) }
      }
      return                     /* 项目文件夹内部不再当普通文件扫，避免重复 */
    }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory()) { walk(p, root, depth + 1); continue }
      if (!e.isFile() || !VIDEO_RE.test(e.name)) continue
      const item = videoItemFromFile(p, root, null)
      if (item && !seenFiles.has(item.id)) { seenFiles.add(item.id); out.push(item) }
    }
  }
  for (const root of roots) if (existsSync(root)) walk(root, root, 1)
  out.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
  return out
}

function videoById(cfg, id) {
  if (!id) return null
  const items = scanVideos(cfg)
  return items.find((x) => x.id === String(id)) || null
}

/**
 * 解析当前该播哪段视频：bgMode 不是 video 就没有。
 * 配置选中的视频如果已经在本地被删掉 → 自动清空选择（需求：本地删除后同步）。
 * shuffle 模式每次解析随机一段（0 分钟 = 每次启动随机；>0 由客户端定时换）。
 */
function resolveVideo(cfg) {
  if (cfg.bgMode !== 'video') return null
  const items = scanVideos(cfg)
  const want = cfg.videoId ? items.find((x) => x.id === cfg.videoId) : null
  /* 本地删除同步：配置的 videoId 已不在磁盘 → 清空（即使这是最后一段视频也要清） */
  if (cfg.videoId && !want) {
    try { writeConfig({ ...cfg, videoId: '' }) } catch { /* 忽略 */ }
    cfg.videoId = ''
  }
  if (!items.length) return null
  if (want) return want
  if (cfg.videoMode === 'shuffle') return items[Math.floor(Math.random() * items.length)]
  const newest = items.slice().sort((a, b) => (b.mtime < a.mtime ? -1 : b.mtime > a.mtime ? 1 : 0))[0]
  return newest || items[0]
}

function publicVideo(item) {
  if (!item) return null
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    file: item.file,
    folder: item.folder,
    previewUrl: item.preview ? '/chat-wallpaper/video-preview?id=' + encodeURIComponent(item.id) : '',
    videoUrl: '/chat-wallpaper/video?id=' + encodeURIComponent(item.id),
    sizeMB: item.sizeMB,
    mtime: item.mtime,
    tags: item.tags
  }
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
        const vid = resolveVideo(cfg)
        json(res, 200, {
          ok: true,
          config: cfg,
          image: img.file ? img.file.replace(/\\/g, '/') : null,
          imageSource: img.source,
          imageOk: !!img.file,
          video: {
            enabled: cfg.bgMode === 'video',
            mode: cfg.videoMode,
            shuffleMinutes: cfg.videoShuffleMinutes,
            selectedId: cfg.videoId || '',
            count: scanVideos(cfg).length,
            current: publicVideo(vid)
          }
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
          const wanted = String(want)
          if (wanted === BUILTIN_IMAGE_ID) {
            if (isImageFile(BUILTIN_IMAGE)) file = BUILTIN_IMAGE
          } else {
            const cand = join(wallpaperImageDir(), basename(wanted))
            if (isImageFile(cand)) file = cand
            /* 兼容旧 URL：只有用户目录没有同名文件时才回落到内置图 */
            else if (wanted === 'default-background.jpg' && isImageFile(BUILTIN_IMAGE)) file = BUILTIN_IMAGE
          }
        } else {
          file = resolveImage(readConfig()).file
        }
        if (!file) { res.writeHead(404, { 'cache-control': 'no-store' }); res.end('no image'); return }
        const stat = statSync(file)
        if (!stat.isFile()) { res.writeHead(404, { 'cache-control': 'no-store' }); res.end('no image'); return }
        const ext = (file.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase()
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'image/jpeg',
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache',
        })
        const stream = createReadStream(file)
        stream.on('error', () => { try { res.destroy() } catch { /* 忽略 */ } })
        stream.pipe(res)
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
          imageSource: cur.source,
          imageConfig: cfg.image || '',
          banner: cfg.banner || '',
          bannerOpacity: cfg.bannerOpacity == null ? 0.12 : cfg.bannerOpacity,
          images: [
            ...(existsSync(BUILTIN_IMAGE) ? [{
              name: '默认背景（内置）',
              url: '/chat-wallpaper/image?name=' + encodeURIComponent(BUILTIN_IMAGE_ID),
              sizeKB: Math.round(statSync(BUILTIN_IMAGE).size / 1024),
              mtime: '',
              builtin: true,
              selected: cur.source === 'builtin',
            }] : []),
            ...listImages().map((c) => {
              const name = c.file.split(/[\\/]/).pop()
              return {
                name,
                url: '/chat-wallpaper/image?name=' + encodeURIComponent(name),
                sizeKB: Math.round(c.size / 1024),
                mtime: new Date(c.mtime).toISOString().slice(0, 19).replace('T', ' '),
                builtin: false,
                selected: cur.file === c.file,
              }
            }),
          ],
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
    const ALLOWED_SET = new Set(['image', 'imageFit', 'veilLightA', 'veilLightB', 'veilDarkA', 'veilDarkB', 'banner', 'bannerOpacity',
      'bgMode', 'videoMode', 'videoId', 'videoShuffleMinutes'])
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
            if (k === 'imageFit') { if (v === 'cover' || v === 'contain') { cfg.imageFit = v; applied.imageFit = v } continue }
            if (k === 'bgMode') { if (v === 'image' || v === 'video') { cfg.bgMode = v; applied.bgMode = v } continue }
            if (k === 'videoMode') { if (v === 'single' || v === 'shuffle') { cfg.videoMode = v; applied.videoMode = v } continue }
            if (k === 'videoShuffleMinutes') {
              const n = Number(v)
              if (Number.isFinite(n)) { cfg.videoShuffleMinutes = Math.max(0, Math.min(1440, Math.round(n))); applied.videoShuffleMinutes = cfg.videoShuffleMinutes }
              continue
            }
            if (k === 'videoId') {
              const s = String(v || '')
              if (s === '') { cfg.videoId = ''; applied.videoId = ''; continue }
              const item = videoById(cfg, s)
              if (item) { cfg.videoId = item.id; applied.videoId = item.id }
              continue
            }
            if (k === 'image') {
              /* 只允许：空字符串（自动/内置默认）、两个哨兵、丢图目录里的文件名。
                 不接受任意绝对路径（避免成为本地任意文件读取原语）。 */
              if (v === '' || v === NO_IMAGE_ID || v === BUILTIN_IMAGE_ID) {
                cfg.image = String(v || '')
                applied.image = cfg.image
                continue
              }
              const s = String(v)
              const inDir = join(wallpaperImageDir(), basename(s))
              if (isImageFile(inDir)) { cfg.image = inDir; applied.image = s }
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


    /** GET /chat-wallpaper/videos —— 设置面板：目录、视频列表、当前解析结果 */
    const videosHandler = (_req, res) => {
      try {
        const cfg = readConfig()
        const roots = videoRootList(cfg).map((p) => ({ path: p.replace(/\\/g, '/'), exists: existsSync(p), removable: !isInside(defaultVideoRoot(), p) || resolve(p).toLowerCase() !== resolve(defaultVideoRoot()).toLowerCase() }))
        const items = scanVideos(cfg).map(publicVideo)
        const cur = resolveVideo(cfg)
        json(res, 200, {
          ok: true,
          bgMode: cfg.bgMode,
          videoMode: cfg.videoMode,
          selectedId: cfg.videoId || '',
          shuffleMinutes: cfg.videoShuffleMinutes,
          currentId: cur ? cur.id : '',
          roots,
          items
        })
      } catch (e) { json(res, 200, { ok: false, error: String(e && e.message) }) }
    }

    /** GET /chat-wallpaper/video?id=... —— 循环视频本体（支持 Range） */
    const videoHandler = (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost')
        const id = url.searchParams.get('id')
        const cfg = readConfig()
        const item = videoById(cfg, id)
        if (!item) { res.writeHead(404, { 'cache-control': 'no-store' }); res.end('no video'); return }
        const file = item.file.replace(/\//g, '\\')
        if (!existsSync(file) || !isInside(file, item.root)) { res.writeHead(404); res.end('missing'); return }
        const stat = statSync(file)
        const ext = (file.match(/\.[a-z0-9]+$/i) || ['.mp4'])[0].toLowerCase()
        const type = ext === '.webm' ? 'video/webm' : 'video/mp4'
        const range = req.headers && req.headers.range
        if (range) {
          const m = /^bytes=(\d*)-(\d*)$/.exec(String(range))
          if (m) {
            let start = m[1] ? parseInt(m[1], 10) : 0
            let end = m[2] ? parseInt(m[2], 10) : stat.size - 1
            if (start >= stat.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); res.end(); return }
            if (end >= stat.size) end = stat.size - 1
            if (end < start) { res.writeHead(416); res.end(); return }
            res.writeHead(206, {
              'Content-Type': type,
              'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(end - start + 1),
              'Cache-Control': 'no-cache'
            })
            createReadStream(file, { start, end }).pipe(res)
            return
          }
        }
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': String(stat.size), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' })
        createReadStream(file).pipe(res)
      } catch (e) { try { res.writeHead(500); res.end('video error') } catch { /* 忽略 */ } }
    }

    /** GET /chat-wallpaper/video-preview?id=... —— 壁纸引擎项目的 preview.gif（设置页缩略图） */
    const videoPreviewHandler = (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost')
        const cfg = readConfig()
        const item = videoById(cfg, url.searchParams.get('id'))
        if (!item || !item.preview || !existsSync(item.preview) || !isInside(item.preview, item.root)) { res.writeHead(404); res.end(); return }
        const ext = (item.preview.match(/\.[a-z0-9]+$/i) || ['.gif'])[0].toLowerCase()
        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/gif'
        const st = statSync(item.preview)
        res.writeHead(200, { 'Content-Type': mime, 'Content-Length': String(st.size), 'Cache-Control': 'no-cache' })
        createReadStream(item.preview).pipe(res)
      } catch (e) { try { res.writeHead(500); res.end() } catch { /* 忽略 */ } }
    }

    /** POST /chat-wallpaper/videos/delete —— 删除视频（普通视频删文件；壁纸项目删整个文件夹） */
    const videosDeleteHandler = (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { json(res, 405, { ok: false }); return }
      let body = ''
      req.on('data', (c) => { body += c; if (body.length > 16384) req.destroy() })
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}')
          const cfg = readConfig()
          const item = videoById(cfg, payload.id)
          if (!item) { json(res, 404, { ok: false, error: 'not found' }); return }
          const target = item.kind === 'project' ? item.folder.replace(/\//g, '\\') : item.file.replace(/\//g, '\\')
          if (!isInside(target, item.root)) { json(res, 400, { ok: false, error: 'outside root' }); return }
          if (resolve(target).toLowerCase() === resolve(item.root).toLowerCase()) { json(res, 400, { ok: false, error: 'refuse root' }); return }
          rmSync(target, { recursive: item.kind === 'project', force: true })
          if (cfg.videoId && cfg.videoId === item.id) writeConfig({ ...cfg, videoId: '' })
          json(res, 200, { ok: true, id: item.id, kind: item.kind, deleted: item.kind === 'project' ? item.folder : item.file })
        } catch (e) { json(res, 500, { ok: false, error: String(e && e.message) }) }
      })
    }

    /** POST /chat-wallpaper/videos/roots —— {action:'add'|'remove'|'open', path} 管理自定义视频目录 */
    const videoRootsHandler = (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') { json(res, 405, { ok: false }); return }
      let body = ''
      req.on('data', (c) => { body += c; if (body.length > 16384) req.destroy() })
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}')
          const action = String(payload.action || '')
          const cfg = readConfig()
          const raw = String(payload.path || '').trim()
          if (action === 'open') {
            const target = raw ? resolve(raw) : defaultVideoRoot()
            const allowed = videoRootList(cfg).some((r) => resolve(r).toLowerCase() === target.toLowerCase())
            if (!allowed) { json(res, 400, { ok: false, error: 'not a configured root' }); return }
            if (!existsSync(target)) mkdirSync(target, { recursive: true })
            spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref()
            json(res, 200, { ok: true, opened: target.replace(/\\/g, '/') })
            return
          }
          if (action === 'add') {
            if (!raw || !resolve(raw) || raw.length > 260) { json(res, 400, { ok: false, error: 'bad path' }); return }
            const target = resolve(raw)
            if (!existsSync(target)) {
              try { mkdirSync(target, { recursive: true }) } catch (e) { json(res, 400, { ok: false, error: '无法创建目录：' + String(e && e.message) }); return }
            }
            if (!statSync(target).isDirectory()) { json(res, 400, { ok: false, error: '不是目录' }); return }
            const list = videoRootList(cfg)
            if (list.length >= 9) { json(res, 400, { ok: false, error: '最多 8 个自定义目录' }); return }
            if (list.some((r) => resolve(r).toLowerCase() === target.toLowerCase())) { json(res, 200, { ok: true, roots: videoRootList(cfg).map((p) => p.replace(/\\/g, '/')) }); return }
            const next = (Array.isArray(cfg.videoRoots) ? cfg.videoRoots : []).concat([target])
            writeConfig({ ...cfg, videoRoots: next })
            json(res, 200, { ok: true, roots: videoRootList(readConfig()).map((p) => p.replace(/\\/g, '/')) })
            return
          }
          if (action === 'remove') {
            const target = resolve(raw)
            if (target.toLowerCase() === resolve(defaultVideoRoot()).toLowerCase()) { json(res, 400, { ok: false, error: '默认目录不能移除' }); return }
            const next = (Array.isArray(cfg.videoRoots) ? cfg.videoRoots : []).filter((p) => resolve(p).toLowerCase() !== target.toLowerCase())
            writeConfig({ ...cfg, videoRoots: next })
            json(res, 200, { ok: true, roots: videoRootList(readConfig()).map((p) => p.replace(/\\/g, '/')) })
            return
          }
          json(res, 400, { ok: false, error: 'bad action' })
        } catch (e) { json(res, 500, { ok: false, error: String(e && e.message) }) }
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
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/videos', handler: videosHandler }))
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/video', handler: videoHandler }))
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/video-preview', handler: videoPreviewHandler }))
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/videos/delete', handler: videosDeleteHandler }))
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/videos/roots', handler: videoRootsHandler }))
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/chat-wallpaper/status', handler: statusHandler }))

    const cfg = readConfig()
    const img = resolveImage(cfg)
    console.log(`[chat-wallpaper] host ready · 背景图 source=${img.source} · file=${img.file ? img.file.replace(/\\/g, '/') : 'fallback'}`)
    console.log(`[chat-wallpaper] 丢图目录：${wallpaperImageDir().replace(/\\/g, '/')}`)
    try { console.log(`[chat-wallpaper] 循环视频：${scanVideos(cfg).length} 段 · 目录 ${videoRootList(cfg).map((p) => p.replace(/\\/g, '/')).join(' | ')}`) } catch { /* 忽略 */ }
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
