import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const buf = fs.readFileSync(path.join(root, 'package.json'));
if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
  throw new Error('package.json 带 UTF-8 BOM，DSH 会拒绝加载');
}
const pkg = JSON.parse(buf.toString('utf8'));
if (!pkg.version) throw new Error('package.json 缺少 version');
for (const f of ['lib/index.js', 'lib/splash.js', 'lib/client.js', 'lib/assets/default-background.jpg', 'templates', 'tools/install.ps1', 'tools/update-apply.ps1', 'tools/rollback-version.ps1', 'lib/assets/voices/manifest.json']) {
  if (!fs.existsSync(path.join(root, f))) throw new Error('缺少 ' + f);
}
const installPs1 = fs.readFileSync(path.join(root, 'tools/install.ps1'), 'utf8');
for (const needle of ['rollback-version.ps1', '紧急回滚-V', 'DSH_BOOT_SUITE_ROLLBACK', 'checkpoint']) {
  if (!installPs1.includes(needle)) throw new Error('install.ps1 缺少更新前回滚 checkpoint：' + needle);
}
/* v2.13.11：新版 DSH 的 dsh 命令行不解析子命令时会「退出码 0 但没装插件」，
   安装器必须按 profile 真实文件校验，失败走手动安装/回滚，绝不留下 bundles 不一致。 */
for (const needle of ['Test-InstalledOk', '安装后校验失败', '命令行的退出码是 0']) {
  if (!installPs1.includes(needle)) throw new Error('install.ps1 缺少安装后校验兜底：' + needle);
}
const rollbackPs1 = fs.readFileSync(path.join(root, 'tools/rollback-version.ps1'), 'utf8');
for (const needle of ['TargetPkg', 'CheckOnly', 'DSH_BOOT_SUITE_ROLLBACK', '回滚日志']) {
  if (!rollbackPs1.includes(needle)) throw new Error('rollback-version.ps1 缺少关键逻辑：' + needle);
}
for (const f of ['line-1.mp3', 'line-6.mp3', 'dry-line-1.mp3']) {
  if (fs.existsSync(path.join(root, 'lib/assets', f))) throw new Error('旧 TTS 配音素材未删除：' + f);
}

