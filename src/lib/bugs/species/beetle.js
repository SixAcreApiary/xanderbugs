import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg, insectGait, antenna, bodyEdge } from '../common.js';

const OUTLINE = [[-12, 38, 26], [26, 12, 18]];   // elytra and pronotum, which the legs come out from under

const LEGS = [
  { x: 22, angle: 0.8 },   // prothorax, under the pronotum
  { x: 10, angle: 1.6 },   // mesothorax, under the front of the elytra
  { x: 0, angle: 2.2 }     // metathorax, under the front third of the elytra
];

const PALETTES = [
  { shell: ['#4a5470', '#12141c', '#020203'], edge: 'rgba(90,120,200,0.2)' }, // black ground beetle, blue sheen
  { shell: ['#5a7a3a', '#1e3010', '#060a02'], edge: 'rgba(140,220,90,0.2)' }  // green-bronze beetle
];

export default {
  id: 'beetle',
  size: [26, 30],
  previewSize: 40,
  // Legs attach only to the thorax (pronotum and the base of the elytra); the test suite checks every hip lies within it.
  anatomy: { legSection: [-4, 38], hips: LEGS.map(l => l.x) },
  speed: [40, 85],
  pace: { drift: 0.2, dartRate: 0.02, dart: [1.4, 0.6] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.25,
  pauseTime: [0.5, 1.8],
  maxTurn: 3,
  wander: 1.2,
  stride: 9,
  draw(ctx, bug) {
    const pal = PALETTES[bug.variant < 0.75 ? 0 : 1];
    const L = bug.light;
    withBugFrame(ctx, bug, () => {
      groundShadow(ctx, L, -6, 0, 54, 34);
      for (const side of [-1, 1]) {
        LEGS.forEach((l, i) => {
          walkLeg(ctx, bug, { hx: l.x, hy: side * 10, edge: bodyEdge(l.x, OUTLINE) - 10, side, angle: l.angle, ...insectGait(bug, i, side), color: '#0e0e10', segs: [
            [20, 0, 4.4], [20, i === 0 ? -0.4 : 0.35, 3.4], [10, 0.2, 2]
          ] });
        });
      }
      shadedEllipse(ctx, L, -12, 0, 38, 26, pal.shell);                 // elytra
      ctx.strokeStyle = pal.edge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(-12, 0, 37, 25, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';                             // seam + striae
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(-50, 0);
      ctx.stroke();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      for (const side of [-1, 1]) {
        for (const off of [6, 12, 18]) {
          ctx.beginPath();
          ctx.moveTo(22, side * off * 0.9);
          ctx.quadraticCurveTo(-12, side * off * 1.15, -46, side * off * 0.3);
          ctx.stroke();
        }
      }
      specular(ctx, L, -12, 0, 38, 26, 0.55);
      shadedEllipse(ctx, L, 26, 0, 12, 18, pal.shell);                  // pronotum
      specular(ctx, L, 26, 0, 12, 18, 0.45);
      shadedEllipse(ctx, L, 40, 0, 8, 10, pal.shell);                   // head
      ctx.fillStyle = '#060606';                                        // mandibles
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(46, side * 4);
        ctx.quadraticCurveTo(54, side * 5, 52, side * 0.5);
        ctx.lineTo(47, side * 1.5);
        ctx.fill();
        const w = Math.sin(bug.t * 4 + side) * 0.15;
        antenna(ctx, 46, side * 6, side, [[56, 12 + w * 20], [68, 18 + w * 30]], 1.6, '#0e0e10', true);
      }
    });
  }
};
