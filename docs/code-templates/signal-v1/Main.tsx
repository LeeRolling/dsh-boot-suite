import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {COLOR, TL, sec} from './tokens';
import {Shot_Signal} from './Shot_Signal';
import {Shot_Data} from './Shot_Data';
import {Shot_Outro} from './Shot_Outro';

const seq = (s: {start: number; end: number}) => ({from: sec(s.start), durationInFrames: sec(s.end) - sec(s.start)});

export const SignalMain: React.FC = () => (
  <AbsoluteFill style={{background: COLOR.bg, overflow: 'hidden'}}>
    <Sequence {...seq(TL.signal)}><Shot_Signal /></Sequence>
    <Sequence {...seq(TL.data)}><Shot_Data /></Sequence>
    <Sequence {...seq(TL.outro)}><Shot_Outro /></Sequence>
  </AbsoluteFill>
);
