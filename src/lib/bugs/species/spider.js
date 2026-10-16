import { withBugFrame, shadedEllipse, specular, groundShadow, leg, walkLeg, drawJointedLeg, tetrapodGait, TAU, bodyEdge } from '../common.js';

// Spider legs alternate: L1,R2,L3,R4 step together, opposite the other four.
// Hips (hx, hy) fan around the rim of the cephalothorax, legs I at the front through IV at the back.
const CEPHALOTHORAX = [[14, 15, 12.5]];

const LEGS = [
  { hx: 22, hy: 8, angle: 0.55, len: 1.05, bend: -0.35 },
  { hx: 17, hy: 10.5, angle: 1.15, len: 0.9, bend: -0.15 },
  { hx: 11, hy: 10.5, angle: 1.95, len: 0.85, bend: 0.25 },
  { hx: 5, hy: 8, angle: 2.55, len: 1.0, bend: 0.4 }
];

const PALETTES = [
  { body: ['#8a7058', '#4a3828', '#18100a'], leg: ['#5a4634', '#2a1e14'], mark: 'rgba(20,12,6,0.65)' }, // wolf spider
  { body: ['#3c3a38', '#141312', '#030303'], leg: ['#2a2826', '#0a0a0a'], mark: 'rgba(160,150,140,0.35)' } // black house spider
];

export default {
  id: 'spider',
  size: [26, 34],
  previewSize: 44,
  // Legs attach only to the cephalothorax, never the abdomen; the test suite checks every hip lies within it.
  anatomy: { legSection: [-1, 29], hips: LEGS.map(l => l.hx) },
  speed: [130, 260],
  pace: { drift: 0.2, dartRate: 0.15, dart: [1.8, 0.5] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.9,
  pauseTime: [0.6, 3.0],
  maxTurn: 5,
  wander: 0.9,
  stride: 16,
  draw(ctx, bug) {
    const pal = PALETTES[bug.variant < 0.65 ? 0 : 1];
    const L = bug.light;
    withBugFrame(ctx, bug, () => {
      groundShadow(ctx, L, -8, 0, 46, 30, 0.28);
      for (const side of [-1, 1]) {
        LEGS.forEach((l, i) => {
          const hx = l.hx, hy = side * l.hy;
          const segs = [[26 * l.len, 0, 4.6], [30 * l.len, l.bend, 3.6], [22 * l.len, l.bend * 0.6, 2.4]];
          const foot = walkLeg(ctx, bug, { hx, hy, edge: bodyEdge(hx, CEPHALOTHORAX) - l.hy, side, angle: l.angle, segs, ...tetrapodGait(bug, i, side), color: pal.leg[1] });
          // Lighter core stripe along the same leg gives the banded, hairy look.
          drawJointedLeg(ctx, hx, foot.py, foot, side, foot.segs.map(([len, b, w]) => [len, b, w * 0.45]), pal.leg[0]);
        });
        const pw = Math.sin(bug.t * 5 + side) * 0.2;                       // pedipalps
        leg(ctx, 26, side * 4, side, 0.35 + pw, [[9, 0, 3], [7, -0.3, 2.4]], pal.leg[1]);
      }
      shadedEllipse(ctx, L, -20, 0, 24, 18, pal.body);                     // abdomen
      ctx.fillStyle = pal.mark;                                            // chevrons
      for (let c = 0; c < 4; c++) {
        const cx = -8 - c * 7;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx - 5, -8 + c * 1.5);
        ctx.lineTo(cx - 3, 0);
        ctx.lineTo(cx - 5, 8 - c * 1.5);
        ctx.fill();
      }
      specular(ctx, L, -20, 0, 24, 18, 0.25);
      shadedEllipse(ctx, L, 14, 0, 15, 12.5, pal.body);                    // cephalothorax
      ctx.fillStyle = pal.mark;
      ctx.beginPath();
      ctx.ellipse(13, 0, 11, 3, 0, 0, TAU);
      ctx.fill();
      specular(ctx, L, 14, 0, 15, 12.5, 0.3);
      ctx.fillStyle = '#050403';                                           // eye cluster
      [[27, 0, 2.4], [26, 3.5, 2], [26, -3.5, 2], [23, 5, 1.4], [23, -5, 1.4], [29, 2, 1.2], [29, -2, 1.2]]
        .forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      [[26.4, -0.6], [25.5, 2.9], [25.5, -4.1]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 0.6, 0, TAU); ctx.fill(); });
    });
  }
};
