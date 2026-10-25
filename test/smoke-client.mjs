/* ============================================================================
 * 浏览器半侧冒烟测试 —— 不装进 DSH，直接按 ModuleLoader 的加载方式把
 * lib/client.js 跑起来，并用一套极小的 React stub 真渲染一遍设置面板，
 * 验证：bundle 协议 / 注册 id / slots.inject 参数 / 读配置 / 改身份名称 /
 *       保存 POST 体 / 恢复默认 / 立即预览。
 * 用法：node smoke-client.mjs
 * ========================================================================== */
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : '')) }
}

/* ── 极小的 React stub：够跑函数组件 + useState/useEffect ────────────────── */
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
  useStateReset() {},
}
function resetHooks() { hookIndex = 0 }

/* ── window / document stub ──────────────────────────────────────────────── */
const styleTags = []
const createdEls = []
const documentStub = {
  querySelector: () => null,
  createElement: (tag) => {
    const el = {
      tag,
      dataset: {},
      click() { el._clicked = true },
      set textContent(v) { this._t = v },
      get textContent() { return this._t },
    }
    createdEls.push(el)
    return el
  },
  head: { appendChild: (el) => styleTags.push(el) },
}

let loaded = null
const confirmCalls = []
let confirmReturn = true
const windowStub = {
  __ModuleLoader__: { load: (entry) => { loaded = entry } },
  addEventListener() {},
  location: { reload() { windowStub.__reloaded = true } },
  confirm(msg) { confirmCalls.push(String(msg)); return confirmReturn },
}

/* ── fetch stub ──────────────────────────────────────────────────────────── */
const CFG = {
  enabled: true, mode: 'session', theme: 'light', speed: 1,
  requireInteraction: true, allowSkip: true, sound: true, soundVolume: 0.5,
  voice: true, voiceLang: 'en', voiceName: '', voiceRate: 1, voicePitch: 1, voiceVolume: 0.9,
  identity: 'JOYCE MOORE', identityId: '0087', accessLevel: '3',
  brand1: 'DEEPSEEK', brand2: 'SYNTHESIZE INTELLIGENCE', brand3a: 'HARNESS', brand3b: 'OS',
  orgZh: '深度求索', orgEn: 'DEEPSEEK', orgSub: 'DEEPSEEK HARNESS',
  welcomeBox: 'DEEPSEEK HARNESS', footer: 'POWERED BY DEEPSEEK',
  accent: '#ff7500', glitchA: '#ff3b30', glitchB: '#2971b8',
}
/* v2.12.1 起模板列表；v2.12.4 内置模板删除 = 隐藏进 HIDDEN（可 unhide 恢复），本地模板才是真删除 */
const BUILTIN_TPL = { id: 'archive-warm', name: '档案暖白', source: 'builtin' }
const BUILTIN_TPL2 = { id: 'whale-girl-scan', name: '鲸鱼娘扫描睁眼', source: 'builtin' }
const USER_TPL_A = { id: 'custom-local-a', name: '我的开场动画', source: 'user' }
const USER_TPL_B = { id: 'custom-local-b', name: '淡入过渡', source: 'user' }
const ALL_TEMPLATES = [BUILTIN_TPL, BUILTIN_TPL2, USER_TPL_A, USER_TPL_B]
const HIDDEN = []          // 被隐藏的内置模板 id（/templates 的 hidden 数组）
const DELETED_USERS = []   // 被真删除的本地模板 id
const liveTemplates = () => ALL_TEMPLATES.filter((t) => !HIDDEN.includes(t.id) && !DELETED_USERS.includes(t.id))
let versionInResponse = '9.9.9'
const requests = []
const fetchStub = (url, init) => {
  const u = String(url)
  requests.push({ url: u, init })
  const isPost = init && init.method === 'POST'
  const readJsonBody = () => { try { return JSON.parse(init.body || '{}') } catch { return {} } }
  if (u.includes('/dsh-startup/templates/unhide')) {
    const body = readJsonBody()
    const id = String(body.id || '')
    if (id) { const at = HIDDEN.indexOf(id); if (at >= 0) HIDDEN.splice(at, 1) }
    else HIDDEN.length = 0
    return Promise.resolve({ json: () => Promise.resolve({ ok: true, hidden: HIDDEN.slice() }) })
  }
  if (u.includes('/dsh-startup/templates/delete')) {
    const id = String(readJsonBody().id || '')
    const tpl = ALL_TEMPLATES.find((t) => t && t.id === id)
    if (!tpl) return Promise.resolve({ json: () => Promise.resolve({ ok: false, id, error: 'not found' }) })
    if (tpl.source === 'user') {
      DELETED_USERS.push(id)
      return Promise.resolve({ json: () => Promise.resolve({ ok: true, id, removed: true, hidden: false }) })
    }
    if (!HIDDEN.includes(id)) HIDDEN.push(id)
    return Promise.resolve({ json: () => Promise.resolve({ ok: true, id, removed: false, hidden: true }) })
  }
  if (u.includes('/dsh-startup/templates')) {
    return Promise.resolve({ json: () => Promise.resolve({ ok: true, templates: liveTemplates(), hidden: HIDDEN.slice() }) })
  }
  const body = isPost ? JSON.parse(init.body) : null
  let config = CFG
  if (body && body.action === 'reset') config = Object.assign({}, CFG)
  else if (body && body.patch) config = Object.assign({}, CFG, body.patch)
  return Promise.resolve({
    json: () => Promise.resolve(isPost
      ? { ok: true, version: versionInResponse, config, defaults: CFG }
      : { ok: true, version: versionInResponse, config, defaults: CFG, file: 'C:\\\\Users\\\\x\\\\.dsh\\\\dsh-startup.json' }),
  })
}

