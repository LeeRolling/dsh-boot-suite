import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, FONT, TL, ramp, rgba, useG} from './tokens';
import {Bar, Hud} from './parts';

export const Shot_Data: React.FC = () => {
  const g = useG(TL.data.start);
  const p = ramp(g, 0, 0.9, 0, 1);
  const ry = 72 * (1 - p);
  const rx = 18 * (1 - p);
  const scale = 0.92 + 0.08 * p;
  const typed = Math.min(8, Math.floor(ramp(g, 0.8, 1.6, 0, 8)));
  const head = 'SAMPLING'.slice(0, typed);
  const num = Math.round(ramp(g, 1.0, 2.2, 0, 87));
  const b1 = ramp(g, 1.6, 2.8, 0, 0.92);
  const b2 = ramp(g, 1.9, 3.1, 0, 0.64);
  const b3 = ramp(g, 2.2, 3.4, 0, 0.38);
  const glitch = g > 3.2 * 50 && g < 3.5 * 50;
  const stripe = glitch ? 3 : 0;
  const stripes = [0, 1, 2].map((i) => (
    <div key={i} style={{
      position: 'absolute', inset: 0,
      clipPath: 'inset(' + (i * 100 + stripe * 2) + 'px 0 ' + (300 - (i + 1) * 100 - stripe) + 'px 0)',
      transform: 'translateX(' + (glitch ? (i % 2 === 0 ? -6 : 6) : 0) + 'px)',
      border: '1px solid ' + (i === 0 ? rgba(COLOR.accent, 0.8) : rgba(COLOR.ink, 0.12)),
    }} />
  ));

  return (
    <AbsoluteFill style={{background: COLOR.bg, overflow: 'hidden'}}>
      <div style={{
        position: 'absolute', left: 640, top: 360, width: 560, height: 320,
        transform: 'translate(-50%,-50%) perspective(1200px) rotateY(' + ry + 'deg) rotateX(' + rx + 'deg) scale(' + scale + ')',
        background: 'linear-gradient(145deg,' + rgba(COLOR.ink, 0.07) + ',' + rgba(COLOR.bg, 0.9) + ')',
        border: '1px solid ' + rgba(COLOR.gray, 0.5),
      }}>
        {stripes}
        <div style={{padding: '22px 26px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <div style={{fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.28em', color: COLOR.ink}}>{head}</div>
            <div style={{fontFamily: FONT.mono, fontSize: 34, color: COLOR.accent}}>{num}%</div>
          </div>
          <div style={{marginTop: 26, display: 'flex', flexDirection: 'column', gap: 18}}>
            {[
              ['STREAM A', b1], ['STREAM B', b2], ['STREAM C', b3],
            ].map(([label, v], i) => (
              <div key={i} style={{position: 'relative', height: 28}}>
                <Bar x={0} y={24} width={500} value={Number(v)} label={String(label)} />
              </div>
            ))}
          </div>
          <div style={{marginTop: 22, fontFamily: FONT.mono, fontSize: 9, letterSpacing: '0.22em', color: COLOR.gray}}>
            VERIFYING STREAM INTEGRITY
          </div>
        </div>
      </div>
      <Hud text="DATA // ANALYSIS" x={28} y={26} />
      <Hud text="87%" x={1252} y={26} align="right" />
      <Hud text="CH 03" x={28} y={686} />
    </AbsoluteFill>
  );
};
