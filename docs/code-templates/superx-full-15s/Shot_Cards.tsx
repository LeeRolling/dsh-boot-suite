import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, EASE, TL, VIDEO, kf, ramp, rgba, rnd, useG} from './tokens';
import {Glow, XMark} from './parts';

type Kind = 'tweet' | 'video';
type C = {id: string; x: number; y: number; w: number; h: number; kind: Kind; t: number};

// 世界坐标：x 为绝对像素，y 为相对画面中心的偏移（镜头 cam=1 时）
const col = (id: string, x: number, kind: Kind, w: number, h: number, ys: number[], ts: number[]): C[] =>
  ys.map((y, i) => ({id: `${id}${i}`, x, y, w, h, kind, t: ts[i]}));

// ASSUMPTION: 列位置、尺寸和出现时间由 8.0–10.0s 的帧图估算，墙的最终形态是近似
const CARDS: C[] = [
  ...col('b', 335, 'tweet', 283, 190, [-205, 0, 205], [8.02, 7.9, 8.06]), // b1 是首张聚焦卡
  ...col('v', 950, 'video', 245, 410, [0], [8.15]),
  ...col('c', -45, 'video', 230, 380, [-400, 0, 400], [9.0, 9.05, 9.1]),
  ...col('d', 1314, 'video', 230, 380, [-400, 0, 400], [9.1, 9.15, 9.2]),
  ...col('e', 950, 'video', 245, 410, [-430, 430], [9.2, 9.25]),
  ...col('f', -420, 'tweet', 250, 170, [-190, 0, 190], [9.35, 9.4, 9.45]),
  ...col('h', 1650, 'tweet', 250, 170, [-190, 0, 190], [9.4, 9.45, 9.5]),
];

const bar = (l: number, t: number, w: number, h: number, a: number): React.CSSProperties => ({
  position: 'absolute', left: l, top: t, width: w, height: h, borderRadius: h / 2, background: rgba(COLOR.ink, a),
});

const CardBody: React.FC<{c: C; edgeOp: number}> = ({c, edgeOp}) => (
  <div style={{
    position: 'relative', width: c.w, height: c.h, borderRadius: 16, overflow: 'hidden',
    background: rgba(COLOR.ink, c.kind === 'video' ? 0.05 : 0.065),
    border: `1px solid ${edgeOp > 0.12 ? rgba(COLOR.ember, edgeOp) : rgba(COLOR.ink, 0.1)}`,
    boxShadow: `0 18px 40px rgba(0,0,0,.5)${edgeOp > 0.5 ? `, 0 0 40px ${rgba(COLOR.ember, 0.25)}` : ''}`,
  }}>
    {c.kind === 'tweet' ? (
      <>
        <div style={{...bar(16, 16, 36, 36, 0.14), borderRadius: '50%'}} />
        <div style={bar(62, 20, 120, 8, 0.22)} />
        <div style={bar(62, 36, 84, 6, 0.1)} />
        <XMark size={12} style={{position: 'absolute', right: 16, top: 18, opacity: 0.55}} />
        <div style={{position: 'absolute', left: 16, right: 16, top: 72, height: c.h - 112,
          background: `repeating-linear-gradient(180deg, ${rgba(COLOR.ink, 0.14)} 0, ${rgba(COLOR.ink, 0.14)} 6px, transparent 6px, transparent 16px)`}} />
        <div style={{position: 'absolute', left: 16, bottom: 14, width: 170, height: 8,
          background: `repeating-linear-gradient(90deg, ${rgba(COLOR.ink, 0.14)} 0, ${rgba(COLOR.ink, 0.14)} 20px, transparent 20px, transparent 48px)`}} />
      </>
    ) : (
      <>
        <div style={{position: 'absolute', left: '50%', top: '46%', marginLeft: -10, marginTop: -18, width: 0, height: 0,
          borderLeft: `28px solid ${rgba(COLOR.ink, 0.3)}`, borderTop: '18px solid transparent', borderBottom: '18px solid transparent'}} />
        <div style={bar(16, c.h - 48, 140, 8, 0.2)} />
        <div style={bar(16, c.h - 30, 90, 6, 0.1)} />
      </>
    )}
  </div>
);

