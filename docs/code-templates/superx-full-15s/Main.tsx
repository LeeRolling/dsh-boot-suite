import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {COLOR, TL, sec} from './tokens';
import {Shot_Intro} from './Shot_Intro';
import {Shot_Glitch} from './Shot_Glitch';
import {Shot_Cards} from './Shot_Cards';
import {Shot_Particles} from './Shot_Particles';
import {Shot_Outro} from './Shot_Outro';

const seq = (s: {start: number; end: number}) => ({from: sec(s.start), durationInFrames: sec(s.end) - sec(s.start)});

// 1280×720 / 50fps / 750 帧
export const Main: React.FC = () => (
  <AbsoluteFill style={{background: COLOR.bg, overflow: 'hidden'}}>
    <Sequence {...seq(TL.intro)}><Shot_Intro /></Sequence>
    <Sequence {...seq(TL.glitch)}><Shot_Glitch /></Sequence>
    <Sequence {...seq(TL.cards)}><Shot_Cards /></Sequence>
    <Sequence {...seq(TL.particles)}><Shot_Particles /></Sequence>
    <Sequence {...seq(TL.outro)}><Shot_Outro /></Sequence>
  </AbsoluteFill>
);
