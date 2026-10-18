/**
 * dsh-boot-suite — 浏览器半侧（合并版）
 * ---------------------------------------------------------------------------
 * 由两个插件合并而来：
 *   · 开机动画  ← 原 dsh-startup-screen/lib/client.js（DSH 设置页「启动动画」）
 *   · 聊天壁纸  ← 原 dsh-chat-wallpaper/lib/client.js（左下角「背景」按钮）
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
      sound: true, soundVolume: 0.5
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
    var FALLBACK_VERSION = '2.2.0'
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

        /* 模板：分幕文案、配色、节奏都由它决定 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '模板'),
          h(Field, {
            label: '启动动画模板',
            hint: '模板决定分幕文案、配色与节奏。想做自己的：在 ~/.dsh/startup-templates/<id>/template.json 放一份，刷新页面就会出现在这里。'
          },
            h(Select, {
              value: draft.template || '',
              options: templateOptions,
              onChange: (v) => set('template', v)
            })
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

    function markBooted() {
      try { window.__DSH_STARTUP_BOOT__ = 'client' } catch (e) { /* noop */ }
    }

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

    /* ── 插件 ────────────────────────────────────────────────────────────── */
    var inject = ['slots']

    function apply(ctx) {
      /* 桌面端兜底：Host 的 index 注入不生效时，由这里自举启动界面。
         正常 web 流程下 __DSH_STARTUP__/__DSH_STARTUP_BOOT__ 已就位，本调用直接返回。 */
      selfBoot()
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
    var ROOT_ID = 'dsh-chat-wallpaper'   /* 视频层（front=最前 / behind=最底）*/
    var BG_ID = 'dsh-cw-bg'              /* 聊天底图层（用户自己定的那张图 + 纱）*/
    var BANNER_ID = 'dsh-cw-banner'      /* 大字横幅层（铺满窗口的那行字，z-index:-1）*/
    var API = '/chat-wallpaper'
    /* 每次改客户端就把这个号 +1。
       有了它在控制台一眼就能判断"浏览器里跑的是不是最新那份" ——
       排查问题时，分不清是代码问题还是旧包，会白猜一轮。 */
    var BUILD = 'cw-21'

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
     * 关键设计：**所有规则都挂在我自己写上去的 .dsh-cw-dark / .dsh-cw-light 上**，
     * 不依赖 DSH 内部的主题标记叫什么名字（那个名字我没法保证，也不该去猜）。
     * 主题由 JS 判定后写到 <html> 的 class 上，CSS 只读这个 class。
     *
     * 两处"魔法"：
     *   · --dsw-alias-bg-base: transparent   外壳让开（面板/卡片用的是别的变量，不受影响）
     *   · 视频放 z-index:-1                  它在正常流内容之下
     * 其余是可读性保险：浅色主题压白纱、深色主题压深纱。
     */
    /**
     * 生成注入的 CSS。
     *
     * **两个层彻底分开**（这是"第二幕"和"聊天底图"两件事解耦的关键）：
     *
     *   #dsh-cw-bg      聊天底图 + 纱    z-index:-1        只有用户配了图才有
     *   #dsh-chat-wallpaper  开场视频
     *        placement="front"  → z-index:2147483000（盖住一切，播完淡出）
     *        placement="behind" → z-index:-1（当常驻背景用，配合 mode=loop）
     *
     * "外壳让开"（--dsw-alias-bg-base: transparent）**只在需要看见底图时才做**：
     * 全屏开场视频自己盖住一切，不需要动外壳 —— 动了反而会在视频结束后
     * 让聊天界面变透明（如果用户没配图，那就是一片空洞）。
     *
     * 主题由 JS 判定后写到 <html> 的 class 上，CSS 只读这个 class，
     * 不去猜 DSH 内部的主题标记叫什么。
     */
    function buildCss(cfg) {
      var R = '#' + ROOT_ID
      var B = '#' + BG_ID
      var N = '#' + BANNER_ID
      var V = '.dsh-cw-veil'
      var front = cfg.placement === 'front'
      var hasImage = !!cfg.__imageOk
      var hasBanner = !!(cfg.banner && String(cfg.banner).trim())
      var L = []

      /* ── 外壳让开：只要"背后有东西要看"（底图或大字），或视频放后面 ── */
      if (hasImage || hasBanner || !front) {
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

      /* ── 视频层 ── */
      if (front) {
        L.push('/* 开场视频：盖在聊天窗口最前面（第二幕）')
        L.push('   ⚠️ z-index 必须**比开机动画低一点点**：')
        L.push('      开机动画 #dsh-startup-root 是 2147483000，我用 2147482990。')
        L.push('      同级的话由 DOM 顺序决定谁在上 —— 我的层不透明，一旦压住开机动画，')
        L.push('      用户就会看到黑屏、点一下才露出开机动画（这个 bug 真踩到了）。')
        L.push('   ⚠️ pointer-events:none —— 绝不吞点击。')
        L.push('      之前加了"点击跳过"，结果全屏层把整个界面的点击都吃掉了。 */')
        L.push(R + ' {')
        L.push('  position: fixed; inset: 0; z-index: 2147482990;')
        L.push('  overflow: hidden; pointer-events: none;')
        L.push('  background: #000;')
        L.push('  opacity: ' + cfg.opacity + ';')
        L.push('}')
      } else {
        L.push('/* 常驻背景视频：最底层、不拦点击 */')
        L.push(R + ' {')
        L.push('  position: fixed; inset: 0; z-index: -1;')
        L.push('  pointer-events: none; overflow: hidden;')
        L.push('  opacity: ' + cfg.opacity + ';')
        L.push('}')
        L.push('html.dsh-cw-light ' + R + ' { background: ' + cfg.fallbackLight + '; }')
        L.push('html.dsh-cw-dark ' + R + ' { background: ' + cfg.fallbackDark + '; }')
        /* 放后面时才需要在视频上压纱（前面那层没有文字要读） */
        L.push(R + ' > ' + V + ' { position: absolute; inset: 0; }')
        L.push('html.dsh-cw-light ' + R + ' > ' + V + ' { background: linear-gradient(' + cfg.veilLightA + ', ' + cfg.veilLightB + '); }')
        L.push('html.dsh-cw-dark ' + R + ' > ' + V + ' { background: linear-gradient(' + cfg.veilDarkA + ', ' + cfg.veilDarkB + '); }')
      }
      L.push(R + ' > video {')
      L.push('  width: 100%; height: 100%; display: block;')
      L.push('  object-fit: ' + (front ? 'cover' : cfg.objectFit) + '; object-position: center;')
      L.push('}')
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

    function killVideo(root) {
      if (!root) return
      var v = root.querySelector('video')
      if (v) { try { v.pause(); v.removeAttribute('src'); v.load() } catch (e) {} }
    }

    /** 撤掉视频层（最前那层"第二幕"）。只暂停、**保留 src** —— 预加载的成果不能丢。 */
    function removeLayer() {
      var el = document.getElementById(ROOT_ID)
      if (el) {
        var v = el.querySelector('video')
        if (v) { try { v.pause() } catch (e) {} }
        el.remove()
      }
    }

    /** 撤掉聊天底图层（最底那层）*/
    function removeBg() {
      var el = document.getElementById(BG_ID)
      if (el) el.remove()
    }

    /* ── 大字横幅 ────────────────────────────────────────────────────────
       用户要的是"视频结束进聊天，一眼看到铺满窗口的大字"。
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

    /* ── 预加载 ──────────────────────────────────────────────────────────
       页面一加载就把视频元素建好并开始 load，**但不插进 DOM**。
       · 好处一：到点插进去时首帧已就绪 → 和开机动画接得上（不丝滑的问题解决）
       · 好处二：绝不在页面加载时就挂全屏层（那样会盖住开机动画期间的界面）
       · 关键：有了它，到点时元素已经 loadedmetadata，设 currentTime 才安全。 */
    var preloaded = null

    function preloadVideo(cfg) {
      if (preloaded) return preloaded
      var v = document.createElement('video')
      v.muted = true
      v.autoplay = false
      v.playsInline = true
      v.preload = 'auto'
      v.setAttribute('muted', '')
      v.setAttribute('playsinline', '')
      v.src = API + '/video?t=' + Date.now()
      if (cfg && cfg.playbackRate && cfg.playbackRate !== 1) {
        try { v.playbackRate = cfg.playbackRate } catch (e) {}
      }
      preloaded = v
      log('视频预加载已开始（元素建好了，但**还没插进 DOM**）')
      return v
    }

    /**
     * 聊天底图层：用户自己定的那张图 + 纱。**在最底下。**
     *
     * 和视频**完全独立** —— 这是这次改版的核心：
     *   · 只配图不配视频 → 一张静态聊天背景
     *   · 只配视频不配图 → 开场演完淡出，回到 DSH 默认底色
     *   · 两个都配     → 视频在前面演，演完淡出，露出"聊天 + 底图"
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

    /** 挂载计数：控制台里能直接看出"到底挂了几次" —— 闪一下 + 重播的元凶就是重复挂载 */
    var mountCount = 0

    /**
     * 挂载视频层。
     *
     * placement="front"（默认）：z-index 2147483000，**盖在聊天窗口最前面**，
     *   开机动画收场后的"第二幕"，播完淡出就进聊天。
     * placement="behind"：z-index:-1，当常驻背景（配合 mode=loop）。
     *
     * ⚠️ **幂等：已经挂好就绝不再建。**
     * 原先的写法是先 removeLayer() 再建新的 —— 那会让视频黑一下、从 0 重新播，
     * 表现就是"鼠标点一下窗口，背景闪一下然后重新开始"。
     */
    function mountLayer(cfg) {
      var existing = document.getElementById(ROOT_ID)
      if (existing && existing.querySelector('video')) {
        log('视频层已在位（累计挂载 ' + mountCount + ' 次）→ 跳过重建，避免闪烁与重播')
        return existing
      }
      if (existing) existing.remove()
      mountCount++
      log('挂载视频层 #' + mountCount + '（' + (cfg.placement === 'front' ? '最前 · 第二幕' : '最底 · 常驻背景') + '）')

      var root = document.createElement('div')
      root.id = ROOT_ID
      root.setAttribute('aria-hidden', 'true')

      /* 全屏开场必然是"播一次"：让它循环等于永久盖住界面，没有任何意义。
         所以 front 模式强制走 once 逻辑（并且点击可跳过）。*/
      var isFront = cfg.placement === 'front'
      var once = (cfg.mode !== 'loop') || isFront

      /* 用**预加载好的**那个元素（页面加载时就开始 load 了）——
         这样到点插进 DOM 时首帧已就绪，接得上、不丝滑的问题也一起解决。 */
      var video = preloaded || document.createElement('video')
      preloaded = video
      video.muted = true
      video.autoplay = false
      video.loop = !once
      video.playsInline = true
      video.setAttribute('muted', '')
      video.setAttribute('playsinline', '')
      video.preload = 'auto'
      if (!video.src) video.src = API + '/video?t=' + Date.now()
      if (cfg.playbackRate && cfg.playbackRate !== 1) {
        try { video.playbackRate = cfg.playbackRate } catch (e) {}
      }

      /* ── 循环区间（只在 mode='loop' 时）────────────────────────────────────
         语义：**第一次从头播完，之后只在 [loopStart, loopEnd] 里循环**。
         （剪辑软件里把片尾做成可循环段就是干这个用的。）

         为什么不用 <video loop>：那个只会回到 0，把片头再放一遍。
         为什么要 rAF：timeupdate 只有 ~4Hz，最坏情况会多播 250ms 的冗余尾巴；
         rAF 每个显示帧查一次（~16ms ≈ 半帧），够精确。

         后台标签页 rAF 会暂停 → 视频会播过头 → 由 ended / timeupdate 兜底拉回来。 */
      if (!once && typeof cfg.loopStartSec === 'number' && cfg.loopStartSec > 0) {
        video.loop = false
        var loopFrom = cfg.loopStartSec
        var loopTo = (typeof cfg.loopEndSec === 'number' && cfg.loopEndSec > loopFrom) ? cfg.loopEndSec : null
        var seeking = false
        var atLoopPoint = function () {
          var end = loopTo !== null ? loopTo : video.duration
          return end > 0 && video.currentTime >= end - 0.005
        }
        var backToLoop = function () {
          if (seeking) return
          seeking = true
          /* 这条日志是决定性的：有它 = 回跳真的发生了；没有 = 循环区间根本没触发。
             （之前"loop 到底有没有生效"只能靠肉眼猜，加这一行就不用猜了。） */
          log('循环回跳', { from: +video.currentTime.toFixed(3), to: +loopFrom.toFixed(3) })
          try { video.currentTime = loopFrom } catch (e) {}
          setTimeout(function () { seeking = false }, 150)
        }
        var rafId = null
        var tick = function () {
          rafId = null
          if (video.paused || video.ended) return
          if (atLoopPoint()) backToLoop()
          rafId = requestAnimationFrame(tick)
        }
        var startTick = function () { if (rafId === null) rafId = requestAnimationFrame(tick) }
        var stopTick = function () { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null } }

        video.addEventListener('timeupdate', function () { if (atLoopPoint()) backToLoop() })
        video.addEventListener('play', startTick)
        video.addEventListener('pause', stopTick)
        video.addEventListener('ended', function () { backToLoop(); video.play().catch(function () {}) })
        log('循环区间已启用', { from: loopFrom, to: loopTo === null ? '(视频结尾)' : loopTo })
      }

      video.addEventListener('error', function () {
        log('视频加载失败，撤回壁纸 —— code', video.error && video.error.code,
            (video.error && video.error.message) || '')
        teardown()
      })
      video.addEventListener('playing', function () {
        log('开始播放', { duration: video.duration, w: video.videoWidth, h: video.videoHeight })
      })

      /* ── 播一次 → 淡出 → 进聊天 ──────────────────────────────────────────
         placement='front' 时这就是"第二幕"：开机动画收场 → 这个全屏视频接上 →
         播完淡出 → 露出聊天窗口（底图是你自己在面板里定的那张）。
         placement='behind' + mode='once' 时是"露一次就走"的背景视频。

         ⚠️ 注意：**绝不再用 `img` 这个变量**了 —— 底图现在住在另一个层（#dsh-cw-bg），
         视频层里没有 img。淡出只淡视频，底图（若有）原样留着。 */
      if (once) {
        var finished = false
        var watchdog = null
        var finishOnce = function (why) {
          if (finished) return
          finished = true
          if (watchdog) clearTimeout(watchdog)
          var ms = Number(cfg.fadeOutMs) > 0 ? Number(cfg.fadeOutMs) : 1200
          log('播放结束（' + why + '）→ 淡出 ' + ms + 'ms',
              cfg.__imageOk ? '进聊天（底图留着）' : '进聊天（回到 DSH 默认底色）')

          var rootEl = document.getElementById(ROOT_ID)
          if (rootEl) {
            rootEl.style.transition = 'opacity ' + ms + 'ms linear'
            rootEl.style.opacity = '0'
          }
          setTimeout(function () {
            removeLayer()
            /* 没有底图 → 连"外壳让开"那套 CSS 一起撤掉，彻底回到 DSH 原样。
               有底图 → 保留 CSS，聊天就落在底图上。 */
            if (!cfg.__imageOk) teardown()
          }, ms + 80)
        }
        video.addEventListener('ended', function () { finishOnce('ended') })
        /* 兜底一：ended 偶尔不触发（被 seek 过、或浏览器脾气）→ 到点自己收 */
        video.addEventListener('timeupdate', function () {
          if (video.duration > 0 && video.currentTime >= video.duration - 0.08) finishOnce('到达结尾')
        })
        /* 兜底二（看门狗）：万一视频卡住永远不 ended，全屏层会永久盖住界面 ——
           这是最坏的情况，所以必须有一个"无论如何都会收"的定时器。 */
        watchdog = setTimeout(function () {
          finishOnce('看门狗兜底（视频没正常结束）')
        }, ((video.duration > 0 ? video.duration : 12) + 5) * 1000)

        /* ⚠️ 这里**故意什么都不做**：
           既没有"点击跳过"，也没有"第一次手势补 play"。
           两个都加过，两个都出事了 ——
             · click→跳过：全屏层把整个界面的点击全吞了
             · pointerdown→补 play：**点一下就开播**，用户根本没法操作
           全屏开场就是要"老老实实自动播、自动收"，宁可不能点，
           也绝不能把用户的点击当成开关。收不了场由看门狗兜底。 */
      }

      root.appendChild(video)
      if (!isFront) {
        /* 只有"放后面"时才在视频上压纱 —— 全屏那层没有文字要读，压纱反而糊 */
        var veil = document.createElement('div')
        veil.className = 'dsh-cw-veil'
        root.appendChild(veil)
      }
      document.body.insertBefore(root, document.body.firstChild)

      /* ⚠️ 挂载时**不播**，而且这一步只由 beginIntro() 调用 ——
         绝不在页面加载时就挂全屏层（那样会在开机动画结束前盖住整个界面）。
         返回 video 给调用方去 play。 */
      return video
    }

    /**
     * 到点了：把（预加载好的）视频层插进 DOM → 摆好不透明度 → 开播。
     *
     * ★ 交叉叠化（cross-dissolve）★
     * dsh-startup-screen 收场时是给根元素加 `.dsu-gone`，然后自己
     * **opacity 1 → 0，620ms**（splash.css:111）。加 class 的那一刻淡出刚开始。
     *
     * 所以只要我在那一刻**已经完全不透明地待在他下面**（我的 z-index 是 2147482990，
     * 比他 2147483000 低 10），他的淡出就自动变成叠化 —— 中间不会露出聊天窗口。
     *
     * ⚠️ 反过来，如果我也跟着淡入（曾经是 260ms），头 260ms 两层都不够实，
     * 中间那一小段就会透出聊天界面 —— 用户看到的"闪一下"就是这个。
     * 前人叠化，后人就别再叠了。
     *
     * 两条硬规则（都是踩坑换来的）：
     *   1. **只在 loadedmetadata 之后才设 currentTime** ——
     *      对还没加载好的元素设 currentTime 会让它卡在 seek 状态、`play()` 永不生效
     *      （"全屏停在第 0 帧盖住界面、只能靠看门狗收"那个 bug）。
     *   2. **2 秒内没播起来就立刻撤层** —— 全屏层绝不能停在那盖住界面。
     */
    function beginIntro(cfg, why, sawOverlay) {
      if (document.getElementById(ROOT_ID)) return       // 已经在了（幂等）
      var video = mountLayer(cfg)
      if (!video) return
      /* readyState 写进日志：>=2 表示首帧已解码，叠化时露出的是真画面而不是黑底 */
      log('开始播（' + why + '）· readyState=' + video.readyState)

      var target = String(cfg.opacity == null ? 1 : cfg.opacity)
      var root = document.getElementById(ROOT_ID)
      if (root) {
        if (sawOverlay) {
          /* 交叉叠化：直接满不透明 —— 让开机动画的 620ms 淡出把我叠出来 */
          root.style.transition = 'none'
          root.style.opacity = target
          log('交叉叠化：我直接满不透明待在下面，等它的 620ms 淡出把我叠出来')
        } else {
          /* 没有开机动画（宽限/超时那条路）→ 没人替我淡，自己来一个短淡入 */
          root.style.transition = 'opacity 300ms linear'
          root.style.opacity = '0'
          requestAnimationFrame(function () { root.style.opacity = target })
        }
      }

      if (video.readyState >= 1) {
        try { video.currentTime = 0 } catch (e) {}
      } else {
        log('元数据还没就绪（readyState=' + video.readyState + '）→ 不设 currentTime，直接 play')
      }
      var p = video.play()
      if (p && typeof p.catch === 'function') {
        p.catch(function (e) { log('play() 被拒（autoplay 策略？）', String(e && e.name)) })
      }
      markIntroShown()   /* 记下"这轮会话放过了"→ 之后刷新/热重载都不再重播 */

      /* 硬保证：2 秒还没播起来就撤层（绝不把界面盖住）*/
      setTimeout(function () {
        if (!document.getElementById(ROOT_ID)) return
        if (video.paused) {
          log('⚠️ 2 秒内没能开始播放 → 撤掉全屏层，宁可没有开场也不盖住界面')
          removeLayer()
          if (!cfg.__imageOk) teardown()
        }
      }, 2000)
    }

    /* ── 等开机动画收场再开始播 ──────────────────────────────────────────
       为什么需要：页面一加载就播的话，开机动画（十几秒，而且要用户点几下）
       盖在上面的那段时间视频已经把片头放完了 —— 用户进到界面看到的直接是循环段，
       那 6 秒片头等于白做。

       顺带的好处：开机动画期间不播视频 = 不占解码器。

       注意：这两个配置项**客户端自己兜底**（不要求宿主提供）。 */

    /**
     * 开机浮层**开始收场**的信号 class。
     *
     * ★ 关键：是 `dsu-handoff`，不是 `dsu-gone` ★
     *   dsh-startup-screen 的收尾分两步（splash.js:1392-1397 / 1400-1425）：
     *     · `dsu-handoff` → 根元素**开始**淡出，整整 780ms（splash.css:791，opacity:0）
     *     · 780ms 之后才是 `dsu-gone` → 再淡出 620ms（那时其实早就透明了）
     *
     * 只盯 `dsu-gone` 会**晚 780ms** —— 那 780ms 里开机动画一路在变透明、
     * 已经在把聊天窗口透出来了，用户看到的就是"闪一下"。
     * 要叠化，必须在它**刚开始**淡的时候就已经满不透明地待在它下面。
     *
     * 换别的开机动画插件时，用 `bootLeaveClasses` 覆盖这里。
     */
    var DEFAULT_LEAVE_CLASSES = ['dsu-handoff', 'dsu-gone']

    /**
     * 开机浮层**还在挡着**吗？
     *
     * ⚠️ 只用 **class** 判定，不看几何尺寸。
     * 第一版加了"零尺寸也算已收场"的几何判断 —— 结果踩坑：
     * 开机层刚插进 DOM 的那一刻往往就是零尺寸/隐藏的，被误判成"收场了"，
     * 于是页面一加载就开播，等用户走完开机动画视频早跑完了。
     */
    function bootOverlayPresent(sels, leaveClasses) {
      if (!sels || !sels.length) return false
      var leave = (leaveClasses && leaveClasses.length) ? leaveClasses : DEFAULT_LEAVE_CLASSES
      for (var i = 0; i < sels.length; i++) {
        var el = null
        try { el = document.querySelector(sels[i]) } catch (e) { continue }
        if (!el) continue
        if (el.classList) {
          var leaving = false
          for (var k = 0; k < leave.length; k++) {
            if (el.classList.contains(leave[k])) { leaving = true; break }
          }
          if (leaving) continue        // 它已在收场路上 → 该我上场了
        }
        return true
      }
      return false
    }

    var POLL_MS = 50           // 50ms 一次：开机动画一收场就尽可能快接上（不加长过渡的空档）
    var GRACE_MS = 3000        // 一直没见到开机层 → 先播，别干等
    var GIVE_UP_MS = 180000    // 3 分钟后停止轮询

    /* ── 一轮会话只放一次开场 ────────────────────────────────────────────
       为什么要这个：
         1. **和开机动画保持一致** —— dsh-startup-screen 自己就是这么做的
            （它的 splash.js 里写 sessionStorage['dsh-startup-screen:shown'] = '1'）。
         2. 更直接的原因：开发本插件时发现**保存 client.js 会触发插件热重载
            = 一次页面刷新**，于是那段时间开场视频被反复重播，
            用户看到的就是"视频疯狂自己跳"。有了这个标记，热重载/刷新都不再重播。
       想再看一次 → 面板的「🔁 重播开场」（它会显式清掉这个标记）。

       注意：只对"全屏开场"（front + once）生效；`placement="behind"` 的
       常驻背景**每次刷新都应该重新出现**，那是背景不是开场。 */
    var SEEN_KEY = 'dsh-chat-wallpaper:intro-shown'

    function introAlreadyShown() {
      try { return window.sessionStorage.getItem(SEEN_KEY) === '1' } catch (e) { return false }
    }
    function markIntroShown() {
      try { window.sessionStorage.setItem(SEEN_KEY, '1') } catch (e) { /* 隐私模式不可写，忽略 */ }
    }
    function clearIntroShown() {
      try { window.sessionStorage.removeItem(SEEN_KEY) } catch (e) { /* 忽略 */ }
    }

    /**
     * 决定何时开始播：等开机浮层收场，**然后才把视频层挂上去并开播**。
     *
     * 三个状态：
     *   waiting  还没见到开机层 —— 过了 GRACE_MS 就先播（万一本机没装开机动画）
     *   covering 开机层在 —— 什么都不做（**层都还没挂**，所以绝不挡界面）
     *   playing  已经开播
     *
     * 关键点：开机层**任何时候**出现都要接住，不只是启动那一下。
     */
    function startWhenFree(cfg) {
      var wantWait = cfg.waitForBoot === undefined ? true : !!cfg.waitForBoot
      var sels = cfg.bootOverlaySelectors || ['#dsh-startup-root']

      var ticks = 0
      var phase = 'waiting'
      var sawOverlay = false     // 见过开机层吗 —— 决定要不要自己淡入（见 beginIntro 的交叉叠化）
      var go = function (why) {
        if (phase === 'playing') return
        phase = 'playing'
        /* 一轮会话只放一次（只对"全屏开场"，且 cfg.oncePerSession !== false）*/
        var isIntro = (cfg.placement === 'front' && cfg.mode !== 'loop')
        var oncePerSession = cfg.oncePerSession === undefined ? true : !!cfg.oncePerSession
        if (isIntro && oncePerSession && !cfg.__forceReplay && introAlreadyShown()) {
          log('本轮会话已经放过开场了 → 跳过（想再看：面板的「🔁 重播开场」）')
          return
        }
        beginIntro(cfg, why, sawOverlay)
      }

      if (!wantWait) { go('waitForBoot=false'); return }
      /* 显式给了空选择器 = "没有浮层要等"。
         （注意 [] 是 truthy，不能用 `cfg.x || 默认值` 兜底，必须显式判长度。） */
      if (sels.length === 0) { go('bootOverlaySelectors 为空'); return }

      var iv = setInterval(function () {
        ticks++
        var present = bootOverlayPresent(sels, cfg.bootLeaveClasses)
        if (present) sawOverlay = true
        /* 用**滴答数**算时间，不用 Date.now()：轮询间隔固定，两者等价；
           但滴答数让这段逻辑可以用假定时器测试（用墙钟的话测试里时间不流逝，
           宽限期永远到不了）。 */
        var waited = (ticks * POLL_MS / 1000).toFixed(1)

        if (ticks * POLL_MS >= GIVE_UP_MS) {           // 轮询不该跑一辈子
          clearInterval(iv)
          log('轮询超时 ' + (GIVE_UP_MS / 1000) + 's，开机层一直没收场 → 不再等')
          go('轮询超时')
          return
        }
        if (phase === 'playing') {
          if (present) {                       // 开机层后来又出现了（比如刷新后重启了序列）
            /* ⚠️ 这里**不能** clearInterval —— 清了就再也不会轮询，
               开机层收场后视频永远不播（测试抓到过这个 bug）。 */
            log('开机动画又出现了 → 撤回视频层，等它收场再挂')
            removeLayer()
            phase = 'covering'
          }
          return
        }
        if (phase === 'covering') {
          if (!present) go('开机动画已收场，等了 ' + waited + 's')
          return
        }
        /* phase === 'waiting' */
        if (present) { phase = 'covering'; log('开机动画在跑 → 视频先不播（层都还没挂，界面不受影响）'); return }
        if (ticks * POLL_MS >= GRACE_MS) go('宽限 ' + (GRACE_MS / 1000) + 's 内没检测到开机动画')
      }, POLL_MS)
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
      panelCfg = cfg          /* 面板与「重播开场」都要留着它（收场后 current 会被清）*/
      var dark = looksDark()
      setThemeClass(dark)
      log('套用壁纸', { source: cfg.__source, file: cfg.__file, theme: dark ? 'dark' : 'light' })
      injectCss(cfg)
      mountBg(cfg)            /* 最底：聊天底图（用户自己定的那张，可选）*/
      mountBanner(cfg)        /* 其上：铺满窗口的大字（可选）*/
      preloadVideo(cfg)       /* 先把视频加载起来（**不插进 DOM**，所以不挡界面）*/
      /* ⚠️ 这里**不挂视频层** —— 只装"到点就挂并播"的闸门。
         页面加载时就挂全屏层的话，它会盖住开机动画结束前的整个界面。 */
      startWhenFree(cfg)
    }

    /**
     * 撤场：把 CSS 和视频层全部收回，页面回到原样。
     *
     * ★★ 必须同时清掉 `current` 并断开主题观察者 ★★
     * 否则会"复活"：撤场后 current 还留着 → 下一次 html/body 属性变化把观察者叫醒
     * → 它发现"没挂载" → applyNow(current) → **把壁纸重新挂起来** → 视频从 0 重播
     * → 播完又淡出 → 又被复活 …… 无限循环。
     *
     * 实际表现就是用户报的：「淡出我看到了，但动画还在后面一直 loop」，
     * 而且因为每次复活都是"宽限 3 秒后随机开播"，时序全乱、不再跟在开机动画后面。
     */
    function teardown() {
      current = null
      if (observer) {
        try { observer.disconnect() } catch (e) { /* 忽略 */ }
        observer = null
      }
      removeCss()
      removeLayer()
      removeBg()
      removeBanner()
      /* 彻底收场：连预加载的元素一起清掉，别留个解码器在后台 */
      if (preloaded) {
        try { preloaded.pause(); preloaded.removeAttribute('src'); preloaded.load() } catch (e) {}
        preloaded = null
      }
      try {
        document.documentElement.classList.remove('dsh-cw-dark', 'dsh-cw-light')
        themeClass = null
      } catch (e) { /* 忽略 */ }
    }

    /**
     * 手动重播开场（设置面板的「🔁 重播开场」按钮）。
     *
     * 为什么需要：开场视频每次开机只播一次。**想录屏/截图的人没法一条条重拍** ——
     * 每次都要重启 DSH，成本高到不可用。有了它，想拍几条拍几条。
     *
     * 不传 sawOverlay：这是"凭空重播"，没有别人替我淡出，所以自己来一个短淡入。
     */
    function replayIntro() {
      var cfg = current || panelCfg
      if (!cfg) { log('还没有配置，无法重播'); return }
      log('手动重播开场')
      clearIntroShown()   /* ★ 手动重播 = 明确要看，把"这轮放过了"的标记清掉 */
      removeLayer()
      injectCss(cfg)     /* 上一轮收场时 CSS 可能已被撤掉，补回来 */
      mountBg(cfg)       /* 底图同理 */
      mountBanner(cfg)   /* 大字也是 */
      if (!preloaded) preloadVideo(cfg)
      beginIntro(cfg, '面板按钮：手动重播', false)
    }

    /**
     * 主题变化时**只换主题 class**（换纱换色）。
     *
     * ⚠️⚠️ **绝不允许在这里挂载任何东西。**
     * 之前这里有一行 `if (!mounted) applyNow(current)` —— 它造成过两次事故：
     *   1. 视频演完、层被移除后，它把视频**复活** → 播完又淡出又复活 → 无限循环
     *      （"动画还在一直继续"）
     *   2. 视频**还没到点挂载**时（开机动画期间层不存在），每次 html/body 属性变化
     *      都 applyNow → `套用壁纸` 日志刷屏，还泄漏一堆轮询定时器
     *
     * **挂载时机只由 startWhenFree 那道闸门决定，观察者不许插手。**
     */
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

    /* ── 设置面板 ────────────────────────────────────────────────────────
       用户要"一个清晰的观察点"：所以做成右下角常驻小圆钮，点开是设置面板。

       ⚠️ 面板**独立于壁纸层**：
         · 自己的根元素 (#dsh-cw-panel) + 自己的 style 标签，teardown() 不碰它们
           —— 否则 once 模式播完收场后，设置入口会跟着壁纸一起消失
         · 自己的主题 class（写在面板根元素上），不依赖 <html> 上的 dsh-cw-*
           —— 那个会被 teardown() 清掉
    */

    var PANEL_ID = 'dsh-cw-panel'
    var PANEL_TAG_ID = 'dsh-chat-wallpaper/panel.css'
    var panelEl = null
    var panelCfg = null

    function panelStyleTag() {
      return document.querySelector('style[data-plugin-css="' + PANEL_TAG_ID + '"]')
    }

    function panelCss() {
      var P = '#' + PANEL_ID
      return [
        P + ', ' + P + ' * { box-sizing: border-box; }',
        /* 放左下角：右下角是发送钮和状态栏，别去挤它们 */
        /* z-index 的分寸：只压过聊天内容，不能压过宿主自己的浮层。
           DSH 实测层级 —— 内容 ≤20；下拉菜单 100 / 1100；设置与通知弹层 1000 / 1100。
           原来写 2147482000（21 亿），结果「🖼 背景」压在「模型已更新」这类通知上面。
           取 50：高于内容（≤20），低于所有宿主浮层（≥100）。 */
        P + ' { position: fixed; left: 20px; bottom: 52px; z-index: 50;',
        '  font: 13px/1.5 system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; }',
        P + ' .cw-fab { height: 34px; padding: 0 13px; border-radius: 999px; cursor: pointer;',
        '  border: 1px solid var(--cw-line); background: var(--cw-bg); color: var(--cw-fg);',
        '  font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.30); }',
        P + ' .cw-fab:hover { border-color: var(--cw-accent); }',
        P + ' .cw-panel { position: absolute; left: 0; bottom: 46px; width: 328px;',
        '  background: var(--cw-bg); color: var(--cw-fg); border: 1px solid var(--cw-line);',
        '  border-radius: 12px; box-shadow: 0 14px 44px rgba(0,0,0,.42); padding: 14px;',
        '  display: none; max-height: 76vh; overflow: auto; }',
        P + '.cw-open .cw-panel { display: block; }',
        P + ' .cw-head { display: flex; align-items: center; justify-content: space-between;',
        '  font-weight: 600; font-size: 14px; margin-bottom: 10px; }',
        P + ' .cw-x { border: 0; background: transparent; color: var(--cw-dim); cursor: pointer; font-size: 15px; }',
        P + ' .cw-sec { margin: 12px 0; }',
        P + ' .cw-label { color: var(--cw-dim); font-size: 12px; margin-bottom: 6px; }',
        P + ' .cw-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }',
        P + ' .cw-thumb { position: relative; aspect-ratio: 16/10; border-radius: 8px; cursor: pointer;',
        '  overflow: hidden; border: 2px solid transparent; background: var(--cw-line); }',
        P + ' .cw-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }',
        P + ' .cw-thumb.cw-sel { border-color: var(--cw-accent); }',
        P + ' .cw-thumb span { position: absolute; left: 0; right: 0; bottom: 0; font-size: 10px;',
        '  padding: 2px 4px; background: rgba(0,0,0,.55); color: #fff; overflow: hidden;',
        '  text-overflow: ellipsis; white-space: nowrap; }',
        P + ' .cw-empty { color: var(--cw-dim); font-size: 12px; padding: 10px 0; line-height: 1.7; }',
        P + ' .cw-row { display: flex; gap: 8px; margin-top: 8px; }',
        P + ' .cw-act { flex: 1; padding: 7px 8px; border-radius: 8px; cursor: pointer; font-size: 12px;',
        '  border: 1px solid var(--cw-line); background: transparent; color: var(--cw-fg); }',
        P + ' .cw-act:hover { border-color: var(--cw-accent); }',
        P + ' .cw-veil { width: 100%; accent-color: var(--cw-accent); }',
        P + ' .cw-text { width: 100%; padding: 7px 9px; border-radius: 8px; font-size: 13px;',
        '  border: 1px solid var(--cw-line); background: transparent; color: var(--cw-fg);',
        '  font-family: inherit; }',
        P + ' .cw-text:focus { outline: none; border-color: var(--cw-accent); }',
        P + ' .cw-radios { display: flex; gap: 14px; font-size: 12px; }',
        P + ' .cw-radios label { display: flex; align-items: center; gap: 5px; cursor: pointer; }',
        P + ' .cw-note { font-size: 11px; color: var(--cw-dim); margin-top: 6px; word-break: break-all; }',
      ].join('\n')
    }

    function injectPanelCss() {
      var existing = panelStyleTag()
      if (existing) existing.remove()
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-chat-wallpaper'
      tag.dataset.pluginCss = PANEL_TAG_ID
      tag.textContent = panelCss()
      document.head.appendChild(tag)
    }

    function paintPanelTheme(dark) {
      if (!panelEl) return
      var c = dark
        ? { bg: 'rgba(26,28,36,.97)', fg: '#e9ecf3', dim: '#98a2b3', line: 'rgba(255,255,255,.15)', accent: '#5aa9ff' }
        : { bg: 'rgba(255,255,255,.98)', fg: '#1b1e25', dim: '#6b7280', line: 'rgba(0,0,0,.13)', accent: '#2b7fff' }
      panelEl.style.setProperty('--cw-bg', c.bg)
      panelEl.style.setProperty('--cw-fg', c.fg)
      panelEl.style.setProperty('--cw-dim', c.dim)
      panelEl.style.setProperty('--cw-line', c.line)
      panelEl.style.setProperty('--cw-accent', c.accent)
    }

    function cwEl(tag, cls, text) {
      var e = document.createElement(tag)
      if (cls) e.className = cls
      if (text !== undefined) e.textContent = text
      return e
    }

    /** 调宿主接口，拿 JSON（失败一律返回 null，绝不抛） */
    function api(path, opts) {
      return fetch(API + path, opts)
        .then(function (r) { return r.json() })
        .catch(function (e) { log('设置面板请求失败', path, String(e && e.message)); return null })
    }

    /** 改配置 → 立刻预览。full=true 需要重挂（换图 / 换模式），false 只重注 CSS（改纱） */
    function panelApply(patch, full) {
      api('/set', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(function (r) {
        if (!r || !r.ok) { log('设置没写进去', r && r.error); return }
        log('设置已更新', r.applied)
        return api('/config', { cache: 'no-store' })
      }).then(function (data) {
        if (!data || !data.config) return
        var cfg = data.config
        cfg.__source = data.source
        cfg.__file = data.file
        cfg.loopStartSec = data.loopStartSec
        cfg.loopEndSec = data.loopEndSec
        cfg.__imageOk = !!data.imageOk
        cfg.__image = data.image
        panelCfg = cfg
        if (full) {
          removeLayer()
          removeBg()
          removeCss()
          applyNow(cfg)          // 重新挂载 → 新图/新模式立刻能看到
        } else {
          current = cfg
          injectCss(cfg)         // 只改纱：不重挂，视频不重播
        }
        refreshPanel()
      })
    }

    function refreshPanel() {
      if (!panelEl) return
      api('/images').then(function (d) {
        if (!d || !d.ok) return
        paintPanelTheme(looksDark())
        panelEl.querySelector('.cw-cur').textContent = d.current
          ? d.current.split(/[\\/]/).pop()
          : '（没有背景图 —— 视频淡出后回到 DSH 默认底色）'
        panelEl.querySelector('.cw-dir').textContent = '丢图目录：' + d.dropDir

        var grid = panelEl.querySelector('.cw-grid')
        grid.textContent = ''
        if (!d.images.length) {
          grid.appendChild(cwEl('div', 'cw-empty',
            '这里还没有图。点下面「打开图片文件夹」，把 jpg / png / webp 丢进去，\n再点一次这个面板就会出现在这里。'))
        }
        d.images.forEach(function (im) {
          var t = cwEl('div', 'cw-thumb' + (d.current && d.current.endsWith(im.name) ? ' cw-sel' : ''))
          var i = document.createElement('img')
          i.src = im.url
          i.alt = ''
          t.appendChild(i)
          t.appendChild(cwEl('span', '', im.name))
          t.title = im.name + ' · ' + im.sizeKB + ' KB · ' + im.mtime
          t.addEventListener('click', function () { panelApply({ image: im.name }, true) })
          grid.appendChild(t)
        })

        var dark = looksDark()
        panelEl.querySelector('.cw-veil-label').textContent =
          '纱的浓度（' + (dark ? '深色' : '浅色') + '主题）'
        panelEl.querySelector('.cw-veil-val').textContent = Math.round((dark ? d.veil.dark : d.veil.light) * 100) + '%'
        var slider = panelEl.querySelector('.cw-veil')
        slider.value = String(Math.round((dark ? d.veil.dark : d.veil.light) * 100))
        panelEl.querySelectorAll('input[name="cw-mode"]').forEach(function (r) {
          r.checked = (r.value === d.mode + '/' + (d.placement || 'front'))
        })

        /* 横幅：文字框 + 浓度滑块（正在打字时不去覆盖用户输入）*/
        var bi = panelEl.querySelector('.cw-text')
        if (bi && document.activeElement !== bi) bi.value = d.banner || ''
        var ba = Math.round((d.bannerOpacity == null ? 0.12 : d.bannerOpacity) * 100)
        var bSliderEl = panelEl.querySelector('.cw-banner-a')
        if (bSliderEl) bSliderEl.value = String(ba)
        var bValEl = panelEl.querySelector('.cw-banner-val')
        if (bValEl) bValEl.textContent = ba + '%'
      })
    }

    function mountPanel() {
      if (panelEl || typeof document === 'undefined' || !document.body) return
      injectPanelCss()
      panelEl = document.createElement('div')
      panelEl.id = PANEL_ID

      var fab = cwEl('button', 'cw-fab', '🖼 背景')
      fab.title = '聊天背景设置'
      fab.addEventListener('click', function () {
        panelEl.classList.toggle('cw-open')
        if (panelEl.classList.contains('cw-open')) refreshPanel()
      })
      panelEl.appendChild(fab)

      var panel = cwEl('div', 'cw-panel')
      var head = cwEl('div', 'cw-head')
      head.appendChild(cwEl('span', '', '聊天背景'))
      var x = cwEl('button', 'cw-x', '✕')
      x.addEventListener('click', function () { panelEl.classList.remove('cw-open') })
      head.appendChild(x)
      panel.appendChild(head)

      var sec1 = cwEl('div', 'cw-sec')
      sec1.appendChild(cwEl('div', 'cw-label', '当前'))
      sec1.appendChild(cwEl('div', 'cw-cur', '…'))
      sec1.appendChild(cwEl('div', 'cw-note cw-dir', ''))
      panel.appendChild(sec1)

      var sec2 = cwEl('div', 'cw-sec')
      sec2.appendChild(cwEl('div', 'cw-label', '选一张（丢进目录的图会自动出现在这里）'))
      sec2.appendChild(cwEl('div', 'cw-grid'))
      panel.appendChild(sec2)

      var row = cwEl('div', 'cw-row')
      var none = cwEl('button', 'cw-act', '不用图片')
      none.addEventListener('click', function () { panelApply({ image: '' }, true) })
      var open = cwEl('button', 'cw-act', '打开图片文件夹')
      open.addEventListener('click', function () { api('/open-dir', { method: 'POST' }) })
      row.appendChild(none)
      row.appendChild(open)
      panel.appendChild(row)

      var sec3 = cwEl('div', 'cw-sec')
      var vl = cwEl('div', 'cw-label')
      vl.appendChild(cwEl('span', 'cw-veil-label', '纱的浓度'))
      vl.appendChild(cwEl('span', 'cw-veil-val', ''))
      sec3.appendChild(vl)
      var slider = document.createElement('input')
      slider.type = 'range'
      slider.className = 'cw-veil'
      slider.min = '0'
      slider.max = '80'
      slider.step = '1'
      slider.addEventListener('input', function () {
        var a = Number(slider.value) / 100
        panelEl.querySelector('.cw-veil-val').textContent = Math.round(a * 100) + '%'
      })
      slider.addEventListener('change', function () {
        var a = Number(slider.value) / 100
        /* 只改第一个渐变停靠点的 alpha，第二个按原比例跟着走（保持渐变的味道） */
        var b = Math.round(a * 76) / 100
        var patch = looksDark()
          ? { veilDarkA: 'rgba(8,10,16,' + a + ')', veilDarkB: 'rgba(6,8,14,' + b + ')' }
          : { veilLightA: 'rgba(253,250,254,' + a + ')', veilLightB: 'rgba(250,247,253,' + b + ')' }
        panelApply(patch, false)
      })
      sec3.appendChild(slider)
      panel.appendChild(sec3)

      /* ── 大字横幅：铺满窗口的那行字，直接在面板里打字改 ── */
      var sec3b = cwEl('div', 'cw-sec')
      sec3b.appendChild(cwEl('div', 'cw-label', '大字横幅（铺满窗口的一行字）'))
      var bInput = document.createElement('input')
      bInput.type = 'text'
      bInput.className = 'cw-text'
      bInput.placeholder = '例如：人类与AI的日常'
      bInput.addEventListener('change', function () { panelApply({ banner: bInput.value }, true) })
      sec3b.appendChild(bInput)
      var bLab = cwEl('div', 'cw-label')
      bLab.appendChild(cwEl('span', '', '横幅浓度 '))
      bLab.appendChild(cwEl('span', 'cw-banner-val', ''))
      sec3b.appendChild(bLab)
      var bSlider = document.createElement('input')
      bSlider.type = 'range'
      bSlider.className = 'cw-banner-a'
      bSlider.min = '2'
      bSlider.max = '40'
      bSlider.step = '1'
      bSlider.addEventListener('input', function () {
        panelEl.querySelector('.cw-banner-val').textContent = bSlider.value + '%'
      })
      bSlider.addEventListener('change', function () {
        panelApply({ bannerOpacity: Number(bSlider.value) / 100 }, true)
      })
      sec3b.appendChild(bSlider)
      panel.appendChild(sec3b)

      var sec4 = cwEl('div', 'cw-sec')
      sec4.appendChild(cwEl('div', 'cw-label', '开场视频'))
      var radios = cwEl('div', 'cw-radios')
      /* 两个选项 = 两种**完整设计**，所以一次同时设定 mode + placement，
         免得用户拼出"全屏 + 循环"这种把界面永久盖住的无意义组合。 */
      ;[
        ['once', 'front', '全屏开场：播一次 → 淡出 → 进聊天'],
        ['loop', 'behind', '常驻背景：在聊天窗口后面一直循环'],
      ].forEach(function (pair) {
        var lab = cwEl('label')
        var r = document.createElement('input')
        r.type = 'radio'
        r.name = 'cw-mode'
        r.value = pair[0] + '/' + pair[1]
        r.addEventListener('change', function () {
          if (r.checked) panelApply({ mode: pair[0], placement: pair[1] }, true)
        })
        lab.appendChild(r)
        lab.appendChild(cwEl('span', '', pair[2]))
        radios.appendChild(lab)
      })
      sec4.appendChild(radios)
      panel.appendChild(sec4)

      /* 录屏/截图友好：开场每次开机只播一次，这个按钮让你想重播就重播。
         点完自动收起面板，免得挡住镜头。 */
      var sec5 = cwEl('div', 'cw-sec')
      var replay = cwEl('button', 'cw-act', '🔁 重播开场')
      replay.title = '不用重启，立刻再放一遍开场视频'
      replay.addEventListener('click', function () {
        panelEl.classList.remove('cw-open')     /* 收起面板，让镜头干净 */
        replayIntro()
      })
      sec5.appendChild(replay)
      panel.appendChild(sec5)

      panelEl.appendChild(panel)
      document.body.appendChild(panelEl)
      paintPanelTheme(looksDark())
      log('设置面板已挂载（左下角「🖼 背景」）')
    }

    /* ── 启动 ───────────────────────────────────────────────────────────── */

    var booted = false

    /**
     * 自举。**只跑一次** —— 重复自举会走一遍 applyNow，虽然 mountLayer 现在幂等，
     * 但重复 fetch + 重复注 CSS 也没必要，而且会把"到底是哪儿在重建"搅浑。
     * 需要重新读配置就刷新页面。
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
            cfg.__source = data.source
            cfg.__file = data.file
            /* 循环区间由宿主把时间码换算成秒后传下来（客户端不做解析） */
            cfg.loopStartSec = data.loopStartSec
            cfg.loopEndSec = data.loopEndSec
            /* 背景图：宿主已经解析好了，这里只拿"有没有" */
            cfg.__imageOk = !!data.imageOk
            cfg.__image = data.image
            cfg.__imageSource = data.imageSource
            if (!data.ok) {
              log('宿主没找到可用视频 —— 检查 /chat-wallpaper/status。片库目录：',
                  (data.config && data.config.userClipDirs) || '?')
              return
            }
            wdiag('config ok file=' + String(data.file).slice(-40) + ' image=' + String(data.imageOk))
            applyNow(cfg)
            watchTheme(cfg)
            /* 设置面板已搬进 DSH 设置页（见 WallpaperPanel），不再挂浮层按钮 */
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
      /* 设置页入口：与「启动动画」并列的「聊天背景」（order 26 / 27）。
         原来那个左下角「🖼 背景」浮层按钮不再创建。 */
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
       原来挂在左下角的「🖼 背景」浮层面板，2026-10-18 起搬进 DSH 设置页，
       与「启动动画」并列（order 26 → 27）。浮层按钮不再创建。
       数据仍走宿主自带的 HTTP 接口（/chat-wallpaper/*），与设置面板无关。 */
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
              mode: cfg.mode || 'once',
              placement: cfg.placement || 'front',
              veilLightA: cfg.veilLightA || 'rgba(253,250,254,.80)',
              veilDarkA: cfg.veilDarkA || 'rgba(8,10,16,.74)',
              file: conf.file || null,
              source: conf.source || 'none',
              image: conf.image || null
            }
            setData(next)
            setDraft({ banner: next.banner, bannerOpacity: next.bannerOpacity, mode: next.mode, placement: next.placement, dark: looksDark() })
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
            cfg.__source = conf.source
            cfg.__file = conf.file
            cfg.loopStartSec = conf.loopStartSec
            cfg.loopEndSec = conf.loopEndSec
            cfg.__imageOk = !!conf.imageOk
            cfg.__image = conf.image
            panelCfg = cfg
            if (full) { removeLayer(); removeBg(); removeCss(); applyNow(cfg) }
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

      var radio = function (key, value, label) {
        return cwH('label', { className: '__ss_check', key: key + value },
          cwH('input', {
            type: 'radio', checked: draft[key] === value, disabled: busy,
            onChange: function () { var d = Object.assign({}, draft); d[key] = value; setDraft(d) }
          }),
          cwH('span', { className: '__ss_checkText' }, cwH('span', {}, label))
        )
      }

      return cwH('div', { className: '__ss_root' },
        cwH('div', { className: '__ss_group' },
          cwH('div', { className: '__ss_groupTitle' }, '当前状态'),
          cwH('div', { className: '__ss_hint' },
            '开场视频：' + (data.file ? data.file.split(/[\\/]/).pop() : '（没找到视频）'),
            cwH('br'),
            '背景图：' + (data.image ? data.image.split(/[\\/]/).pop() : '（没有背景图，视频淡出后回到 DSH 默认底色）'),
            cwH('br'),
            '丢图目录：' + (data.dropDir || '?')
          ),
          cwH('div', { className: '__ss_row' },
            cwH('button', { className: '__ss_btn', type: 'button', onClick: function () { api('/open-dir', { method: 'POST' }) } }, '打开图片文件夹'),
            cwH('button', { className: '__ss_btn', type: 'button', onClick: function () { replayIntro(); setNotice('已重播开场') } }, '重播开场'),
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

        cwH('div', { className: '__ss_group' },
          cwH('div', { className: '__ss_groupTitle' }, '开场视频'),
          cwH('div', { className: '__ss_label' }, '播完之后'),
          radio('mode', 'once', '播一次就淡出，进聊天（默认）'),
          radio('mode', 'loop', '常驻循环（配合下面的「放到最底层」当背景视频）'),
          cwH('div', { className: '__ss_label', style: { marginTop: 6 } }, '放在哪一层'),
          radio('placement', 'front', '最前面全屏播（第二幕）'),
          radio('placement', 'behind', '放到聊天窗口后面当常驻背景')
        ),

        cwH('div', { className: '__ss_actions' },
          cwH('button', {
            className: '__ss_btn __ss_btnPrimary', type: 'button', disabled: busy,
            onClick: function () { apply({ banner: draft.banner, bannerOpacity: draft.bannerOpacity, mode: draft.mode, placement: draft.placement }, true) }
          }, busy ? '保存中…' : '保存'),
          error ? cwH('span', { className: '__ss_err' }, error) : null,
          notice ? cwH('span', { className: '__ss_ok' }, notice) : null
        )
      )
    }

    exports.apply = apply
    exports.inject = []       // 不需要任何客户端服务

    /* 测试钩子：只给 node:vm 冒烟测试用，不参与运行时逻辑。
       有了它们就能在不启动 DSH 的情况下验证 CSS 生成、主题判定、挂载幂等、起始时机。 */
    exports.__buildCss = buildCss
    exports.__looksDark = looksDark
    exports.__TAG_ID = TAG_ID
    exports.__ROOT_ID = ROOT_ID
    exports.__THEME_CLASSES = ['dsh-cw-dark', 'dsh-cw-light']
    exports.__resetLum = function () { measuredLum = null }
    exports.__mountLayer = mountLayer
    exports.__mountCount = function () { return mountCount }
    exports.__bootOverlayPresent = bootOverlayPresent
    exports.__DEFAULT_LEAVE_CLASSES = DEFAULT_LEAVE_CLASSES
    exports.__startWhenFree = startWhenFree
    exports.__teardown = teardown
    exports.__applyNow = applyNow
    exports.__watchTheme = watchTheme
    exports.__mountPanel = mountPanel
    exports.__refreshPanel = refreshPanel
    exports.__preloadVideo = preloadVideo
    exports.__beginIntro = beginIntro
    exports.__replayIntro = replayIntro
    exports.__mountBanner = mountBanner
    exports.__fitBanner = fitBanner
    exports.__BANNER_ID = BANNER_ID
    exports.__PANEL_ID = PANEL_ID
    exports.__PANEL_TAG_ID = PANEL_TAG_ID
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
