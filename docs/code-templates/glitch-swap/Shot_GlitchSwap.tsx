import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLOR, EASE, FONT, sec} from './tokens';

const SLICES = 6;
const TEXT_H = 72;
const PAD = 24;
const TEXT_W = 420;
const PEAK = 22;
const GLITCH = {start: 0.8, dur: 0.45};

export const Shot_GlitchSwap: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();

  const g0 = sec(GLITCH.start, fps);
  const g1 = g0 + sec(GLITCH.dur, fps);
  const gm = Math.round((g0 + g1) / 2);
  const inWindow = f >= g0 && f < g1;

  const word = f >= gm ? '=  ?' : '=  VOGUE';
  const amp = inWindow
    ? interpolate(f, [g0, gm, g1], [0, PEAK, 0], {easing: EASE.inOut})
    : 0;
  const tick = Math.floor(f / 2);

  const scale = interpolate(f, [0, sec(0.35, fps)], [0.96, 1], {
    easing: EASE.out,
    extrapolateRight: 'clamp',
  });

  const layer = (color: string, dx: number) => (
    <div
      style={{
        position: 'absolute',
        left: PAD,
        top: 0,
        color,
        mixBlendMode: 'screen',
        whiteSpace: 'pre',
        transform: `translateX(${dx}px)`,
      }}
    >
      {word}
    </div>
  );

  const h = TEXT_H / SLICES;

  return (
    <AbsoluteFill style={{background: COLOR.bg, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 28, transform: `scale(${scale})`}}>
        <div
          style={{
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: 120,
            lineHeight: 1,
            color: COLOR.x,
            textShadow: `0 0 40px ${COLOR.x}55, 0 0 90px ${COLOR.x}22`,
          }}
        >
          X
        </div>

        <div
          style={{
            position: 'relative',
            width: TEXT_W,
            height: TEXT_H,
            marginLeft: -PAD,
            fontFamily: FONT.mono,
            fontSize: 78,
            lineHeight: `${TEXT_H}px`,
            whiteSpace: 'pre',
          }}
        >
          <span style={{visibility: 'hidden', marginLeft: PAD}}>{word}</span>

          {Array.from({length: SLICES}, (_, i) => {
            const shift = Math.round((random(`slice-${i}-${tick}`) - 0.5) * 2 * amp);
            const split = Math.round(amp * 0.6);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  inset: 0,
                  isolation: 'isolate',
                  clipPath: `inset(${i * h}px 0 ${TEXT_H - (i + 1) * h}px 0)`,
                  transform: `translateX(${shift}px)`,
                  filter: `blur(${amp > 0 ? 1 : 0}px)`,
                }}
              >
                <div style={{position: 'absolute', inset: 0, background: COLOR.bg}} />
                {layer(COLOR.r, -split)}
                {layer(COLOR.g, 0)}
                {layer(COLOR.b, split)}
              </div>
            );
          })}
        </div>
      </div>

      {f === gm && <AbsoluteFill style={{background: COLOR.white, opacity: 0.22}} />}
    </AbsoluteFill>
  );
};
