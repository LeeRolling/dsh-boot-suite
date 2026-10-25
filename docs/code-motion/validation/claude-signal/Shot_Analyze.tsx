import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, EASE, TL, VIDEO, clamp01, kf, pad, ramp, rgba, rnd, tickOf, useG} from './tokens';
import {GlitchText, mono, reticleState} from './parts';

const P = {x: 90, y: 185, w: 400, h: 350};
const WN = 90, WW = 360, WH = 130;

const wave = (g: number, env: number, phase: number, k: number) =>
  Array.from({length: WN}, (_, i) => {
    const t = g / VIDEO.fps;
    const y = WH / 2 + env * 46 * (
      Math.sin(i * 0.31 + t * 5 * k + phase) * 0.55 + Math.sin(i * 0.87 - t * 8) * 0.25 + (rnd(`w${phase}`, i) - 0.5) * 0.35);
    return `${((i / (WN - 1)) * WW).toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

// 第 0 个光点固定，是最终被框住的目标；其余由种子决定
const BLIPS = Array.from({length: 6}, (_, i) =>
  i === 0 ? {a: 40, d: 95} : {a: rnd('ba', i) * 360, d: (0.25 + 0.7 * rnd('bd', i)) * 150});

export const Shot_Analyze: React.FC = () => {
  const g = useG(TL.analyze.start);
  const t = g / VIDEO.fps;
  const ex = ramp(g, 8.55, 8.85, 0, 1, EASE.inOut);
  const k = ramp(g, 4.1, 4.95, 0, 1, EASE.out);          // 面板翻入
  const p = ramp(g, 4.7, 7.8, 0, 1, EASE.out);           // 进度 0→1
  const pc = 0.87 * p;                                   // 实际填充比例，终点 87%
  const count = Math.round(pc * 100);
  const env = ramp(g, 4.5, 6.2, 0.25, 1, EASE.out);
  const amp = kf(g, [[8.25, 0], [8.3, 14, EASE.out], [8.5, 14], [8.62, 0]]); // 计数故障窗口
  const tick = tickOf(g, 2);

  const {cx, cy} = reticleState(g);
  const theta = (t - 4.8) * 180;                          // 匀速 180°/s
  const rScale = ramp(g, 4.6, 5.4, 0.4, 1, EASE.out);
  const rOp = ramp(g, 4.6, 5.2, 0, 1);
  const sweepOp = ramp(g, 4.9, 5.3, 0, 1);
  const lockK = ramp(g, 7.6, 7.95, 0, 1, EASE.pop);
  const headX = WW * pc;

  const blipXY = (b: {a: number; d: number}) => {
    const r = (b.a * Math.PI) / 180;
    return [cx + b.d * Math.sin(r), cy - b.d * Math.cos(r)] as const;
  };

  return (
    <AbsoluteFill style={{opacity: 1 - ex}}>
      {/* 3D 面板 */}
      <div style={{position: 'absolute', inset: 0, perspective: 1400, perspectiveOrigin: `${P.x + P.w / 2}px 360px`}}>
        <div style={{position: 'absolute', left: P.x, top: P.y, width: P.w, height: P.h, transformOrigin: 'left center',
          transform: `rotateY(${(1 - k) * -84}deg)`, opacity: ramp(g, 4.1, 4.3, 0, 1),
          background: rgba(COLOR.white, 0.035), border: `1px solid ${rgba(COLOR.steel, 0.45)}`,
          boxShadow: `0 0 40px ${rgba(COLOR.steel, 0.08)}`}}>
          {/* 翻入时扫过的高光 */}
          <div style={{position: 'absolute', inset: 0,
            background: `linear-gradient(105deg, transparent ${k * 100 - 30}%, ${rgba(COLOR.white, 0.1 * (1 - k))} ${k * 100}%, transparent ${k * 100 + 30}%)`}} />
          <div style={{position: 'absolute', left: 20, top: 16, ...mono(13, rgba(COLOR.white, 0.85))}}>SIG-0087</div>
          <div style={{position: 'absolute', right: 20, top: 16, display: 'flex', alignItems: 'center', gap: 8, ...mono(12)}}>
            <span style={{width: 6, height: 6, borderRadius: '50%', background: COLOR.orange}} />LIVE
          </div>
          {/* 波形 */}
          <svg width={WW} height={WH} style={{position: 'absolute', left: 20, top: 48}}>
            <line x1={0} y1={WH / 2} x2={WW} y2={WH / 2} stroke={rgba(COLOR.steel, 0.3)} strokeDasharray="3 5" />
            <polyline points={wave(g, env, 2.1, 0.7)} fill="none" stroke={rgba(COLOR.steel, 0.5)} strokeWidth={1} />
            <polyline points={wave(g, env, 0, 1)} fill="none" stroke={rgba(COLOR.white, 0.9)} strokeWidth={1.5} />
            <line x1={headX} y1={0} x2={headX} y2={WH} stroke={COLOR.orange} strokeWidth={1} opacity={sweepOp} />
          </svg>
          {/* 计数 */}
          <div style={{position: 'absolute', left: 20, top: 190}}>
            <GlitchText text={`${pad(count, 2)}%`} w={240} h={96} size={84} amp={amp} tick={tick} seed="cnt" />
          </div>
          <div style={{position: 'absolute', right: 20, top: 236, ...mono(11)}}>LOCK RATIO</div>
          {/* 进度条 */}
          <div style={{position: 'absolute', left: 20, top: 302, width: WW, height: 2, background: rgba(COLOR.steel, 0.3)}}>
            <div style={{width: headX, height: 2, background: COLOR.white}} />
            <div style={{position: 'absolute', left: headX - 1, top: -4, width: 2, height: 10, background: COLOR.orange}} />
          </div>
          <svg width={WW} height={8} style={{position: 'absolute', left: 20, top: 308}}>
            <path d={Array.from({length: 11}, (_, i) => `M${i * 36} 0v${i % 5 === 0 ? 7 : 4}`).join('')}
              stroke={rgba(COLOR.steel, 0.5)} strokeWidth={1} fill="none" />
          </svg>
          <div style={{position: 'absolute', left: 20, top: 322, ...mono(11)}}>ANALYZING</div>
          <div style={{position: 'absolute', right: 20, top: 322, ...mono(11, COLOR.orange), opacity: ramp(g, 7.8, 7.95, 0, 1)}}>LOCK 87</div>
        </div>
      </div>

      {/* 雷达：中心跟随准星 */}
      <svg width={VIDEO.width} height={VIDEO.height} style={{position: 'absolute', left: 0, top: 0}}>
        {[50, 100, 150].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r * rScale} fill="none" stroke={rgba(COLOR.steel, 0.28)} strokeWidth={1} opacity={rOp} />
        ))}
        <line x1={cx} y1={cy} x2={cx + 150 * Math.sin((theta * Math.PI) / 180)} y2={cy - 150 * Math.cos((theta * Math.PI) / 180)}
          stroke={COLOR.orange} strokeWidth={1} opacity={sweepOp * 0.9} />
        {BLIPS.map((b, i) => {
          const [bx, by] = blipXY(b);
          const delta = (((theta - b.a) % 360) + 360) % 360;
          let inten = g >= 250 ? Math.exp(-delta / 110) : 0; // 5.0s 起才有回波
          if (i === 0) inten = Math.max(inten, 0.9 * clamp01(lockK));
          return (
            <g key={i} opacity={clamp01(inten)}>
              <circle cx={bx} cy={by} r={3} fill={COLOR.orange} />
              <circle cx={bx} cy={by} r={8} fill="none" stroke={rgba(COLOR.orange, 0.5)} strokeWidth={1} />
            </g>
          );
        })}
        {(() => {
          const [bx, by] = blipXY(BLIPS[0]);
          const s = 18 + 10 * (1 - lockK); // 锁定框由大到小收紧
          const c = 7;
          const d = `M${bx - s} ${by - s + c}V${by - s}H${bx - s + c} M${bx + s - c} ${by - s}H${bx + s}V${by - s + c} M${bx - s} ${by + s - c}V${by + s}H${bx - s + c} M${bx + s - c} ${by + s}H${bx + s}V${by + s - c}`;
          return <path d={d} fill="none" stroke={COLOR.orange} strokeWidth={1.5} opacity={clamp01(lockK)} />;
        })()}
      </svg>
      <div style={{position: 'absolute', left: cx - 150, top: cy - 150, width: 300, height: 300, borderRadius: '50%',
        opacity: sweepOp,
        background: `conic-gradient(from ${theta - 70}deg, ${rgba(COLOR.orange, 0)} 0deg, ${rgba(COLOR.orange, 0.32)} 69deg, ${rgba(COLOR.orange, 0)} 70deg, ${rgba(COLOR.orange, 0)} 360deg)`}} />
    </AbsoluteFill>
  );
};
