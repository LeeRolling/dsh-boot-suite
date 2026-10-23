import React, {useId} from 'react';
import {COLOR, EQ, FONT, VIDEO, rgba} from './tokens';

// 原创几何：一粗一细两条斜杠，粗条压在细条上留缝（不是任何官方标志的描摹）
const THICK = '3,4 25,4 97,96 75,96';
const THIN = '92,4 81,4 4,96 15,96';
const c01 = (v: number) => Math.min(1, Math.max(0, v));

export type XMarkProps = {
  size: number;
  fill?: string;
  fillOp?: number; // 填充整体不透明度（用 <g opacity>，避免交叉处叠加变亮）
  edge?: number; // 0–1：常亮红边
  sweep?: {pos: number; op: number}; // 沿粗条方向扫过的亮边，pos 0–1
  style?: React.CSSProperties;
};

export const XMark: React.FC<XMarkProps> = ({size, fill = COLOR.ink, fillOp = 1, edge = 0, sweep, style}) => {
  const gid = `xg${useId().replace(/:/g, '')}`;
  const p = sweep ? sweep.pos : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible', display: 'block', ...style}}>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="3" y1="4" x2="97" y2="96">
          <stop offset={c01(p - 0.2)} stopColor={COLOR.ember} stopOpacity={0} />
          <stop offset={c01(p - 0.03)} stopColor={COLOR.ember} stopOpacity={1} />
          <stop offset={c01(p)} stopColor={COLOR.ink} stopOpacity={1} />
          <stop offset={c01(p + 0.03)} stopColor={COLOR.ember} stopOpacity={0} />
        </linearGradient>
      </defs>
      <g opacity={fillOp}>
        <polygon points={THIN} fill={fill} />
        <polygon points={THICK} fill={fill} stroke={COLOR.bg} strokeWidth={3} paintOrder="stroke" />
      </g>
      {edge > 0 &&
        [THIN, THICK].map((pts) => (
          <polygon key={`e${pts}`} points={pts} fill="none" stroke={COLOR.ember} strokeWidth={1.5}
            vectorEffect="non-scaling-stroke" opacity={edge} />
        ))}
      {sweep && sweep.op > 0 &&
        [THICK, THIN].map((pts) => (
          <polygon key={`s${pts}`} points={pts} fill="none" stroke={`url(#${gid})`} strokeWidth={2.5}
            vectorEffect="non-scaling-stroke" opacity={sweep.op} />
        ))}
    </svg>
  );
};

// 原创火焰图标（两条 path），不依赖 emoji 字体
export const Flame: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{display: 'block'}}>
    <path d="M50 3 C56 22 80 33 80 62 C80 82 66 97 50 97 C34 97 20 82 20 62 C20 47 29 39 35 29 C37 38 43 43 47 43 C45 29 45 16 50 3 Z" fill={COLOR.ember} />
    <path d="M50 46 C56 58 67 63 67 77 C67 88 59 95 50 95 C41 95 33 88 33 77 C33 65 44 59 50 46 Z" fill={COLOR.ink} opacity={0.55} />
  </svg>
);

export const Glow: React.FC<{x: number; y: number; rx: number; ry?: number; a: number}> = ({x, y, rx, ry, a}) => {
  const h = ry ?? rx;
  return (
    <div style={{
      position: 'absolute', left: x - rx, top: y - h, width: rx * 2, height: h * 2, borderRadius: '50%',
      background: `radial-gradient(closest-side, ${rgba(COLOR.ember, Math.max(0, a))}, ${rgba(COLOR.ember, 0)})`,
      pointerEvents: 'none',
    }} />
  );
};

// 等式里的文字：绝对定位 + 垂直居中
export const eqText = (left: number): React.CSSProperties => ({
  position: 'absolute', left, top: 0, height: VIDEO.height, display: 'flex', alignItems: 'center',
  fontFamily: FONT.sans, fontWeight: 600, fontSize: EQ.fs, color: COLOR.ink, letterSpacing: '-0.02em', whiteSpace: 'pre',
});
