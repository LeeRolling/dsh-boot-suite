import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, FONT, TL, ramp, rgba, useG} from './tokens';
import {Crosshair, Grid, Hud, Line, Ticks} from './parts';

export const Shot_Signal: React.FC = () => {
  const g = useG(TL.signal.start);
  const grid = ramp(g, 0, 0.8, 0, 0.9);
  const dot = 0.35 + 0.35 * Math.sin((g / 50) * Math.PI);
  const line = ramp(g, 1.1, 2.1, 0, 1, undefined);
  const ticks = ramp(g, 1.2, 2.3, 0, 1, undefined);
  const cross = ramp(g, 2.2, 2.8, 0, 1);
  const typed = Math.min(17, Math.floor(ramp(g, 2.6, 3.5, 0, 17)));
  const sub = 'SIGNAL ACQUIRED'.slice(0, typed);
  const flash = Math.max(0, 1 - Math.abs(g - 3.55 * 50) / 6);

  return (
    <AbsoluteFill style={{background: COLOR.bg, overflow: 'hidden'}}>
      <Grid opacity={grid * 0.8} />
      <div style={{
        position: 'absolute', left: 640 - 3, top: 360 - 3, width: 6, height: 6, borderRadius: 3,
        background: COLOR.accent, opacity: dot, boxShadow: '0 0 24px ' + rgba(COLOR.accent, 0.8),
      }} />
      <Line width={720} y={360} reveal={line} />
      <Ticks count={13} reveal={ticks} y={360} />
      <Crosshair size={120} progress={cross} />
      <div style={{
        position: 'absolute', left: 640, top: 430, transform: 'translateX(-50%)',
        fontFamily: FONT.mono, fontSize: 12, letterSpacing: '0.3em', color: COLOR.ink,
        opacity: ramp(g, 2.4, 2.8, 0, 1),
      }}>{sub}<span style={{opacity: g % 16 < 8 ? 1 : 0}}>_</span></div>
      <Hud text="SIGNAL // ACQUIRE" x={28} y={26} />
      <Hud text="NODE 07" x={1252} y={26} align="right" />
      <Hud text="LAT 31.23 N" x={28} y={686} />
      <Hud text="TC 00:00:0" x={1252} y={686} align="right" />
      <div style={{position: 'absolute', inset: 0, background: COLOR.ink, opacity: flash * 0.35, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
