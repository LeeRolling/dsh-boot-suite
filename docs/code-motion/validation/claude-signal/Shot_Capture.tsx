import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, COPY, EASE, FONT, TL, VIDEO, ramp, rgba, useG} from './tokens';
import {mono} from './parts';

// ASSUMPTION: 节点坐标、刻度尺位置是我自己定的构图，不对应任何参考。
const NODES: ReadonlyArray<readonly [number, number]> = [[220, 468], [380, 438], [540, 492], [700, 452], [860, 500], [1020, 462]];
const BASE_Y = 548, RX0 = 160, RX1 = 1120;
const POLY = NODES.map((n) => `${n[0]},${n[1]}`).join(' ');
const TICKS = (() => {
  let d = '';
  for (let x = RX0, i = 0; x <= RX1; x += 16, i++) d += `M${x} ${BASE_Y}v${i % 5 === 0 ? -14 : -6}`;
  return d;
})();
const LABELS = Array.from({length: 7}, (_, i) => ({x: RX0 + i * 160, t: String(i * 20).padStart(3, '0')}));

const along = (u: number): readonly [number, number] => {
  const t = Math.min(0.9999, Math.max(0, u)) * (NODES.length - 1);
  const i = Math.floor(t), f = t - i;
  const a = NODES[i], b = NODES[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
};
const typed = (g: number, a: number, b: number, s: string) =>
  s.slice(0, Math.floor(ramp(g, a, b, 0, s.length + 0.999)));

export const Shot_Capture: React.FC = () => {
  const g = useG(TL.capture.start);
  const out = 1 - ramp(g, 4.0, 4.5, 0, 1);
  const rulerP = ramp(g, 0.5, 1.7, 0, 1, EASE.out);
  const lineP = ramp(g, 0.9, 2.1, 0, 1, EASE.out);
  const u = ramp(g, 2.0, 3.7, 0, 1, EASE.inOut);
  const runnerOp = ramp(g, 1.95, 2.05, 0, 1);

  const line1 = typed(g, 1.5, 2.7, COPY.typed1);
  const line2 = typed(g, 2.9, 3.7, COPY.typed2);
  const typing = (g >= 75 && g < 135) || (g >= 145 && g < 185); // 1.5–2.7s、2.9–3.7s
  const cursorOn = g >= 60 && (typing || Math.floor(g / 25) % 2 === 0); // 1.2s 起出现，停打后每 0.5s 闪
  const onLine2 = g >= 145;
  const cursor = (
    <span style={{display: 'inline-block', width: 10, height: 18, marginLeft: 4, verticalAlign: '-3px',
      background: COLOR.orange, opacity: cursorOn ? 1 : 0}} />
  );

  return (
    <AbsoluteFill style={{opacity: out}}>
      {/* 刻度尺：整块左→右 clip 揭开 */}
      <div style={{position: 'absolute', inset: 0, clipPath: `inset(0px ${(1 - rulerP) * VIDEO.width}px 0px 0px)`}}>
        <svg width={VIDEO.width} height={VIDEO.height} style={{position: 'absolute', left: 0, top: 0}}>
          <line x1={RX0} y1={BASE_Y} x2={RX1} y2={BASE_Y} stroke={rgba(COLOR.steel, 0.6)} strokeWidth={1} />
          <path d={TICKS} fill="none" stroke={rgba(COLOR.steel, 0.6)} strokeWidth={1} />
          {LABELS.map((l) => (
            <text key={l.t} x={l.x} y={BASE_Y + 24} fill={rgba(COLOR.steel, 0.7)} textAnchor="middle"
              style={{fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.1em'}}>{l.t}</text>
          ))}
        </svg>
      </div>

      {/* 点 + 线 + 垂线 + 跑动的橙点 */}
      <svg width={VIDEO.width} height={VIDEO.height} style={{position: 'absolute', left: 0, top: 0}}>
        {NODES.map(([x, y], i) => {
          const k = ramp(g, 0.9 + 0.24 * i, 1.1 + 0.24 * i, 0, 1, EASE.pop);
          const kOp = ramp(g, 0.9 + 0.24 * i, 1.0 + 0.24 * i, 0, 1);
          return (
            <g key={i} opacity={kOp}>
              <line x1={x} y1={y} x2={x} y2={BASE_Y} stroke={rgba(COLOR.steel, 0.3)} strokeWidth={1} strokeDasharray="2 4" />
              <circle cx={x} cy={y} r={9 * k} fill="none" stroke={rgba(COLOR.steel, 0.5)} strokeWidth={1} />
              <circle cx={x} cy={y} r={4 * k} fill={COLOR.white} />
            </g>
          );
        })}
        <polyline points={POLY} fill="none" stroke={rgba(COLOR.steel, 0.75)} strokeWidth={1}
          pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - lineP} />
        {[3, 2, 1, 0].map((k) => {
          const [tx, ty] = along(u - 0.035 * k);
          return <circle key={k} cx={tx} cy={ty} r={k === 0 ? 5 : 4 - k * 0.6} fill={COLOR.orange}
            opacity={runnerOp * (k === 0 ? 1 : 0.35 / k)} />;
        })}
        <circle cx={along(u)[0]} cy={along(u)[1]} r={12} fill="none" stroke={rgba(COLOR.orange, 0.35)} strokeWidth={1} opacity={runnerOp} />
      </svg>

      {/* 打字机 */}
      <div style={{position: 'absolute', left: 160, top: 596, ...mono(18, rgba(COLOR.white, 0.85), 0.08)}}>
        <div style={{height: 30}}>{line1}{!onLine2 && cursor}</div>
        <div style={{height: 30}}>{onLine2 && <>{line2}{cursor}</>}</div>
      </div>
    </AbsoluteFill>
  );
};
