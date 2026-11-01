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
if (!/return done\.then\(function \(\) \{[\s\S]{0,260}transOut\(transType\('Out'\), finish\)/.test(splashJs)) throw new Error('iframe 模板收尾未交给插件退场转场')
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
console.log('ok  package.json version=' + pkg.version + '，无 BOM，关键文件齐全（含更新前回滚 checkpoint）');
