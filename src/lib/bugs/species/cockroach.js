import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg, insectGait, antenna, bodyEdge } from '../common.js';

const OUTLINE = [[-6, 46, 21], [27, 15, 19]];   // body and pronotum rim

const LEGS = [
  { x: 24, angle: 0.75, segs: [[16, 0, 3.6], [18, -0.35, 2.6], [12, 0.2, 1.6]] },
  { x: 12, angle: 1.55, segs: [[20, 0, 4], [24, 0.55, 2.8], [14, 0.25, 1.7]] },
  { x: 0, angle: 2.15, segs: [[24, 0, 4.4], [32, 0.4, 3], [18, 0.15, 1.8]] }
];

export default {
  id: 'cockroach',
  size: [45.6, 52.4],
  previewSize: 64,
  // Legs attach only to the thorax (pronotum and wing bases); the test suite checks every hip lies within it.
  anatomy: { legSection: [-6, 42], hips: LEGS.map(l => l.x) },
  speed: [180, 320],
  pace: { drift: 0.25, dartRate: 0.25, dart: [2, 0.45] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.6,
  pauseTime: [0.3, 2.2],
  maxTurn: 6,
  wander: 1.1,
  stride: 22,
  draw(ctx, bug) {
    const L = bug.light;
    const legColor = '#4a2410';
    withBugFrame(ctx, bug, () => {
      groundShadow(ctx, L, -4, 0, 56, 28);
      for (const side of [-1, 1]) {
        LEGS.forEach((l, i) => {
          walkLeg(ctx, bug, { hx: l.x, hy: side * 8, edge: bodyEdge(l.x, OUTLINE) - 8, side, angle: l.angle, segs: l.segs, ...insectGait(bug, i, side), color: legColor });
        });
        ctx.strokeStyle = '#3a1a08';                       // cerci
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-46, side * 4);
        ctx.lineTo(-56, side * 9);
        ctx.stroke();
      }
      shadedEllipse(ctx, L, -6, 0, 46, 21, ['#a0552a', '#5c2410', '#240a03']);   // body under wings
      for (const side of [-1, 1]) {                                               // overlapping tegmina
        shadedEllipse(ctx, L, -10, side * 6, 41, 15, ['#b4683a', '#6a2c12', '#2a0d04'], side * 0.05);
      }
      ctx.strokeStyle = 'rgba(30,8,0,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.quadraticCurveTo(-20, 1.5, -50, 0);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';                                       // wing veins
      for (const side of [-1, 1]) {
        for (let v = 0; v < 3; v++) {
          ctx.beginPath();
          ctx.moveTo(18, side * (4 + v * 4));
          ctx.quadraticCurveTo(-15, side * (8 + v * 4), -46, side * (2 + v * 3));
          ctx.stroke();
        }
      }
      specular(ctx, L, -8, 0, 44, 20, 0.5);
      shadedEllipse(ctx, L, 27, 0, 15, 19, ['#e6c08a', '#b07a42', '#4a2210']);    // pronotum rim
      shadedEllipse(ctx, L, 27, 0, 10, 13, ['#8a4a26', '#4a1e0a', '#1a0602']);    // pronotum center
      specular(ctx, L, 27, 0, 15, 19, 0.4);
      shadedEllipse(ctx, L, 42, 0, 7, 8, ['#7a3a1a', '#3a1508', '#120401']);      // head
      for (const side of [-1, 1]) {
        const w = Math.sin(bug.t * 3 + side) * 0.25 + Math.sin(bug.t * 7.3 + side * 2) * 0.08;
        antenna(ctx, 47, side * 3, side, [
          [70, 18 + w * 30],
          [70 + Math.cos(0.5 + w) * 60, 18 + Math.sin(0.5 + w) * 60 + w * 30]
        ], 1.1, '#3a1a08', true);
        ctx.fillStyle = '#100402';                                                // eyes
        ctx.beginPath();
        ctx.ellipse(43, side * 5.5, 2.2, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
};
