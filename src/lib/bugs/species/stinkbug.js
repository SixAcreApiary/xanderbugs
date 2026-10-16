import { withBugFrame, bodyGradient, specular, groundShadow, walkLeg, insectGait, mirroredPath, fixedRandom, TAU, outlineEdge } from '../common.js';

// Brown marmorated stink bug: a mottled shield with banded edges and banded antennae.
const SHIELD = [[46, 3], [40, 7], [31, 8.5], [27, 18], [22, 27], [16, 26], [4, 24], [-14, 23], [-30, 19], [-42, 11], [-47, 0]];
const LEGS = [
  { x: 22, angle: 0.9 },   // prothorax, under the pronotum
  { x: 9, angle: 1.6 },    // mesothorax, under the scutellum's base
  { x: -4, angle: 2.2 }    // metathorax
];

const rand = fixedRandom(4231);
const SPECKLES = Array.from({ length: 90 }, () => [rand() * 88 - 44, rand() * 46 - 23, 0.4 + rand() * 1.1, rand() < 0.6]);

function bandedLine(ctx, pts, width, colors) {
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(...pts[i - 1]);
    ctx.lineTo(...pts[i]);
    ctx.stroke();
  }
}

export default {
  id: 'stinkbug',
  size: [46, 56],
  previewSize: 74,
  // Legs attach only to the thorax (pronotum and scutellum base); the test suite checks every hip lies within it.
  anatomy: { legSection: [-10, 31], hips: LEGS.map(l => l.x) },
  speed: [25, 55],
  pace: { drift: 0.15, dartRate: 0.01, dart: [1.3, 0.6] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.4,
  pauseTime: [0.8, 3],
  maxTurn: 2,
  wander: 0.9,
  stride: 9,
  draw(ctx, bug) {
    const L = bug.light;
    withBugFrame(ctx, bug, () => {
      groundShadow(ctx, L, -4, 0, 54, 32);
      for (const side of [-1, 1]) {
        LEGS.forEach((l, i) => {
          const segs = [[16, 0, 3.2], [16, i === 0 ? -0.4 : 0.4, 2.4], [8, 0.2, 1.6]];
          walkLeg(ctx, bug, { hx: l.x, hy: side * 9, edge: outlineEdge(l.x, SHIELD) - 9, side, angle: l.angle, segs, ...insectGait(bug, i, side), color: '#5a4430' });
        });
      }
      mirroredPath(ctx, SHIELD);
      ctx.fillStyle = bodyGradient(ctx, L, 0, 0, 46, 27, ['#a08462', '#6e5638', '#2e2214']);
      ctx.fill();
      ctx.save();
      mirroredPath(ctx, SHIELD);
      ctx.clip();
      for (const [x, y, r, dark] of SPECKLES) {                        // marbled mottling
        ctx.fillStyle = dark ? 'rgba(40,28,16,0.45)' : 'rgba(200,180,140,0.3)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(30,20,10,0.35)';                          // scutellum
      ctx.beginPath();
      ctx.moveTo(18, -12);
      ctx.lineTo(-18, 0);
      ctx.lineTo(18, 12);
      ctx.fill();
      ctx.fillStyle = 'rgba(25,16,8,0.5)';                            // dark wing membrane
      ctx.beginPath();
      ctx.ellipse(-36, 0, 11, 13, 0, 0, TAU);
      ctx.fill();
      for (const side of [-1, 1]) {                                    // banded connexivum along the edge
        for (let x = -36, n = 0; x < 10; x += 6, n++) {
          ctx.fillStyle = n % 2 ? 'rgba(235,220,190,0.75)' : 'rgba(30,20,10,0.7)';
          ctx.fillRect(x, side > 0 ? 19 : -23, 6, 4);
        }
      }
      ctx.restore();
      specular(ctx, L, 6, 0, 36, 22, 0.25);
      ctx.fillStyle = '#1a1008';                                       // eyes
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(38, side * 7.5, 1.8, 0, TAU);
        ctx.fill();
        const w = Math.sin(bug.t * 3 + side) * 0.15;
        const a = 0.55 + w;
        const p0 = [44, side * 4], p1 = [p0[0] + Math.cos(a) * 12, side * (4 + Math.sin(a) * 12)];
        const p2 = [p1[0] + Math.cos(a - 0.3) * 12, p1[1] + side * Math.sin(a - 0.3) * 12];
        const p3 = [p2[0] + Math.cos(a - 0.5) * 10, p2[1] + side * Math.sin(a - 0.5) * 10];
        bandedLine(ctx, [p0, p1, p2, p3], 1.6, ['#3a2a18', '#5a4430', '#b09a78']);
      }
    });
  }
};
