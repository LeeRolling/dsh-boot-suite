import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, FONT, TL, ramp, rgba, useG} from './tokens';
import {Grid, Hud, Mark, Ring} from './parts';

const PARTICLES = 90;

export const Shot_Outro: React.FC = () => {
  const g = useG(TL.outro.start);
  const ringP = ramp(g, 0, 1.4, 0, 1);
  const sweep = (g / 50) * 0.55;
  const markDraw = ramp(g, 1.0, 2.2, 0, 1, undefined);
  const glow = ramp(g, 1.2, 2.6, 0, 1);
  const typed = Math.min(7, Math.floor(ramp(g, 1.8, 2.6, 0, 7)));
  const title = 'SIGNAL.'.slice(0, typed);
  const sub = ramp(g, 2.7, 3.2, 0, 1);
  const domain = ramp(g, 3.1, 3.5, 0, 1);

  return (
    <AbsoluteFill style={{background: COLOR.bg, overflow: 'hidden'}}>
      <Grid opacity={0.25} />
      <Ring r={210} progress={Math.min(1, ringP)} sweep={sweep} />
      <Ring r={150} progress={Math.min(1, ringP * 1.15)} sweep={sweep + 0.18} />
      {Array.from({length: PARTICLES}, (_, i) => {
        const a = (i / PARTICLES) * Math.PI * 2;
        const d = ramp(g, 0.4 + (i % 10) * 0.02, 2.0 + (i % 10) * 0.02, 560, 54);
        const op = ramp(g, 1.8, 2.6, 0.7, 0.25);
        return (
          <div key={i} style={{
            position: 'absolute', left: 640 + Math.cos(a) * d - 1.5, top: 360 + Math.sin(a) * d - 1.5,
            width: 3, height: 3, background: COLOR.accent, opacity: op,
          }} />
        );
      })}
      <Mark size={260} draw={markDraw} glow={glow} />
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center',
        fontFamily: FONT.sans, fontWeight: 700, fontSize: 64, letterSpacing: '0.02em', color: COLOR.ink,
        opacity: ramp(g, 1.8, 2.1, 0, 1),
      }}>{title}</div>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 556, textAlign: 'center',
        fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.34em', color: COLOR.accent, opacity: sub,
      }}>READY FOR CONNECTION</div>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 596, textAlign: 'center',
        fontFamily: FONT.mono, fontSize: 9, letterSpacing: '0.28em', color: COLOR.gray, opacity: domain,
      }}>SIGNAL.ZONE</div>
      <Hud text="SIGNAL // LOCK" x={28} y={26} />
      <Hud text="END OF STREAM" x={1252} y={26} align="right" />
    </AbsoluteFill>
  );
};
