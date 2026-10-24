import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLOR, EASE, FONT, VIDEO, clamp01, pad, ramp, rgba, rnd, sec} from './tokens';

export const mono = (size: number, color: string = rgba(COLOR.steel, 0.8), ls = 0.12): React.CSSProperties => ({
  fontFamily: FONT.mono, fontSize: size, color, letterSpacing: `${ls}em`, whiteSpace: 'pre', fontWeight: 400,
});

// 全程常驻层：网格 + 暗角 + 四角括号 + HUD。放在 Sequence 之外，所以 useCurrentFrame 是全局帧。
export const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const gridOp = ramp(f, 0, 1.0, 0, 1, EASE.out);
  const hud = ramp(f, 0.2, 0.9, 0, 1, EASE.out);
  const drift = f * 0.1; // 匀速缓漂，让静态网格有「活的」感觉
  const major = rgba(COLOR.steel, 0.1);
  const minor = rgba(COLOR.steel, 0.045);
  const mask = 'radial-gradient(ellipse 70% 65% at 50% 45%, #000 25%, transparent 100%)';
  const ss = Math.floor(f / VIDEO.fps) % 60;
  const ff = f % VIDEO.fps;
  const phase = f < sec(4) ? '01 CAPTURE' : f < sec(8.4) ? '02 ANALYZE' : '03 RESOLVE';
  const bracket = rgba(COLOR.steel, 0.55);

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: gridOp,
          backgroundImage: `linear-gradient(${major} 1px, transparent 1px), linear-gradient(90deg, ${major} 1px, transparent 1px), linear-gradient(${minor} 1px, transparent 1px), linear-gradient(90deg, ${minor} 1px, transparent 1px)`,
          backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px',
          backgroundPosition: `${-drift}px ${-drift}px`,
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      />
      <AbsoluteFill
        style={{background: `radial-gradient(ellipse at 50% 50%, ${rgba(COLOR.bg, 0)} 55%, ${rgba(COLOR.bg, 0.8)} 100%)`}}
      />
      <svg width={VIDEO.width} height={VIDEO.height} style={{position: 'absolute', left: 0, top: 0, opacity: hud}}>
        <path d="M28 56 V28 H56 M1224 28 H1252 V56 M28 664 V692 H56 M1252 664 V692 H1224"
          fill="none" stroke={bracket} strokeWidth={1} />
      </svg>
      <div style={{position: 'absolute', left: 44, top: 38, opacity: hud, ...mono(12)}}>{COPY_HUD}</div>
      <div style={{position: 'absolute', right: 44, top: 38, opacity: hud, ...mono(12)}}>
        {`00:00:${pad(ss, 2)}:${pad(ff, 2)}`}
      </div>
      <div style={{position: 'absolute', left: 44, bottom: 38, opacity: hud, ...mono(12, rgba(COLOR.steel, 0.5))}}>
        1280×720 · 50FPS
      </div>
      <div style={{position: 'absolute', right: 44, bottom: 38, opacity: hud, ...mono(12)}}>{phase}</div>
    </AbsoluteFill>
  );
};
const COPY_HUD = 'SIGNAL // INTRO';

// 准星状态：捕获段在 (640,300)，4.0–4.8s 平移到 (900,340) 成为雷达中心；3.4–3.75s 锁定
export const reticleState = (g: number) => {
  const mv = ramp(g, 4.0, 4.8, 0, 1, EASE.inOut);
  const lock = ramp(g, 3.4, 3.75, 0, 1, EASE.pop); // pop 会过冲，仅用于尺寸；透明度用 clamp 版
  return {cx: 640 + 260 * mv, cy: 300 + 40 * mv, arm: 130 + 40 * mv, ring: 70 - 24 * lock, lock: clamp01(lock)};
};

// 切片故障字：4 条横向切片 + 橙/灰蓝重影 + 白色主层。amp<=0 时只渲染干净白字，保证静帧干净。
export const GlitchText: React.FC<{
  text: string; w: number; h: number; size: number; amp: number; tick: number; seed: string;
}> = ({text, w, h, size, amp, tick, seed}) => {
  const base: React.CSSProperties = {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', fontFamily: FONT.sans, fontWeight: 600,
    fontSize: size, lineHeight: 1, whiteSpace: 'pre', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
  };
  if (amp <= 0) {
    return <div style={{position: 'relative', width: w, height: h}}><div style={{...base, color: COLOR.white}}>{text}</div></div>;
  }
  const S = 4; // h 必须能被 4 整除，切片边界才是整数像素
  const sh = h / S;
  const split = Math.round(amp * 0.18);
  return (
    <div style={{position: 'relative', width: w, height: h}}>
      {Array.from({length: S}, (_, i) => {
        const shift = Math.round((rnd(`${seed}${i}`, tick) - 0.5) * 2 * amp);
        return (
          <div key={i} style={{position: 'absolute', inset: 0,
            clipPath: `inset(${i * sh}px 0 ${h - (i + 1) * sh}px 0)`, transform: `translateX(${shift}px)`}}>
            <div style={{...base, color: COLOR.orange, opacity: 0.85, transform: `translateX(${-split}px)`}}>{text}</div>
            <div style={{...base, color: COLOR.steel, opacity: 0.85, transform: `translateX(${split}px)`}}>{text}</div>
            <div style={{...base, color: COLOR.white}}>{text}</div>
          </div>
        );
      })}
    </div>
  );
};