const CardView: React.FC<{c: C; g: number; slide: number}> = ({c, g, slide}) => {
  const k = ramp(g, c.t, c.t + 0.5, 0, 1, EASE.out);
  if (k <= 0) return null;
  const a = rnd(c.id, 1), b = rnd(c.id, 2), d = rnd(c.id, 3);
  const baseX = c.id.startsWith('b') ? 640 + (335 - 640) * slide : c.x; // 首列先在中间，再左滑
  const fromX = c.id === 'v0' ? 260 : (a - 0.5) * 520;
  const fromY = c.id === 'v0' ? 420 : (b - 0.5) * 520;
  const s = g / VIDEO.fps;
  const x = baseX + (1 - k) * fromX + Math.sin(s * 0.9 + d * 6.28) * 6; // 到位后缓慢漂移
  const y = c.y + (1 - k) * fromY + Math.cos(s * 0.7 + d * 6.28) * 5;
  const rz = (1 - k) * (a - 0.5) * 40 + (c.kind === 'video' ? 3 : 0);
  const ry = (1 - k) * (b - 0.5) * 50 + (d - 0.5) * 8;
  const focusOp = c.id === 'b1' ? 0.8 - 0.6 * ramp(g, 9.0, 9.6, 0, 1) : rnd(c.id, 4) < 0.25 ? 0.35 : 0;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: c.w, height: c.h, opacity: k,
      transform: `translate3d(${x - c.w / 2}px, ${360 + y - c.h / 2}px, 0) rotateZ(${rz}deg) rotateY(${ry}deg) scale(${0.86 + 0.14 * k})`}}>
      <CardBody c={c} edgeOp={focusOp} />
    </div>
  );
};

const QUAD = [[-1, -1, 'inset(0 50% 50% 0)'], [1, -1, 'inset(0 0 50% 50%)'], [-1, 1, 'inset(50% 50% 0 0)'], [1, 1, 'inset(50% 0 0 50%)']] as const;

export const Shot_Cards: React.FC = () => {
  const g = useG(TL.cards.start);

  // 7.5–8.05s：X 光晕 → 四块外飞 + 光环
  const pre = 1 - ramp(g, 7.6, 7.64, 0, 1);
  const burst = ramp(g, 7.6, 7.64, 0, 1) * (1 - 0.9 * ramp(g, 7.7, 8.05, 0, 1));
  const dist = ramp(g, 7.6, 8.05, 0, 120, EASE.out);
  const ringR = ramp(g, 7.6, 8.05, 130, 300, EASE.out);
  const ringOp = 0.5 * (1 - 0.8 * ramp(g, 7.7, 8.1, 0, 1));
  const halo = 0.5 * (1 - ramp(g, 7.6, 7.95, 0, 1));
  const haze = 0.14 * (1 - ramp(g, 9.3, 10.2, 0, 1));

  const cam = kf(g, [[7.5, 1], [8.9, 1], [10.0, 0.62, EASE.inOut]]); // 8.9–10.0s 拉远成墙
  const slide = ramp(g, 8.2, 8.55, 0, 1, EASE.inOut);
  const groupOp = 1 - ramp(g, 10.15, 10.45, 0, 1, EASE.inOut);

  return (
    <AbsoluteFill>
      <Glow x={640} y={360} rx={520} ry={300} a={haze} />
      <Glow x={640} y={360} rx={150} a={halo} />

      <XMark size={180} fillOp={0.1} edge={0.85} style={{position: 'absolute', left: 550, top: 270, opacity: pre}} />
      {QUAD.map(([qx, qy, clip], i) => (
        <XMark key={i} size={180} fillOp={0.1} edge={0.85}
          style={{position: 'absolute', left: 550 + qx * dist, top: 270 + qy * dist, clipPath: clip, opacity: burst}} />
      ))}
      <div style={{position: 'absolute', left: 640 - ringR, top: 360 - ringR, width: ringR * 2, height: ringR * 2,
        borderRadius: '50%', border: `1px solid ${rgba(COLOR.ember, ringOp)}`}} />
      <div style={{position: 'absolute', left: 578, top: 400, width: 4, height: 4, borderRadius: '50%',
        background: COLOR.ink, boxShadow: `0 0 12px ${COLOR.ember}`, opacity: 1 - ramp(g, 7.5, 7.65, 0, 1)}} />

      <div style={{position: 'absolute', left: 0, top: 0, width: VIDEO.width, height: VIDEO.height,
        transform: `scale(${cam})`, transformOrigin: '640px 360px', perspective: 1600, perspectiveOrigin: '640px 360px',
        opacity: groupOp}}>
        {CARDS.map((c) => <CardView key={c.id} c={c} g={g} slide={slide} />)}
      </div>
    </AbsoluteFill>
  );
};
