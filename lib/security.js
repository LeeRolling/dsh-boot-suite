/* ============================================================================
 * dsh-boot-suite — 安全公共件（纯函数，便于单元测试）
 * ----------------------------------------------------------------------------
 * 只放与安全相关、且不依赖 DSH 运行时的逻辑：
 *   - SHA-256 摘要：更新链只信 GitHub Release 资产自带的官方摘要
 *   - safeDecodeURIComponent：畸形 % 转义返回 null，绝不抛异常打断路由
 *   - validateTemplate：模板 JSON 的结构化校验（替代原先只看 id/体积的宽松版）
 *   - guardDecision：浏览器信任栅栏的 fail-closed 判定
 * ========================================================================== */

import { createHash, timingSafeEqual } from 'node:crypto'

export const TEMPLATE_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
export const MAX_TEMPLATE_BYTES = 16 * 1024 * 1024
export const TEMPLATE_ENTRY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/

const MAX_DEPTH = 10
const MAX_ARRAY_ITEMS = 256
const MAX_OBJECT_KEYS = 128
const MAX_STRING_LEN = 4000
const MAX_ABS_NUMBER = 1e7
const MAX_TOTAL_NODES = 20000
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** 十六进制 SHA-256（小写）。 */
export function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

/** 'sha256:<64hex>' → '<64hex>'；格式不合法返回 ''。 */
export function parseDigest(digest) {
  const s = String(digest || '').trim().toLowerCase()
  const m = /^sha256:([0-9a-f]{64})$/.exec(s)
  return m ? m[1] : ''
}

/** 校验 buffer 是否匹配官方摘要；缺摘要也算失败（调用方决定是否降级）。 */
export function digestMatches(buf, digest) {
  const expected = parseDigest(digest)
  if (!expected) return { ok: false, reason: 'missing-digest' }
  if (!Buffer.isBuffer(buf) || buf.length === 0) return { ok: false, reason: 'empty-body' }
  const actual = sha256Hex(buf)
  const a = Buffer.from(actual, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'digest-mismatch', actual }
  return { ok: true, actual }
}

export function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value == null ? '' : value))
  } catch (err) {
    return null
  }
}

function sanitizeValue(value, depth, state) {
  if (state.nodes++ > MAX_TOTAL_NODES) return { ok: false, reason: 'too-many-nodes' }
  if (depth > MAX_DEPTH) return { ok: false, reason: 'too-deep' }
  if (value === null) return { ok: true, value: null }
  const t = typeof value
  if (t === 'string') return { ok: true, value: value.replace(/\u0000/g, '').slice(0, MAX_STRING_LEN) }
  if (t === 'boolean') return { ok: true, value }
  if (t === 'number') {
    if (!Number.isFinite(value)) return { ok: false, reason: 'non-finite-number' }
    return { ok: true, value: Math.max(-MAX_ABS_NUMBER, Math.min(MAX_ABS_NUMBER, value)) }
  }
  if (t !== 'object') return { ok: false, reason: 'unsupported-type' }
  if (Array.isArray(value)) {
    const out = []
    const n = Math.min(value.length, MAX_ARRAY_ITEMS)
    for (let i = 0; i < n; i++) {
      const r = sanitizeValue(value[i], depth + 1, state)
      if (!r.ok) return r
      out.push(r.value)
    }
    return { ok: true, value: out }
  }
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return { ok: false, reason: 'non-plain-object' }
  const keys = Object.keys(value)
  if (keys.length > MAX_OBJECT_KEYS) return { ok: false, reason: 'too-many-keys' }
  const out = {}
  for (const k of keys) {
    if (DANGEROUS_KEYS.has(k)) continue
    if (k.length > 100) return { ok: false, reason: 'key-too-long' }
    const r = sanitizeValue(value[k], depth + 1, state)
    if (!r.ok) return r
    out[k] = r.value
  }
  return { ok: true, value: out }
}

/** 模板 JSON 校验：id 合法 + 体积上限 + 结构化限界 + 分幕数上限。失败返回 {ok:false,reason}。 */
export function validateTemplate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'not-object' }
  const id = String(raw.id || '').trim()
  if (!TEMPLATE_ID_RE.test(id)) return { ok: false, reason: 'bad-id' }
  let json = ''
  try {
    json = JSON.stringify(raw)
  } catch (err) {
    return { ok: false, reason: 'unserializable' }
  }
  if (json.length > MAX_TEMPLATE_BYTES) return { ok: false, reason: 'too-large' }
  const state = { nodes: 0 }
  const r = sanitizeValue(raw, 0, state)
  if (!r.ok) return r
  const out = r.value
  out.id = id
  if (Array.isArray(out.steps)) out.steps = out.steps.slice(0, 24)
  if (out.layers !== undefined) {
    if (!Array.isArray(out.layers)) return { ok: false, reason: 'bad-layers' }
    for (const layer of out.layers) {
      if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return { ok: false, reason: 'bad-layer' }
      if (layer.type !== undefined && typeof layer.type !== 'string') return { ok: false, reason: 'bad-layer-type' }
    }
  }
  if (out.engine !== undefined && typeof out.engine !== 'string') return { ok: false, reason: 'bad-engine' }
  if (out.engine === 'iframe') {
    if (out.entry !== undefined && (typeof out.entry !== 'string' || !TEMPLATE_ENTRY_RE.test(out.entry))) {
      return { ok: false, reason: 'bad-entry' }
    }
  }
  return { ok: true, value: out }
}

/** 浏览器信任栅栏的 fail-closed 判定：抛错/缺服务一律拒绝；只有明确“放行”才放行。 */
export function guardDecision(code, err) {
  if (err) return { reject: true, status: 403, reason: 'guard-error' }
  if (code === undefined || code === null || code === false) return { reject: false }
  if (typeof code === 'number' && Number.isInteger(code) && code >= 100 && code <= 599) {
    return { reject: true, status: code, reason: code === 401 ? 'unauthorized' : 'request-rejected' }
  }
  return { reject: true, status: 403, reason: 'request-rejected' }
}
