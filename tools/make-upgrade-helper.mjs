#!/usr/bin/env node
/**
 * 生成桌面「升级到 X（先完全退出 DSH 再双击）.cmd」助手。
 *
 * 为什么有这个脚本：
 *   2026-10-28 v2.13.9 的桌面助手曾用 PowerShell 数组 + 字符串拼接生成，
 *   结果每个 +$v+ 被拆成独立数组元素，写出的 .cmd 变成
 *   "title dsh-boot-suite" / "2.13.9" / " upgrade helper" 三行，
 *   用户双击后 cmd 把版本号当命令执行，更新器没启动。
 *   现在改成「模板整段写 + 写后读回校验」，从流程上避免同类事故。
 *
 * 用法：
 *   node tools/make-upgrade-helper.mjs <版本号>
 *   node tools/make-upgrade-helper.mjs 2.13.9 --desktop "C:/Users/Admin/Desktop"
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
const version = args[0]
const versionRe = /^\d+\.\d+\.\d+$/
if (!version || !versionRe.test(version)) {
  console.error('[x] 用法：node tools/make-upgrade-helper.mjs <版本号> [--desktop <桌面目录>]')
  process.exit(1)
}

let desktop = path.join(os.homedir(), 'Desktop')
const di = args.indexOf('--desktop')
if (di >= 0 && args[di + 1]) desktop = args[di + 1]

const pkgInstall = `%USERPROFILE%\\.dsh\\boot-suite-updates\\${version}\\pkg\\tools\\install.ps1`
const helperName = `升级到 ${version}（先完全退出 DSH 再双击）.cmd`
const helperPath = path.join(desktop, helperName)

/* 整段模板：一行一个元素，绝不把版本号单独拼成数组元素 */
const lines = [
  '@echo off',
  'chcp 65001 >nul',
  `title dsh-boot-suite ${version} upgrade helper`,
  'echo ============================================================',
  `echo  Install dsh-boot-suite v${version} from this staged package.`,
  'echo  IMPORTANT: fully quit DeepSeek Harness first (window + tray).',
  'echo ============================================================',
  'echo.',
  `powershell -NoProfile -ExecutionPolicy Bypass -File "${pkgInstall}"`,
  'echo.',
  'echo If the window closed before installing: quit DeepSeek Harness completely, then double-click this file again.',
  `echo After installing, open DeepSeek Harness manually and check Settings for version ${version}.`,
  'echo.',
  'pause'
]

/* 自检 1：不允许出现「单独一行的版本号」，那是上次事故的形态 */
const bad = lines.findIndex(l => l.trim() === version)
if (bad >= 0) {
  console.error(`[x] 生成失败：第 ${bad + 1} 行只剩版本号 ${version}（拼接被拆开了）`)
  process.exit(1)
}
/* 自检 2：安装器路径必须完整包含版本号与 install.ps1 */
if (!lines.some(l => l.includes(`\\${version}\\pkg\\tools\\install.ps1`))) {
  console.error('[x] 生成失败：install.ps1 完整路径缺失')
  process.exit(1)
}
/* 自检 3：纯 ASCII（避免 cmd 代码页把中文路径/文件名截断） */
const text = lines.join('\r\n') + '\r\n'
if ([...text].some(ch => ch.charCodeAt(0) > 127)) {
  console.error('[x] 生成失败：.cmd 内容含非 ASCII 字符')
  process.exit(1)
}

fs.mkdirSync(desktop, { recursive: true })
fs.writeFileSync(helperPath, text, 'ascii')

/* 自检 4：写后读回，逐行比对 + 关键行检查（这是事故的根本教训） */
const back = fs.readFileSync(helperPath, 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
if (back.length !== lines.length || back.some((l, i) => l !== lines[i])) {
  console.error('[x] 生成失败：写回内容与模板不一致')
  process.exit(1)
}
if (!back.some(l => l.includes(`\\${version}\\pkg\\tools\\install.ps1`))) {
  console.error('[x] 生成失败：读回后 install.ps1 路径不完整')
  process.exit(1)
}

console.log(`[ok] ${helperPath}`)
console.log(`[ok] ${Buffer.byteLength(text, 'ascii')} bytes，${lines.length} 行；版本 ${version}；路径校验通过`)
