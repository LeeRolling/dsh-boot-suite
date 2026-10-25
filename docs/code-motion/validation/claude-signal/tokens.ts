import {Easing, interpolate, random, useCurrentFrame} from 'remotion';

export const VIDEO = {width: 1280, height: 720, fps: 50, frames: 600} as const;
export const sec = (n: number, fps: number = VIDEO.fps) => Math.round(n * fps);

export type Ease = (x: number) => number;
export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  wipe: Easing.bezier(0.77, 0, 0.175, 1),
  pop: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;
// ASSUMPTION: 匀速运动（打字、扫描、网格漂移）不属于四种曲线，等于「不加缓动」。
export const LINEAR: Ease = (x) => x;

// 4 色：深底 / 亮白 / 灰蓝 / 橙；其余都是它们的透明度变体
export const COLOR = {bg: '#07090C', white: '#F2F5F7', steel: '#7F95A8', orange: '#FF6A2B'} as const;
export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// 2 个字体族：几何无衬线 + 等宽。ASSUMPTION: 只用本机字体栈，不联网。
export const FONT = {
  sans: "Inter, 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace",
} as const;

// 占位文案，公开发布前请替换
export const COPY = {
  typed1: '> ACQUIRING SIGNAL',
  typed2: '> LOCKING TARGET',
  title: 'SIGNAL',
  sub: 'DETECT · DECODE · DELIVER',
  domain: 'signal.example',
  hud: 'SIGNAL // INTRO',
} as const;

// 镜头区间（秒）。刻意重叠，让交界处元素自己淡出，而不是被 Sequence 硬切。
export const TL = {
  capture: {start: 0, end: 4.6},
  analyze: {start: 4.0, end: 8.9},
  reticle: {start: 0, end: 8.6},
  resolve: {start: 8.3, end: 12},
} as const;

// Sequence 内 useCurrentFrame 是局部帧，这里还原成全局帧，时间常量就都能写全局秒
export const useG = (startSec: number) => useCurrentFrame() + sec(startSec);

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const pad = (n: number, w: number) => String(Math.max(0, Math.round(n))).padStart(w, '0');

export const ramp = (g: number, a: number, b: number, v0: number, v1: number, easing: Ease = LINEAR) =>
  interpolate(g, [sec(a), sec(b)], [v0, v1], {easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

// 分段关键帧：[秒, 值, 进入该 key 的缓动?]，秒必须严格递增且相邻至少 1 帧
export type Key = readonly [number, number, Ease?];
export const kf = (g: number, keys: ReadonlyArray<Key>): number => {
  if (g <= sec(keys[0][0])) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (g <= sec(keys[i][0])) {
      return interpolate(g, [sec(keys[i - 1][0]), sec(keys[i][0])], [keys[i - 1][1], keys[i][1]], {
        easing: keys[i][2] ?? LINEAR,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }
  return keys[keys.length - 1][1];
};

// 确定性随机：只用 Remotion 的 random(seed)，没有 Math.random
export const rnd = (seed: string, i = 0) => random(`${seed}:${i}`);
export const tickOf = (g: number, every = 2) => Math.floor(g / every);
