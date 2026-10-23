import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLOR, COPY, EASE, EQ, FONT, TL, kf, ramp, rgba, rnd, sec, tickOf, useG} from './tokens';
import {Glow, XMark, eqText} from './parts';

const ORIG = COPY.eqWord;
const POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789$%&#@/+<>';

// 乱码：每个字符以概率 p 被替换；后两位只在乱码时出现（文字会「变宽」）
const scramble = (layer: number, tick: number, p: number, on: boolean) =>
  Array.from({length: 9}, (_, j) => {
    const k = tick * 16 + j;
    const hit = on && rnd(`m${layer}`, k) < (j < ORIG.length ? p : p * 0.6);
    if (hit) return POOL[Math.floor(rnd(`p${layer}`, k) * POOL.length)];
    return j < ORIG.length ? ORIG[j] : '';
  }).join('');

export const Shot_Glitch: React.FC = () => {
  const g = useG(TL.glitch.start);
  const tick = tickOf(g, 2); // 25Hz 阶梯

  // —— 位置 ——
  const move = ramp(g, 5.8, 6.4, 0, 1, EASE.inOut); // 文字消失后整组重新居中
  const xLeft = EQ.xLeft + (483 - EQ.xLeft) * move;
  const eqLeft = EQ.eqLeft + (650 - EQ.eqLeft) * move;
  const ex = ramp(g, 7.3, 7.5, 0, 1, EASE.out); // 7.3–7.5s X 回中放大
  const xSize = EQ.xSize + (180 - EQ.xSize) * ex;
  const xCx = xLeft + EQ.xSize / 2 + (640 - (xLeft + EQ.xSize / 2)) * ex;
  const jitWin = g >= sec(7.3) && g < sec(7.42);
  const jit = jitWin ? (rnd('xj', tick) - 0.5) * 36 : 0;

  // —— 亮度 ——
  const dimX = ramp(g, 5.05, 5.25, 0, 1, EASE.out); // 白 X → 暗 X + 红边
  const wordOp = kf(g, [[5.0, 1], [5.2, 0.55, EASE.out], [5.7, 0.5], [5.95, 0]]);
  const eqOp = kf(g, [[5.0, 1], [5.2, 0.8, EASE.out], [7.3, 0.8], [7.42, 0]]);
  const split = 4 * (1 - ramp(g, 5.1, 5.3, 0, 1)) * (g >= sec(5.05) ? 1 : 0);
  const splitShadow = `${-split}px 0 ${rgba(COLOR.ember, 0.75)}, ${split}px 0 ${rgba(COLOR.ink, 0.35)}`;

  // —— 乱码 ——
  const scrOn = g >= sec(5.2) && g < sec(5.98);
  const scrP = ramp(g, 5.15, 5.5, 0.15, 1);

  // —— 红线 + 线头擦除 ——
  const grow = ramp(g, 5.05, 5.3, 0, 1, EASE.out);
  const headX = 430 + (EQ.wordRight - 430) * ramp(g, 5.7, 6.1, 0, 1, EASE.inOut);
  const lineEnd = 430 + (EQ.wordRight - 430) * grow;
  const lineOp = kf(g, [[5.0, 0], [5.06, 0.9], [6.05, 0.9], [6.15, 0]]);
  const dotOp = ramp(g, 5.55, 5.65, 0, 1) * (1 - ramp(g, 6.05, 6.15, 0, 1));
  const clipLeft = Math.max(0, headX - EQ.wordLeft);

  // —— 「?」与碎点 ——
  const qk = ramp(g, 6.25, 6.5, 0, 1, EASE.out) * (1 - ramp(g, 7.3, 7.42, 0, 1));
  const specksOn = kf(g, [[6.0, 0], [6.15, 1], [6.8, 0.6], [7.0, 0]]);
  const frag = g >= sec(6.0) && g < sec(6.45) && rnd('fr', tick) > 0.35; // X 的错位残片
  const flash = 0.5 * kf(g, [[5.0, 0], [5.06, 1], [5.4, 0, EASE.out]]);

  const xTop = EQ.cy - xSize / 2;
  const xLeftPx = xCx - xSize / 2 + jit;

  return (
    <AbsoluteFill>
      <Glow x={640} y={440} rx={260} ry={150} a={flash} />
      <Glow x={640} y={350} rx={520} ry={260} a={0.18} />
      <Glow x={640} y={360} rx={200} a={0.5 * ex} />

      {/* 红线 */}
      <div style={{position: 'absolute', left: headX, top: 351, width: Math.max(0, lineEnd - headX), height: 2,
        background: COLOR.ember, opacity: lineOp, boxShadow: `0 0 8px ${rgba(COLOR.ember, 0.8)}`}} />
      <div style={{position: 'absolute', left: headX - 4, top: 348, width: 8, height: 8, borderRadius: '50%',
        background: COLOR.ink, opacity: dotOp, boxShadow: `0 0 12px ${COLOR.ember}`}} />

      {/* 「=」 */}
      <div style={{...eqText(eqLeft), opacity: eqOp, textShadow: splitShadow}}>=</div>

      {/* 词：主层 + 两层重影，被线头擦掉 */}
      <div style={{position: 'absolute', left: EQ.wordLeft, top: 0, width: 520, height: 720,
        clipPath: `inset(0px 0px 0px ${clipLeft}px)`}}>
        {[[0, 0, 1], [7, 3, 0.45], [-5, 7, 0.35]].map(([dx, layer, k]) => (
          <div key={layer} style={{...eqText(dx), opacity: wordOp * k, textShadow: layer === 0 ? splitShadow : 'none'}}>
            {scramble(layer, tick + layer * 3, scrP, scrOn)}
          </div>
        ))}
      </div>

      {/* 碎点 */}
      {Array.from({length: 14}, (_, i) =>
        rnd('sv', i + tick * 20) > 0.45 ? (
          <div key={i} style={{position: 'absolute', left: 700 + rnd('sx', i) * 280, top: 330 + rnd('sy', i) * 70,
            width: 3, height: 3, borderRadius: '50%', background: COLOR.ink, opacity: specksOn * 0.7}} />
        ) : null,
      )}

      {/* 「?」 */}
      <div style={{position: 'absolute', left: 750, top: 0, height: 720, display: 'flex', alignItems: 'center',
        fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 140, color: COLOR.ink, opacity: qk,
        filter: `blur(${(1 - qk) * 6}px)`}}>
        ?
      </div>

      {/* X：白 → 暗红边 */}
      <XMark size={xSize} fillOp={1} style={{position: 'absolute', left: xLeftPx, top: xTop, opacity: 1 - dimX}} />
      <XMark size={xSize} fillOp={0.1} edge={0.85} style={{position: 'absolute', left: xLeftPx, top: xTop, opacity: dimX}} />
      {frag && (
        <XMark size={xSize} fill={COLOR.ember} fillOp={0.4}
          style={{position: 'absolute', left: xLeftPx - 8, top: xTop + 4,
            clipPath: `inset(${30 + rnd('fa', tick) * 20}% 0 ${25 + rnd('fb', tick) * 20}% 0)`}} />
      )}
    </AbsoluteFill>
  );
};
