#!/usr/bin/env node
/** 坐标规范：所有内置模板的图层 pos 必须是画布中心 [640,360]，位移只能写进关键帧 offsetX/offsetY。
 *  这条测试存在的意义：曾经有模板把"绝对坐标"写进 pos，编辑器里 Y 显示 0 但画面不在中心，
 *  用户排错时完全对不上。以后任何人（包括脚本生成）写模板都必须遵守。 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const tplRoot = path.join(here, '..', 'templates')
let failures = 0
let checked = 0

for (const name of fs.readdirSync(tplRoot)) {
  const file = path.join(tplRoot, name, 'template.json')
  if (!fs.existsSync(file)) continue
  let tpl
  try { tpl = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { console.log('  FAIL ' + name + ' 解析失败'); failures++; continue }
  for (const L of tpl.layers || []) {
    checked++
    const pos = Array.isArray(L.pos) ? L.pos : [640, 360]
    if (pos[0] !== 640 || pos[1] !== 360) {
      failures++
      console.log('  FAIL ' + name + ' 图层 ' + (L.id || '?') + ' pos=' + JSON.stringify(pos) + '（应为 [640,360]，位移写 offsetX/offsetY）')
    }
  }
}

if (failures) { console.log('坐标规范：' + failures + ' 处违规（共检查 ' + checked + ' 层）'); process.exit(1) }
console.log('坐标规范：全部通过（' + checked + ' 层，pos 均为 [640,360]）')