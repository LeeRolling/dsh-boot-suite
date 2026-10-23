import {Easing, interpolate, random, useCurrentFrame} from 'remotion';

export const VIDEO = {width: 1280, height: 720, fps: 50, frames: 750} as const;
export const sec = (n: number, fps: number = VIDEO.fps) => Math.round(n * fps);

export type Ease = (x: number) => number;
export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  wipe: Easing.bezier(0.77, 0, 0.175, 1),
  pop: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;
// ASSUMPTION: 匀速的扫描/漂移不属于四种曲线，等于「不加缓动」，统一用 LINEAR。
export const LINEAR: Ease = (x) => x;

// 4 色：背景 / 火红 / 墨白 / 灰；其余都是它们的透明度变体
export const COLOR = {bg: '#050403', ember: '#E2553A', ink: '#F4F1EE', ash: '#8C8681'} as const;
export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// 2 个字体族。ASSUMPTION: 只用本机字体栈，不联网；没装 Instrument Serif 时回退 Georgia 斜体。
export const FONT = {
  sans: "Inter, 'Helvetica Neue', Arial, sans-serif",
  serif: "'Instrument Serif', 'Playfair Display', Georgia, serif",
} as const;

// 文案集中放这里，作为占位文案，公开发布前请替换。
export const COPY = {
  caption: ['You', 'thought', 'the', 'X', 'meant', 'one', 'thing.'],
  eqWord: 'Twitter',
  lockup: 'SuperX',
  line2: ['X', 'was', 'never', 'just', 'one.'],
  soon: 'Soon.',
  domain: 'superx.so',
} as const;

// 等式布局（1280×720 坐标，由帧图反推）
export const EQ = {fs: 118, cy: 360, xSize: 100, xLeft: 320, eqLeft: 473, wordLeft: 573, wordRight: 977} as const;

export const TL = {
  intro: {start: 0, end: 5.0},
  glitch: {start: 5.0, end: 7.5},
  cards: {start: 7.5, end: 10.5},
  particles: {start: 10.0, end: 12.7},
  outro: {start: 12.5, end: 15.0},
} as const;

// 全局帧（Sequence 内 useCurrentFrame 是局部帧，这里还原成全局）
export const useG = (startSec: number) => useCurrentFrame() + sec(startSec);

export const ramp = (g: number, a: number, b: number, v0: number, v1: number, easing: Ease = LINEAR) =>
  interpolate(g, [sec(a), sec(b)], [v0, v1], {easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

// 分段关键帧：每个 key = [秒, 值, 进入该 key 的缓动?]，相邻 key 至少相隔 1 帧
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

// 确定性随机（Remotion random，种子固定，无 Math.random）
export const rnd = (seed: string, i = 0) => random(`${seed}:${i}`);
export const tickOf = (g: number, every = 2) => Math.floor(g / every);
