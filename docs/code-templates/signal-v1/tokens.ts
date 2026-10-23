import {Easing, interpolate, random, useCurrentFrame} from 'remotion';

export const VIDEO = {width: 1280, height: 720, fps: 50, frames: 600} as const;
export const sec = (n: number) => Math.round(n * VIDEO.fps);
export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  wipe: Easing.bezier(0.77, 0, 0.175, 1),
  pop: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export const COLOR = {
  bg: '#04080C',
  ink: '#E8F1FF',
  gray: '#6C86A8',
  accent: '#FF7A1A',
} as const;

export const FONT = {
  sans: "Inter, 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono', 'IBM Plex Mono', Consolas, monospace",
} as const;

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
};

export const TL = {
  signal: {start: 0, end: 4.0},
  data: {start: 4.0, end: 8.4},
  outro: {start: 8.4, end: 12.0},
} as const;

export const useG = (startSec: number) => useCurrentFrame() + sec(startSec);

export const ramp = (g: number, a: number, b: number, v0: number, v1: number, easing = EASE.inOut) =>
  interpolate(g, [sec(a), sec(b)], [v0, v1], {easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export const eq = (g: number, t: number) => g <= sec(t);
export const rnd = (seed: string, i = 0) => random(seed + ':' + i);
