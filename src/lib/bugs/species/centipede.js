import { shadedEllipse, specular, groundShadow, leg, antenna, walkLeg, dutyFactor } from '../common.js';

// Scolopendrid centipedes walk with a retrograde wave: each leg steps a little after the one in front,
// so the ripple runs head to tail, opposite to travel. Left and right legs of a segment alternate.
const WAVE_LAG = 0.09;   // fraction of a stride cycle between neighbouring segments

const SEGMENTS = 21;

const PALETTES = [
  { plate: ['#a87a3a', '#5a3a14', '#1e1004'], head: ['#c06a2a', '#7a3410', '#2a0e02'], leg: '#d8a24a' }, // stone centipede
  { plate: ['#4a5a3a', '#1e2814', '#080c04'], head: ['#c84a1a', '#7a2208', '#2a0802'], leg: '#e0b030' }  // giant centipede
];

// Body follows the head's path: sample segment positions along the trail (newest point first).
export function sampleTrail(trail, headX, headY, heading, spacing, n) {
  const out = [];
  let px = headX, py = headY, idx = 0;
  const pts = trail;
  for (let s = 0; s < n; s++) {
    let remaining = s === 0 ? 0 : spacing;
    while (remaining > 0 && idx < pts.length) {
      const q = pts[idx];
      const d = Math.hypot(q.x - px, q.y - py);
      if (d >= remaining) {
        const t = remaining / d;
        px += (q.x - px) * t;
        py += (q.y - py) * t;
        remaining = 0;
      } else {
        px = q.x; py = q.y;
        remaining -= d;
        idx++;
      }
    }
    if (remaining > 0) {                    // trail too short (just spawned): extend straight back
      px -= Math.cos(heading) * remaining;
      py -= Math.sin(heading) * remaining;
    }
    out.push({ x: px, y: py });
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
    out[i].angle = i === 0 ? heading : Math.atan2(a.y - b.y, a.x - b.x);
  }
  return out;
}

export default {
  id: 'centipede',
  size: [70, 95],
  previewSize: 115,
  previewShift: 0.5,   // body trails behind the head, so centre the whole length in the cell
  speed: [90, 170],
  pace: { drift: 0.2, dartRate: 0.08, dart: [1.6, 0.6] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.3,
  pauseTime: [0.4, 1.6],
  maxTurn: 3.2,
  wander: 1.6,
  stride: 8,
  trail: true,
  abundance: 0.4,   // turns up less than other bugs at any slider setting
  draw(ctx, bug) {
    const pal = PALETTES[bug.variant < 0.6 ? 0 : 1];
    const k = bug.size / 100;
    const spacing = bug.size / SEGMENTS;
    const segs = sampleTrail(bug.trail ?? [], bug.x, bug.y, bug.heading, spacing, SEGMENTS);
    const L = bug.light;
    const inFrame = (seg, fn) => {
      ctx.save();
      ctx.translate(seg.x, seg.y);
      ctx.rotate(seg.angle);
      ctx.scale(k, k);
      fn();
      ctx.restore();
    };
    segs.forEach(seg => inFrame(seg, () => groundShadow(ctx, L, 0, 0, 7, 9, 0.22)));
    for (let i = SEGMENTS - 1; i >= 1; i--) {
      inFrame(segs[i], () => {
        const last = i === SEGMENTS - 1;
        for (const side of [-1, 1]) {
          // The last pair are long trailing legs that aren't used for walking.
          if (last) leg(ctx, -2, side * 3, side, 2.75, [[12, 0, 1.6], [14, 0.1, 1.1]], pal.leg);
          else {
            const offset = ((-i * WAVE_LAG + (side > 0 ? 0.5 : 0)) % 1 + 1) % 1;
            walkLeg(ctx, bug, { hx: 0, hy: side * 3.5, edge: 1.5, side, angle: 1.6, segs: [[6.5, 0, 1.6], [6.5, 0.55, 1.1]], offset, duty: dutyFactor(bug, 0.55), color: pal.leg });
          }
        }
      });
    }
    for (let i = SEGMENTS - 1; i >= 1; i--) {
      const taper = i > SEGMENTS - 4 ? 1 - (i - (SEGMENTS - 4)) * 0.12 : 1;
      inFrame(segs[i], () => {
        shadedEllipse(ctx, L, 0, 0, 3.4, 5.2 * taper, pal.plate);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.4, 5.2 * taper, 0, 0, Math.PI * 2);
        ctx.stroke();
        specular(ctx, L, 0, 0, 3.4, 5.2 * taper, 0.3);
      });
    }
    inFrame(segs[0], () => {
      ctx.strokeStyle = '#3a1404';                         // forcipules
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(2, side * 2.5);
        ctx.quadraticCurveTo(8, side * 4, 7, side * 0.5);
        ctx.stroke();
      }
      shadedEllipse(ctx, L, 0, 0, 4.5, 5, pal.head);
      specular(ctx, L, 0, 0, 4.5, 5, 0.35);
      for (const side of [-1, 1]) {
        const w = Math.sin(bug.t * 6 + side * 1.4) * 0.25;
        antenna(ctx, 3.5, side * 2, side, [[12, 4 + w * 10], [20, 9 + w * 18]], 1, pal.leg, true);
      }
    });
  }
};
