import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg, insectGait, antenna, TAU, bodyEdge } from '../common.js';

const OUTLINE = [[18, 13, 11]];   // thorax

const LEGS = [
  { x: 27, angle: 0.85 },  // prothorax, just behind the head
  { x: 18, angle: 1.6 },   // mesothorax
  { x: 10, angle: 2.25 }   // metathorax, in front of the waist
];

// Wings, from Vespula worker measurements: body 12-15 mm, forewing ~8-10.5 mm (about 0.69 of the body), so
// at rest they reach nearly to the tip of the abdomen. Like all social wasps, a yellowjacket folds each
// forewing lengthwise when resting, so it shows as a narrow smoky strip with a darker leading edge, hinged on
// the side of the thorax and lying back along that side of the body. Body units: head front x = 44, sting
// tip x = -50.
export const BODY_FRONT = 44, BODY_TIP = -50;
export const WING = {
  root: { x: 22, y: 7.5 },   // the side of the mesothorax
  spread: 0.12,              // radians each folded wing angles out from the midline
  length: ((BODY_FRONT - BODY_TIP) * 9.25) / 13.5,
  width: 10                  // folded: about half the open wing's width (open ~0.3 of its length)
};

// Outline of a folded forewing (root at 0, tip at x = len): a narrow strip, slightly wider toward the end,
// with a rounded tip.
export function foldedWingOutline(len, width, side, n = 16) {
  const half = t => (width / 2) * Math.min(1, 0.55 + 0.6 * t) * Math.sqrt(Math.max(0, 1 - t ** 6));
  const lead = [], trail = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    lead.push([t * len, -side * half(t)]);
    trail.push([t * len, side * half(t)]);
  }
  return [...lead, ...trail.reverse()];
}

const YELLOW = ['#ffe25a', '#e8b812', '#7a5a04'];
const BLACK = ['#3a3630', '#141210', '#040302'];

// Black bands across the yellow gaster, each with the small central point typical of Vespula.
function gasterBands(ctx) {
  ctx.fillStyle = '#16120c';
  for (const bx of [-6, -16, -26, -36]) {
    ctx.beginPath();
    ctx.moveTo(bx + 2.5, -20);
    ctx.lineTo(bx + 2.5, 20);
    ctx.lineTo(bx - 2, 20);
    ctx.lineTo(bx - 2, 4);
    ctx.lineTo(bx - 6, 0);
    ctx.lineTo(bx - 2, -4);
    ctx.lineTo(bx - 2, -20);
    ctx.fill();
  }
}

export default {
  id: 'yellowjacket',
  size: [38, 46],
  previewSize: 64,
  // Legs attach only to the mesosoma (thorax), never the waist or gaster; the test suite checks every hip lies within it.
  anatomy: { legSection: [5, 31], hips: LEGS.map(l => l.x) },
  speed: [60, 120],
  pace: { drift: 0.25, dartRate: 0.1, dart: [1.6, 0.4] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.55,
  pauseTime: [0.4, 2.2],
  maxTurn: 5,
  wander: 1.5,
  stride: 10,
  draw(ctx, bug) {
    const L = bug.light;
    // Wings buzz in short bursts while it stands still, as wasps do before taking off.
    const buzzing = bug.paused && Math.sin(bug.t * 0.7) > 0.92;   // only now and then, and only slightly
    const flick = bug.loosen ? Math.sin(bug.t * 90) * 0.1 : buzzing ? Math.sin(bug.t * 90) * 0.05 : 0;   // whirring free of a tangle
    withBugFrame(ctx, bug, () => {
      groundShadow(ctx, L, -6, 0, 54, 20);
      for (const side of [-1, 1]) {
        LEGS.forEach((l, i) => {
          walkLeg(ctx, bug, { hx: l.x, hy: side * 5, edge: bodyEdge(l.x, OUTLINE) - 5, side, angle: l.angle, ...insectGait(bug, i, side), color: i === 2 ? '#c8961e' : '#b88418', segs: [
            [13, 0, 2.6], [15, i === 0 ? -0.4 : 0.4, 1.9], [9, 0.2, 1.3]
          ] });
        });
      }
      shadedEllipse(ctx, L, -20, 0, 24, 15, YELLOW);                        // gaster
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(-20, 0, 24, 15, 0, 0, TAU);
      ctx.clip();
      gasterBands(ctx);
      ctx.restore();
      ctx.fillStyle = '#16120c';                                          // stinger tip
      ctx.beginPath();
      ctx.moveTo(-43, -3);
      ctx.lineTo(-50, 0);
      ctx.lineTo(-43, 3);
      ctx.fill();
      specular(ctx, L, -20, 0, 24, 15, 0.3);
      shadedEllipse(ctx, L, 4, 0, 3.5, 3, BLACK);                           // petiole
      shadedEllipse(ctx, L, 18, 0, 13, 11, BLACK);                          // thorax
      ctx.fillStyle = '#e8b812';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(22, side * 7.5, 4, 1.6, side * 0.4, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, side * 4, 2, 1.4, 0, 0, TAU);
        ctx.fill();
      }
      specular(ctx, L, 18, 0, 13, 11, 0.3);
      for (const side of [-1, 1]) {                                        // wings folded lengthwise, along each side
        ctx.save();
        ctx.translate(WING.root.x, side * WING.root.y);
        ctx.rotate(Math.PI - side * (WING.spread + flick));
        const len = WING.length, w = WING.width;
        ctx.fillStyle = 'rgba(150,132,90,0.4)';
        ctx.strokeStyle = 'rgba(50,40,20,0.5)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        foldedWingOutline(len, w, side).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fill();
        const sheen = ctx.createLinearGradient(0, -w, len, w);                // a faint sheen
        sheen.addColorStop(0, 'rgba(255,255,255,0)');
        sheen.addColorStop(0.45, 'rgba(255,250,235,0.22)');
        sheen.addColorStop(0.65, 'rgba(255,255,255,0)');
        ctx.fillStyle = sheen;
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(70,48,16,0.75)';                             // darker leading edge, on the outside
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(1, -side * w * 0.25);
        ctx.lineTo(len * 0.92, -side * w * 0.42);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(50,40,20,0.4)';                              // the lengthwise fold
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(4, side * w * 0.05);
        ctx.lineTo(len * 0.95, side * w * 0.08);
        ctx.stroke();
        ctx.restore();
      }
      shadedEllipse(ctx, L, 36, 0, 8, 10.5, BLACK);                          // head
      ctx.fillStyle = '#f0c420';                                          // yellow face
      ctx.beginPath();
      ctx.ellipse(40, 0, 4.5, 7.5, 0, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      ctx.fillStyle = '#100c08';
      for (const side of [-1, 1]) {                                        // kidney-shaped eyes
        ctx.beginPath();
        ctx.ellipse(36, side * 7.5, 4, 2.6, side * 0.3, 0, TAU);
        ctx.fill();
        const w = Math.sin(bug.t * 5 + side * 1.2) * 0.2;
        antenna(ctx, 42, side * 3, side, [[52, 8 + w * 20], [62, 16 + w * 30]], 1.8, '#141210', true);
      }
    });
  }
};
