import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {COLOR, TL, sec} from './tokens';
import {Backdrop} from './parts';
import {Shot_Capture} from './Shot_Capture';
import {Shot_Analyze} from './Shot_Analyze';
import {Shot_Reticle} from './Shot_Reticle';
import {Shot_Resolve} from './Shot_Resolve';

const seq = (s: {start: number; end: number}) => ({from: sec(s.start), durationInFrames: sec(s.end) - sec(s.start)});

// 1280×720 / 50fps / 600 帧。层序：底→顶
export const Main: React.FC = () => (
  <AbsoluteFill style={{background: COLOR.bg, overflow: 'hidden'}}>
    <Backdrop />
    <Sequence {...seq(TL.capture)}><Shot_Capture /></Sequence>
    <Sequence {...seq(TL.analyze)}><Shot_Analyze /></Sequence>
    <Sequence {...seq(TL.reticle)}><Shot_Reticle /></Sequence>
    <Sequence {...seq(TL.resolve)}><Shot_Resolve /></Sequence>
  </AbsoluteFill>
);

// <Composition id="Main" component={Main} width={1280} height={720} fps={50} durationInFrames={600} />
