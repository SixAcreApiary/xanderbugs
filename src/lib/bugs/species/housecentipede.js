import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg, drawJointedLeg, restFoot, dutyFactor, antenna, TAU, bodyEdge } from '../common.js';

// House centipede (Scutigera coleoptrata): a short, rigid, striped body on 15 pairs of very long banded
// legs that lengthen toward the rear; the last pair trail far behind like a second set of antennae.
// Scutigeromorphs walk with a DIRECT wave (steps ripple tail -> head, the same way it travels), left and
// right legs of a segment alternating, and don't undulate the body.
const PAIRS = 15;
const WAVE_LAG = 0.07;   // fraction of a stride cycle between neighbouring leg pairs

const LEGS = Array.from({ length: PAIRS }, (_, i) => {
  const u = i / (PAIRS - 1);                 // 0 front .. 1 rear
  const len = i === PAIRS - 1 ? 190 : 78 + u * 62;
  return {
    hx: 34 - u * 78,
    angle: i === PAIRS - 1 ? 2.75 : 0.85 + u * 1.55,
    segs: [[len * 0.34, 0, 3], [len * 0.36, 0.3 + u * 0.15, 2.2], [len * 0.3, 0.2, 1.4]],
    trailing: i === PAIRS - 1
  };
});

const BAND = '#2e2640';

const LEG_COLOR = '#d8c48e';

// Dark bands over the pale leg, drawn along the same jointed pose.
function legBands(ctx, hx, hy, foot, side, segs) {
  ctx.setLineDash([9, 9]);
  drawJointedLeg(ctx, hx, hy, foot, side, segs.map(([l, b, w]) => [l, b, w * 1.05]), BAND);
  ctx.setLineDash([]);
}

export default {
  id: 'housecentipede',
  size: [38.1, 43.9],
  previewSize: 34,
  previewShift: 0.45,  // long trailing legs: shift right so they fit the cell
  speed: [205, 350],
  pace: { drift: 0.2, dartRate: 0.3, dart: [1.8, 0.4] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.8,
  pauseTime: [0.4, 2.5],
  abundance: 0.4,   // turns up less than other bugs at any slider setting
  maxTurn: 6,
  wander: 1.2,
  stride: 35,          // long legs, long strides: its legs blur less
  // Legs attach along the whole trunk, one pair per segment; the test suite checks every hip lies within it.
  anatomy: { legSection: [-46, 38], hips: LEGS.map(l => l.hx) },
  draw(ctx, bug) {
    const L = bug.light;
    const duty = dutyFactor(bug, 0.42);
    withBugFrame(ctx, bug, () => {
      groundShadow(ctx, L, -4, 0, 60, 20, 0.26);
      for (const side of [-1, 1]) {
        LEGS.forEach((l, i) => {
          const hy = side * 6;
          let foot;
          if (l.trailing) {
            // The last pair aren't walked on; they trail behind and sway slightly.
            foot = restFoot(l.hx, hy, side, l.angle + Math.sin(bug.t * 3 + side) * 0.05, l.segs);
            drawJointedLeg(ctx, l.hx, hy, foot, side, l.segs, LEG_COLOR);
          } else {
            const offset = (i * WAVE_LAG + (side > 0 ? 0.5 : 0)) % 1;   // rear pairs lead: tail -> head ripple
            foot = walkLeg(ctx, bug, { hx: l.hx, hy, edge: bodyEdge(l.hx, [[-4, 44, 9]]) - 6, side, angle: l.angle, segs: l.segs, offset, duty, color: LEG_COLOR });
          }
          legBands(ctx, l.hx, foot.py ?? hy, foot, side, foot.segs ?? l.segs);
        });
      }
      // Body: seven broad dorsal plates over the fifteen leg-bearing segments, three dark stripes.
      shadedEllipse(ctx, L, -4, 0, 44, 9, ['#d4c09a', '#a8946c', '#5a4a34']);
      ctx.strokeStyle = 'rgba(46,38,64,0.85)';
      ctx.lineWidth = 2.2;
      for (const y of [-4.5, 0, 4.5]) {
        ctx.beginPath();
        ctx.moveTo(34, y * 0.8);
        ctx.lineTo(-44, y * 0.4);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(40,30,20,0.35)';
      ctx.lineWidth = 0.8;
      for (let p = 1; p < 7; p++) {
        const x = 36 - p * 11.5;
        ctx.beginPath();
        ctx.moveTo(x, -8.5);
        ctx.quadraticCurveTo(x - 2.5, 0, x, 8.5);
        ctx.stroke();
      }
      specular(ctx, L, -4, 0, 44, 9, 0.25);
      shadedEllipse(ctx, L, 42, 0, 6.5, 7.5, ['#c8b48a', '#8a7650', '#3a2e1c']);   // head
      ctx.fillStyle = '#141018';                                                // large compound eyes
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(42, side * 5.5, 2.6, 2, 0, 0, TAU);
        ctx.fill();
        const w = Math.sin(bug.t * 4 + side * 1.3) * 0.18 + Math.sin(bug.t * 11 + side) * 0.05;
        antenna(ctx, 47, side * 3, side, [[110, 22 + w * 70], [175 + w * 10, 44 + w * 110]], 1.3, '#6a5a3e', true);
      }
    });
  }
};

