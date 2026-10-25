/**
 * dsh-boot-suite — 浏览器半侧（合并版）
 * ---------------------------------------------------------------------------
 * 由两个插件合并而来：
 *   · 开机动画  ← 原 dsh-startup-screen/lib/client.js（DSH 设置页「启动动画」）
 *   · 聊天壁纸  ← 原 dsh-chat-wallpaper/lib/client.js（DSH 设置页「聊天背景」）
 *
 * 两半各在自己的 IIFE 里跑，互不污染作用域；对外只注册 dsh-boot-suite 一个模块 id
 * （必须等于 bundle 行名，否则 ModuleLoader 会报 loaded without registering）。
 *
 * 执行顺序：开机动画先（它要在 DOM 里立起 #dsh-startup-root，壁纸半侧的起始闸门
 * 靠这个浮层判断"开机动画放完没有"）；导出合并顺序：壁纸先、开机动画后 ——
 * 壁纸半侧自己声明 inject: []，开机动画半侧要 inject: [slots]，后者必须赢。
 */
window.__ModuleLoader__.load({
  id: 'dsh-boot-suite',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    /* 第一段执行：开机动画（原 dsh-startup-screen）*/
    var __bootHalf = (function () {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement

    var API = '/dsh-startup/config'
    var STARTUP_ROUTE = '/dsh-startup'

    /* ── CSS ─────────────────────────────────────────────────────────────── */
    var CSS = [
      '.__ss_root{max-width:620px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.__ss_version{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:11px}',
      '.__ss_groupTitle{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_field{display:flex;flex-direction:column;gap:5px}',
      '.__ss_label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.__ss_hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.__ss_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px;box-sizing:border-box;width:100%;outline:none}',
      '.__ss_input:focus{border-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_inputMono{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.06em}',
      '.__ss_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;min-width:180px}',
      '.__ss_check{display:flex;align-items:flex-start;gap:8px;cursor:pointer}',
      '.__ss_check input{margin-top:2px;accent-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_checkText{display:flex;flex-direction:column;gap:2px}',
      '.__ss_two{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.__ss_actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}',
      '.__ss_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.__ss_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_btn:disabled{opacity:.5;cursor:default}',
      '.__ss_btnPrimary{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}',
      '.__ss_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_ok{font-size:12px;color:var(--dsw-alias-state-business-primary)}',
      '.__ss_link{font-size:12px;color:var(--dsw-alias-state-business-primary);text-decoration:none;border-bottom:1px dashed currentColor}',
      '.__ss_err{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.__ss_swatch{width:38px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;cursor:pointer}',
      '.__ss_preview{margin-top:2px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.__ss_previewText{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5}'
    ].join('')
    var tagId = 'dsh-startup-screen/main.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-startup-screen'
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ── 表单原子 ────────────────────────────────────────────────────────── */
    function Field(props) {
      return h('div', { className: '__ss_field' },
        h('label', { className: '__ss_label' }, props.label),
        props.children,
        props.hint ? h('div', { className: '__ss_hint' }, props.hint) : null
      )
    }

    function TextInput(props) {
      return h('input', {
        className: '__ss_input' + (props.mono ? ' __ss_inputMono' : ''),
        type: 'text',
        value: props.value == null ? '' : String(props.value),
        placeholder: props.placeholder || '',
        maxLength: props.maxLength || 64,
        spellCheck: false,
        onChange: (e) => props.onChange(e.target.value)
      })
    }

    function Select(props) {
      return h('select', {
        className: '__ss_select',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      }, props.options.map((o) => h('option', { key: o[0], value: o[0] }, o[1])))
    }

    function Check(props) {
      return h('label', { className: '__ss_check' },
        h('input', {
          type: 'checkbox',
          checked: !!props.checked,
          onChange: (e) => props.onChange(e.target.checked)
        }),
        h('span', { className: '__ss_checkText' },
          h('span', null, props.label),
          props.hint ? h('span', { className: '__ss_hint' }, props.hint) : null
        )
      )
    }

    function ColorInput(props) {
      return h('input', {
        className: '__ss_swatch',
        type: 'color',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      })
    }

    function Range(props) {
      return h('div', { className: '__ss_row' },
        h('input', {
          type: 'range',
          min: props.min, max: props.max, step: props.step || 0.05,
          value: props.value,
          style: { flex: '1 1 200px' },
          onChange: (e) => props.onChange(Number(e.target.value))
        }),
        h('span', { className: '__ss_status' }, props.display)
      )
    }

    /* ── 语音：读系统里可用的音色，女声排在前面 ─────────────────────────── */
    var NATURAL_HINTS = ['natural', 'neural', 'online', 'premium', 'enhanced', 'siri', 'google']
    var FEMALE_HINTS = [
      'aria', 'jenny', 'michelle', 'emma', 'ava', 'libby', 'sonia', 'maisie',
      'zira', 'samantha', 'karen', 'moira', 'tessa', 'victoria', 'serena', 'allison',
      'susan', 'fiona', 'hazel', 'female', 'woman',
      'xiaoxiao', 'xiaoyi', 'xiaomo', 'huihui', 'yaoyao', '晓晓', '晓伊', '女声'
    ]
    var MALE_HINTS = ['david', 'mark', 'guy', 'ryan', 'george', 'daniel', 'alex', 'fred',
      'male', 'yunxi', 'yunjian', 'kangkang']

    function hits(name, list) {
      for (var i = 0; i < list.length; i++) if (name.indexOf(list[i]) !== -1) return true
      return false
    }
    /** 神经网络音色优先，其次女声，最后剔掉男声 —— 和运行时 splash.js 的打分口径一致 */
    function scoreVoice(name, lang, want) {
      var sc = 0
      if (hits(name, NATURAL_HINTS)) sc += 60
      if (hits(name, FEMALE_HINTS)) sc += 40
      if (hits(name, MALE_HINTS)) sc -= 45
      if (String(lang || '').indexOf(want) === 0) sc += 25
      return sc
    }

    function readVoices() {
      try {
        var s = window.speechSynthesis
        if (!s || typeof s.getVoices !== 'function') return []
        var list = s.getVoices() || []
        var want = 'en'
        var scored = list.map(function (v, i) {
          var name = String(v.name || '').toLowerCase()
          return {
            v: v,
            natural: hits(name, NATURAL_HINTS),
            female: hits(name, FEMALE_HINTS),
            sc: scoreVoice(name, String(v.lang || '').toLowerCase(), want),
            i: i
          }
        })
        scored.sort(function (a, b) {
          if (a.sc !== b.sc) return b.sc - a.sc
          return a.i - b.i
        })
        return scored.map(function (x) { return x.v })
      } catch (e) { return [] }
    }

    function speakSample(text, draft) {
      try {
        var s = window.speechSynthesis
        if (!s) return false
        s.cancel()
        var u = new window.SpeechSynthesisUtterance(text || 'Access permission required.')
        var list = readVoices()
        var target = null
        for (var i = 0; i < list.length; i++) if (list[i].name === draft.voiceName) target = list[i]
        if (target) { u.voice = target; u.lang = target.lang }
        u.rate = Math.min(2, Math.max(0.5, Number(draft.voiceRate) || 1))
        u.pitch = Math.min(2, Math.max(0, Number(draft.voicePitch) || 1))
        u.volume = Math.min(1, Math.max(0, Number(draft.voiceVolume) || 0.9))
        if (draft.voiceLang === 'zh') { u.text = '需要访问许可，验证通过。'; u.lang = 'zh-CN' }
        s.speak(u)
        return true
      } catch (e) { return false }
    }

    function VoicePicker(props) {
      var [list, setList] = react.useState(readVoices)
      react.useEffect(function () {
        var s = window.speechSynthesis
        if (!s) return
        var on = function () { setList(readVoices()) }
        try { s.addEventListener('voiceschanged', on) } catch (e) {}
        var t = setTimeout(on, 400)
        return function () {
          try { s.removeEventListener('voiceschanged', on) } catch (e) {}
          clearTimeout(t)
        }
      }, [])
      var auto = window.__DSH_STARTUP_API__ && window.__DSH_STARTUP_API__.voice
      var opts = [['', '自动（优先神经网络女声）' + (auto ? ' → ' + auto : '')]].concat(
        list.map(function (v) {
          var name = String(v.name || '').toLowerCase()
          var mark = hits(name, NATURAL_HINTS) ? '★ ' : (hits(name, FEMALE_HINTS) ? '♀ ' : '')
          return [v.name, mark + v.name + ' · ' + (v.lang || '')]
        })
      )
      return h('div', { className: '__ss_field' },
        h('label', { className: '__ss_label' }, '音色'),
        h('div', { className: '__ss_row' },
          h(Select, { value: props.value || '', options: opts, onChange: props.onChange }),
          h('button', {
            className: '__ss_btn',
            type: 'button',
            onClick: props.onPreview
          }, '试听')
        ),
        h('div', { className: '__ss_hint' },
          list.length
            ? '★ = 神经网络音色（念长句自然，推荐）；♀ = 女声但多为老式拼接合成，念长句会发塑料。'
              + '共 ' + list.length + ' 个，已按"神经网络 → 女声 → 排除男声"排好序。'
            : '这台机器暂时读不到系统音色（浏览器可能要等 voiceschanged，或系统没装英语语音包）。'
        )
      )
    }

    /* ── 面板 ────────────────────────────────────────────────────────────── */
    /* 本地兜底默认值：Host 半侧若是旧版本（配置里还没有语音字段），
       面板也要能正常显示这些控件，而不是一片 undefined。 */
    var FALLBACK = {
      voice: true, voiceLang: 'en', voiceName: '', voiceRate: 0.88, voicePitch: 0.85,
      voiceVolume: 0.9, voiceCue: true, voiceLead: 240, voiceSource: 'asset',
      sound: true, soundVolume: 0.5, bedNoise: false
    }
    function num(v, d) {
      var n = Number(v)
      return isFinite(n) ? n : d
    }

    /* 版本号的来源，按可靠性排序：
       1) 面板自己从 /dsh-startup/config 拿到的（Host 读的是它自己的 package.json）
       2) Host 往 index 里注入的 window.__DSH_STARTUP_VERSION__
          —— 桌面端走浏览器半侧自举时没有 1，就靠这一条
       3) 下面这个常量：两份都没拿到时的兜底，别让面板显示 undefined
       版本号本身只在 lib/index.js 里读一次，这里不重复维护。 */
    var FALLBACK_VERSION = '2.11.11'
    function readInjectedVersion() {
      try {
        var v = window.__DSH_STARTUP_VERSION__
        return v ? String(v) : ''
      } catch (e) { return '' }
    }

    function Panel() {
      var [draft, setDraft] = react.useState(null)
      var [defaults, setDefaults] = react.useState(null)
      var [file, setFile] = react.useState('')
      var [version, setVersion] = react.useState(readInjectedVersion)
      var [error, setError] = react.useState(null)
      var [notice, setNotice] = react.useState(null)
      var [busy, setBusy] = react.useState(false)
      var [templates, setTemplates] = react.useState([])
      var [update, setUpdate] = react.useState(null)
      var [checking, setChecking] = react.useState(false)
      var [updating, setUpdating] = react.useState(false)
      var [updateMsg, setUpdateMsg] = react.useState('')

      function load() {
        setError(null)
        return fetch(API, { headers: { Accept: 'application/json' } })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'load failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            setDefaults(Object.assign({}, FALLBACK, j.defaults))
            setFile(j.file || '')
            if (j.version) setVersion(String(j.version))
          })
          .catch((e) => setError('读取配置失败：' + String(e && e.message ? e.message : e)))
      }

      react.useEffect(() => { load() }, [])

      /* 模板列表单独拉一次：它来自宿主扫描 templates/ 与 ~/.dsh/startup-templates/ */
      react.useEffect(() => {
        fetch('/dsh-startup/templates', { headers: { Accept: 'application/json' } })
          .then((r) => r.json())
          .then((j) => { if (j && j.ok === true && Array.isArray(j.templates)) setTemplates(j.templates) })
          .catch(() => { /* 拉不到就只显示「内置」 */ })
      }, [])

      function set(key, value) {
        setNotice(null)
        setDraft((d) => Object.assign({}, d, { [key]: value }))
      }

      function save() {
        if (!draft) return
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: draft })
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'save failed')
            setDraft(j.config)
            setNotice('已保存。下次打开 DSH 生效；点「立即预览」可以先看效果。')
          })
          .catch((e) => setError('保存失败：' + String(e && e.message ? e.message : e)))
          .then(() => setBusy(false))
      }

      function reset() {
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' })
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'reset failed')
            setDraft(j.config)
            setNotice('已恢复默认。')
          })
          .catch((e) => setError('恢复默认失败：' + String(e && e.message ? e.message : e)))
          .then(() => setBusy(false))
      }

      /** 一键诊断：让宿主写一份报告到桌面，用户直接发给作者。 */
      function runDiagnose() {
        setNotice(null)
        fetch(STARTUP_ROUTE + '/diagnose', { method: 'POST' })
          .then(function (r) { return r.json() })
          .then(function (j) {
            if (!j || j.ok !== true) throw new Error((j && j.error) || '生成失败')
            setNotice('诊断报告已生成到桌面：' + j.file)
          })
          .catch(function (e) {
            setNotice('生成诊断报告失败：' + String((e && e.message) || e))
          })
      }

      /** 检查更新：问宿主（宿主去读 GitHub latest release，避开浏览器 CORS）。 */
      function checkUpdate() {
        setChecking(true)
        fetch(STARTUP_ROUTE + '/update-check?refresh=1', { cache: 'no-store' })
          .then(function (r) { return r.json() })
          .then(function (j) { setUpdate(j || { ok: false }) })
          .catch(function (e) { setUpdate({ ok: false, error: String((e && e.message) || e) }) })
          .then(function () { setChecking(false) })
      }

      /** 下载完成/本地选择后：确认重启 -> 启动外部更新器 */
      function confirmAndApply(version) {
        var yes = window.confirm(
          '本次更新需要重启 DSH。' + String.fromCharCode(10) +
          '请确认没有正在进行的对话。' + String.fromCharCode(10, 10) +
          '是否现在重启？'
        )
        if (!yes) {
          setUpdating(false)
          setUpdateMsg('已准备好更新。想继续时，再点一次「立即更新」即可。')
          return
        }
        setUpdating(true)
        setUpdateMsg('更新器窗口已打开：请手动完全退出 DSH（窗口+托盘），退出后会自动安装并重新打开。')
        fetch(STARTUP_ROUTE + '/update-apply', { method: 'POST' })
          .then(function (r) { return r.json() })
          .then(function (k) {
            if (!k || k.ok !== true) throw new Error((k && k.error) || '启动更新器失败')

          })
          .catch(function (e) {
            setUpdating(false)
            setUpdateMsg('更新失败：' + String((e && e.message) || e))
          })
      }

      /** 立即更新：让系统浏览器下载（走浏览器自己的代理），插件监听 Downloads 自动接住 */
      function runUpdate() {
        if (!update || !update.latest) return
        setUpdating(true)
        setUpdateMsg('正在让浏览器下载 v' + update.latest + '（使用浏览器自己的代理）…')
        fetch(STARTUP_ROUTE + '/update-browser-download', { method: 'POST' })
          .then(function (r) { return r.json() })
          .then(function (j) {
            if (!j || j.ok !== true) throw new Error((j && j.error) || '无法启动浏览器下载')
            setUpdateMsg('已用 ' + (j.browser === 'chrome' ? 'Chrome' : '默认浏览器') + ' 打开下载，完成后会自动继续（最多等 10 分钟）…')
            return fetch(STARTUP_ROUTE + '/update-watch-download?version=' + encodeURIComponent(update.latest))
          })
          .then(function (r) { return r.json() })
          .then(function (j) {
            if (!j || j.ok !== true) throw new Error((j && j.error) || '没有等到下载文件')
            setUpdating(false)
            setUpdateMsg('已获取 v' + j.version + '（' + Math.round(j.size / 1048576) + ' MB）')
            confirmAndApply(j.version)
          })
          .catch(function (e) {
            setUpdating(false)
            setUpdateMsg('浏览器下载没接住：' + String((e && e.message) || e) + '。可再点「立即更新」，或点「选择安装包」手动指定。')
          })
      }

      /** 浏览器下载好 zip 后，从本地选择文件（完全不依赖宿主联网） */
      function pickLocalPackage() {
        if (!update || !update.latest) return
        var inp = document.createElement('input')
        inp.type = 'file'
        inp.accept = '.zip'
        inp.onchange = function () {
          var f = inp.files && inp.files[0]
          if (!f) return
          setUpdating(true)
          setUpdateMsg('正在读取本地安装包…')
          f.arrayBuffer()
            .then(function (buf) {
              return fetch(STARTUP_ROUTE + '/update-upload?version=' + encodeURIComponent(update.latest), {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: buf
              })
            })
            .then(function (r) { return r.json() })
            .then(function (j) {
              if (!j || j.ok !== true) throw new Error((j && j.error) || '本地安装包无效')
              setUpdating(false)
              setUpdateMsg('已载入本地安装包 v' + j.version + '（' + Math.round(j.size / 1048576) + ' MB）')
              confirmAndApply(j.version)
            })
            .catch(function (e) {
              setUpdating(false)
              setUpdateMsg('载入本地安装包失败：' + String((e && e.message) || e))
            })
        }
        inp.click()
      }

      /** 立即预览：**先把宿主最新的配置和模板灌回 window，再让运行时重播**。
          只调 replay() 的话，运行时手里的还是首屏注入那会儿的旧配置/旧模板 ——
          表现就是「换了模板点预览还是老动画，非得重启」。 */
      function preview() {
        setBusy(true)
        setNotice(null)
        fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) return
            if (j.config) window.__DSH_STARTUP__ = Object.assign({}, FALLBACK, j.config)
            try {
              if (j.template) window.__DSH_STARTUP_TEMPLATE__ = j.template
              else delete window.__DSH_STARTUP_TEMPLATE__
              if (j.template2) window.__DSH_STARTUP_TEMPLATE2__ = j.template2
              else delete window.__DSH_STARTUP_TEMPLATE2__
            } catch (e) { /* 删不掉就让它回落内置 */ }
          })
          .catch(() => { /* 拿不到最新配置就用旧的，至少还能重播 */ })
          .then(function () {
            setBusy(false)
            var api = window.__DSH_STARTUP_API__
            if (api && typeof api.replay === 'function') { api.replay(); return }
            window.location.reload()
          })
      }

      /* 版本号常驻顶部，不进骨架屏 —— 它不依赖配置接口，
         接口挂了也该看得见当前装的是哪一版。 */
      var versionLine = h('div', { className: '__ss_version' }, '版本 v' + (version || FALLBACK_VERSION))

      if (!draft) {
        return h('div', { className: '__ss_root' },
          versionLine,
          h('div', { className: '__ss_status' }, error ? error : '读取配置中…'),
          error ? h('div', { className: '__ss_actions' },
            h('button', { className: '__ss_btn', onClick: load }, '重试')
          ) : null
        )
      }

      var modeOptions = [
        ['session', '每个浏览器会话一次'],
        ['daily', '每天一次'],
        ['always', '每次打开都播放']
      ]

      /* 模板下拉：'' = 引擎内置那套；其余来自宿主扫描到的模板 */
      var templateOptions = [['', '内置（档案暖白）']].concat(
        (templates || []).map(function (t) {
          return [t.id, t.name + (t.source === 'user' ? ' · 本地' : '')]
        })
      )
      var act2Options = [['', '不播放（第一幕结束直接进聊天）']].concat(
        (templates || []).map(function (t) {
          return [t.id, t.name + (t.source === 'user' ? ' · 本地' : '')]
        })
      )

      return h('div', { className: '__ss_root' },
        versionLine,

        /* 开关 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '播放'),
          h(Check, {
            label: '启用启动动画',
            hint: '关闭后直接进主界面，不再显示启动界面。',
            checked: draft.enabled,
            onChange: (v) => set('enabled', v)
          }),
          h(Field, { label: '播放时机' },
            h(Select, { value: draft.mode, options: modeOptions, onChange: (v) => set('mode', v) })
          ),
          h(Field, { label: '速度倍率', hint: '0.35 慢放 · 1 原速 · 3 快放；参考片时长约 27 秒，默认整套约 16 秒。' },
            h('div', { className: '__ss_row' },
              h('input', {
                type: 'range', min: 0.35, max: 3, step: 0.05,
                value: draft.speed,
                style: { flex: '1 1 240px' },
                onChange: (e) => set('speed', Number(e.target.value))
              }),
              h('span', { className: '__ss_status' }, Number(draft.speed).toFixed(2) + '×')
            )
          )
        ),

        /* 模板：第一幕 / 第二幕 分开选 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '模板'),
          h(Field, {
            label: '启动动画第一幕',
            hint: '先播这一段。默认「档案暖白」，结尾是 WELCOME TO DEEPSEEK HARNESS。'
          },
            h(Select, {
              value: draft.template || '',
              options: templateOptions,
              onChange: (v) => set('template', v)
            })
          ),
          h(Field, {
            label: '启动动画第二幕',
            hint: '第一幕播完接着播这一段；选「不播放」就第一幕结束直接进聊天。'
          },
            h(Select, {
              value: draft.act2 || '',
              options: act2Options,
              onChange: (v) => set('act2', v)
            })
          ),
          h('div', { className: '__ss_row' },
            h('button', {
              className: '__ss_btn',
              type: 'button',
              onClick: function () { openTemplateEditor() }
            }, '打开模板编辑器'),
            h('span', { className: '__ss_hint' }, '在网页里改文案/配色/分幕，保存后回到这里选它')
          )
        ),

        /* 聊天背景引导（另一个窗口的设置） */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '聊天背景'),
          h('div', { className: '__ss_hint', style: { lineHeight: '1.9' } },
            '聊天背景是另一个窗口的设置：打开 DSH 设置 →「聊天背景」，',
            '可以选聊天底图 / 大字横幅。',
            h('br'),
            '把图片丢进 ~/.dsh/chat-wallpaper 即可换底图。'
          )
        ),

        /* 身份 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '身份资料'),
          h(Field, {
            label: '身份名称',
            hint: '终幕「欢迎 xxx 访问 / WELCOME, XXX」里的 xxx，也出现在第二步的身份卡上。'
          }, h(TextInput, { value: draft.identity, placeholder: '例如：JOYCE MOORE', onChange: (v) => set('identity', v) })),
          h('div', { className: '__ss_two' },
            h(Field, { label: '身份编号', hint: '显示在第二步身份卡上，建议用数字（如 0087）。' },
              h(TextInput, { value: draft.identityId, mono: true, onChange: (v) => set('identityId', v) })),
            h(Field, { label: '权限等级' },
              h(TextInput, { value: draft.accessLevel, mono: true, onChange: (v) => set('accessLevel', v) }))
          )
        ),

        /* 交互 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '交互'),
          h(Check, {
            label: '需要人工确认',
            hint: '第 1、2 步停下来等按钮 / Enter / 空格；关闭则整段自动播放。',
            checked: draft.requireInteraction,
            onChange: (v) => set('requireInteraction', v)
          }),
          h(Check, {
            label: '允许跳过',
            hint: '右上角显示 SKIP，按 Esc 也能直接进主界面。',
            checked: draft.allowSkip,
            onChange: (v) => set('allowSkip', v)
          }),
          h(Check, {
            label: '音效',
            hint: '默认关闭；开启后在交互确认时有轻微电子音（浏览器需先有一次用户操作）。',
            checked: draft.sound,
            onChange: (v) => set('sound', v)
          }),
          h(Check, {
            label: '背景底噪（硬盘嗡鸣 / 老电视沙沙声）',
            hint: '默认关闭。开启后整段开机铺一层很轻的低频底噪，像机器通电；觉得吵就关掉。',
            checked: draft.bedNoise === true,
            onChange: (v) => set('bedNoise', v)
          })
        ),

        /* 语音与音效 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '语音与音效'),
          h(Check, {
            label: '女声播报（念每一行的英文）',
            hint: '照参考片里那位女声的节奏：文字出现的同一时刻念出来。'
              + '动画会等这句话念完再走下一步，不会把语音掐断；浏览器要求先有一次点击才准出声，'
              + '所以第一次点按钮/按 Enter 时会把当前这行补念一次。',
            checked: draft.voice,
            onChange: (v) => set('voice', v)
          }),
          h(Field, {
            label: '语音来源',
            hint: '素材 = 插件内置的真声（来自你给的音频，5 句）；TTS = 用系统语音合成。'
              + '素材缺失时无论选哪个都会自动回落到 TTS；终幕那句嵌了可配置的身份名称，始终走 TTS。'
          },
            h(Select, {
              value: draft.voiceSource || 'asset',
              options: [['asset', '真声素材（推荐）'], ['tts', '系统 TTS 合成']],
              onChange: (v) => set('voiceSource', v)
            })
          ),
          h(Field, { label: '播报语言' },
            h(Select, {
              value: draft.voiceLang,
              options: [['en', '英语（照参考片）'], ['zh', '中文'], ['both', '中英各念一遍']],
              onChange: (v) => set('voiceLang', v)
            })
          ),
          draft.voice ? h(VoicePicker, {
            value: draft.voiceName,
            onChange: (v) => set('voiceName', v),
            onPreview: () => speakSample(null, draft)
          }) : null,
          draft.voice ? h('div', { className: '__ss_row' },
            h('button', {
              className: '__ss_btn',
              type: 'button',
              onClick: () => {
                set('voiceRate', 0.88)
                set('voicePitch', 0.85)
                set('voiceName', '')
                set('voiceCue', true)
                set('voiceLead', 240)
              }
            }, '↺ 套用「电影旁白」档'),
            h('span', { className: '__ss_hint' }, '语速 0.88 · 音调 0.85（压抑、深沉）· 自动挑神经网络女声 · 提示音 + 开口留白')
          ) : null,
          draft.voice ? h('div', { className: '__ss_two' },
            h(Field, { label: '语速' },
              h(Range, { value: num(draft.voiceRate, 1), min: 0.5, max: 2, display: num(draft.voiceRate, 1).toFixed(2) + '×', onChange: (v) => set('voiceRate', v) })
            ),
            h(Field, { label: '音调' },
              h(Range, { value: num(draft.voicePitch, 1), min: 0, max: 2, display: num(draft.voicePitch, 1).toFixed(2), onChange: (v) => set('voicePitch', v) })
            )
          ) : null,
          draft.voice ? h(Field, { label: '开口前留白', hint: '提示音响过之后停多久再开口。电影旁白/机场广播都有这一拍，240ms 起最像"系统在播报"。' },
            h(Range, {
              value: num(draft.voiceLead, 240), min: 0, max: 800, step: 20,
              display: Math.round(num(draft.voiceLead, 240)) + ' ms',
              onChange: (v) => set('voiceLead', v)
            })
          ) : null,
          draft.voice ? h(Field, { label: '音量' },
            h(Range, { value: num(draft.voiceVolume, 0.9), min: 0, max: 1, display: Math.round(num(draft.voiceVolume, 0.9) * 100) + '%', onChange: (v) => set('voiceVolume', v) })
          ) : null,
          draft.voice ? h(Check, {
            label: '播报前提示音',
            hint: '念台词之前先响两声轻提示 —— 这一笔让 TTS 从「浏览器念字」变成「系统播报」，是 AI 感的关键。',
            checked: draft.voiceCue,
            onChange: (v) => set('voiceCue', v)
          }) : null,
          h(Check, {
            label: '界面音效',
            hint: '咔哒 / 双音确认 / 过场噪声扫频 / 结尾和声钟，全部 WebAudio 现场合成，不含音频文件。',
            checked: draft.sound,
            onChange: (v) => set('sound', v)
          }),
          draft.sound ? h(Field, { label: '音效音量' },
            h(Range, { value: num(draft.soundVolume, 0.5), min: 0, max: 1, display: Math.round(num(draft.soundVolume, 0.5) * 100) + '%', onChange: (v) => set('soundVolume', v) })
          ) : null
        ),

        /* 视觉 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '视觉'),
          h(Field, { label: '主题' },
            h(Select, {
              value: draft.theme,
              options: [['light', '浅色 · 暖白档案底板（参考片原色）'], ['dark', '深色 · 暗底板']],
              onChange: (v) => set('theme', v)
            })
          ),
          h('div', { className: '__ss_two' },
            h(Field, { label: '强调色 · 橙' },
              h('div', { className: '__ss_row' },
                h(ColorInput, { value: draft.accent, onChange: (v) => set('accent', v) }),
                h('span', { className: '__ss_status' }, draft.accent)
              )
            ),
            h(Field, { label: '故障色 · 蓝' },
              h('div', { className: '__ss_row' },
                h(ColorInput, { value: draft.glitchB, onChange: (v) => set('glitchB', v) }),
                h('span', { className: '__ss_status' }, draft.glitchB)
              )
            )
          )
        ),

        /* 文案 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '文案'),
          h('div', { className: '__ss_two' },
            h(Field, { label: '左上 · 主标题' }, h(TextInput, { value: draft.brand1, onChange: (v) => set('brand1', v) })),
            h(Field, { label: '左上 · 产品行' },
              h('div', { className: '__ss_row' },
                h(TextInput, { value: draft.brand3a, onChange: (v) => set('brand3a', v) }),
                h('span', { className: '__ss_status' }, '+'),
                h(TextInput, { value: draft.brand3b, onChange: (v) => set('brand3b', v) })
              )
            )
          ),
          h(Field, { label: '左上 · 副标题' }, h(TextInput, { value: draft.brand2, maxLength: 40, onChange: (v) => set('brand2', v) })),
          h('div', { className: '__ss_two' },
            h(Field, { label: '黑幕 · 中文' }, h(TextInput, { value: draft.orgZh, onChange: (v) => set('orgZh', v) })),
            h(Field, { label: '黑幕 · 英文' }, h(TextInput, { value: draft.orgEn, mono: true, onChange: (v) => set('orgEn', v) }))
          ),
          h('div', { className: '__ss_two' },
            h(Field, { label: '黑幕 · 小字' }, h(TextInput, { value: draft.orgSub, mono: true, onChange: (v) => set('orgSub', v) })),
            h(Field, { label: '终幕 · 黑框' }, h(TextInput, { value: draft.welcomeBox, onChange: (v) => set('welcomeBox', v) }))
          ),
          h(Field, { label: '右下 · 页脚' }, h(TextInput, { value: draft.footer, mono: true, onChange: (v) => set('footer', v) }))
        ),

        /* 预览 + 操作 */
        h('div', { className: '__ss_preview' },
          h('div', { className: '__ss_previewText' },
            '预览会按当前「已保存」的配置重播一次。想先看新配置，先点保存再预览。',
            file ? h('div', { style: { marginTop: '4px', opacity: 0.75 } }, '配置文件：' + file) : null
          ),
          h('button', { className: '__ss_btn', onClick: preview }, '立即预览')
        ),

        /* 版本与更新 */
        h('div', { className: '__ss_row', style: { marginTop: '10px' } },
          h('button', { className: '__ss_btn', disabled: checking, onClick: checkUpdate }, checking ? '检查中…' : '检查更新'),
          h('button', { className: '__ss_btn', onClick: runDiagnose }, '生成诊断报告'),
          h('span', {
            className: (update && update.ok && update.hasUpdate) ? '__ss_ok' : '__ss_hint'
          }, (function () {
            if (checking) return '正在读取 GitHub 最新版本…'
            if (!update) return '当前版本 v' + (version || FALLBACK_VERSION)
            if (update.ok === false) return '检查失败：' + (update.error || '未知') + '（不影响使用）'
            if (update.hasUpdate) return '有新版本 v' + update.latest + '（当前 v' + update.current + '）'
            return '已是最新（v' + (update.current || version) + '）'
          })()),
          (update && update.ok && update.hasUpdate && update.url)
            ? h('a', { className: '__ss_link', href: update.url, target: '_blank', rel: 'noreferrer' }, '打开下载页')
            : null,
          (update && update.ok && update.hasUpdate)
            ? h('button', { className: '__ss_btn __ss_btnPrimary', disabled: updating, onClick: runUpdate }, updating ? '更新中…' : '立即更新')
            : null,
          (update && update.ok && update.hasUpdate)
            ? h('button', { className: '__ss_btn', disabled: updating, onClick: pickLocalPackage }, '选择安装包')
            : null
        ),
        (update && update.ok && update.hasUpdate)
          ? h('div', { className: '__ss_hint', style: { marginTop: '6px', lineHeight: '1.8' } },
              '下载会优先用 Chrome（Edge + IDM 可能拦下载）。如果没自动继续，点「选择安装包」选 Downloads 里的 zip。')
          : null,
        updateMsg ? h('div', { className: '__ss_hint', style: { marginTop: '6px', lineHeight: '1.8' } }, updateMsg) : null,

        /* 鸣谢 */
        h('div', { className: '__ss_group', style: { marginTop: '10px' } },
          h('div', { className: '__ss_groupTitle' }, '鸣谢（原动画版权归原作者）'),
          h('div', { className: '__ss_hint', style: { lineHeight: '1.9' } },
            '片头（档案暖白）参考：沈宏宏（@6shenhonghong9） · ',
            h('a', { className: '__ss_link', href: 'https://github.com/6shenhonghong9/dsh-startup-screen', target: '_blank', rel: 'noreferrer' }, 'dsh-startup-screen'),
            h('br'),
            '鲸鱼娘素材：NativeDog1/dsh-boot-animation 内置片库「DeepSeek娘扫描睁眼」（BSD-3-Clause，原作者待上游确认）；可选模板「鲸鱼娘扫描睁眼」随包提供 · ',
            h('a', { className: '__ss_link', href: 'https://github.com/NativeDog1/dsh-boot-animation', target: '_blank', rel: 'noreferrer' }, 'dsh-boot-animation'),
            h('br'),
            '配音：DeepSeek · 语音包与台词由作者提供'
          )
        ),

        h('div', { className: '__ss_actions' },
          h('button', {
            className: '__ss_btn __ss_btnPrimary',
            disabled: busy,
            onClick: save
          }, busy ? '处理中…' : '保存'),
          h('button', { className: '__ss_btn', disabled: busy, onClick: reset }, '恢复默认'),
          h('button', { className: '__ss_btn', disabled: busy, onClick: load }, '放弃修改'),
          notice ? h('span', { className: '__ss_ok' }, notice) : null,
          error ? h('span', { className: '__ss_err' }, error) : null
        )
      )
    }

    /* ── 桌面端自举 ──────────────────────────────────────────────────────── */
    /* Host 半侧靠 ctx.webServer.tapIndex 往 index.html 里注入启动界面。
       web profile 一定走这条路；但 Electron 也可能改用 file:// + IPC 直接下发
       前端（dsh-host-webserver 的注释就写着 "Electron uses file:// plus IPC
       instead"），那时 index 注入整条不生效。所以浏览器半侧自己兜一层：
       没被 Host 接管时，由本侧建根节点 + 拉 splash.css/splash.js 自举。

       判定全在 window 上，不去猜宿主类型：
         __DSH_STARTUP_BOOT__  Host 已经注入过（index）/ 本侧已经自举过（client）
         __DSH_STARTUP_SKIP__  Host 侧的兜底脚本已判定"这次不播"
         __DSH_STARTUP__       配置已就位（Host 注入的）
       Host 判定失效时不该被静默吃掉，所以这里在拦到 SKIP 之前，还要看一眼
       Host 侧根本没跑过（BOOT 标记为空）这种情况：把兜底脚本的同款判定补做一遍。 */
    var BOOT_ROUTE = '/dsh-startup'

    function readFlag(store, key) {
      try {
        var s = window[store]
        return s ? s.getItem(key) : null
      } catch (e) { return null }
    }

    function writeFlag(store, key, value) {
      try {
        var s = window[store]
        if (s) s.setItem(key, value)
      } catch (e) { /* 隐私模式下可能抛，忽略 */ }
    }

    /* ── 桌面窗口的原生按钮条 ────────────────────────────────────────────
       Electron 的 titleBarOverlay 画在页面之上，任何 z-index 都盖不住。
       DSH 的 preload 会测量 body 里一个探针 span 的 background-color/color，
       再 setTitleBarOverlay() 画那条带子，并在 <head> 变动时重新测量。
       所以片头期间把探针改成透明：三个按钮就浮在动画上，而不是压在一条实心条上。
       片头结束移除样式，head 变动本身触发重新测量，DSH 恢复自己的颜色。 */
    function adaptCaption(on) {
      try {
        var ID = 'dsh-startup-caption'
        var old = document.getElementById(ID)
        if (!on) {
          if (old && old.parentNode) old.parentNode.removeChild(old)
          return
        }
        if (old) return
        /* mac 没有 titleBarOverlay；其余平台一律尝试（没有探针时这条样式是空操作）。
           早期版本还额外要求 html[data-platform] 存在，实测某些桌面版本该属性为空，
           那条 gate 反而把功能挡掉了。 */
        var platform = document.documentElement && document.documentElement.dataset
          ? document.documentElement.dataset.platform : ''
        if (platform === 'darwin') return
        var st = document.createElement('style')
        st.id = ID
        /* 探针选择器照抄 DSH Desktop preload 的测量对象，另附两种兜底写法 */
        st.textContent = [
          'body>span[style*="dsw-specific-sidebar-fill"]',
          'body span[style*="dsw-specific-sidebar-fill"]',
          'body>span[style*="sidebar-fill"]'
        ].join(',') + '{background-color:transparent !important;color:#dfe7f3 !important}'
        ;(document.head || document.documentElement).appendChild(st)
      } catch (e) { /* 纯装饰，失败不影响任何功能 */ }
    }

    /* 一次性探针：标题栏那条带子到底由什么控制？把现场事实写回诊断日志，
       比反复猜选择器可靠。启动后 1.5 秒跑一次，开销可忽略。 */
    function probeCaption() {
      try {
        var out = {
          dataset: Object.assign({}, document.documentElement.dataset || {}),
          applied: !!document.getElementById('dsh-startup-caption'),
          rootPresent: !!document.getElementById('dsh-startup-root'),
          bootFlag: String(window.__DSH_STARTUP_BOOT__ || ''),
          skipFlag: window.__DSH_STARTUP_SKIP__ === true,
          probes: [],
          corner: '',
          cornerStack: [],
          frameEls: []
        }
        var spans = document.querySelectorAll('body > span, body span')
        for (var i = 0; i < spans.length && out.probes.length < 6; i++) {
          var st = String(spans[i].getAttribute('style') || '')
          if (st.indexOf('sidebar-fill') !== -1) {
            out.probes.push({
              tag: spans[i].tagName,
              parent: spans[i].parentNode ? spans[i].parentNode.tagName : '',
              style: st.slice(0, 140)
            })
          }
        }
        try {
          var el = document.elementFromPoint(window.innerWidth - 40, 18)
          out.corner = el ? (el.tagName + '#' + (el.id || '') + '.' + String(el.className || '').slice(0, 60)) : ''
          /* 记录右上角 6 层堆栈：新 DSH 的标题栏探针可能换了容器，单看一层不够 */
          var node = el
          for (var d = 0; node && d < 6; d++) {
            var cs = null
            try { cs = window.getComputedStyle(node) } catch (e3) { cs = null }
            out.cornerStack.push({
              tag: node.tagName,
              id: node.id || '',
              cls: String(node.className || '').slice(0, 80),
              bg: cs ? cs.backgroundColor : '',
              pe: cs ? cs.pointerEvents : ''
            })
            node = node.parentNode
          }
        } catch (e2) { /* noop */ }
        try {
          var frames = document.querySelectorAll('[class*="frame"], [class*="Frame"]')
          for (var fi = 0; fi < frames.length && out.frameEls.length < 8; fi++) {
            var fe = frames[fi]
            var fcs = null
            try { fcs = window.getComputedStyle(fe) } catch (e4) { fcs = null }
            out.frameEls.push({
              tag: fe.tagName,
              id: fe.id || '',
              cls: String(fe.className || '').slice(0, 80),
              bg: fcs ? fcs.backgroundColor : '',
              rect: (function () { try { var r = fe.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] } catch (e5) { return null } })()
            })
          }
        } catch (e6) { /* noop */ }
        fetch(BOOT_ROUTE + '/diag', {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: 'caption-probe ' + JSON.stringify(out)
        }).catch(function () { /* 诊断失败不影响启动 */ })
      } catch (e) { /* noop */ }
    }

    function markBooted() {
      try { window.__DSH_STARTUP_BOOT__ = 'client' } catch (e) { /* noop */ }
    }

    /* 片头结束后把标题栏还给 DSH；再兜一个 40 秒的上限，防止动画异常时一直透明 */
    try {
      window.addEventListener('dsh-startup:done', function () { adaptCaption(false) })
      setTimeout(function () { adaptCaption(false) }, 40000)
    } catch (e) { /* noop */ }

    /** 挂一个 <script src>；失败时调 fail(err)。 */
    function loadScript(src, fail) {
      var s = document.createElement('script')
      s.src = src
      s.async = false
      if (typeof fail === 'function') {
        s.addEventListener('load', function () { fail(null) })
        s.addEventListener('error', function () { fail(new Error('script load failed: ' + src)) })
      }
      ;(document.head || document.documentElement).appendChild(s)
    }

    /** 挂一份 <link rel=stylesheet>；失败时调 fail(err)。 */
    function loadCss(href, fail) {
      var link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      if (typeof fail === 'function') {
        link.addEventListener('load', function () { fail(null) })
        link.addEventListener('error', function () { fail(new Error('css load failed: ' + href)) })
      }
      ;(document.head || document.documentElement).appendChild(link)
    }

    /** 移除根节点、解开滚动锁定 —— 自举任何一步失败都要把页面还回去。 */
    function release(ok) {
      if (ok) return
      adaptCaption(false)
      try {
        var r = document.getElementById('dsh-startup-root')
        if (r && r.parentNode) r.parentNode.removeChild(r)
        if (document.documentElement.classList) document.documentElement.classList.remove('dsu-lock')
        if (document.body && document.body.style) document.body.style.overflow = ''
        window.__DSH_STARTUP_FAILED__ = true
      } catch (e) { /* 兜底不再抛 */ }
    }

    function injectRoot(cfg) {
      var root = document.getElementById('dsh-startup-root')
      if (!root) {
        root = document.createElement('div')
        root.id = 'dsh-startup-root'
        document.body.appendChild(root)
      }
      root.className = 'dsu-root dsu-boot'
      adaptCaption(true)
      setTimeout(probeCaption, 1500)
      setTimeout(probeCaption, 4200)
      if (document.documentElement.classList) document.documentElement.classList.add('dsu-lock')
      if (document.body && document.body.style) document.body.style.overflow = 'hidden'

      /* 样式与运行时都从 Host 路由取 —— 同一份文件，不额外维护内联副本 */
      var failed = false
      var cssReady = false
      var scriptReady = false
      function guard(err) {
        if (err) {
          if (!failed && typeof console !== 'undefined' && console.warn) {
            console.warn('[dsh-startup-screen] 启动界面自举失败，已放开页面：', err.message)
            reportDiag('injectRoot 失败: ' + err.message)
          }
          failed = true
          release(false)
          return
        }
        if (cssReady && scriptReady) release(true)
      }

      loadCss(BOOT_ROUTE + '/splash.css', function (err) {
        if (err) { guard(err); return }
        cssReady = true
        guard(null)
      })

      /* 配置先落 window：splash.js 载入时直接读它 */
      window.__DSH_STARTUP__ = cfg || {}
      try {
        delete window.__DSH_STARTUP_LOADED__
      } catch (e) { window.__DSH_STARTUP_LOADED__ = undefined }
      loadScript(BOOT_ROUTE + '/splash.js?t=' + Date.now(), function (err) {
        if (err) { guard(err); return }
        scriptReady = true
        guard(null)
      })

      /* 自愈：样式与脚本都拿到了、这个标记还在，就说明动画没接管，放行 */
      setTimeout(function () {
        try {
          var r = document.getElementById('dsh-startup-root')
          if (r && r.className && r.className.indexOf('dsu-boot') !== -1) release(false)
        } catch (e) { /* 兜底不再抛 */ }
      }, 9000)
    }

    function selfBoot() {
      try {
        if (typeof window === 'undefined' || typeof document === 'undefined') return
        if (!document.body) return
        if (window.__DSH_STARTUP_BOOT__) return          /* 已被 Host 或本侧接管 */
        if (window.__DSH_STARTUP__) return               /* 配置已在页面上：Host 注入过 */
        if (document.getElementById('dsh-startup-root')) return
        /* 已经出过错的地方不要再扑一次 */
        if (window.__DSH_STARTUP_FAILED__ === true) return
        markBooted()
        fetch(API, { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json() })
          .then(function (j) { return j && j.ok === true ? j.config : null })
          .catch(function () { return null })
          .then(function (cfg) {
            cfg = cfg || { enabled: true, mode: 'session', speed: 1 }
            if (cfg.enabled === false) return
            var today = new Date().toISOString().slice(0, 10)
            if (cfg.mode === 'session' && readFlag('sessionStorage', 'dsh-startup-screen:shown') === '1') return
            if (cfg.mode === 'daily' && readFlag('localStorage', 'dsh-startup-screen:day') === today) return
            /* 回填判定标记，保证与 Host 侧同款语义（splash.js 会读这两个键） */
            if (cfg.mode === 'session') writeFlag('sessionStorage', 'dsh-startup-screen:shown', '1')
            if (cfg.mode === 'daily') writeFlag('localStorage', 'dsh-startup-screen:day', today)
            return injectRoot(cfg)
          })
          .catch(function () { /* 自举失败就算了，页面本来就是好的 */ })
      } catch (e) { /* 自举是兜底，绝不许把宿主带崩 */ }
    }

    /* ── 启动期取证 + 黑屏自愈 ────────────────────────────────────────────── */

    /** 把启动期异常回传宿主（POST /dsh-startup/diag）。最多 8 条，失败静默。 */
    var diagSent = 0
    function reportDiag(msg) {
      if (diagSent >= 8) return
      diagSent++
      try {
        fetch(API.replace('/config', '/diag'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: String(msg).slice(0, 900)
        }).catch(function () { /* 取证失败不影响启动 */ })
      } catch (e) { /* 同上 */ }
    }

    /* 黑屏自愈：Host 那侧把黑幕（根节点 + CSS）注进来了，但运行时没起来。
       成因可能是 splash.js 被栅栏拦下、加载后抛错，或者注入行里的外部脚本
       被页面侧解释器丢掉了。判据：800ms 后根节点仍带 dsu-boot、运行时既没
       加载过也没挂出 API —— 那就自己把 CSS/JS 补上。800ms 足够让正常的
       script-src 行跑完；跑不完说明它压根没执行，这时候补注入是唯一出路。
       宁可多闪一下，也不能停在一块纯黑屏上干等 9 秒兜底。 */
    var healDone = false
    function healBlackScreen() {
      try {
        setTimeout(function () {
          try {
            if (typeof window === 'undefined' || typeof document === 'undefined') return
            if (window.__DSH_STARTUP_FAILED__ === true) return
            if (window.__DSH_STARTUP_LOADED__) return
            if (window.__DSH_STARTUP_API__) return
            var root = document.getElementById('dsh-startup-root')
            if (!root) return
            if ((root.className || '').indexOf('dsu-boot') === -1) return
            /* 注意：判据只看"运行时有没有真的跑起来"，不看"文档里有没有 script 标签"。
               2.1.1 就是栽在这上面 —— 标签在文档里但被当成 innerHTML 插进去、永远
               不执行，于是自愈以为"只等就好"，动画彻底不出现。
               这里直接补一次 DOM 注入的 loadScript（这条路实测一定能执行），
               splash.js 自身的 __DSH_STARTUP_LOADED__ 单例守卫会挡住第二次初始化。 */
            healDone = true
            reportDiag('heal: 800ms 运行时未起来，自行注入（boot=' + String(window.__DSH_STARTUP_BOOT__) + '）')
            markBooted()
            injectRoot(window.__DSH_STARTUP__ || {})
          } catch (e) { /* 自愈失败也不能带崩宿主 */ }
        }, 800)
      } catch (e) { /* noop */ }
    }

    /* 启动期错误回传：只关心来自 /dsh-startup/ 的脚本错误 */
    try {
      window.addEventListener('error', function (ev) {
        try {
          var file = (ev && ev.filename) || ''
          if (file.indexOf('/dsh-startup/') === -1) return
          reportDiag('onerror: ' + String((ev && ev.message) || '') + ' @ ' + file + ':' + String((ev && ev.lineno) || 0))
        } catch (e) { /* noop */ }
      })
      window.addEventListener('unhandledrejection', function (ev) {
        try {
          var r = ev && ev.reason
          reportDiag('unhandledrejection: ' + String((r && r.message) || r))
        } catch (e) { /* noop */ }
      })
    } catch (e) { /* noop */ }

    /* ── 模板编辑器：在应用内嵌一层全屏面板打开 ─────────────────────────────
       不能用 window.open —— Electron 渲染进程通常不允许新开窗口，点了没反应。
       这里直接在 body 上盖一个 iframe，同源、带会话，编辑器里的接口都能用。 */
    function openTemplateEditor() {
      try {
        var old = document.getElementById('dsu-editor-overlay')
        if (old && old.parentNode) old.parentNode.removeChild(old)

        var wrap = document.createElement('div')
        wrap.id = 'dsu-editor-overlay'
        wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#0b0d11;display:flex;flex-direction:column'

        var bar = document.createElement('div')
        bar.style.cssText = 'flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:10px 14px;background:#14161a;color:#e8ecf2;font:14px/1.6 Segoe UI,Microsoft YaHei,sans-serif;border-bottom:1px solid #2a2f38'

        var title = document.createElement('span')
        title.style.cssText = 'font-weight:600;letter-spacing:.02em'
        title.textContent = '启动动画 · 模板编辑器'

        var msg = document.createElement('span')
        msg.style.cssText = 'color:#9aa4b2;font-size:12px;flex:1'
        msg.textContent = '正在加载编辑器…'

        var close = document.createElement('button')
        close.textContent = '✕ 关闭（Esc）'
        /* 关闭是中性操作，不用危险红（红只留给「删除模板」这类真破坏性动作，§2.8.1） */
        close.style.cssText = 'flex:0 0 auto;background:#2a2f38;color:#e8ecf2;border:1px solid #3d4654;border-radius:8px;padding:8px 16px;cursor:pointer;font:inherit;font-weight:600'
        function closeIt() {
          try { if (wrap.parentNode) wrap.parentNode.removeChild(wrap) } catch (e) {}
          try { document.removeEventListener('keydown', onKey, true) } catch (e) {}
        }
        close.onclick = closeIt

        var onKey = function (ev) { if (ev && ev.key === 'Escape') { closeIt() } }
        try { document.addEventListener('keydown', onKey, true) } catch (e) {}

        /* 关闭按钮放最左边：右上角被客户端窗口的最小化/最大化/关闭压着，放那儿点不到 */
        var spacerRight = document.createElement('span')
        spacerRight.style.cssText = 'flex:0 0 150px'
        bar.appendChild(close); bar.appendChild(title); bar.appendChild(msg); bar.appendChild(spacerRight)

        var frame = document.createElement('iframe')
        frame.style.cssText = 'flex:1;border:0;width:100%;height:100%;background:#0b0d11'
        frame.setAttribute('allow', 'clipboard-write')

        wrap.appendChild(bar); wrap.appendChild(frame)
        document.body.appendChild(wrap)

        /* 不走 iframe 导航 —— 那一步会被宿主的信任栅栏挡成空白页。
           先把编辑器页面源码取回来（和设置面板同一个 fetch 通道，能过栅栏），
           再塞进 srcdoc，页面就不用再发一次导航请求了。 */
        fetch(BOOT_ROUTE + '/editor', { headers: { Accept: 'text/html' }, cache: 'no-store' })
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status)
            return r.text()
          })
          .then(function (html) {
            if (!html || html.length < 500) throw new Error('页面内容异常（' + html.length + ' 字节）')
            msg.textContent = '按 Esc 或右上角关闭'
            frame.srcdoc = html
            /* 自检：编辑器脚本跑起来的话左侧表单会被填满；没填满就是被 CSP 拦了 */
            setTimeout(function () {
              try {
                var doc = frame.contentDocument
                var sideEl = doc && doc.getElementById('side')
                if (sideEl && sideEl.children.length > 0) { msg.textContent = '按 Esc 或右上角关闭'; return }
                msg.textContent = '编辑器脚本没跑起来（可能被页面 CSP 拦了内联脚本）—— 把这句话告诉大肥鱼'
              } catch (e) {
                msg.textContent = '读不到编辑器内容：' + String((e && e.message) || e)
              }
            }, 1500)
          })
          .catch(function (e) {
            msg.textContent = '编辑器没加载出来：' + String((e && e.message) || e) + ' —— 把这句话告诉大肥鱼'
          })
      } catch (e) {
        try { console.warn('[dsh-startup-screen] 打不开模板编辑器：', String((e && e.message) || e)) } catch (e2) { /* noop */ }
      }
    }

    /* ── 插件 ────────────────────────────────────────────────────────────── */
    var inject = ['slots']

    function apply(ctx) {
      /* 桌面端兜底：Host 的 index 注入不生效时，由这里自举启动界面。
         正常 web 流程下 __DSH_STARTUP__/__DSH_STARTUP_BOOT__ 已就位，本调用直接返回。 */
      selfBoot()
      /* 标题栏适配不能只放在 injectRoot 里：宿主注入成功时 selfBoot 会提前返回，
         injectRoot 根本不会执行 —— 这就是 2.5.0 里那条没生效的根因。
         这里再补一次（幂等），并挂上一次性探针。 */
      try {
        var bootCfg = window.__DSH_STARTUP__ || null
        if (!bootCfg || bootCfg.enabled !== false) {
          adaptCaption(true)
          setTimeout(probeCaption, 1800)
          setTimeout(probeCaption, 4500)
        }
      } catch (e) { /* noop */ }
      healBlackScreen()
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'startup-screen', order: 26, label: '启动动画' },
          function () { return h(Panel, {}) }
        )
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
    })()

    /* 第二段执行：聊天壁纸（原 dsh-chat-wallpaper）*/
    var __wallHalf = (function () {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var TAG_ID = 'dsh-chat-wallpaper/main.css'
    var BG_ID = 'dsh-cw-bg'              /* 聊天底图层（用户自己定的那张图 + 纱）*/
    var BANNER_ID = 'dsh-cw-banner'      /* 大字横幅层（铺满窗口的那行字，z-index:-1）*/
    var API = '/chat-wallpaper'
    /* 每次改客户端就把这个号 +1。
       有了它在控制台一眼就能判断"浏览器里跑的是不是最新那份" ——
       排查问题时，分不清是代码问题还是旧包，会白猜一轮。 */
    var BUILD = 'cw-22'

    function log() {
      try {
        var a = ['[chat-wallpaper]']
        for (var i = 0; i < arguments.length; i++) a.push(arguments[i])
        console.log.apply(console, a)
      } catch (e) { /* console 不可用就算了 */ }
    }

    /* ── 主题判定 ───────────────────────────────────────────────────────── */

    /** 扫 html/body 上所有属性的名字与值，以及 className，找 "dark" */
    function markerSaysDark() {
      var els = [document.documentElement, document.body]
      for (var i = 0; i < els.length; i++) {
        var el = els[i]
        if (!el) continue
        if (/dark/i.test(el.className || '')) return true
        var attrs = el.attributes || []
        for (var j = 0; j < attrs.length; j++) {
          var a = attrs[j]
          if (/dark/i.test(a.name) || /dark/i.test(String(a.value))) return true
        }
      }
      return false
    }

    /** 兜底：量一下外壳的实心底色亮度（必须在注入我们自己的 CSS 之前调用） */
    function bgLuminance() {
      try {
        var el = document.getElementById('root') || document.body
        var c = getComputedStyle(el).backgroundColor
        var m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(c || '')
        if (!m) return -1
        var alpha = m[4] === undefined ? 1 : parseFloat(m[4])
        // 透明底 = 判断不了，必须返回"未知"。
        // 否则会把 rgba(0,0,0,0) 当成纯黑判成深色 —— 而我们的 CSS 恰恰把外壳变透明，
        // 于是主题一变，壁纸就自己判自己深色、把自己撤掉（自杀式回归）。
        if (!(alpha > 0)) return -1
        return (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255
      } catch (e) { return -1 }
    }

    /**
     * 主题判定。
     *
     * 亮度只在**第一次**判定时量，之后缓存 —— 因为一旦我们的 CSS 生效，
     * 外壳底色就变透明了，再量只会得到"未知"（见 bgLuminance 的注释）。
     * 之后的主题变化靠标记判定（MutationObserver 会在属性变化时重跑）。
     */
    var measuredLum = null

    function looksDark() {
      if (markerSaysDark()) return true
      if (measuredLum === null) measuredLum = bgLuminance()
      return measuredLum >= 0 && measuredLum < 0.45
    }

    /* ── CSS ─────────────────────────────────────────────────────────────── */

    /**
     * 生成注入的 CSS。
     *
     * 所有规则都挂在 JS 写上去的 .dsh-cw-dark / .dsh-cw-light 上，
     * 不依赖 DSH 内部的主题标记叫什么名字。
     *
     * 两个层：
     *   #dsh-cw-bg      聊天底图 + 纱   z-index:-2（只有配了图才有）
     *   #dsh-cw-banner  大字横幅        z-index:-1（只有配了横幅才有）
     * "外壳让开"（--dsw-alias-bg-base: transparent）只在"背后有东西要看"时才做。
     */
    function buildCss(cfg) {
      var B = '#' + BG_ID
      var N = '#' + BANNER_ID
      var V = '.dsh-cw-veil'
      var hasImage = !!cfg.__imageOk
      var hasBanner = !!(cfg.banner && String(cfg.banner).trim())
      var L = []

      /* ── 外壳让开：只要"背后有东西要看"（底图或大字）── */
      if (hasImage || hasBanner) {
        L.push('/* 让开的只是 html/body 自己的底色 */')
        L.push('html.dsh-cw-light, html.dsh-cw-light body,')
        L.push('html.dsh-cw-dark, html.dsh-cw-dark body { background: transparent !important; }')
        L.push('/* 外壳让开 —— 秘密就这两个变量；侧栏按主题给半透色。')
        L.push('   面板/卡片/代码块用的是别的变量，一律不动，所以文字永远落在实心底上。 */')
        L.push('html.dsh-cw-light body {')
        L.push('  --dsw-alias-bg-base: transparent;')
        L.push('  --dsw-specific-sidebar-fill: ' + cfg.sidebarLight + ';')
        L.push('}')
        L.push('html.dsh-cw-dark body {')
        L.push('  --dsw-alias-bg-base: transparent;')
        L.push('  --dsw-specific-sidebar-fill: ' + cfg.sidebarDark + ';')
        L.push('}')
      }

      /* ── 聊天底图层（最底，z-index:-2）── */
      if (hasImage) {
        L.push('/* 聊天底图：最底层、不拦点击 */')
        L.push(B + ' {')
        L.push('  position: fixed; inset: 0; z-index: -2;')
        L.push('  pointer-events: none; overflow: hidden;')
        L.push('}')
        L.push('html.dsh-cw-light ' + B + ' { background: ' + cfg.fallbackLight + '; }')
        L.push('html.dsh-cw-dark ' + B + ' { background: ' + cfg.fallbackDark + '; }')
        L.push(B + ' > img {')
        L.push('  position: absolute; inset: 0;')
        L.push('  width: 100%; height: 100%; display: block;')
        L.push('  object-fit: ' + (cfg.imageFit || 'cover') + '; object-position: center;')
        L.push('}')
        L.push('/* 纱：底图上的文字靠它撑对比度。浅色压白纱、深色压深纱 */')
        L.push(B + ' > ' + V + ' { position: absolute; inset: 0; }')
        L.push('html.dsh-cw-light ' + B + ' > ' + V + ' { background: linear-gradient(' + cfg.veilLightA + ', ' + cfg.veilLightB + '); }')
        L.push('html.dsh-cw-dark ' + B + ' > ' + V + ' { background: linear-gradient(' + cfg.veilDarkA + ', ' + cfg.veilDarkB + '); }')
      }

      /* ── 大字横幅层（z-index:-1：在底图之上、聊天内容之下）──
         为什么用真文字而不是图片：**矢量，放多大都不糊**。
         字号由 fitBanner() 量出来（把字号设 100px 量宽度 → 按窗口宽度等比放大），
         所以"铺满"对任意长度的文字都成立，不是猜的。 */
      if (hasBanner) {
        L.push('/* 大字横幅：铺满窗口的那行字（矢量文字，不是拉伸的图片）*/')
        L.push(N + ' {')
        L.push('  position: fixed; inset: 0; z-index: -1;')
        L.push('  pointer-events: none; overflow: hidden;')
        L.push('  display: flex; align-items: center; justify-content: center;')
        L.push('}')
        L.push(N + ' > span {')
        L.push('  display: block; white-space: nowrap;')
        L.push('  line-height: 1; letter-spacing: 0.02em; font-weight: 800;')
        L.push('  font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "HarmonyOS Sans SC", "Noto Sans SC", system-ui, sans-serif;')
        L.push('  /* 颜色按主题走；透明度由 JS 写 --cw-banner-a（面板滑块控制）*/')
        L.push('}')
        L.push('html.dsh-cw-light ' + N + ' > span { color: rgba(18,20,28, var(--cw-banner-a, ' + (cfg.bannerOpacity == null ? 0.12 : cfg.bannerOpacity) + ')); }')
        L.push('html.dsh-cw-dark ' + N + ' > span { color: rgba(255,255,255, var(--cw-banner-a, ' + (cfg.bannerOpacity == null ? 0.12 : cfg.bannerOpacity) + ')); }')
      }

      return L.join('\n')
    }

    function styleTag() {
      return document.querySelector('style[data-plugin-css="' + TAG_ID + '"]')
    }

    function injectCss(cfg) {
      var existing = styleTag()
      if (existing) existing.remove()
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-chat-wallpaper'
      tag.dataset.pluginCss = TAG_ID
      tag.textContent = buildCss(cfg)
      document.head.appendChild(tag)
    }

    function removeCss() {
      var existing = styleTag()
      if (existing) existing.remove()
    }

    /* ── DOM ─────────────────────────────────────────────────────────────── */

    /** 撤掉聊天底图层（最底那层）*/
    function removeBg() {
      var el = document.getElementById(BG_ID)
      if (el) el.remove()
    }

    /* ── 大字横幅 ────────────────────────────────────────────────────────
       用户要的是"进聊天后一眼看到铺满窗口的大字"。
       聊天消息里的字最大也就十几像素，永远做不到 —— 所以必须做成背景层。
       用**真文字**而不是图片：矢量，放多大都不糊。 */

    var bannerResize = null

    /**
     * 把字号调到"铺满窗口"。
     *
     * 不猜公式（中英混排宽度不一样：中文 1em，拉丁字母约 0.5em）——
     * 而是**量一次**：先把字号设成 100px，量出实际宽度，再按窗口宽度等比放大。
     * 这样对任意长度、任意中英混排的文字都成立。
     */
    function fitBanner() {
      var el = document.getElementById(BANNER_ID)
      if (!el) return
      var span = el.querySelector('span')
      if (!span) return
      try {
        span.style.fontSize = '100px'
        var w = span.getBoundingClientRect().width || span.scrollWidth || 0
        if (!(w > 0)) return                    /* 量不到就先不设，等下一次 resize */
        var vw = (typeof window !== 'undefined' && window.innerWidth) || document.documentElement.clientWidth || 1200
        var size = Math.max(20, Math.floor(100 * (vw * 0.96) / w))
        span.style.fontSize = size + 'px'
      } catch (e) { /* 忽略 */ }
    }

    function mountBanner(cfg) {
      var text = cfg.banner == null ? '' : String(cfg.banner).trim()
      var existing = document.getElementById(BANNER_ID)
      if (!text) { if (existing) existing.remove(); return null }
      if (existing) {
        /* 已经在了：只更新文字/透明度，不重建 */
        var s = existing.querySelector('span')
        if (s) s.textContent = text
        existing.style.setProperty('--cw-banner-a', String(cfg.bannerOpacity == null ? 0.12 : cfg.bannerOpacity))
        fitBanner()
        return existing
      }

      var el = document.createElement('div')
      el.id = BANNER_ID
      el.setAttribute('aria-hidden', 'true')
      el.style.setProperty('--cw-banner-a', String(cfg.bannerOpacity == null ? 0.12 : cfg.bannerOpacity))
      el.appendChild(document.createElement('span')).textContent = text
      /* 插在底图之上、聊天内容之下：DOM 顺序无所谓，z-index 决定 */
      document.body.insertBefore(el, document.body.firstChild)

      /* 插进 DOM 之后量一次；窗口尺寸变了再量 */
      requestAnimationFrame(fitBanner)
      if (!bannerResize) {
        bannerResize = function () { fitBanner() }
        try { window.addEventListener('resize', bannerResize) } catch (e) {}
      }
      log('挂载大字横幅', { text: text, size: '按窗口自动' })
      return el
    }

    function removeBanner() {
      var el = document.getElementById(BANNER_ID)
      if (el) el.remove()
      if (bannerResize) {
        try { window.removeEventListener('resize', bannerResize) } catch (e) {}
        bannerResize = null
      }
    }

    /**
     * 聊天底图层：用户自己定的那张图 + 纱。**在最底下。**
     * 有图就挂、没图就什么都不挂；和上面的大字横幅互相独立。
     */
    function mountBg(cfg) {
      if (!cfg.__imageOk) return null
      var already = document.getElementById(BG_ID)
      if (already) return already

      var bg = document.createElement('div')
      bg.id = BG_ID
      bg.setAttribute('aria-hidden', 'true')

      var img = document.createElement('img')
      img.alt = ''
      img.setAttribute('aria-hidden', 'true')
      img.addEventListener('error', function () {
        log('聊天底图加载失败 → 撤掉它')
        if (img.parentNode) img.parentNode.removeChild(img)
      })
      img.src = API + '/image?t=' + Date.now()

      var veil = document.createElement('div')
      veil.className = 'dsh-cw-veil'

      bg.appendChild(img)
      bg.appendChild(veil)
      document.body.insertBefore(bg, document.body.firstChild)
      log('挂载聊天底图层')
      return bg
    }

    /* ── 生命周期 ───────────────────────────────────────────────────────── */

    var current = null         // 当前生效的配置
    var observer = null
    var themeClass = null      // 当前写到 <html> 上的主题 class

    /** 把主题判定结果写到 <html> 的 class 上 —— CSS 全部读它，不读 DSH 的标记 */
    function setThemeClass(dark) {
      var next = dark ? 'dsh-cw-dark' : 'dsh-cw-light'
      if (themeClass === next) return
      document.documentElement.classList.remove('dsh-cw-dark', 'dsh-cw-light')
      document.documentElement.classList.add(next)
      themeClass = next
    }

    function applyNow(cfg) {
      current = cfg
      var dark = looksDark()
      setThemeClass(dark)
      log('套用壁纸', { image: cfg.__image, theme: dark ? 'dark' : 'light' })
      injectCss(cfg)
      mountBg(cfg)            /* 最底：聊天底图（用户自己定的那张，可选）*/
      mountBanner(cfg)        /* 其上：铺满窗口的大字（可选）*/
    }

    /**
     * 撤场：把 CSS / 底图 / 横幅全部收回，页面回到原样（测试清场原语；运行期不再调用）。
     *
     * ★★ 必须同时清掉 `current` 并断开主题观察者 ★★
     * 否则会"复活"：撤场后 current 还留着 → 下一次 html/body 属性变化把观察者叫醒
     * → 它发现"没挂载" → applyNow(current) → 把壁纸重新挂起来 → 无限循环。
     */
    function teardown() {
      current = null
      if (observer) {
        try { observer.disconnect() } catch (e) { /* 忽略 */ }
        observer = null
      }
      removeCss()
      removeBg()
      removeBanner()
      try {
        document.documentElement.classList.remove('dsh-cw-dark', 'dsh-cw-light')
        themeClass = null
      } catch (e) { /* 忽略 */ }
    }

    /** 主题变化时只换主题 class（换纱换色）。观察者**只改 class**，绝不挂载/重挂任何层。 */
    function watchTheme(cfg) {
      if (observer || typeof MutationObserver === 'undefined') return
      observer = new MutationObserver(function () {
        if (!current) return
        var dark = looksDark()
        var want = dark ? 'dsh-cw-dark' : 'dsh-cw-light'
        if (themeClass !== want) {
          log('主题切换 →', dark ? '深色纱' : '白纱')
          setThemeClass(dark)
        }
      })
      observer.observe(document.documentElement, { attributes: true })
      if (document.body) observer.observe(document.body, { attributes: true })
    }

    /** 调宿主接口，拿 JSON（失败一律返回 null，绝不抛） */
    function api(path, opts) {
      return fetch(API + path, opts)
        .then(function (r) { return r.json() })
        .catch(function (e) { log('设置面板请求失败', path, String(e && e.message)); return null })
    }

    /* ── 启动 ───────────────────────────────────────────────────────────── */

    var booted = false

    /**
     * 自举。**只跑一次** —— 重复自举会重复 fetch + 重复注 CSS，没必要。
     * 需要重新读配置就刷新页面。壁纸不再等开机动画、不再有「解析到视频」这道门：
     * 拿到底图/横幅配置就直接挂上。
     */
    function boot() {
      if (booted) { log('已自举过 → 跳过重复自举（要重读配置请刷新页面）'); return }
      booted = true
      wdiag('boot 开始')
      log('client build ' + BUILD + ' 已加载')
      try {
        fetch(API + '/config', { cache: 'no-store' })
          .then(function (r) { return r.json() })
          .then(function (data) {
            var cfg = data && data.config ? data.config : null
            if (!cfg) { log('拿不到配置，放弃'); return }
            /* 背景图：宿主已经解析好了，这里只拿"有没有" */
            cfg.__imageOk = !!data.imageOk
            cfg.__image = data.image
            wdiag('config ok image=' + String(data.imageOk))
            applyNow(cfg)
            watchTheme(cfg)
          })
          .catch(function (e) { log('请求配置失败，放弃', String(e && e.message)) })
      } catch (e) {
        wdiag('boot 失败: ' + String((e && e.message) || e))
        log('自举失败，放弃（绝不能把宿主带崩）', String(e && e.message))
      }
    }

    /* 壁纸半侧的诊断：回传给 /dsh-startup/diag，最多 10 条。
       "壁纸那半边到底跑没跑" 这个问题，光看控制台是看不到的 —— 落进日志里。 */
    var wdiagSent = 0
    function wdiag(msg) {
      if (wdiagSent >= 10) return
      wdiagSent++
      try {
        fetch('/dsh-startup/diag', {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: 'wall: ' + String(msg).slice(0, 800)
        }).catch(function () { /* 取证失败不影响运行 */ })
      } catch (e) { /* noop */ }
    }

    function apply(ctx) {
      /* 设置页入口：与「启动动画」并列的「聊天背景」（order 27）。 */
      try {
        if (ctx && ctx.slots && typeof ctx.slots.inject === 'function') {
          ctx.slots.inject('settings.section', function () {
            return ctx.slots.register(
              { name: 'settings.section', id: 'chat-wallpaper', order: 27, label: '聊天背景' },
              function () { return cwH(WallpaperPanel, {}) }
            )
          })
          wdiag('settings.section 已注册（聊天背景）')
        } else {
          wdiag('没有 ctx.slots，设置页入口跳过')
        }
      } catch (e) { wdiag('设置节注册失败: ' + String((e && e.message) || e)) }

      if (typeof document === 'undefined') { wdiag('没有 document，放弃自举'); return }
      wdiag('apply: readyState=' + document.readyState)
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true })
        /* 保险：DOMContentLoaded 万一在 apply 之前就烧掉了（客户端模块晚于它加载），
           监听器永远不触发，壁纸就整块死掉。2 秒后自己补一次。 */
        setTimeout(function () {
          try { if (!booted) { wdiag('DOMContentLoaded 没等到，强制自举'); boot() } } catch (e) { /* noop */ }
        }, 2000)
      } else {
        boot()
      }
    }

    /* ══ 设置页「聊天背景」面板（React）══════════════════════════════════════
       与「启动动画」并列（order 26 → 27）。数据走宿主自带的 HTTP 接口（/chat-wallpaper/*）。 */
    var cwReact = require('react')
    var cwH = cwReact.createElement

    /** 把 rgba(...) 里的 alpha 换掉，保留 RGB。 */
    function withAlpha(color, a) {
      var s = String(color || '')
      var m = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*[0-9.]+\s*)?\)$/.exec(s)
      if (!m) return 'rgba(0,0,0,' + Number(a).toFixed(2) + ')'
      return 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + Number(a).toFixed(2) + ')'
    }

    function WallpaperPanel() {
      var [data, setData] = cwReact.useState(null)
      var [draft, setDraft] = cwReact.useState(null)
      var [busy, setBusy] = cwReact.useState(false)
      var [error, setError] = cwReact.useState(null)
      var [notice, setNotice] = cwReact.useState(null)

      function load() {
        setError(null)
        return Promise.all([api('/images'), api('/config', { cache: 'no-store' })])
          .then(function (arr) {
            var images = arr[0] || {}
            var conf = arr[1] || {}
            var cfg = conf.config || {}
            var next = {
              images: images.images || [],
              current: images.current || null,
              dropDir: images.dropDir || '',
              dropDirExists: !!images.dropDirExists,
              veil: images.veil || { light: 0.8, dark: 0.5 },
              banner: cfg.banner || '',
              bannerOpacity: cfg.bannerOpacity == null ? 0.12 : cfg.bannerOpacity,
              veilLightA: cfg.veilLightA || 'rgba(253,250,254,.80)',
              veilDarkA: cfg.veilDarkA || 'rgba(8,10,16,.74)',
              image: conf.image || null
            }
            setData(next)
            setDraft({ banner: next.banner, bannerOpacity: next.bannerOpacity, dark: looksDark() })
          })
          .catch(function (e) { setError('读取失败：' + String((e && e.message) || e)) })
      }
      cwReact.useEffect(function () { load() }, [])

      function apply(patch, full) {
        setBusy(true); setNotice(null); setError(null)
        return api('/set', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch)
        })
          .then(function (r) {
            if (!r || !r.ok) throw new Error((r && r.error) || '写入失败')
            return api('/config', { cache: 'no-store' })
          })
          .then(function (conf) {
            var cfg = conf && conf.config ? conf.config : null
            if (!cfg) return null
            cfg.__imageOk = !!conf.imageOk
            cfg.__image = conf.image
            if (full) { removeBg(); removeCss(); applyNow(cfg) }
            else { current = cfg; injectCss(cfg) }
            setNotice('已保存并生效')
            return load()
          })
          .catch(function (e) { setError('保存失败：' + String((e && e.message) || e)) })
          .then(function () { setBusy(false) })
      }

      if (!data || !draft) return cwH('div', { className: '__ss_root' }, '读取中…')

      var dark = !!draft.dark
      var veilNow = dark ? data.veilDarkA : data.veilLightA
      var veilAlpha = dark ? data.veil.dark : data.veil.light

      var thumb = function (im) {
        var selected = data.current && data.current.split(/[\\/]/).pop() === im.name
        return cwH('button', {
          key: im.name,
          type: 'button',
          title: im.name + ' · ' + im.sizeKB + ' KB · ' + im.mtime,
          disabled: busy,
          onClick: function () { apply({ image: im.name }, true) },
          style: {
            position: 'relative', padding: 0, border: '2px solid ' + (selected ? 'var(--dsw-alias-state-business-primary,#3964fe)' : 'var(--dsw-alias-border-l2)'),
            borderRadius: 8, background: 'var(--dsw-alias-bg-layer-3)', cursor: 'pointer', overflow: 'hidden', width: 132, height: 76
          }
        },
          cwH('img', { src: im.url, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } }),
          cwH('span', {
            style: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '2px 4px', fontSize: 10, background: 'rgba(0,0,0,.55)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
          }, im.name)
        )
      }

      return cwH('div', { className: '__ss_root' },
        cwH('div', { className: '__ss_group' },
          cwH('div', { className: '__ss_groupTitle' }, '当前状态'),
          cwH('div', { className: '__ss_hint' },
            '背景图：' + (data.image ? data.image.split(/[\\/]/).pop() : '（没有背景图，使用 DSH 默认底色）'),
            cwH('br'),
            '丢图目录：' + (data.dropDir || '?')
          ),
          cwH('div', { className: '__ss_row' },
            cwH('button', { className: '__ss_btn', type: 'button', onClick: function () { api('/open-dir', { method: 'POST' }) } }, '打开图片文件夹'),
            cwH('button', { className: '__ss_btn', type: 'button', disabled: busy, onClick: function () { load() } }, '刷新')
          )
        ),

        cwH('div', { className: '__ss_group' },
          cwH('div', { className: '__ss_groupTitle' }, '背景图'),
          cwH('div', { className: '__ss_hint' }, '点一下立刻换；把图丢进上面的目录就会出现在这里，按修改时间取最新那张。'),
          data.images.length
            ? cwH('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } }, data.images.map(thumb))
            : cwH('div', { className: '__ss_hint' }, '目录里还没有图。点「打开图片文件夹」，把 jpg / png / webp 丢进去，再点刷新。'),
          cwH('div', { className: '__ss_row' },
            cwH('button', { className: '__ss_btn', type: 'button', disabled: busy, onClick: function () { apply({ image: '' }, true) } }, '不用背景图')
          )
        ),

        cwH('div', { className: '__ss_group' },
          cwH('div', { className: '__ss_groupTitle' }, '纱的浓度（' + (dark ? '深色主题' : '浅色主题') + '）'),
          cwH('div', { className: '__ss_hint' }, '盖在背景图上的那层纱，越浓字越清楚、背景越淡。'),
          cwH('div', { className: '__ss_row' },
            cwH('input', {
              type: 'range', min: 0, max: 100, step: 1,
              value: Math.round(veilAlpha * 100), disabled: busy,
              style: { flex: 1 },
              onChange: function (ev) {
                var v = Number(ev.target.value) / 100
                var patch = {}
                patch[dark ? 'veilDarkA' : 'veilLightA'] = withAlpha(veilNow, v)
                apply(patch, false)
                var d = Object.assign({}, data); d.veil[dark ? 'dark' : 'light'] = v; setData(d)
              }
            }),
            cwH('span', { className: '__ss_status' }, Math.round(veilAlpha * 100) + '%')
          )
        ),

        cwH('div', { className: '__ss_group' },
          cwH('div', { className: '__ss_groupTitle' }, '大字横幅'),
          cwH('div', { className: '__ss_hint' }, '铺满窗口的一行字（矢量文字，不会糊）。留空 = 不要横幅。'),
          cwH('input', {
            className: '__ss_input', type: 'text', value: draft.banner, disabled: busy,
            placeholder: '例如：DEEPSEEK HARNESS',
            onChange: function (ev) { var d = Object.assign({}, draft); d.banner = ev.target.value; setDraft(d) }
          }),
          cwH('div', { className: '__ss_row' },
            cwH('input', {
              type: 'range', min: 0, max: 40, step: 1, value: Math.round(draft.bannerOpacity * 100), disabled: busy,
              style: { flex: 1 },
              onChange: function (ev) { var d = Object.assign({}, draft); d.bannerOpacity = Number(ev.target.value) / 100; setDraft(d) }
            }),
            cwH('span', { className: '__ss_status' }, Math.round(draft.bannerOpacity * 100) + '%')
          )
        ),

        cwH('div', { className: '__ss_actions' },
          cwH('button', {
            className: '__ss_btn __ss_btnPrimary', type: 'button', disabled: busy,
            onClick: function () { apply({ banner: draft.banner, bannerOpacity: draft.bannerOpacity }, true) }
          }, busy ? '保存中…' : '保存'),
          error ? cwH('span', { className: '__ss_err' }, error) : null,
          notice ? cwH('span', { className: '__ss_ok' }, notice) : null
        )
      )
    }

    exports.apply = apply
    exports.inject = []       // 不需要任何客户端服务

    /* 测试钩子：只给 node:vm 冒烟测试用，不参与运行时逻辑。
       有了它们就能在不启动 DSH 的情况下验证 CSS 生成、主题判定、挂载/撤场。 */
    exports.__buildCss = buildCss
    exports.__looksDark = looksDark
    exports.__TAG_ID = TAG_ID
    exports.__BG_ID = BG_ID
    exports.__BANNER_ID = BANNER_ID
    exports.__THEME_CLASSES = ['dsh-cw-dark', 'dsh-cw-light']
    exports.__resetLum = function () { measuredLum = null }
    exports.__mountBg = mountBg
    exports.__mountBanner = mountBanner
    exports.__fitBanner = fitBanner
    exports.__applyNow = applyNow
    exports.__watchTheme = watchTheme
    exports.__teardown = teardown
    exports.__hasCurrent = function () { return !!current }
    exports.__BUILD = BUILD

    return module.exports
    })()

    /* 测试钩子：两半的 __* 全量合并（两套冒烟测试的唯一入口） */
    Object.assign(module.exports, __wallHalf, __bootHalf)

    /* 受管入口：ModuleLoader 只会调这一个 apply。
       壁纸半侧先起（它只碰 DOM + HTTP，不依赖 slots），坏了也不能影响开机动画；
       开机动画半侧最后起，它的 inject: [slots] 是设置页要的契约。 */
    module.exports.apply = function (ctx) {
      try { __wallHalf.apply(ctx) } catch (e) {
        try { console.warn("[dsh-boot-suite] 聊天壁纸半侧启动失败，已跳过：", String((e && e.message) || e)) } catch (e2) { /* noop */ }
      }
      return __bootHalf.apply(ctx)
    }
    module.exports.inject = __bootHalf.inject

    return module.exports
  }
})