/* ── 按 ModuleLoader 的方式加载 bundle ───────────────────────────────────── */
console.log('\n[1] bundle 协议（window.__ModuleLoader__.load）')
const CLIENT_BUNDLE = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const code = fs.readFileSync(CLIENT_BUNDLE, 'utf8')
const sandbox = {
  window: windowStub, document: documentStub, fetch: fetchStub,
  console, Promise, Object, Array, JSON, String, Number, Math, Date, Error,
  setTimeout, clearTimeout, Symbol,
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(code, sandbox, { filename: 'client.js' })
check('调用了 ModuleLoader.load', loaded !== null)
check('注册 id 等于 loader entry 名（否则会报 loaded without registering）', loaded && loaded.id === 'dsh-boot-suite', loaded && loaded.id)
check('提供了 factory', loaded && typeof loaded.factory === 'function')

console.log('\n[2] factory 导出形状')
const requireStub = (name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
}
const mod = loaded.factory(requireStub)
check('exports.inject = ["slots"]', Array.isArray(mod.inject) && mod.inject.length === 1 && mod.inject[0] === 'slots', JSON.stringify(mod.inject))
check('exports.apply 是函数', typeof mod.apply === 'function')
check('注入了插件样式 <style data-plugin-css>', styleTags.length === 1 && styleTags[0].dataset.pluginCss === 'dsh-startup-screen/main.css', styleTags.length + ' 个')

console.log('\n[3] ctx.slots 注册 settings.section')
let registration = null
const ctx = {
  slots: {
    inject(name, fn) { check('slots.inject 的槽位名 = settings.section', name === 'settings.section', name); return fn() },
    register(options, render) { registration = { options, render }; return { dispose() {} } },
  },
}
mod.apply(ctx)
check('注册了 settings.section', registration !== null)
check('options.name 正确', registration && registration.options.name === 'settings.section', registration && registration.options.name)
check('options.id = startup-screen', registration && registration.options.id === 'startup-screen', registration && registration.options.id)
check('options.label = 启动动画（字符串，由注册方本地化）', registration && registration.options.label === '启动动画', registration && registration.options.label)
check('options.order 是数字', registration && typeof registration.options.order === 'number', registration && registration.options.order)
check('render 是函数', registration && typeof registration.render === 'function')

/* ── 真渲染面板 ──────────────────────────────────────────────────────────── */
function walk(node, out = []) {
  if (node === null || node === undefined) return out
  if (typeof node !== 'object') return out          /* 文本节点本身不收集 */
  if (Array.isArray(node)) { node.forEach((n) => walk(n, out)); return out }
  if (node.type) {
    /* 函数组件要展开（Field / Check / TextInput… 都不用 hooks，直接调用即可） */
    if (typeof node.type === 'function') return walk(node.type(node.props || {}), out)
    out.push(node)
    walk(node.props && node.props.children, out)
  }
  return out
}
function find(node, pred) { return walk(node).find(pred) }
const flush = () => new Promise((r) => setTimeout(r, 0))
/* render 返回的是 h(Panel, {}) 这个元素，要真正调用 Panel 才拿得到树 */
function renderPanel() {
  const el = registration.render({ close() {} })
  resetHooks()
  return el.type(el.props)
}

console.log('\n[4] 面板渲染 + 读取配置')
let tree = renderPanel()
check('首屏显示"读取配置中…"', JSON.stringify(tree).includes('读取配置中'), JSON.stringify(tree).slice(0, 80))
await flush(); await flush()
tree = renderPanel()
check('GET /dsh-startup/config 被调用', requests.some((r) => r.url === '/dsh-startup/config' && (!r.init || !r.init.method)), requests.map((r) => (r.init && r.init.method) || 'GET').join(','))
const texts = walk(tree).filter((n) => typeof n.props.children === 'string').map((n) => n.props.children)
check('渲染出「身份名称」字段', texts.includes('身份名称'), texts.slice(0, 12).join('/'))
check('渲染出「身份编号」字段', texts.includes('身份编号'))

/* 面板顶部：原来的大段说明已移除，改成版本号 */
const versionNode = find(tree, (n) => n.props && n.props.className === '__ss_version')
check('顶部渲染出版本号节点 __ss_version', !!versionNode, versionNode && String(versionNode.props.children))
check('版本号取自 /dsh-startup/config 返回的 version', versionNode && versionNode.props.children === '版本 v9.9.9', versionNode && String(versionNode.props.children))
check('已删除原来那段「启动界面：黑幕…」说明', !JSON.stringify(tree).includes('启动界面：'), '')
check('已删除 __ss_lead 样式类', !JSON.stringify(tree).includes('__ss_lead'), '')
check('渲染出「权限等级」字段', texts.includes('权限等级'))
const idInput = find(tree, (n) => n.type === 'input' && n.props.type === 'text' && n.props.value === 'JOYCE MOORE')
check('身份名称输入框回填了当前配置', !!idInput, idInput && idInput.props.value)
check('渲染出「启动动画」开关', texts.includes('启用启动动画'))
check('渲染出「女声播报」开关', texts.includes('女声播报（念每一行的英文）'))
check('渲染出「播报语言」字段', texts.includes('播报语言'))
check('渲染出「界面音效」开关', texts.includes('界面音效'))
check('渲染出音色选择（无 speechSynthesis 时给出提示）', texts.includes('音色'))
check('渲染出语速/音调/音量', texts.includes('语速') && texts.includes('音调') && texts.includes('音量'))
check('渲染出「立即预览」按钮', !!find(tree, (n) => n.type === 'button' && n.props.children === '立即预览'))
check('渲染出「恢复默认」按钮', !!find(tree, (n) => n.type === 'button' && n.props.children === '恢复默认'))

console.log('\n[5] 改身份名称 → 保存')
idInput.props.onChange({ target: { value: '琉璃' } })
tree = renderPanel()
const idInput2 = find(tree, (n) => n.type === 'input' && n.props.type === 'text')
check('改名后输入框值为「琉璃」', idInput2.props.value === '琉璃', idInput2.props.value)
const saveBtn = find(tree, (n) => n.type === 'button' && n.props.children === '保存')
check('找到保存按钮', !!saveBtn)
saveBtn.props.onClick()
await flush(); await flush(); await flush()
const post = requests.filter((r) => r.init && r.init.method === 'POST').pop()
check('POST 到 /dsh-startup/config', post && post.url === '/dsh-startup/config', post && post.url)
check('POST 体是 {patch:{identity:"琉璃",...}}', post && JSON.parse(post.init.body).patch.identity === '琉璃', post && post.init.body.slice(0, 90))
check('Content-Type 是 application/json', post && post.init.headers['Content-Type'] === 'application/json')
tree = renderPanel()
check('保存后提示已保存', JSON.stringify(tree).includes('已保存'), '')

console.log('\n[5b] 自定义动画 + 三段转场 UI（v2.12.0）')
const texts2 = walk(tree).filter((n) => typeof n.props.children === 'string').map((n) => n.props.children)
check('渲染出「自定义动画」组', texts2.includes('自定义动画'), texts2.slice(-14).join('/'))
check('渲染出「转场」组', texts2.includes('转场'))
const importBtn = find(tree, (n) => n.type === 'button' && n.props.children === '📥 导入动画')
check('渲染出「📥 导入动画」按钮', !!importBtn, importBtn ? '' : walk(tree).filter((n) => n.type === 'button').map((b) => b.props.children).join('/'))
for (const label of ['第一幕入场', '第一幕 → 第二幕', '第二幕 → 桌面', '转场时长', '扫描线 / 推移方向']) {
  check('渲染出「' + label + '」字段', texts2.includes(label))
}

/* 三段转场的下拉：8 种类型 × 3 个；方向下拉：4 个 */
const selectOf = (values) => walk(tree).filter((n) =>
  n.type === 'select' && Array.isArray(n.props.children) &&
  values.every((v) => n.props.children.some((o) => o && o.type === 'option' && o.props.value === v)))
const TRANSITION_TYPES = ['dissolve', 'flash', 'glitch', 'scanline', 'slide', 'iris', 'black', 'none']
const TRANSITION_DIRS = ['left', 'right', 'up', 'down']
const typeSelects = selectOf(TRANSITION_TYPES)
const dirSelects = selectOf(TRANSITION_DIRS)
check('三段转场 = 3 个下拉，每个都有 8 种类型', typeSelects.length === 3,
  '实际 ' + typeSelects.length + '：' + typeSelects.map((s) => s.props.value).join(','))
check('★ 缺省（宿主只给旧字段、无 transition 字段）→ FALLBACK 三个下拉都是 dissolve',
  typeSelects.length === 3 && typeSelects.every((s) => s.props.value === 'dissolve'),
  typeSelects.map((s) => s.props.value).join(','))
check('方向下拉存在且缺省 = left', dirSelects.length === 1 && dirSelects[0].props.value === 'left',
  dirSelects.map((s) => s.props.value).join(','))
const msRange = find(tree, (n) => n.type === 'input' && n.props.type === 'range' && n.props.min === 200 && n.props.max === 2000)
check('转场时长滑块：200–2000ms、缺省 600ms', !!msRange && msRange.props.value === 600, msRange && String(msRange.props.value))
check('时长滑块显示「600 ms」', texts2.includes('600 ms'), '')

/* 「📥 导入动画」按钮真的会弹出文件选择，且 accept 只列允许的 7 种 */
const beforeCreated = createdEls.length
importBtn && importBtn.props.onClick()
const fileInput = createdEls.slice(beforeCreated).find((el) => el.type === 'file')
check('点「📥 导入动画」→ 创建了 file input（浏览器会弹选择框）', !!fileInput && fileInput._clicked === true,
  fileInput ? 'accept=' + fileInput.accept : '没有创建 input')
check('文件选择器 accept 白名单含 mp4/webm/gif/png/jpg/jpeg/webp',
  !!fileInput && ['mp4', 'webm', 'gif', 'png', 'jpg', 'jpeg', 'webp'].every((x) => String(fileInput.accept).includes('.' + x)),
  fileInput && fileInput.accept)

/* 选择转场 → 保存 patch 里必须带上（沿用现有的 vm 渲染 + 保存路径） */
typeSelects[0].props.onChange({ target: { value: 'glitch' } })
typeSelects[1].props.onChange({ target: { value: 'flash' } })
typeSelects[2].props.onChange({ target: { value: 'scanline' } })
dirSelects[0].props.onChange({ target: { value: 'up' } })
msRange.props.onChange({ target: { value: '900' } })
tree = renderPanel()
const typeSelects2 = selectOf(TRANSITION_TYPES)
check('选择后下拉回显新值（glitch / flash / scanline）',
  typeSelects2.map((s) => s.props.value).join(',') === 'glitch,flash,scanline',
  typeSelects2.map((s) => s.props.value).join(','))
const saveBtn2 = find(tree, (n) => n.type === 'button' && n.props.children === '保存')
saveBtn2.props.onClick()
await flush(); await flush(); await flush()
const post2 = requests.filter((r) => r.init && r.init.method === 'POST').pop()
const patch2 = post2 ? JSON.parse(post2.init.body).patch : {}
check('★ 保存 patch 里带上了三个转场', patch2.transitionIn === 'glitch' && patch2.transitionJoin === 'flash' && patch2.transitionOut === 'scanline',
  JSON.stringify({ i: patch2.transitionIn, j: patch2.transitionJoin, o: patch2.transitionOut }))
check('★ 保存 patch 里带上了转场时长与方向', patch2.transitionMs === 900 && patch2.transitionDir === 'up',
  JSON.stringify({ ms: patch2.transitionMs, dir: patch2.transitionDir }))
check('保存 patch 全量 draft：既有字段（identity）没丢', patch2.identity === '琉璃', String(patch2.identity))
tree = renderPanel()

console.log('\n[5c] 删除该动画：本地删文件 / 内置隐藏可恢复（v2.12.4）')
{
  /* 初始：宿主 /templates 返回 2 个内置 + 2 个本地（见 fetchStub 的 ALL_TEMPLATES） */
  const texts3 = () => walk(tree).filter((n) => typeof n.props.children === 'string').map((n) => n.props.children)
  const isSelectComp = (c) => c && typeof c.type === 'function' && Array.isArray(c.props && c.props.options)
  /* 第一幕/第二幕两行：__ss_row 里「下拉 + 删除该动画」；编辑器那行只有按钮、没有下拉 */
  const tplRows = () => walk(tree).filter((n) =>
    n.type === 'div' && n.props && Array.isArray(n.props.children) &&
    n.props.children.some(isSelectComp) &&
    n.props.children.some((c) => c && c.type === 'button' && c.props.children === '删除该动画'))
  const rowSelect = (row) => row.props.children.find(isSelectComp)
  const rowValue = (row) => rowSelect(row) && rowSelect(row).props.value
  const rowBtn = (row) => row.props.children.find((c) => c && c.type === 'button' && c.props.children === '删除该动画')
  const deleteAnimBtns = () => walk(tree).filter((n) => n.type === 'button' && n.props.children === '删除该动画')
  const groupTitles = () => walk(tree).filter((n) => n.type === 'div' && n.props && n.props.className === '__ss_groupTitle').map((n) => n.props.children)
  const postList = (prefix) => requests.filter((r) => r.init && r.init.method === 'POST' && String(r.url).includes(prefix))
  const restoreBtn = () => find(tree, (n) => n.type === 'button' && /^恢复已隐藏的内置模板（\d+）$/.test(String(n.props.children || '')))
  const hasOption = (sel, id) => !!sel && Array.isArray(sel.props.children) &&
    sel.props.children.some((o) => o && o.type === 'option' && o.props.value === id)
  /* 第一幕/第二幕两个模板下拉：都含内置 archive-warm，且都有一项「内置/不播放」说明 */
  const templateSelects = () => walk(tree).filter((n) =>
    n.type === 'select' && Array.isArray(n.props.children) &&
    n.props.children.some((o) => o && o.type === 'option' && o.props.value === 'archive-warm') &&
    n.props.children.some((o) => o && o.type === 'option' && /内置|不播放/.test(String(o.props.children))))
  /* archive-warm 被隐藏后上面的定位会失效：改用「有内置/不播放说明」来找两个下拉 */
  const templateSelectsAny = () => walk(tree).filter((n) =>
    n.type === 'select' && Array.isArray(n.props.children) &&
    n.props.children.some((o) => o && o.type === 'option' && /内置|不播放/.test(String(o.props.children))))

  /* ── 组顺序：自定义动画 → 模板 → 转场（保留） ── */
  const titles = groupTitles()
  const iImport = titles.indexOf('自定义动画')
  const iTpl = titles.indexOf('模板')
  const iTrans = titles.indexOf('转场')
  check('渲染出「自定义动画」「模板」「转场」三个组', iImport >= 0 && iTpl >= 0 && iTrans >= 0, titles.join(' → '))
  check('★ 组顺序：自定义动画 → 模板 → 转场（自定义动画在模板之前）',
    iImport >= 0 && iTpl >= 0 && iTrans >= 0 && iImport < iTpl && iTpl < iTrans,
    JSON.stringify({ 自定义动画: iImport, 模板: iTpl, 转场: iTrans }))
  check('「本地动画（N）」列表仍然不存在', !texts3().some((t) => /本地动画（/.test(String(t))),
    texts3().filter((t) => /本地动画/.test(String(t))).join('/'))

  /* ── 两行始终各 1 个按钮 + 布局不变（保留 v2.12.3 断言） ── */
  let rows = tplRows()
  check('★ 两行各有 1 个「删除该动画」（共 2 个，始终显示）',
    rows.length === 2 && deleteAnimBtns().length === 2,
    '行 ' + rows.length + ' / 按钮 ' + deleteAnimBtns().length)
  check('★ 按钮固定在行内最右侧：两行 nowrap + space-between + gap 24px，按钮 marginLeft auto / minWidth 112px',
    rows.every((r) => r.props.style && r.props.style.flexWrap === 'nowrap' &&
      r.props.style.justifyContent === 'space-between' && r.props.style.gap === '24px') &&
    rows.every((r) => rowBtn(r).props.style &&
      rowBtn(r).props.style.marginLeft === 'auto' && rowBtn(r).props.style.minWidth === '112px'),
    JSON.stringify(rows.map((r) => rowBtn(r).props.style)))
  check('底部说明改成「本地删文件 / 内置只是隐藏可恢复」',
    texts3().some((t) => String(t).includes('本地动画会删除文件')) &&
    texts3().some((t) => String(t).includes('内置模板只是隐藏')),
    texts3().filter((t) => /删除该动画/.test(String(t))).join(' / '))

  /* ── 未选模板 → 两个都置灰、title「没有选择模板」、点了不发请求 ── */
  check('★ 未选模板（第一幕空 / 第二幕不播放）→ 两个按钮都置灰',
    rows.every((r) => rowBtn(r).props.disabled === true),
    JSON.stringify(rows.map((r) => ({ v: rowValue(r), disabled: rowBtn(r).props.disabled }))))
  check('未选模板时 title = 没有选择模板',
    rows.every((r) => rowBtn(r).props.title === '没有选择模板'), rows.map((r) => rowBtn(r).props.title).join(' / '))
  const reqBeforeDisabled = requests.length
  const confirmBeforeDisabled = confirmCalls.length
  const disabledClick = rowBtn(rows[0]).props.onClick
  if (typeof disabledClick === 'function') disabledClick()
  await flush(); await flush()
  check('点置灰按钮：不发任何请求、也不弹 confirm',
    requests.length === reqBeforeDisabled && confirmCalls.length === confirmBeforeDisabled,
    'requests +' + (requests.length - reqBeforeDisabled) + ' / confirm +' + (confirmCalls.length - confirmBeforeDisabled))

  /* ── 选内置模板 → 按钮也启用（v2.12.4 不再只对本地生效） ── */
  let tplSel = templateSelects()
  check('找到第一幕 / 第二幕两个模板下拉', tplSel.length === 2, '实际 ' + tplSel.length)
  tplSel[0].props.onChange({ target: { value: 'archive-warm' } })
  tree = renderPanel()
  rows = tplRows()
  check('★ 第一幕选内置 archive-warm → 第一幕按钮 enabled（title=隐藏内置模板（可恢复）），第二幕未选仍置灰',
    rowValue(rows[0]) === 'archive-warm' && rowBtn(rows[0]).props.disabled === false &&
    rowBtn(rows[0]).props.title === '隐藏内置模板（可恢复）' &&
    rowValue(rows[1]) === '' && rowBtn(rows[1]).props.disabled === true,
    JSON.stringify(rows.map((r) => ({ v: rowValue(r), disabled: rowBtn(r).props.disabled, title: rowBtn(r).props.title }))))
  tplSel = templateSelects()
  tplSel[1].props.onChange({ target: { value: 'whale-girl-scan' } })
  tree = renderPanel()
  rows = tplRows()
  check('★ 第二幕也选内置 whale-girl-scan → 两个按钮都 enabled',
    rowBtn(rows[0]).props.disabled === false && rowBtn(rows[1]).props.disabled === false &&
    rowBtn(rows[1]).props.title === '隐藏内置模板（可恢复）',
    rows.map((r) => rowBtn(r).props.disabled).join(','))

  /* ── 点内置模板的删除 = 隐藏（文件不删） ── */
  const confirmBefore = confirmCalls.length
  const beforeHide = requests.length
  rowBtn(rows[0]).props.onClick()
  check('点内置模板的删除：confirm 文案是「隐藏内置模板…（可恢复）」',
    confirmCalls.length === confirmBefore + 1 &&
    String(confirmCalls[confirmCalls.length - 1]).includes('隐藏内置模板') &&
    String(confirmCalls[confirmCalls.length - 1]).includes('档案暖白') &&
    String(confirmCalls[confirmCalls.length - 1]).includes('不会删除安装文件') &&
    String(confirmCalls[confirmCalls.length - 1]).includes('恢复已隐藏的内置模板'),
    String(confirmCalls[confirmCalls.length - 1]))
  await flush(); await flush(); await flush(); await flush()
  const hidePost = postList('/dsh-startup/templates/delete').pop()
  check('★ POST /dsh-startup/templates/delete {id:"archive-warm"}',
    !!hidePost && JSON.parse(hidePost.init.body).id === 'archive-warm', hidePost && hidePost.init.body)
  check('隐藏成功后刷新了模板列表（GET /dsh-startup/templates）',
    requests.slice(beforeHide).some((r) => String(r.url).includes('/dsh-startup/templates') && (!r.init || !r.init.method)))
  const cfg1 = postList('/dsh-startup/config').pop()
  const patch1 = cfg1 ? JSON.parse(cfg1.init.body).patch : {}
  check('★ 被引用时自动 POST config 把 template 切回 ""', patch1.template === '', JSON.stringify(patch1))
  check('隐藏引起的 config patch 只动 template（不夹带其它字段）', Object.keys(patch1).join(',') === 'template', JSON.stringify(patch1))
  tree = renderPanel()
  rows = tplRows()
  check('回填生效：第一幕 value 变空、该按钮回到置灰',
    rowValue(rows[0]) === '' && rowBtn(rows[0]).props.disabled === true,
    JSON.stringify({ v: rowValue(rows[0]), disabled: rowBtn(rows[0]).props.disabled }))
  check('提示文案以「已隐藏内置模板」开头', JSON.stringify(tree).includes('已隐藏内置模板'))
  check('被隐藏的内置模板从下拉选项里消失', !hasOption(templateSelectsAny()[0], 'archive-warm'))
  check('另一个内置模板 whale-girl-scan 仍在选项里（只隐藏被点的那个）',
    hasOption(templateSelectsAny()[1], 'whale-girl-scan'))
  check('★ hidden 状态来自 /templates 响应：HIDDEN === ["archive-warm"]', HIDDEN.join(',') === 'archive-warm', HIDDEN.join(','))
  const restoreNow = restoreBtn()
  check('★ 隐藏后出现「恢复已隐藏的内置模板（1）」按钮',
    !!restoreNow && String(restoreNow.props.children) === '恢复已隐藏的内置模板（1）',
    restoreNow && String(restoreNow.props.children))

  /* ── 点恢复：POST /templates/unhide（全部）→ 刷新 → 按钮消失、模板回来 ── */
  const beforeRestore = requests.length
  restoreNow.props.onClick()
  await flush(); await flush(); await flush(); await flush()
  const unhidePost = postList('/dsh-startup/templates/unhide').pop()
  check('★ POST /dsh-startup/templates/unhide，body 为 {}（全部恢复）',
    !!unhidePost && JSON.stringify(JSON.parse(unhidePost.init.body)) === '{}', unhidePost && unhidePost.init.body)
  check('恢复成功后刷新了模板列表（GET /dsh-startup/templates）',
    requests.slice(beforeRestore).some((r) => String(r.url).includes('/dsh-startup/templates') && (!r.init || !r.init.method)))
  tree = renderPanel()
  check('恢复提示：已恢复全部被隐藏的内置模板。', JSON.stringify(tree).includes('已恢复全部被隐藏的内置模板'))
  check('★ 恢复后「恢复已隐藏的内置模板」按钮消失', !restoreBtn())
  check('恢复后 archive-warm 重新出现在下拉选项里', hasOption(templateSelects()[0], 'archive-warm'))
  check('HIDDEN 已清空', HIDDEN.length === 0, HIDDEN.join(','))

  /* ── 本地模板删除路径保持不变（删文件、不可恢复、不进 hidden） ── */
  tplSel = templateSelects()
  tplSel[0].props.onChange({ target: { value: 'custom-local-a' } })
  tree = renderPanel()
  rows = tplRows()
  check('第一幕选本地模板 → 按钮 enabled（title=删除这个本地动画）',
    rowBtn(rows[0]).props.disabled === false && rowBtn(rows[0]).props.title === '删除这个本地动画',
    String(rowBtn(rows[0]).props.title))
  const confirmBeforeLocal = confirmCalls.length
  const beforeDelLocal = requests.length
  rowBtn(rows[0]).props.onClick()
  check('本地模板的 confirm 文案是「删除本地模板…（不可恢复）」',
    confirmCalls.length === confirmBeforeLocal + 1 &&
    String(confirmCalls[confirmCalls.length - 1]).includes('删除本地模板') &&
    String(confirmCalls[confirmCalls.length - 1]).includes('无法恢复') &&
    String(confirmCalls[confirmCalls.length - 1]).includes('我的开场动画'),
    String(confirmCalls[confirmCalls.length - 1]))
  await flush(); await flush(); await flush(); await flush()
  const delLocal = postList('/dsh-startup/templates/delete').pop()
  check('★ POST /dsh-startup/templates/delete {id:"custom-local-a"}',
    !!delLocal && JSON.parse(delLocal.init.body).id === 'custom-local-a', delLocal && delLocal.init.body)
  const cfgLocal = requests.slice(beforeDelLocal).filter((r) => r.init && r.init.method === 'POST' && r.url === '/dsh-startup/config').pop()
  const patchLocal = cfgLocal ? JSON.parse(cfgLocal.init.body).patch : {}
  check('本地删除被引用时也 POST config 把 template 切回 ""（且只动 template）',
    patchLocal.template === '' && Object.keys(patchLocal).join(',') === 'template', JSON.stringify(patchLocal))
  tree = renderPanel()
  rows = tplRows()
  check('本地删除后提示「已删除本地模板」', JSON.stringify(tree).includes('已删除本地模板'))
  check('本地模板从下拉选项里消失（真删了）', !hasOption(templateSelects()[0], 'custom-local-a'))
  check('本地删除不会产生「恢复已隐藏」按钮（它不可恢复）', !restoreBtn() && HIDDEN.length === 0)
  check('回填后第一幕按钮回到置灰', rowValue(rows[0]) === '' && rowBtn(rows[0]).props.disabled === true)
  check('收尾仍有 2 个「删除该动画」按钮', deleteAnimBtns().length === 2 && rows.length === 2)
  check('内置 archive-warm 仍可选择', templateSelects().length === 2 && hasOption(templateSelects()[1], 'archive-warm'))
  check('删除/隐藏流程共弹了 2 次 confirm', confirmCalls.length === confirmBefore + 2, String(confirmCalls.length))
}

console.log('\n[6] 恢复默认 / 立即预览')
const resetBtn = find(tree, (n) => n.type === 'button' && n.props.children === '恢复默认')
resetBtn.props.onClick()
await flush(); await flush()
const resetPost = requests.filter((r) => r.init && r.init.method === 'POST').pop()
check('恢复默认 POST {action:"reset"}', resetPost && JSON.parse(resetPost.init.body).action === 'reset', resetPost && resetPost.init.body)

windowStub.__DSH_STARTUP_API__ = { replay() { windowStub.__replayed = true } }
tree = renderPanel()
const previewBtn = find(tree, (n) => n.type === 'button' && n.props.children === '立即预览')
/* 预览会先 GET 一次 /config（拿最新配置与模板）再重播 —— 少了这一步，换模板后预览的还是老动画 */
const beforePreview = requests.length
previewBtn.props.onClick()
await flush(); await flush(); await flush()
check('立即预览先重新拉配置', requests.length > beforePreview && requests.slice(beforePreview).some((r) => /\/dsh-startup\/config/.test(r.url || '')), '')
check('立即预览调用 __DSH_STARTUP_API__.replay()', windowStub.__replayed === true)
delete windowStub.__DSH_STARTUP_API__
previewBtn.props.onClick()
await flush(); await flush(); await flush()
check('没有 API 时回退到 location.reload()', windowStub.__reloaded === true)

console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
