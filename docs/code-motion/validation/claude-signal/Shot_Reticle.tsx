import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, EASE, FONT, TL, VIDEO, pad, ramp, rgba, useG} from './tokens';
import {reticleState} from './parts';

const GAP = 22;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

// 跨镜头主角：捕获段是准星，4.0s 起平移成雷达中心，8.3–8.5s 在闪白处消失
export const Shot_Reticle: React.FC = () => {
  const g = useG(TL.reticle.start);
  const s = reticleState(g);
  const draw = ramp(g, 0.3, 1.1, 0, 1, EASE.out);
  const out = 1 - ramp(g, 8.3, 8.5, 0, 1);

  let ticks = '';
  for (let i = 0; i < 36; i++) {
    const a = (i * 10 * Math.PI) / 180;
    const r0 = s.ring + 4, r1 = r0 + (i % 9 === 0 ? 12 : 5);
    ticks += `M${(s.cx + r0 * Math.sin(a)).toFixed(1)} ${(s.cy - r0 * Math.cos(a)).toFixed(1)}L${(s.cx + r1 * Math.sin(a)).toFixed(1)} ${(s.cy - r1 * Math.cos(a)).toFixed(1)}`;
  }
  const label = s.lock > 0.5 ? 'LOCKED' : 'SEEKING';

  return (
    <AbsoluteFill style={{opacity: out}}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{position: 'absolute', left: 0, top: 0}}>
        {DIRS.map(([dx, dy], i) => (
          <line key={i} x1={s.cx + dx * GAP} y1={s.cy + dy * GAP}
            x2={s.cx + dx * (GAP + (s.arm - GAP) * draw)} y2={s.cy + dy * (GAP + (s.arm - GAP) * draw)}
            stroke={COLOR.white} strokeWidth={1} opacity={0.8} />
        ))}
        <circle cx={s.cx} cy={s.cy} r={s.ring} fill="none" stroke={COLOR.white} strokeWidth={1.2}
          pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} opacity={0.9 * (1 - s.lock)} />
        <circle cx={s.cx} cy={s.cy} r={s.ring} fill="none" stroke={COLOR.orange} strokeWidth={1.6}
          pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} opacity={s.lock} />
        <path d={ticks} fill="none" stroke={rgba(COLOR.steel, 0.8)} strokeWidth={1} opacity={draw} />
        <circle cx={s.cx} cy={s.cy} r={2} fill={COLOR.orange} opacity={draw} />
        <text x={s.cx + s.ring + 16} y={s.cy - s.ring - 8} fill={rgba(COLOR.steel, 0.85)} opacity={draw}
          style={{fontFamily: FONT.mono, fontSize: 12, letterSpacing: '0.12em'}}>
          {`X ${pad(s.cx, 4)}  Y ${pad(s.cy, 4)}`}
        </text>
        <text x={s.cx + s.ring + 16} y={s.cy - s.ring + 8} fill={s.lock > 0.5 ? COLOR.orange : rgba(COLOR.steel, 0.85)} opacity={draw}
          style={{fontFamily: FONT.mono, fontSize: 12, letterSpacing: '0.12em'}}>
          {label}
        </text>
      </svg>
    </AbsoluteFill>
  );
};
