import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg, insectGait, antenna, TAU, bodyEdge } from '../common.js';

// Bedbug: a small, flat, rusty oval with a ribbed abdomen and a crescent-shaped pronotum.
const OUTLINE = [[-12, 34, 30], [24, 9, 21]];   // abdomen and pronotum

const LEGS = [
  { x: 25, angle: 1.0 },   // prothorax, under the pronotum
  { x: 18, angle: 1.65 },  // mesothorax
  { x: 12, angle: 2.25 }   // metathorax, just ahead of the abdomen
];
const BODY = ['#c06a3a', '#7a3216', '#2e0e04'];

export default {
  id: 'bedbug',
  size: [12, 16],
  previewSize: 36,
  // Legs attach only to the thorax (pronotum region), never the abdomen; the test suite checks every hip lies within it.
  anatomy: { legSection: [11, 33], hips: LEGS.map(l => l.x) },
  speed: [30, 60],
  pace: { drift: 0.2, dartRate: 0.02, dart: [1.4, 0.5] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.5,
  pauseTime: [0.6, 2.4],
  maxTurn: 3.5,
  wander: 1.3,
  stride: 4.5,
  draw(ctx, bug) {
    const L = bug.light;
    withBugFrame(ctx, bug, () => {
      groundShadow(ctx, L, -6, 0, 50, 36, 0.3);
      for (const side of [-1, 1]) {
        LEGS.forEach((l, i) => {
          walkLeg(ctx, bug, { hx: l.x, hy: side * 10, edge: bodyEdge(l.x, OUTLINE) - 10, side, angle: l.angle, ...insectGait(bug, i, side), color: '#8a4a26', segs: [
            [14, 0, 3.4], [14, i === 0 ? -0.35 : 0.4, 2.4], [7, 0.2, 1.6]
          ] });
        });
      }
      shadedEllipse(ctx, L, -12, 0, 34, 30, BODY);                       // abdomen
      ctx.strokeStyle = 'rgba(40,10,2,0.45)';                            // segment ribs
      ctx.lineWidth = 1;
      for (let x = 6; x > -40; x -= 7) {
        const r = Math.sqrt(Math.max(0, 1 - ((x + 12) / 34) ** 2)) * 30;
        ctx.beginPath();
        ctx.moveTo(x + 2, -r * 0.92);
        ctx.quadraticCurveTo(x - 3, 0, x + 2, r * 0.92);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(230,190,140,0.12)';                          // fine pale hairs along the rim
      for (let a = 0; a < TAU; a += 0.35) {
        ctx.beginPath();
        ctx.arc(-12 + Math.cos(a) * 33, Math.sin(a) * 29, 0.8, 0, TAU);
        ctx.fill();
      }
      specular(ctx, L, -12, 0, 34, 30, 0.3);
      shadedEllipse(ctx, L, 24, 0, 9, 21, BODY);                         // crescent pronotum
      ctx.fillStyle = 'rgba(46,14,4,0.35)';
      ctx.beginPath();
      ctx.ellipse(27, 0, 5, 12, 0, 0, TAU);
      ctx.fill();
      shadedEllipse(ctx, L, 36, 0, 7, 7, BODY);                          // head
      ctx.fillStyle = '#1a0602';
      for (const side of [-1, 1]) {
        ctx.beginPath();                                                 // bulging eyes
        ctx.arc(34, side * 7, 2.2, 0, TAU);
        ctx.fill();
        const w = Math.sin(bug.t * 4 + side) * 0.2;
        antenna(ctx, 41, side * 3, side, [[47, 6], [54, 10 + w * 10], [62, 13 + w * 18]], 1.5, '#8a4a26');
      }
    });
  }
};
