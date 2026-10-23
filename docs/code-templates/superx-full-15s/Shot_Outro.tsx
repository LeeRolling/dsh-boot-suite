import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, COPY, EASE, FONT, TL, VIDEO, ramp, rgba, useG} from './tokens';
import {Flame, Glow, XMark} from './parts';

const row = (y: number, h: number): React.CSSProperties => ({
  position: 'absolute', left: 0, width: VIDEO.width, top: y - h / 2, height: h,
  display: 'flex', justifyContent: 'center', alignItems: 'center',
});

export const Shot_Outro: React.FC = () => {
  const g = useG(TL.outro.start);
  const lk = ramp(g, 12.55, 12.85, 0, 1, EASE.out);
  const flash = 0.07 * (1 - ramp(g, 12.5, 12.8, 0, 1)); // 12.6s 那格偏亮的闪
  const streak = ramp(g, 12.95, 13.25, 0, 1) * (0.65 + 0.15 * Math.sin((g / VIDEO.fps) * 2.2));
  const soon = ramp(g, 13.85, 14.05, 0, 1, EASE.out);
  const dom = ramp(g, 14.1, 14.5, 0, 1, EASE.out);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: rgba(COLOR.ink, flash)}} />
      <Glow x={640} y={200} rx={560} ry={220} a={0.14 * ramp(g, 12.5, 13.0, 0, 1)} />

      {/* 锁标 */}
      <div style={{...row(195, 110), opacity: lk, filter: `blur(${(1 - lk) * 14}px)`, transform: `scale(${1.06 - 0.06 * lk})`,
        gap: 14, fontFamily: FONT.sans, fontWeight: 600, fontSize: 84, color: COLOR.ink, letterSpacing: '-0.02em'}}>
        <Flame size={92} />
        <span>{COPY.lockup}</span>
      </div>
      <div style={{position: 'absolute', left: 835, top: 168, width: 90, height: 3, transform: 'rotate(-38deg)',
        background: `linear-gradient(90deg, transparent, ${rgba(COLOR.ink, 0.8)}, transparent)`, opacity: streak}} />

      {/* 副句：13.0–13.5s 逐词模糊入场 */}
      <div style={{...row(343, 80), gap: '0.28em', fontFamily: FONT.sans, fontWeight: 500, fontSize: 58, color: COLOR.ink}}>
        {COPY.line2.map((w, k) => {
          const r = ramp(g, 13.0 + 0.08 * k, 13.22 + 0.08 * k, 0, 1, EASE.out);
          return (
            <span key={k} style={{display: 'inline-flex', alignItems: 'center', opacity: r,
              filter: `blur(${(1 - r) * 10}px)`, transform: `translateY(${(1 - r) * 8}px)`}}>
              {w === 'X' ? <XMark size={52} /> : w}
            </span>
          );
        })}
      </div>

      <div style={{...row(460, 130), fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 96, color: COLOR.ink,
        opacity: soon, filter: `blur(${(1 - soon) * 12}px)`, transform: `scale(${1.05 - 0.05 * soon})`}}>
        {COPY.soon}
      </div>

      <div style={{...row(566, 30), fontFamily: FONT.sans, fontWeight: 500, fontSize: 20, letterSpacing: '0.08em',
        color: COLOR.ash, opacity: 0.6 * dom, filter: `blur(${(1 - dom) * 4}px)`}}>
        {COPY.domain}
      </div>
    </AbsoluteFill>
  );
};
