import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, COPY, EASE, EQ, FONT, TL, VIDEO, kf, ramp, rgba, useG} from './tokens';
import {Glow, XMark, eqText} from './parts';

export const Shot_Intro: React.FC = () => {
  const g = useG(TL.intro.start);

  // X 尺寸（px），在对数空间插值。ASSUMPTION: 0s 约 2000px，1.8s 前缓慢拉远，之后落定到 215px。
  const size = Math.exp(kf(g, [
    [0, Math.log(2000)],
    [1.8, Math.log(1500)],
    [2.5, Math.log(520), EASE.inOut],
    [3.2, Math.log(215), EASE.out],
  ]));

  // 3.85–4.0s：红 X 缩成等式里的白 X，并左移到 EQ.xLeft
  const m = ramp(g, 3.85, 4.0, 0, 1, EASE.out);
  const hs = size * (1 - m) + EQ.xSize * m;
  const hx = 640 + (EQ.xLeft + EQ.xSize / 2 - 640) * m;
  const heroOp = 1 - ramp(g, 3.85, 3.95, 0, 1);
  const whiteOp = ramp(g, 3.88, 4.0, 0, 1);

  // 边缘光：沿粗条左下边缘从 p=0.38 扫到 0.8（线性），光斑跟随
  const p = ramp(g, 0, 2.4, 0.38, 0.8);
  const sweepOp = 1 - ramp(g, 2.3, 3.0, 0, 1);
  const edge = ramp(g, 0, 3.2, 0.15, 0.65);
  const gx = 640 + (3 + 72 * p - 50) * size / 100;
  const gy = 360 + (4 + 92 * p - 50) * size / 100;
  const glowR = Math.min(340, Math.max(70, size * 0.1));
  const haze = 0.08 + 0.1 * ramp(g, 2.4, 3.2, 0, 1);

  // 等式擦出：「= Twitter」整体左→右 clip，带 6px 模糊收敛
  const rv = ramp(g, 3.88, 4.05, 0, 1, EASE.out);
  const clipRight = EQ.eqLeft + (EQ.wordRight - EQ.eqLeft) * rv;

  const capOut = ramp(g, 4.8, 4.98, 0, 1, EASE.inOut);

  return (
    <AbsoluteFill>
      <Glow x={640} y={350} rx={520} ry={260} a={haze} />
      <Glow x={gx} y={gy} rx={glowR} a={0.34 * sweepOp} />

      <XMark size={hs} fillOp={0.07} edge={edge} sweep={{pos: p, op: sweepOp}}
        style={{position: 'absolute', left: hx - hs / 2, top: 360 - hs / 2, opacity: heroOp}} />
      <XMark size={hs} fillOp={1}
        style={{position: 'absolute', left: hx - hs / 2, top: 360 - hs / 2, opacity: whiteOp}} />

      <div style={{position: 'absolute', inset: 0, opacity: rv > 0 ? 1 : 0,
        clipPath: `inset(0px ${VIDEO.width - clipRight}px 0px 0px)`, filter: `blur(${(1 - rv) * 6}px)`}}>
        <div style={eqText(EQ.eqLeft)}>=</div>
        <div style={eqText(EQ.wordLeft)}>{COPY.eqWord}</div>
      </div>

      {/* 副句：3.0–3.6s 逐词模糊入场，4.8–4.98s 淡出 */}
      <div style={{position: 'absolute', left: 0, width: VIDEO.width, top: 505, height: 40, display: 'flex',
        justifyContent: 'center', alignItems: 'center', gap: '0.3em', fontFamily: FONT.sans, fontWeight: 500,
        fontSize: 25, color: rgba(COLOR.ink, 0.62), opacity: 1 - capOut, filter: `blur(${capOut * 6}px)`}}>
        {COPY.caption.map((w, k) => {
          const r = ramp(g, 3.0 + 0.075 * k, 3.2 + 0.075 * k, 0, 1, EASE.out);
          return (
            <span key={k} style={{opacity: r, filter: `blur(${(1 - r) * 8}px)`, display: 'inline-flex', alignItems: 'center'}}>
              {w === 'X' ? <XMark size={22} /> : w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
