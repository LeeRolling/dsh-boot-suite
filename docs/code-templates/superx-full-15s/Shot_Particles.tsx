import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, EASE, TL, VIDEO, ramp, rgba, rnd, useG} from './tokens';
import {Glow, XMark} from './parts';

const W = VIDEO.width, H = VIDEO.height, CX = 640, CY = 360;
const T0 = 10.15, TB0 = 11.45, TB1 = 12.0; // 出现 / 漩涡开始 / 漩涡结束（秒）

type P = {x0: number; y0: number; vx: number; vy: number; s: number; w: number; red: boolean; a: number; sw: number};
const N = 240; // ASSUMPTION: 数量由帧图估计
const PARTS: P[] = Array.from({length: N}, (_, i) => {
  const ang = rnd('an', i) * Math.PI * 2, sp = 12 + rnd('sp', i) * 55;
  return {
    x0: 150 + rnd('x', i) * 980, y0: 70 + rnd('y', i) * 580,
    vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
    s: 9 + rnd('s', i) ** 2 * 22, w: (rnd('w', i) - 0.5) * 2.4,
    red: rnd('r', i) < 0.13, a: 0.4 + rnd('a', i) * 0.5, sw: Math.PI * 2.4 * (1 + 0.35 * rnd('sw', i)),
  };
});
const REDS = PARTS.map((p, i) => (p.red ? i : -1)).filter((i) => i >= 0);

const drawX = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, color: string, alpha: number) => {
  if (alpha <= 0.005) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.16);
  ctx.beginPath();
  ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2);
  ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2);
  ctx.stroke();
  ctx.restore();
};

// 闭式运动：任意帧可直接算出位置，不依赖上一帧
const draw = (ctx: CanvasRenderingContext2D, g: number) => {
  ctx.clearRect(0, 0, W, H);
  const t = g / VIDEO.fps;
  const appear = ramp(g, T0, 10.5, 0, 1, EASE.out);
  if (appear <= 0) return;
  const e = EASE.inOut(ramp(g, TB0, TB1, 0, 1));
  const grow = 0.7 + 0.5 * ramp(g, 10.3, 11.3, 0, 1);

  const place = (p: P, ee: number) => {
    if (ee <= 0) return {x: p.x0 + p.vx * (t - T0), y: p.y0 + p.vy * (t - T0)};
    const dx = p.x0 + p.vx * (TB0 - T0) - CX, dy = p.y0 + p.vy * (TB0 - T0) - CY;
    const r = Math.hypot(dx, dy) * (1 - ee), a = Math.atan2(dy, dx) + p.sw * ee;
    return {x: CX + r * Math.cos(a), y: CY + r * Math.sin(a)};
  };

  // 红色粒子之间的细线（星座感）
  const lineA = 0.22 * appear * ramp(g, 10.7, 11.0, 0, 1) * (1 - ramp(g, 11.45, 11.7, 0, 1));
  if (lineA > 0) {
    ctx.strokeStyle = COLOR.ember; ctx.lineWidth = 1; ctx.globalAlpha = lineA;
    for (let j = 0; j < REDS.length - 1; j++) {
      const a = place(PARTS[REDS[j]], 0), b = place(PARTS[REDS[j + 1]], 0);
      if (Math.hypot(a.x - b.x, a.y - b.y) < 420) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
  }

  PARTS.forEach((p) => {
    const col = p.red ? COLOR.ember : COLOR.ink;
    const fade = 1 - ramp(g, 11.9, 12.0, 0, 1);
    const alpha = p.a * appear * fade;
    const s = p.s * grow * (1 - 0.65 * e);
    const rot = p.w * (t - T0) + e * p.sw * 0.5;
    if (e > 0.15) for (let k = 3; k >= 1; k--) { // 漩涡拖尾
      const q = place(p, Math.max(0, e - 0.04 * k));
      drawX(ctx, q.x, q.y, s, rot, col, (alpha * 0.35) / k);
    }
    const q = place(p, e);
    drawX(ctx, q.x, q.y, s, rot, col, alpha);
  });

  // 中心光核
  const coreA = ramp(g, 11.6, 11.95, 0, 1, EASE.inOut) * (1 - ramp(g, 12.0, 12.3, 0, 1));
  if (coreA > 0) {
    const R = 40 + 90 * ramp(g, 11.6, 12.0, 0, 1);
    const gr = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
    gr.addColorStop(0, rgba(COLOR.ink, 0.9 * coreA));
    gr.addColorStop(0.25, rgba(COLOR.ember, 0.7 * coreA));
    gr.addColorStop(1, rgba(COLOR.ember, 0));
    ctx.globalAlpha = 1; ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
};

export const Shot_Particles: React.FC = () => {
  const g = useG(TL.particles.start);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) draw(ctx, g);
  }, [g]);

  // 12.0s 起的小 X：先亮后暗，带红边
  const xOp = ramp(g, 11.92, 12.0, 0, 1) * (1 - ramp(g, 12.45, 12.7, 0, 1));
  return (
    <AbsoluteFill>
      <Glow x={640} y={360} rx={420} a={0.06 + 0.08 * ramp(g, 11.4, 12.0, 0, 1)} />
      <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0}} />
      <XMark size={100} fillOp={ramp(g, 12.0, 12.3, 0.55, 0.08)} edge={ramp(g, 12.0, 12.4, 0.5, 0.85)}
        sweep={{pos: 0.12, op: 1 - ramp(g, 12.0, 12.5, 0, 1)}}
        style={{position: 'absolute', left: 590, top: 310, opacity: xOp}} />
    </AbsoluteFill>
  );
};
