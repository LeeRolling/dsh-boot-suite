import React from 'react';
import {COLOR, FONT, VIDEO, rgba} from './tokens';

export const Grid: React.FC<{opacity: number}> = ({opacity}) => (
  <div style={{
    position: 'absolute', inset: 0, opacity,
    backgroundImage:
      'linear-gradient(' + rgba(COLOR.gray, 0.12) + ' 1px, transparent 1px),' +
      'linear-gradient(90deg,' + rgba(COLOR.gray, 0.12) + ' 1px, transparent 1px)',
    backgroundSize: '64px 64px',
    maskImage: 'radial-gradient(circle at 50% 50%, #000 20%, transparent 78%)',
    WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 20%, transparent 78%)',
  }} />
);

export const Crosshair: React.FC<{progress: number; size: number}> = ({progress, size}) => (
  <svg width={size * 2} height={size * 2} style={{position: 'absolute', left: 640 - size, top: 360 - size, overflow: 'visible'}}>
    <circle cx={size} cy={size} r={size * 0.5} fill="none" stroke={COLOR.gray} strokeWidth={1}
      strokeDasharray={4} strokeDashoffset={32} opacity={0.5 * progress} />
    <line x1={size} y1={size - size * 0.62} x2={size} y2={size - size * 0.38} stroke={COLOR.ink} strokeWidth={1.5} opacity={progress} />
    <line x1={size} y1={size + size * 0.38} x2={size} y2={size + size * 0.62} stroke={COLOR.ink} strokeWidth={1.5} opacity={progress} />
    <line x1={size - size * 0.62} y1={size} x2={size - size * 0.38} y2={size} stroke={COLOR.ink} strokeWidth={1.5} opacity={progress} />
    <line x1={size + size * 0.38} y1={size} x2={size + size * 0.62} y2={size} stroke={COLOR.ink} strokeWidth={1.5} opacity={progress} />
  </svg>
);

export const Line: React.FC<{width: number; y: number; reveal: number; color?: string}> = ({width, y, reveal, color}) => (
  <div style={{
    position: 'absolute', left: 640 - width * reveal / 2, top: y, width: width * reveal, height: 1,
    background: color || rgba(COLOR.ink, 0.55),
  }} />
);

export const Ticks: React.FC<{count: number; reveal: number; y: number}> = ({count, reveal, y}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: VIDEO.width, height: VIDEO.height}}>
    {Array.from({length: count}, (_, i) => {
      const x = 640 + (i - (count - 1) / 2) * 56;
      return <div key={i} style={{
        position: 'absolute', left: x, top: y - 6, width: 1, height: 12,
        background: COLOR.gray, opacity: i / count < reveal ? 0.9 : 0,
      }} />;
    })}
  </div>
);

export const Hud: React.FC<{text: string; x: number; y: number; align?: 'left' | 'right' | 'center'}> = ({text, x, y, align}) => (
  <div style={{
    position: 'absolute', left: x, top: y, transform: align === 'right' ? 'translateX(-100%)' : align === 'center' ? 'translateX(-50%)' : 'none',
    fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.24em', color: COLOR.gray, whiteSpace: 'pre',
  }}>{text}</div>
);

export const Mark: React.FC<{size: number; draw: number; glow: number}> = ({size, draw, glow}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{position: 'absolute', left: 640 - size / 2, top: 360 - size / 2, overflow: 'visible'}}>
    <polygon points="50,4 96,50 50,96 4,50" fill="none" stroke={COLOR.accent} strokeWidth={2.5}
      strokeDasharray={300} strokeDashoffset={300 * (1 - draw)} opacity={glow} />
    <polygon points="50,22 78,50 50,78 22,50" fill={rgba(COLOR.accent, 0.16 * glow)} />
    <circle cx={50} cy={50} r={3} fill={COLOR.accent} opacity={glow} />
  </svg>
);

export const Ring: React.FC<{r: number; progress: number; sweep: number}> = ({r, progress, sweep}) => (
  <svg width={r * 2 + 20} height={r * 2 + 20} style={{position: 'absolute', left: 640 - r - 10, top: 360 - r - 10, overflow: 'visible'}}>
    <circle cx={r + 10} cy={r + 10} r={r} fill="none" stroke={COLOR.gray} strokeWidth={1}
      strokeDasharray={Math.PI * 2 * r} strokeDashoffset={Math.PI * 2 * r * (1 - progress)} opacity={0.7} />
    <line x1={r + 10} y1={r + 10} x2={r + 10 + Math.cos(sweep * Math.PI * 2) * r} y2={r + 10 + Math.sin(sweep * Math.PI * 2) * r}
      stroke={COLOR.accent} strokeWidth={1.5} opacity={progress > 0.2 ? 0.9 : 0} />
  </svg>
);

export const Bar: React.FC<{x: number; y: number; width: number; value: number; label: string}> = ({x, y, width, value, label}) => (
  <div style={{position: 'absolute', left: x, top: y, width}}>
    <div style={{position: 'absolute', top: -16, left: 0, fontFamily: FONT.mono, fontSize: 9, letterSpacing: '0.18em', color: COLOR.gray}}>{label}</div>
    <div style={{width: '100%', height: 2, background: rgba(COLOR.gray, 0.25)}} />
    <div style={{width: width * value, height: 2, marginTop: -2, background: COLOR.accent}} />
  </div>
);