/* v2.15.5：全景大肥鱼-含彩蛋版（重命名 + 结尾波形 + 模板内配音效果） */
const tplJson = JSON.parse(fs.readFileSync(path.join(root, 'templates/division-bigfish-codex/template.json'), 'utf8'))
if (tplJson.name !== '全景大肥鱼-含彩蛋版') throw new Error('模板名称未更新：' + tplJson.name)
const bigfishApp = fs.readFileSync(path.join(root, 'templates/division-bigfish-codex/app.js'), 'utf8')
for (const needle of ['attachVoiceFx', 'window.__WAIT_START__', 'VOICE_FX_PRESETS']) {
  if (!bigfishApp.includes(needle)) throw new Error('模板内配音效果/结尾波形缺少：' + needle)
}
const hostStartup = fs.readFileSync(path.join(root, 'lib/host-startup.js'), 'utf8')
if (!hostStartup.includes("bigfishVoiceFx: 'none'")) throw new Error('host-startup 缺少 bigfishVoiceFx 默认值')
if (!hostStartup.includes("window.CONFIG.voiceFx='")) throw new Error('host-startup 未注入模板 voiceFx')
const clientJs = fs.readFileSync(path.join(root, 'lib/client.js'), 'utf8')
for (const needle of ['bigfishVoiceFx', '全景大肥鱼-含彩蛋版']) {
  if (!clientJs.includes(needle)) throw new Error('设置页缺少：' + needle)
}
/* v2.15.6：掉线彩蛋必须等用户点【重新连接】，不许自动 reconnect */
if (bigfishApp.includes('setTimeout(reconnect')) throw new Error('彩蛋仍有自动 reconnect 定时器')
if (!bigfishApp.includes('必须等用户点【重新连接】')) throw new Error('彩蛋等待逻辑缺少注释锚点')
const bigfishCfg = fs.readFileSync(path.join(root, 'templates/division-bigfish-codex/config.js'), 'utf8')
if (bigfishCfg.includes('eggReplayWait')) throw new Error('config.js 仍残留 eggReplayWait 自动重播字段')
/* v2.15.7：结尾等待配音时必须继续渲染波形 */
if (!bigfishApp.includes('if(!playing&&t>=cfg.duration-0.05)render();')) throw new Error('结尾等待期缺少渲染调用，波形会再次冻住')
/* v2.15.8：模板配音音量 + iframe 模板 BGM */
if (!hostStartup.includes('bigfishVoiceVolume: 50')) throw new Error('host-startup 缺少配音音量默认值')
if (!hostStartup.includes('window.CONFIG.voiceVolume=')) throw new Error('host-startup 未注入模板配音音量')
if (!bigfishApp.includes('a.volume=voiceVol')) throw new Error('模板配音未应用音量')
if (!bigfishApp.includes('dsh-startup-voice')) throw new Error('模板未上报配音闪避事件')
const splashJs = fs.readFileSync(path.join(root, 'lib/splash.js'), 'utf8')
if (!splashJs.includes('dsh-startup-voice')) throw new Error('splash 未处理模板配音闪避')
if (!/engine === 'iframe'[\s\S]{0,160}bgm\.start\(\)/.test(splashJs)) throw new Error('iframe 模板未启动 BGM')
if (!clientJs.includes('配音音量')) throw new Error('设置页缺少配音音量')
if (!clientJs.includes('bigfishVoiceVolume')) throw new Error('设置页缺少 bigfishVoiceVolume')
if (!clientJs.includes('style: (isArchiveWarm || isBigfish)')) throw new Error('BGM 组未对全景大肥鱼显示')
/* v2.15.9：无第二幕不切第二段音乐、BGM 循环开关、跳过按钮位置 */
if (!hostStartup.includes('bgmLoop: true')) throw new Error('host-startup 缺少 bgmLoop 默认值')
if (!hostStartup.includes("'bgmLoop'")) throw new Error('host-startup BOOL_KEYS 缺 bgmLoop')
if (!splashJs.includes('C.bgmLoop !== false')) throw new Error('splash 未使用 bgmLoop')
if (!/if \(!TEMPLATE2[\s\S]{0,420}bgm\.toSecond\(\)/.test(splashJs)) throw new Error('splash 在无第二幕时仍提前切第二段音乐')
if (!clientJs.includes('hasSecondAct')) throw new Error('设置页缺少第二幕判断')
if (!clientJs.includes('bgmLoop')) throw new Error('设置页缺少循环开关')
const skipCss = fs.readFileSync(path.join(root, 'templates/division-bigfish-codex/style.css'), 'utf8')
if (!skipCss.includes('top:64px;right:72px')) throw new Error('跳过按钮位置未调整')
/* v2.15.10：掉线时机随机、彩蛋截断 BGM、重连不叠音 */
if (!bigfishApp.includes('dsh-startup-bgm')) throw new Error('模板未上报 BGM 彩蛋信号')
if (!bigfishApp.includes('resetPlayedAfter')) throw new Error('重连未按时间点重置语音')
if (!bigfishApp.includes('eggTimeForPct(Math.random()*100)')) throw new Error('掉线时机未按进度百分比随机')
if (!splashJs.includes('bgm cut')) throw new Error('splash 缺少 BGM 截断')
if (!splashJs.includes('dsh-startup-bgm')) throw new Error('splash 未处理 BGM 彩蛋信号')
if (!bigfishCfg.includes('egg:{}')) throw new Error('config.js 仍固定 egg.at')
/* v2.15.11：模板不再自己做白闪，结尾转场由插件接管 */
for (const f of ['index.html', 'render.html']) {
  const html = fs.readFileSync(path.join(root, 'templates/division-bigfish-codex', f), 'utf8')
  if (html.includes('id="flash"')) throw new Error(f + ' 仍有模板白闪节点 #flash')
}
if (bigfishApp.includes('flashEl')) throw new Error('app.js 仍引用模板白闪 flashEl')
if (bigfishApp.includes('flashEl')) throw new Error('app.js 仍残留白闪动画')
if (skipCss.includes('#flash')) throw new Error('style.css 仍残留 #flash 样式')
if (!/if \(typeof afterIframe === 'function'\) return afterIframe\(\)/.test(splashJs)) throw new Error('iframe 模板收尾未支持第二幕回调')
if (!/return done\.then\(function \(\) \{[\s\S]{0,420}transOut\(transType\('Out'\), finish\)/.test(splashJs)) throw new Error('iframe 模板收尾未交给插件退场转场')
/* v2.15.12：结尾等配音时圆环继续转 */
if (!bigfishApp.includes('const rt=t+waitSec')) throw new Error('结尾圆环未使用连续旋转时钟 rt')
if (!bigfishApp.includes('rotate(${rt*5})')) throw new Error('外圈未使用 rt 旋转')
if (!bigfishApp.includes('rotate(${-rt*12})')) throw new Error('内圈未使用 rt 旋转')
if (!bigfishApp.includes('Math.sin(rt*6.54)')) throw new Error('外圈脉冲未使用 rt')
if (!/function flashDone\(\)\{hideEgg\(\);doneEmit\(\);\}/.test(bigfishApp)) throw new Error('flashDone 不应再清零旋转时钟')
/* v2.15.13：配音中文字幕 */
if (!bigfishApp.includes('cfg.voice.subs')) throw new Error('模板未使用字幕映射 cfg.voice.subs')
if (!bigfishApp.includes('subtitle')) throw new Error('模板未更新 #subtitle')
const bigfishHtml = fs.readFileSync(path.join(root, 'templates/division-bigfish-codex', 'index.html'), 'utf8')
if (!bigfishHtml.includes('id="subtitle"')) throw new Error('index.html 缺少 #subtitle 字幕节点')
if (!bigfishCfg.includes('警告：检测到新特工登录')) throw new Error('config.js 缺少中文字幕映射')
if (!bigfishCfg.includes("line2:'装备与技能配置已验证。倒计时十秒。'")) throw new Error('config.js line2 字幕未包含完整句')
if (!bigfishCfg.includes("line3:'网络同步完成。正在移交权限。'")) throw new Error('config.js line3 字幕不正确')
if (!bigfishCfg.includes("reconnect:'检测到特工重新连接。'")) throw new Error('config.js 缺少重连接字幕')
if (!bigfishCfg.includes("line4:'警告：特工已离线。'")) throw new Error('config.js 缺少彩蛋 line4 字幕')
if (!bigfishApp.includes('renderVoiceRow')) throw new Error('模板未使用整行字幕布局 renderVoiceRow')
if (!fs.existsSync(path.join(root, 'templates/division-bigfish-codex/assets/whale-badge-line.png'))) throw new Error('缺少鲸鱼徽章图标 whale-badge-line.png')
/* v2.15.14：重连提示音独占一整行，播完再继续，且不再续播断句 */
if (!bigfishApp.includes('重连接提示音独占一整行')) throw new Error('app.js 缺少重连提示音独占一行的实现')
if (!bigfishApp.includes('const cueOn=')) throw new Error('渲染未使用重连提示音分支 cueOn')
if (!bigfishApp.includes('playing&&!cueGate')) throw new Error('重连期间未门控后续配音（cueGate）')
if (!bigfishApp.includes('played.line2=false;played.line3=false;played.orig3=false')) throw new Error('重连后未重置后续配音的播放标记')
if (/resetPlayedAfter\(cfg\.loadingStart\)/.test(bigfishApp)) throw new Error('重连仍会续播断句（resetPlayedAfter）')
if (!bigfishApp.includes('cueFailTimer')) throw new Error('重连提示音缺少播放失败的兜底解除门控')
/* v2.15.15：重连提示音也要走插件的配音效果；line3 顺延，避免和 line2 叠音 */
if (!bigfishApp.includes("attachVoiceFx('reconnect')")) throw new Error('重连提示音未接入配音效果')
if (!bigfishApp.includes("[25.0,'line3',3.300]")) throw new Error('app.js 默认时间线未把 line3 顺延到 25.0s')
if (!bigfishCfg.includes("[25.0,'line3',3.300]")) throw new Error('config.js 时间线未把 line3 顺延到 25.0s')
/* v2.15.16：掉线彩蛋等当前配音播完再弹出，不硬切语音/字幕 */
if (!bigfishApp.includes('掉线彩蛋若正好赶上某句配音')) throw new Error('app.js 缺少彩蛋等待当前配音播完的逻辑')
if (!bigfishApp.includes('eggWait=true')) throw new Error('app.js 缺少 eggWait 等待状态')
/* v2.15.17：字幕/波形跟随配音真实播放时钟 */
if (!bigfishApp.includes('__DSH_AUDIO_T__')) throw new Error('app.js 缺少配音真实时钟镜像 __DSH_AUDIO_T__')
if (!bigfishApp.includes('function eggVoice(){')) throw new Error('app.js 彩蛋字幕未改为音频时钟驱动')
/* v2.16.0：配音串行播放 + 彩蛋尾部等待（1.5x 加速段避免叠音、最后一句不被截断） */
if (!bigfishApp.includes('配音串行播放')) throw new Error('app.js 缺少配音串行播放（防叠音）')
if (!bigfishApp.includes('!__busy')) throw new Error('app.js 未按前一句播完再启动下一句')
if (!bigfishApp.includes('eggLeft<=6')) throw new Error('app.js 彩蛋等待条件未覆盖动画尾部')
if (!bigfishApp.includes('!shown&&!eggWait')) throw new Error('app.js 动画收尾未等待彩蛋语音播完')

/* v2.16.0：第一节延长 5s + 插入登录 ID 动画；读取段整体后移 */
if (!bigfishCfg.includes('loginStart:9.2')) throw new Error('config.js 缺少 loginStart=9.2')
if (!bigfishCfg.includes('loginDur:5.0')) throw new Error('config.js 缺少 loginDur=5.0')
if (!bigfishCfg.includes("sched:[[4.6,'orig1',2.65],[9.8,'login',1.79],[14.5,'line1',3.375],[18.4,'line2',3.232],[25.0,'line3',3.300],[30.45,'orig3',2.77]]")) throw new Error('config.js 配音时间线未按三段时间轴重排')
if (!bigfishApp.includes("[14.5,'line1',3.375],[18.4,'line2',3.232]")) throw new Error('app.js 默认配音时间线未同步')
if (!bigfishApp.includes('var LOGIN=')) throw new Error('app.js 缺少登录 ID 动画模块')
if (!bigfishApp.includes('voiceVT')) throw new Error('app.js 缺少静音模式的配音时间轴换算 voiceVT')
if (!bigfishApp.includes('sanitize')) throw new Error('app.js 缺少用户名安全化处理')
if (!bigfishHtml.includes('id="login"') || !bigfishHtml.includes('id="login-line1"')) throw new Error('index.html 缺少登录 ID 动画节点')
if (!bigfishHtml.includes('login-scan-text') || !bigfishHtml.includes('login-name')) throw new Error('index.html 缺少登录动画扫描/用户名节点')
if (Number(tplJson.duration) !== 33.4) throw new Error('template.json duration 未更新为 33.4')
/* v2.16.0 第二版：5s 登录段、整体 1/3 尺寸、贝塞尔平移、第二段配音 */
if (!bigfishCfg.includes("login:'assets/voice-login.wav'")) throw new Error('config.js 缺少第二段登录配音资源')
if (!bigfishCfg.includes("login:'特工身份确认。'")) throw new Error('config.js 缺少登录配音中文字幕')
if (!fs.existsSync(path.join(root, 'templates/division-bigfish-codex/assets/voice-login.wav'))) throw new Error('缺少第二段登录配音 voice-login.wav')
if (!bigfishHtml.includes('login-l2-track')) throw new Error('index.html 缺少贝塞尔平移轨道 login-l2-track')
if (!bigfishHtml.includes('login-voice-layer')) throw new Error('index.html 缺少登录段配音行图层 login-voice-layer')
if (!bigfishApp.includes('function bezier(')) throw new Error('app.js 缺少贝塞尔缓动实现')
if (!bigfishApp.includes("track.style.transform='translateX('")) throw new Error('app.js 未用 track 平移实现平滑过渡')
if (!bigfishApp.includes("renderVoiceRow($('login-voice')")) throw new Error('app.js 登录段未使用配音行 renderVoiceRow')
if (!skipCss.includes('width:min(500px,92vw)')) throw new Error('style.css 登录框未缩到 1/3 尺寸')

/* v2.16.1：4K AV1 改名 + 新增 4K H.264 模板 + 第二幕视频诊断/暂停恢复 */
const tpl4k = JSON.parse(fs.readFileSync(path.join(root, 'templates/whale-girl-scan-4k/template.json'), 'utf8'))
if (tpl4k.name !== '鲸鱼娘扫描睁眼（4K AV1）') throw new Error('4K AV1 模板名称未更新')
const tpl4kh = JSON.parse(fs.readFileSync(path.join(root, 'templates/whale-girl-scan-4k-h264/template.json'), 'utf8'))
if (tpl4kh.name !== '鲸鱼娘扫描睁眼（4K H.264）') throw new Error('缺少 4K H.264 模板名称')
if (!fs.existsSync(path.join(root, 'templates/whale-girl-scan-4k-h264/assets/whale-girl-scan-4k-h264.mp4'))) throw new Error('缺少 4K H.264 视频文件')
const splashSrc = fs.readFileSync(path.join(root, 'lib/splash.js'), 'utf8')
if (!splashSrc.includes('video stats ')) throw new Error('splash.js 缺少第二幕视频丢帧统计')
if (!splashSrc.includes('video meta ')) throw new Error('splash.js 缺少第二幕视频分辨率日志')
if (!splashSrc.includes('vResumeTimer')) throw new Error('splash.js 缺少省电暂停自动恢复')
if (!splashSrc.includes('vp0.catch')) throw new Error('splash.js 未静默 play() 失败')
/* v2.16.2：新增 4K H.264 必须算「正式模板」，否则第二幕下拉里看不到 */
const clientSrc = fs.readFileSync(path.join(root, 'lib/client.js'), 'utf8')
if (!clientSrc.includes("'whale-girl-scan-4k-h264': 1")) throw new Error('client.js 的正式模板白名单缺少 4K H.264')
/* v2.16.2：安装器代理加固 */
const installPs1V2162 = fs.readFileSync(path.join(root, 'tools/install.ps1'), 'utf8')
if (!installPs1V2162.includes('Get-ProxyInfo')) throw new Error('install.ps1 缺少代理探测')
if (!installPs1V2162.includes('npm_config_fetch_timeout')) throw new Error('install.ps1 缺少 pnpm 网络超时设置')
if (!installPs1V2162.includes('registry.npmmirror.com')) throw new Error('install.ps1 缺少国内镜像重试')
const helperGen = fs.readFileSync(path.join(root, 'tools/make-upgrade-helper.mjs'), 'utf8')
if (!helperGen.includes('turn off any proxy')) throw new Error('升级助手缺少代理提示')
/* v2.16.3：设置页下拉改自绘，跟随皮肤 3D 面板平面 */
if (!clientSrc.includes('__ss_selectMenu')) throw new Error('client.js 缺少自绘下拉菜单')
if (!clientSrc.includes('aria-haspopup')) throw new Error('client.js 自绘下拉缺少 aria 属性')
if (!clientSrc.includes('function CwSelect(')) throw new Error('client.js 聊天背景缺少 CwSelect')
if (clientSrc.includes("h('select',")) throw new Error('client.js 仍残留原生 select（设置页）')
if (clientSrc.includes("cwH('select',")) throw new Error('client.js 仍残留原生 select（聊天背景）')
/* v2.16.6：第一幕是 iframe 模板时也要接第二幕 */
if (!splashSrc.includes('function runIframeTemplate(tpl, afterIframe)')) throw new Error('splash.js 未给 iframe 模板留第二幕回调')
if (!splashSrc.includes('runIframeTemplate(TEMPLATE, function () {')) throw new Error('splash.js iframe 首幕未接第二幕')
if (!splashSrc.includes('afterIframe')) throw new Error('splash.js 缺少 afterIframe 处理')
/* v2.16.7：视频原声开关 + 掉线彩蛋底图 */
const hostSrcV2167 = fs.readFileSync(path.join(root, 'lib/host-startup.js'), 'utf8')
if (!hostSrcV2167.includes('act1VideoSound: false')) throw new Error('host-startup 缺少第一幕视频原声默认值')
if (!hostSrcV2167.includes('act2VideoSound: false')) throw new Error('host-startup 缺少第二幕视频原声默认值')
if (!hostSrcV2167.includes("'act1VideoSound'") || !hostSrcV2167.includes("'act2VideoSound'")) throw new Error('host-startup 的 BOOL_KEYS 缺少视频原声开关')
if (!splashSrc.includes('act2VideoSound === true')) throw new Error('splash.js 缺少第二幕视频原声分支')
if (!splashSrc.includes('fallback muted')) throw new Error('splash.js 缺少未静音自动播放失败回退')
if (!clientSrc.includes('第一幕视频原声') || !clientSrc.includes('第二幕视频原声')) throw new Error('client.js 缺少视频原声设置项')
const eggBg = path.join(root, 'templates/division-bigfish-codex/assets/egg-bg.png')
if (!fs.existsSync(eggBg)) throw new Error('缺少掉线彩蛋底图 egg-bg.png')
if (fs.statSync(eggBg).size < 1000000) throw new Error('掉线彩蛋底图疑似未替换（文件过小）')
/* v2.16.8：聊天背景第二张内置背景（可选，不改变默认） */
const wallSrcV2168 = fs.readFileSync(path.join(root, 'lib/host-wallpaper.js'), 'utf8')
if (!wallSrcV2168.includes('BUILTIN_IMAGES')) throw new Error('host-wallpaper 缺少多张内置背景表')
if (!wallSrcV2168.includes("'__snowgirl__'")) throw new Error('host-wallpaper 缺少第二张内置背景哨兵')
if (!wallSrcV2168.includes('builtinName')) throw new Error('host-wallpaper 缺少内置背景名称回传')
if (!clientSrc.includes('builtinName')) throw new Error('client.js 缺少内置背景名称显示')
const snowBg = path.join(root, 'lib/assets/builtin-background-snowgirl.png')
if (!fs.existsSync(snowBg)) throw new Error('缺少第二张内置背景图 builtin-background-snowgirl.png')
if (fs.statSync(snowBg).size < 1000000) throw new Error('第二张内置背景图疑似不完整')
/* v2.16.9：内置第二幕 V5（AI 动画，可选） */
const v5Tpl = path.join(root, 'templates/bigfish-v5-act2/template.json')
if (!fs.existsSync(v5Tpl)) throw new Error('缺少内置第二幕模板 bigfish-v5-act2')
const v5Json = JSON.parse(fs.readFileSync(v5Tpl, 'utf8'))
if (v5Json.id !== 'bigfish-v5-act2') throw new Error('V5 模板 id 不符')
const v5Mp4 = path.join(root, 'templates/bigfish-v5-act2/assets/bigfish-v5-act2.mp4')
if (!fs.existsSync(v5Mp4)) throw new Error('缺少 V5 第二幕视频')
if (fs.statSync(v5Mp4).size < 2000000) throw new Error('V5 第二幕视频疑似不完整')
if (!clientSrc.includes("'bigfish-v5-act2': 1")) throw new Error('client.js 正式模板白名单缺少 bigfish-v5-act2')
if (!fs.existsSync(path.join(root, 'templates/bigfish-v5-act2/NOTICE.md'))) throw new Error('缺少 V5 模板 NOTICE')
/* v2.16.10：鸣谢含两位原作者 */
if (!clientSrc.includes('之一ONETHING')) throw new Error('鸣谢缺少皮肤原作者之一ONETHING')
if (!clientSrc.includes('胡萨尔cC')) throw new Error('鸣谢缺少余额表盘原作者胡萨尔cC')
if (!clientSrc.includes('oenthing/blockade-orange-dsh-skin')) throw new Error('鸣谢缺少皮肤仓库链接')
if (!clientSrc.includes('goooooooeg/dsh-balance-hud')) throw new Error('鸣谢缺少表盘仓库链接')
console.log('ok  package.json version=' + pkg.version + '，无 BOM，关键文件齐全（含更新前回滚 checkpoint）');
