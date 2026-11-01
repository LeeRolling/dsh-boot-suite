#!/usr/bin/env node
/**
 * 安全暂存本机升级包（2026-11-02 事故后的流程固化）。
 *
 * 事故复盘：
 *   v2.15.13 曾把 zip 直接解压到 ~/.dsh/boot-suite-updates/2.15.13/，
 *   文件铺在 2.15.13/ 下而不是 2.15.13/pkg/ 下；桌面助手固定调用
 *   ...\2.15.13\pkg\tools\install.ps1，于是报「路径不存在」。
 *   更糟的是当时在 DSH 运行时删掉了旧 pkg，profile 的 link: 指向了
 *   不存在的目录，DSH 直接打不开，只能回滚。
 *
 * 本脚本的顺序（任何一步失败都保留旧版本，绝不让 profile 悬空）：
 *   1. 确认目标 pkg 没有被任何 profile 以 link: 正在使用（在跑就拒绝）；
 *   2. 解压到 updates 目录内的临时目录，校验 pkg/package.json 版本、
 *      pkg/tools/install.ps1、文件数；
 *   3. 旧 pkg 改名备份（不删除），新 pkg 原子 rename 到位；
 *   4. 再校验一遍新 pkg；失败则把旧 pkg 改回来；
 *   5. 复制 zip 到 <版本>/<版本>.zip，最后打印摘要。
 *
 * 用法：
 *   node tools/stage-local.mjs 2.15.13
 *   node tools/stage-local.mjs 2.15.13 --zip "F:/.../03-发布包/dsh-boot-suite-win.zip"
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.dirname(here)

const args = process.argv.slice(2)
const version = args[0]
const versionRe = /^\d+\.\d+\.\d+$/
if (!version || !versionRe.test(version)) {
  console.error('[x] 用法：node tools/stage-local.mjs <版本号> [--zip <发布包 zip 路径>]')
  process.exit(1)
}

const zi = args.indexOf('--zip')
let zipPath = zi >= 0 && args[zi + 1]
  ? path.resolve(args[zi + 1])
  : path.resolve(repoRoot, '..', '03-发布包', 'dsh-boot-suite-win.zip')

if (!fs.existsSync(zipPath)) {
  console.error(`[x] 找不到发布包 zip：${zipPath}`)
  process.exit(1)
}

const updatesRoot = path.join(os.homedir(), '.dsh', 'boot-suite-updates')
const versionDir = path.join(updatesRoot, version)
const targetPkg = path.join(versionDir, 'pkg')
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
const tmpRoot = path.join(updatesRoot, `.stage-${version}-${stamp}`)
const tmpPkg = path.join(tmpRoot, 'pkg')

const fail = (msg) => {
  console.error(`[x] ${msg}`)
  console.error(`[x] 旧的 ${targetPkg} 未被删除（如果已备份，会在下面提示），profile 未改动。`)
  process.exit(1)
}

/* 1. 目标 pkg 正被 profile 以 link: 使用时拒绝替换 */
const profilesRoot = path.join(os.homedir(), '.dsh', 'profiles')
const live = []
if (fs.existsSync(profilesRoot)) {
  for (const name of fs.readdirSync(profilesRoot)) {
    const pj = path.join(profilesRoot, name, 'package.json')
    if (!fs.existsSync(pj)) continue
    try {
      const json = JSON.parse(fs.readFileSync(pj, 'utf8'))
      for (const dep of Object.values(json.dependencies || {})) {
        if (typeof dep !== 'string' || !dep.startsWith('link:')) continue
        const resolved = path.resolve(dep.slice(5).replace(/\//g, path.sep)).toLowerCase()
        if (resolved === targetPkg.toLowerCase() || resolved.startsWith(targetPkg.toLowerCase() + path.sep.toLowerCase())) {
          live.push(`${name}: ${dep}`)
        }
      }
    } catch { /* 单个 profile 读不动就跳过，不影响主流程 */ }
  }
}
if (live.length) {
  console.error(`[x] 目标 pkg 正被 profile 使用，拒绝替换：\n    ${live.join('\n    ')}`)
  console.error('[x] 先让 DSH 用旧版本启动（或回滚）并完全退出，再暂存新版本。')
  process.exit(1)
}

/* 2. 解压到临时目录并校验 */
fs.rmSync(tmpRoot, { recursive: true, force: true })
fs.mkdirSync(tmpPkg, { recursive: true })
console.log(`[1/5] 解压 ${zipPath}`)
const tar = spawnSync('tar', ['-xf', zipPath, '-C', tmpPkg], { stdio: 'inherit' })
if (tar.status !== 0) fail(`解压失败（tar exit ${tar.status}）`)

let srcPkg = tmpPkg
if (!fs.existsSync(path.join(srcPkg, 'package.json')) && fs.existsSync(path.join(srcPkg, 'pkg', 'package.json'))) {
  srcPkg = path.join(srcPkg, 'pkg') // 兼容 zip 内自带 pkg/ 层的情况
}
const countFiles = (dir) => {
  let n = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) n += countFiles(p)
    else n++
  }
  return n
}
const pkgJsonPath = path.join(srcPkg, 'package.json')
const installPath = path.join(srcPkg, 'tools', 'install.ps1')
if (!fs.existsSync(pkgJsonPath)) fail('解压结果里没有 package.json')
if (!fs.existsSync(installPath)) fail('解压结果里没有 tools/install.ps1（桌面助手会找不到安装器）')
const pkgVersion = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version
if (pkgVersion !== version) fail(`包内版本 ${pkgVersion} 与要暂存的 ${version} 不一致`)
const fileCount = countFiles(srcPkg)
if (fileCount < 50) fail(`包内文件数异常（${fileCount}），拒绝暂存`)
console.log(`[2/5] 校验通过：version=${pkgVersion}，files=${fileCount}`)

