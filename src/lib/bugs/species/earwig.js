import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg, insectGait, antenna, bodyEdge } from '../common.js';

const OUTLINE = [[12, 8, 10], [25, 6, 8.5]];   // elytra and pronotum

const LEGS = [
  { x: 25, angle: 0.9 },   // prothorax, under the pronotum
  { x: 16, angle: 1.6 },   // mesothorax, under the front of the short elytra
  { x: 8, angle: 2.2 }     // metathorax, under the back of the elytra
];

const BODY = ['#a85a32', '#5a2812', '#1e0a04'];

export default {
  id: 'earwig',
  size: [27.9, 32.1],
  previewSize: 44,
  // Legs attach only to the thorax (pronotum and short elytra); the test suite checks every hip lies within it.
  anatomy: { legSection: [4, 31], hips: LEGS.map(l => l.x) },
  speed: [70, 130],
  pace: { drift: 0.25, dartRate: 0.08, dart: [1.6, 0.5] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.4,
  pauseTime: [0.3, 1.4],
  maxTurn: 4,
  wander: 1.4,
  stride: 10,
  draw(ctx, bug) {
    const L = bug.light;
    withBugFrame(ctx, bug, () => {
      groundShadow(ctx, L, -4, 0, 60, 18);
      for (const side of [-1, 1]) {
        LEGS.forEach((l, i) => {
          walkLeg(ctx, bug, { hx: l.x, hy: side * 5, edge: bodyEdge(l.x, OUTLINE) - 5, side, angle: l.angle, ...insectGait(bug, i, side), color: '#b8864a', segs: [[13, 0, 2.8], [14, 0.4, 2], [7, 0.2, 1.3]] });
        });
      }
      // Abdomen: overlapping tergites that taper toward the forceps, slight sideways flex while walking.
      const flex = Math.sin(bug.phase * 0.5) * 1.5 * bug.moving;
      for (let i = 0; i < 7; i++) {
        const x = 2 - i * 6.5;
        const r = 10 - i * 0.55;
        shadedEllipse(ctx, L, x, flex * (i / 6), 5.2, r, BODY);
      }
      specular(ctx, L, -18, 0, 22, 9, 0.35);
      ctx.strokeStyle = '#2a1004';                                      // forceps
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-40, flex + side * 3);
        ctx.bezierCurveTo(-50, flex + side * 7, -58, flex + side * 7.5, -63, flex + side * 3.2);
        ctx.stroke();
      }
      shadedEllipse(ctx, L, 12, 0, 8, 10, ['#b07a4a', '#5e3618', '#24100a']);   // short elytra
      shadedEllipse(ctx, L, 25, 0, 6, 8.5, ['#a07048', '#4e2a12', '#1e0c04']);  // pronotum
      shadedEllipse(ctx, L, 36, 0, 7, 8, BODY);                                 // head
      specular(ctx, L, 36, 0, 7, 8, 0.4);
      for (const side of [-1, 1]) {
        const w = Math.sin(bug.t * 6 + side * 1.7) * 0.2;
        antenna(ctx, 42, side * 3, side, [[54, 8 + w * 25], [66, 14 + w * 40]], 1.3, '#8a5a2a', true);
      }
    });
  }
};
