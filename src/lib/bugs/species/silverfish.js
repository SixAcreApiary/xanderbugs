import { withBugFrame, groundShadow, walkLeg, insectGait, antenna, specular } from '../common.js';

const SEGMENTS = 12;
// Legs on the three thoracic segments right behind the head (fractions of body length from the head).
const THORAX_LEGS = [0.13, 0.21, 0.29];

export default {
  id: 'silverfish',
  size: [27.9, 32.1],
  previewSize: 44,
  // Legs attach only to the three thoracic segments (as fractions of body length); the test suite checks every hip lies within it.
  anatomy: { legSection: [0.1, 0.32], hips: THORAX_LEGS },
  speed: [140, 240],
  pace: { drift: 0.3, dartRate: 0.3, dart: [2, 0.35] },   // speed drift and dart frequency/strength while walking
  pauseRate: 0.45,
  pauseTime: [0.4, 2.0],
  maxTurn: 7,
  wander: 2.2,
  stride: 4,
  twitchy: true,   // known for darting, stop-start movement
  draw(ctx, bug) {
    const L = bug.light;
    withBugFrame(ctx, bug, () => {
      // Spine points with a travelling lateral wave (the fish-like wriggle that gives it its name).
      const pts = [];
      for (let i = 0; i <= SEGMENTS; i++) {
        const u = i / SEGMENTS;
        const x = 42 - u * 88;
        const y = Math.sin(bug.phase * 0.55 - u * 4) * 5 * u * (0.3 + 0.7 * bug.moving);
        const w = (1 - u * 0.8) * 10.5 * (u < 0.12 ? 0.75 + u * 2 : 1);
        pts.push({ x, y, w });
      }
      groundShadow(ctx, L, -4, 0, 52, 14, 0.28);
      for (const side of [-1, 1]) {
        THORAX_LEGS.forEach((u, i) => {
          const p = pts[Math.round(u * SEGMENTS)];
          walkLeg(ctx, bug, { hx: p.x, hy: p.y + side * p.w * 0.6, edge: p.w * 0.4, side, angle: 1.2 + i * 0.4, segs: [[7, 0, 1.6], [7, 0.4, 1.1]], ...insectGait(bug, i, side), color: '#8a8a86' });
        });
      }
      const tail = pts[SEGMENTS];
      ctx.strokeStyle = '#7a7a76';                                     // three tail filaments
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      [-0.45, 0, 0.45].forEach((a, i) => {
        const wv = Math.sin(bug.t * 8 + i) * 0.08;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.quadraticCurveTo(tail.x - 18, tail.y + (a + wv) * 18, tail.x - 34, tail.y + (a + wv) * 38);
        ctx.stroke();
      });
      const grad = ctx.createLinearGradient(0, -12 + L.y * 6, 0, 12 + L.y * 6);
      grad.addColorStop(0, '#a9aaa4');
      grad.addColorStop(0.45, '#8c8e8b');
      grad.addColorStop(1, '#3a3c3c');
      ctx.fillStyle = grad;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y - p.w) : ctx.moveTo(p.x, p.y - p.w)));
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + pts[i].w);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,40,40,0.35)';                         // segment bands
      ctx.lineWidth = 0.7;
      for (let i = 1; i < SEGMENTS; i++) {
        const p = pts[i];
        ctx.beginPath();
        ctx.moveTo(p.x - 1.5, p.y - p.w * 0.95);
        ctx.quadraticCurveTo(p.x - 4, p.y, p.x - 1.5, p.y + p.w * 0.95);
        ctx.stroke();
      }
      specular(ctx, L, 10, pts[4].y, 30, 7, 0.4);
      const head = pts[0];
      for (const side of [-1, 1]) {
        const w = Math.sin(bug.t * 7 + side * 2) * 0.2;
        antenna(ctx, head.x + 2, head.y + side * 3, side, [[66, 10 + w * 30], [88, 22 + w * 50]], 1, '#6a6a66', true);
      }
    });
  }
};