/* 3. 旧 pkg 备份 → 新 pkg 原子替换 */
fs.mkdirSync(versionDir, { recursive: true })
let backupDir = ''
if (fs.existsSync(targetPkg)) {
  backupDir = path.join(versionDir, `pkg.prev-${stamp}`)
  fs.renameSync(targetPkg, backupDir)
  console.log(`[3/5] 旧 pkg 已备份到 ${backupDir}`)
} else {
  console.log('[3/5] 没有旧 pkg，直接放入新 pkg')
}
try {
  fs.renameSync(srcPkg, targetPkg)
} catch (err) {
  if (backupDir) fs.renameSync(backupDir, targetPkg)
  fail(`新 pkg 移入失败（${err.message}），已恢复旧 pkg`)
}

/* 4. 对最终位置再校验一遍，失败就回滚 */
let ok = false
try {
  const v = JSON.parse(fs.readFileSync(path.join(targetPkg, 'package.json'), 'utf8')).version
  ok = v === version && fs.existsSync(path.join(targetPkg, 'tools', 'install.ps1'))
} catch { ok = false }
if (!ok) {
  fs.rmSync(targetPkg, { recursive: true, force: true })
  if (backupDir) fs.renameSync(backupDir, targetPkg)
  fail('新 pkg 落位后校验失败，已恢复旧 pkg')
}
const zipCopy = path.join(versionDir, `${version}.zip`)
fs.copyFileSync(zipPath, zipCopy)
console.log(`[4/5] 新 pkg 就位：${targetPkg}`)

/* 5. 打印摘要 */
const size = fs.statSync(zipPath).size
console.log('[5/5] 完成')
console.log(`  version      : ${version}`)
console.log(`  pkg          : ${targetPkg}`)
console.log(`  files        : ${fileCount}`)
console.log(`  pkg.prev     : ${backupDir || '(无)'}`)
console.log(`  zip copy     : ${zipCopy} (${size} bytes)`)
