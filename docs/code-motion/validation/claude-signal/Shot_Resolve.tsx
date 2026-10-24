import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, COPY, EASE, FONT, TL, VIDEO, clamp01, kf, ramp, rgba, rnd, useG} from './tokens';
import {mono} from './parts';

const W = VIDEO.width, H = VIDEO.height;
const HEX = {cx: 640, cy: 300, r: 78};
const hexPt = (a: number, r = HEX.r) => [HEX.cx + r * Math.cos(a), HEX.cy + r * Math.sin(a)] as const;
// u∈[0,1) 沿六边形周长取点（尖顶朝上，与 SVG 路径顶点一致）
const hexAt = (u: number) => {
  const k = u * 6, i = Math.floor(k) % 6, f = k - Math.floor(k);
  const [x0, y0] = hexPt(-Math.PI / 2 + (i * Math.PI) / 3);
  const [x1, y1] = hexPt(-Math.PI / 2 + ((i + 1) * Math.PI) / 3);
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f] as const;
};
const poly = (n: number, r: number, a0: number) =>
  'M' + Array.from({length: n}, (_, i) => hexPt(a0 + (i * 2 * Math.PI) / n, r).map((v) => v.toFixed(1)).join(' ')).join(' L') + ' Z';
const HEX_D = poly(6, HEX.r, -Math.PI / 2);
const TRI_D = poly(3, 40, -Math.PI / 2);

type Pt = {x0: number; y0: number; tx: number; ty: number; d: number; dur: number; bow: number; a: number; s: number; orange: boolean};
const N = 220; // ASSUMPTION: 粒子数量取预算内的中间值
const PARTS: Pt[] = Array.from({length: N}, (_, i) => {
  const [tx, ty] = hexAt(i / N);
  return {x0: 80 + rnd('px', i) * 1120, y0: 60 + rnd('py', i) * 600, tx, ty, d: rnd('pd', i) * 0.35,
    dur: 0.9 + rnd('pu', i) * 0.3, bow: (rnd('pb', i) - 0.5) * 160, a: 0.45 + rnd('pa', i) * 0.5,
    s: rnd('ps', i) < 0.2 ? 3 : 2, orange: rnd('po', i) < 0.15};
});

// 闭式运动：任意帧直接算出位置，不依赖上一帧；弧线靠垂直方向的正弦偏移
const place = (p: Pt, e: number) => {
  const dx = p.tx - p.x0, dy = p.ty - p.y0, len = Math.hypot(dx, dy) || 1;
  const b = p.bow * Math.sin(Math.PI * e);
  return [p.x0 + dx * e + (-dy / len) * b, p.y0 + dy * e + (dx / len) * b] as const;
};

const draw = (ctx: CanvasRenderingContext2D, g: number) => {
  ctx.clearRect(0, 0, W, H);
  const t = g / VIDEO.fps;
  const vis = ramp(g, 8.5, 8.75, 0, 1) * (1 - ramp(g, 9.9, 10.3, 0, 1));
  if (vis <= 0) return;
  PARTS.forEach((p) => {
    const raw = (t - 8.5 - p.d) / p.dur;
    const e = EASE.out(clamp01(raw));
    ctx.fillStyle = p.orange ? COLOR.orange : COLOR.white;
    if (e > 0.02 && e < 0.98) {
      for (let k = 2; k >= 1; k--) { // 短拖尾
        const [qx, qy] = place(p, EASE.out(clamp01(raw - 0.07 * k)));
        ctx.globalAlpha = (p.a * vis * 0.3) / k;
        ctx.fillRect(qx - p.s / 2, qy - p.s / 2, p.s, p.s);
      }
    }
    const [x, y] = place(p, e);
    ctx.globalAlpha = p.a * vis;
    ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
  });
  ctx.globalAlpha = 1;
};

const row = (y: number, h: number): React.CSSProperties => ({
  position: 'absolute', left: 0, width: W, top: y - h / 2, height: h, display: 'flex', justifyContent: 'center', alignItems: 'center',
});

export const Shot_Resolve: React.FC = () => {
  const g = useG(TL.resolve.start);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) draw(ctx, g);
  }, [g]);

  const flash = kf(g, [[8.4, 0], [8.42, 0.3], [8.65, 0, EASE.out]]); // 闪白峰值 0.3
  const p1 = ramp(g, 9.3, 10.2, 0, 1, EASE.inOut);
  const p2 = ramp(g, 9.7, 10.4, 0, 1, EASE.inOut);
  const dot = ramp(g, 10.3, 10.6, 0, 1, EASE.pop);
  const pop = 1 + 0.04 * (1 - ramp(g, 10.2, 10.8, 0, 1, EASE.out));
  const wipe = ramp(g, 10.1, 10.7, 0, 1, EASE.wipe);
  const sub = ramp(g, 10.5, 10.9, 0, 1, EASE.out);
  const rule = ramp(g, 10.7, 11.0, 0, 1, EASE.out);
  const dom = ramp(g, 10.9, 11.2, 0, 1, EASE.out);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0}} />

      {/* 几何标记：六边形 + 内三角 + 圆心点，pathLength 描边 */}
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <g style={{transformOrigin: `${HEX.cx}px ${HEX.cy}px`, transform: `scale(${pop})`}}>
          <path d={HEX_D} fill="none" stroke={COLOR.orange} strokeWidth={9} opacity={0.12 * p1}
            pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p1} />
          <path d={HEX_D} fill="none" stroke={COLOR.orange} strokeWidth={2}
            pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p1} />
          <path d={TRI_D} fill="none" stroke={COLOR.white} strokeWidth={1.5}
            pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p2} />
          {Array.from({length: 6}, (_, i) => {
            const [vx, vy] = hexPt(-Math.PI / 2 + (i * Math.PI) / 3);
            return <circle key={i} cx={vx} cy={vy} r={3} fill={COLOR.white} opacity={clamp01(p1 * 6 - i)} />;
          })}
          <circle cx={HEX.cx} cy={HEX.cy} r={3 * dot} fill={COLOR.orange} />
        </g>
      </svg>

      {/* 标题：wipe 揭开。paddingLeft 抵消末尾字距，保证视觉居中 */}
      <div style={row(470, 120)}>
        <div style={{fontFamily: FONT.sans, fontWeight: 600, fontSize: 88, letterSpacing: '0.3em', paddingLeft: '0.3em',
          color: COLOR.white, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`, opacity: wipe > 0 ? 1 : 0}}>
          {COPY.title}
        </div>
      </div>
      <div style={{...row(540, 30), ...mono(20, rgba(COLOR.steel, 0.95), 0.22), opacity: sub, transform: `translateY(${(1 - sub) * 8}px)`}}>
        {COPY.sub}
      </div>
      <div style={{position: 'absolute', left: 608, top: 577, width: 64, height: 1, background: COLOR.orange,
        transform: `scaleX(${rule})`, opacity: 0.9}} />
      <div style={{...row(612, 24), ...mono(16, rgba(COLOR.white, 0.6), 0.12), opacity: dom}}>{COPY.domain}</div>

      <AbsoluteFill style={{background: COLOR.white, opacity: flash}} />
    </AbsoluteFill>
  );
};
