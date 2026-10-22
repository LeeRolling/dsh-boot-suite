import {Easing} from 'remotion';

export const VIDEO = {width: 1280, height: 720, fps: 50, frames: 110} as const;

export const sec = (n: number, fps: number = VIDEO.fps) => Math.round(n * fps);

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  wipe: Easing.bezier(0.77, 0, 0.175, 1),
  pop: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export const COLOR = {
  bg: '#050303',
  black: '#000000',
  x: '#A83A26',
  white: '#FFFFFF',
  r: '#FF2D55',
  g: '#22FF88',
  b: '#00E5FF',
} as const;

export const FONT = {
  sans: "Inter, 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace",
} as const;
