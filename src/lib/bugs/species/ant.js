import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg, insectGait, antenna, bodyEdge } from '../common.js';

const PALETTES = [
  { body: ['#5a4a42', '#1c1310', '#060302'], leg: '#1a120e' },  // black carpenter ant
  { body: ['#d0703a', '#8a3414', '#3a1205'], leg: '#5a230c' }   // red fire ant
];

// Tripod gait: L1,R2,L3 move together, opposite to R1,L2,R3.
const OUTLINE = [[12, 14, 6.5]];   // mesosoma, where the legs leave the body

const LEGS = [
  { x: 20, angle: 0.95 },  // prothorax
  { x: 13, angle: 1.65 },  // mesothorax
  { x: 7, angle: 2.25 }    // metathorax
];

export default {
  id: 'ant',
  size: [15, 20],
  previewSize: 38,
  // Legs attach only to the mesosoma (thorax); the test suite checks every hip lies within it.
  anatomy: { legSection: [-2, 26], hips: LEGS.map(l => l.x) },
  speed: [55, 95],
  pace: { drift: 0.3, dartRate: 0.08, dart: [1.5, 0.5] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.35,
  pauseTime: [0.2, 0.9],
  maxTurn: 4.5,
  wander: 1.6,
  stride: 7,
  greets: true,   // stops head to head with another ant to touch antennae
  draw(ctx, bug) {
    const pal = PALETTES[bug.variant < 0.7 ? 0 : 1];
    const L = bug.light;
    withBugFrame(ctx, bug, () => {
      groundShadow(ctx, L, -2, 0, 58, 22);
      for (const side of [-1, 1]) {
        LEGS.forEach((l, i) => {
          walkLeg(ctx, bug, { hx: l.x, hy: side * 3, edge: bodyEdge(l.x, OUTLINE) - 3, side, angle: l.angle, ...insectGait(bug, i, side), color: pal.leg, segs: [
            [20, 0, 3.2], [22, i === 0 ? -0.5 : 0.45, 2.4], [11, 0.25, 1.6]
          ] });
        });
      }
      shadedEllipse(ctx, L, -25, 0, 21, 14.5, pal.body);   // gaster
      specular(ctx, L, -25, 0, 21, 14.5, 0.35);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.8;
      for (const gx of [-18, -27, -35]) {
        ctx.beginPath();
        ctx.ellipse(gx + 6, 0, 3, 13 - Math.abs(gx + 25) * 0.25, 0, -1.2, 1.2);
        ctx.stroke();
      }
      shadedEllipse(ctx, L, -3, 0, 4, 4.2, pal.body);       // petiole node
      shadedEllipse(ctx, L, 12, 0, 14, 6.5, pal.body);     // mesosoma
      specular(ctx, L, 12, 0, 14, 6.5, 0.3);
      shadedEllipse(ctx, L, 34, 0, 11, 10, pal.body);       // head
      specular(ctx, L, 34, 0, 11, 10, 0.35);
      ctx.fillStyle = pal.leg;                              // mandibles
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(43, side * 3);
        ctx.quadraticCurveTo(50, side * 6, 48, side * 0.5);
        ctx.lineTo(44, side * 1);
        ctx.fill();
      }
      for (const side of [-1, 1]) {                         // elbowed antennae
        const w = bug.meet
          ? Math.sin(bug.t * 24 + side * 2.1) * 0.4 + Math.sin(bug.t * 37 + side) * 0.15   // rapid antennation
          : Math.sin(bug.t * 9 + side * 1.3) * 0.18;
        const sx = 40, sy = 5;
        const ex = sx + Math.cos(0.9 + w) * 16, ey = sy + Math.sin(0.9 + w) * 16;
        const tx = ex + Math.cos(-0.25 + w * 2) * 22, ty = ey + Math.sin(-0.25 + w * 2) * 22;
        antenna(ctx, sx, side * sy, side, [[ex, ey], [tx, ty]], 1.7, pal.leg);
      }
    });
  }
};
