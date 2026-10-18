/**
 * dsh-boot-suite — 宿主半侧（合并版）
 * ---------------------------------------------------------------------------
 *   · host-startup.js   开机动画：/dsh-startup/* 路由 + index.html 首屏注入
 *   · host-wallpaper.js 聊天壁纸：/chat-wallpaper/* 路由 + Range 视频流
 *
 * 两份配置刻意**没有合并**，继续读原来的两个文件，老用户的设置原样生效：
 *   · $DSH_HOME/dsh-startup.json
 *   · $DSH_HOME/chat-wallpaper.json
 */
import * as startup from './host-startup.js'
import wallpaperPlugin from './host-wallpaper.js'

const name = 'dsh-boot-suite'
const inject = ['webServer', 'connection']

function apply(ctx) {
  /* 壁纸半侧"绝不抛异常"：壁纸坏了只能是没有壁纸，绝不能影响 DSH 启动。 */
  try {
    wallpaperPlugin.apply(ctx)
  } catch (err) {
    try {
      ctx.logger?.warn?.('[dsh-boot-suite] 聊天壁纸半侧启动失败，已跳过：' + String((err && err.message) || err))
    } catch (e2) { /* 日志失败不影响加载 */ }
  }
  startup.apply(ctx)
}

/* 具名导出给 cordis-plugin-loader（它取 exports.default ?? exports）。
   两边都指向同一个对象，无论走哪条路结果一致。 */
const plugin = { name, inject, apply }
export { apply, inject, name }
export default plugin

/* 壁纸半侧的纯函数与测试钩子原样透传：老测试（smoke-timecode / smoke-panel /
   smoke-resolve）直接从这里取，迁移时不必改断言。 */
export { parseTimecode, __resolveForTest, __alphaOf, __listImages, __imageDir } from './host-wallpaper.js'
