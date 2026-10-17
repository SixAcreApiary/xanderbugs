import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg, insectGait, antenna, bodyEdge, TAU } from '../common.js';

// Tripod gait: L1,R2,L3 move together, opposite to R1,L2,R3.

// Common North American ants, picked to look unlike one another. They share one body plan (head, mesosoma, one or
// two waist nodes, gaster); each kind has its own proportions, head and jaws, colours and pace. Real worker
// lengths run from ~1.5 mm (ghost ant) to ~11 mm (carpenter ant). The carpenter ant keeps the original 'ant' id
// so saved settings carry over.
//  - Carpenter (Camponotus): big and black.            - Fire (Solenopsis): reddish brown, darker gaster.
//  - Argentine (Linepithema): tiny, light to mid brown. - Pharaoh (Monomorium): the tiniest, pale amber.
//  - Texas leafcutter (Atta texana): rust, spiny, a big heart-shaped head and strong cutting jaws.
//  - Acrobat (Crematogaster): a heart-shaped black gaster, often cocked up, on a red-brown front.
//  - Red harvester (Pogonomyrmex barbatus): all red, a big square head with a beard of long hairs beneath.
//  - Trap-jaw (Odontomachus): long, straight snap jaws held open, a long head.
//  - Big-headed (Pheidole), a major worker: a huge head on a small body.
//  - Longhorn crazy (Paratrechina longicornis): dark, very long legs and antennae, runs erratically.
//  - Ghost (Tapinoma melanocephalum): a dark head and thorax, a pale see-through gaster and legs.
//  - Twig (Pseudomyrmex gracilis): slender and wasp-like, big eyes, orange and dark.
const BLACK = ['#5a4a42', '#1c1310', '#060302'];
const RUST = ['#c8784a', '#8a4018', '#3a1606'];
const SHAPE = { head: [34, 11, 10], meso: [12, 14, 6.5], gaster: [-25, 21, 14.5], nodes: [[-3, 4]], jaws: 'short', legs: 1, antennae: 1, eyes: 0 };
// Real-size scale shared by the ants (screen px per mm, as the carpenter ant is drawn).
const PX_PER_MM = 2.307;

export const ANT_BREEDS = [
  { id: 'ant', label: 'Carpenter ants', size: [25.1, 28.9], speed: [60, 100], front: BLACK, gaster: BLACK, leg: '#1a120e' },
  { id: 'fireant', label: 'Fire ants', size: [12.1, 13.9], speed: [42, 72], front: ['#d0703a', '#8a3414', '#3a1205'], gaster: ['#7a3a1c', '#3a1608', '#140602'], leg: '#5a230c' },
  { id: 'argentineant', label: 'Argentine ants', size: [7.9, 9.1], speed: [48, 76], front: ['#a0784a', '#6a4a28', '#2a1a0a'], gaster: ['#8a643c', '#5a3c1e', '#22140a'], leg: '#6a4a2a' },
  { id: 'pharaohant', label: 'Pharaoh ants', size: [6.5, 7.5], speed: [32, 52], front: ['#ecc678', '#c8902c', '#6a4410'], gaster: ['#c89a50', '#8a5a1c', '#3a2208'], leg: '#b8883a' },
  { id: 'leafcutterant', label: 'Texas leafcutter ants', mm: 6, speed: [50, 85], front: RUST, gaster: ['#b8703e', '#7a3a14', '#2a1004'], leg: '#8a4a20',
    shape: { head: [36, 14, 15], meso: [12, 13, 7], gaster: [-25, 16, 11.5], nodes: [[-2, 3.4], [-8, 4]], jaws: 'cutter', heart: true, spines: true, legs: 1.25, antennae: 1.2 } },
  { id: 'acrobatant', label: 'Acrobat ants', mm: 3, speed: [40, 70], front: ['#c86a3a', '#8a3814', '#3a1406'], gaster: ['#4a3a34', '#161010', '#040202'], leg: '#7a3a18',
    shape: { head: [33, 10, 9.5], meso: [13, 12, 5.5], gaster: [-23, 17, 15], nodes: [[0, 3], [-5, 3.5]], heartGaster: true } },
  { id: 'harvesterant', label: 'Red harvester ants', mm: 7, speed: [45, 80], front: ['#e0703a', '#a8381a', '#4a1206'], gaster: ['#d06a38', '#982e14', '#3a1006'], leg: '#8a2a10',
    shape: { head: [35, 13, 13], meso: [12, 14, 7], gaster: [-25, 19, 14], nodes: [[-2, 3.5], [-8, 4.2]], square: true, beard: true, legs: 1.1 } },
  { id: 'trapjawant', label: 'Trap-jaw ants', mm: 8, speed: [55, 95], front: ['#9a6a3a', '#5a3814', '#1e1004'], gaster: ['#8a5a30', '#4a2c10', '#180c04'], leg: '#6a4420',
    shape: { head: [36, 13, 9], meso: [11, 15, 6], gaster: [-27, 18, 13], nodes: [[-5, 3.5]], jaws: 'trap', legs: 1.15, antennae: 1.1, eyes: 0.18 } },
  { id: 'bigheadedant', label: 'Big-headed ants', mm: 4, speed: [30, 55], front: ['#d8a060', '#9a5e24', '#3a2008'], gaster: ['#a06a34', '#64381a', '#241006'], leg: '#a8743c',
    shape: { head: [36, 17, 18], meso: [11, 11, 5], gaster: [-22, 15, 11], nodes: [[-1, 3], [-5, 3.4]], heart: true } },
  { id: 'crazyant', label: 'Longhorn crazy ants', mm: 2.8, speed: [80, 140], dartRate: 0.6, front: ['#5a524c', '#24201c', '#080606'], gaster: ['#4a4440', '#1c1814', '#060404'], leg: '#3a3430',
    shape: { head: [34, 9.5, 8], meso: [13, 14, 5], gaster: [-24, 17, 12], nodes: [[-2, 3]], legs: 1.6, antennae: 1.7 } },
  { id: 'ghostant', label: 'Ghost ants', mm: 1.5, speed: [35, 60], front: ['#6a4a34', '#3a2414', '#140804'], gaster: ['#f4ecd8', '#d8ccb0', '#8a7a5a'], leg: '#e0d4b8',
    shape: { gaster: [-25, 20, 14], nodes: [[-3, 3.5]], ghost: true } },
  { id: 'twigant', label: 'Twig ants', mm: 8.5, speed: [55, 95], front: ['#f0a050', '#c06a20', '#5a2a08'], gaster: ['#6a4a34', '#2a1a10', '#0a0604'], leg: '#d08840',
    shape: { head: [36, 9, 7.5], meso: [15, 15, 5], gaster: [-32, 18, 9], nodes: [[-4, 2.6], [-11, 3.4]], legs: 0.95, antennae: 0.7, eyes: 0.42 } }
].map(b => ({ ...b, shape: { ...SHAPE, ...b.shape } }));
export const ANT_IDS = ANT_BREEDS.map(b => b.id);

// The body's drawn length, jaws' base to the tip of the gaster (what life size measures).
export function antLength({ shape: { head, gaster } }) {
  return head[0] + head[1] + 3 - (gaster[0] - gaster[1]);
}

function drawJaws(ctx, sh, color) {
  const f = sh.head[0] + sh.head[1];
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (sh.jaws === 'trap') {                 // long straight snap jaws, held open, hooked teeth at the tips
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.moveTo(f - 2, side * 3.5);
      ctx.lineTo(f + 24, side * 4.2);
      ctx.lineTo(f + 24, side * 1.2);
      ctx.stroke();
      continue;
    }
    if (sh.jaws === 'cutter') {               // big triangular cutting jaws with a toothed edge
      ctx.moveTo(f - 3, side * 6);
      ctx.quadraticCurveTo(f + 9, side * 9, f + 8, side * 1);
      ctx.lineTo(f + 5, side * 2.5);
      ctx.lineTo(f + 4, side * 1.2);
      ctx.lineTo(f, side * 3);
    } else {
      ctx.moveTo(f - 2, side * 3);
      ctx.quadraticCurveTo(f + 5, side * 6, f + 3, side * 0.5);
      ctx.lineTo(f - 1, side * 1);
    }
    ctx.fill();
  }
}

function drawHead(ctx, L, sh, colors) {
  const [cx, rx, ry] = sh.head;
  if (sh.heart) {                             // two lobes at the back make a heart-shaped head
    for (const side of [-1, 1]) shadedEllipse(ctx, L, cx - rx * 0.25, side * ry * 0.38, rx * 0.8, ry * 0.65, colors);
    shadedEllipse(ctx, L, cx + rx * 0.15, 0, rx * 0.85, ry * 0.75, colors);
  } else if (sh.square) {                     // a broad, square-cornered head
    ctx.fillStyle = colors[1];
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {            // a superellipse: square with rounded corners
      const a = (i / 24) * TAU, c = Math.cos(a), sn = Math.sin(a);
      const x = cx + rx * Math.sign(c) * Math.abs(c) ** 0.5, y = ry * Math.sign(sn) * Math.abs(sn) ** 0.5;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.fill();
    shadedEllipse(ctx, L, cx, 0, rx * 0.92, ry * 0.92, colors);
  } else {
    shadedEllipse(ctx, L, cx, 0, rx, ry, colors);
  }
  specular(ctx, L, cx, 0, rx, ry, 0.35);
  if (sh.eyes) {
    ctx.fillStyle = '#120c08';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + rx * 0.15, side * ry * 0.7, rx * sh.eyes, ry * sh.eyes * 0.8, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (sh.spines) {                            // spines at the back corners of the head
    ctx.fillStyle = colors[2];
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.8, side * ry * 0.65);
      ctx.lineTo(cx - rx * 1.25, side * ry * 0.95);
      ctx.lineTo(cx - rx * 0.6, side * ry * 0.85);
      ctx.fill();
    }
  }
  if (sh.beard) {                             // the harvester's psammophore: long hairs fringing the underside
    ctx.strokeStyle = 'rgba(240,210,170,0.7)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = -4; i <= 4; i++) { ctx.moveTo(cx + rx * 0.6, i * ry * 0.18); ctx.lineTo(cx + rx * 1.05, i * ry * 0.22); }
    ctx.stroke();
  }
}

function drawGaster(ctx, L, sh, colors) {
  const [cx, rx, ry] = sh.gaster;
  if (sh.heartGaster) {                       // heart-shaped, pointed at the tip
    ctx.fillStyle = colors[1];
    ctx.beginPath();
    ctx.moveTo(cx + rx, 0);
    ctx.bezierCurveTo(cx + rx * 1.1, -ry * 1.1, cx - rx * 0.4, -ry * 1.2, cx - rx, 0);
    ctx.bezierCurveTo(cx - rx * 0.4, ry * 1.2, cx + rx * 1.1, ry * 1.1, cx + rx, 0);
    ctx.fill();
  }
  if (sh.ghost) {                             // pale and see-through
    ctx.save();
    ctx.globalAlpha = 0.55;
    shadedEllipse(ctx, L, cx, 0, rx, ry, colors);
    ctx.restore();
  } else shadedEllipse(ctx, L, cx, 0, rx * (sh.heartGaster ? 0.85 : 1), ry * (sh.heartGaster ? 0.9 : 1), colors);
  specular(ctx, L, cx, 0, rx, ry, 0.35);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';       // segment lines
  ctx.lineWidth = 0.8;
  for (const [u, f] of [[0.333, 0.776], [-0.095, 0.862], [-0.476, 0.724]]) {
    ctx.beginPath();
    ctx.ellipse(cx + u * rx + 6, 0, 3, ry * f, 0, -1.2, 1.2);
    ctx.stroke();
  }
}

function makeAnt(br) {
  const sh = br.shape, [mx, mrx, mry] = sh.meso;
  const LEGS = [
    { x: mx + mrx * 0.57, angle: 0.95 },   // prothorax
    { x: mx + mrx * 0.07, angle: 1.65 },   // mesothorax
    { x: mx - mrx * 0.36, angle: 2.25 }    // metathorax
  ];
  const outline = [[mx, mrx, mry]];
  const length = antLength(br);
  const size = br.size ?? (() => { const mid = (br.mm * PX_PER_MM * 100) / length; return [Math.round(mid * 0.93 * 10) / 10, Math.round(mid * 1.07 * 10) / 10]; })();
  return {
    id: br.id,
    breed: br,
    size,
    previewSize: 38,
    // Legs attach only to the mesosoma (thorax); the test suite checks every hip lies within it.
    anatomy: { legSection: [mx - mrx, mx + mrx], hips: LEGS.map(l => l.x) },
    speed: br.speed,
    pace: { drift: 0.3, dartRate: br.dartRate ?? 0.08, dart: [1.5, 0.5] },   // speed drift and dart frequency/strength while walking
    pauseRate: 0.35,
    pauseTime: [0.2, 0.9],
    maxTurn: br.dartRate ? 6 : 4.5,
    wander: br.dartRate ? 2.6 : 1.6,
    stride: ((9 * size[0]) / 15) * sh.legs,   // steps in proportion to its size, as long as its legs reach
    greets: true,   // stops head to head with another ant of its own kind to touch antennae
    scent: true,    // lays a scent trail that other ants of its kind sometimes follow
    backLength: [0.06, 0.15],   // ants only shuffle back a fraction of their length
    draw(ctx, bug) {
      const L = bug.light, [hx, hrx, hry] = sh.head;
      withBugFrame(ctx, bug, () => {
        groundShadow(ctx, L, -2, 0, 58, 22);
        for (const side of [-1, 1]) {
          LEGS.forEach((l, i) => {
            walkLeg(ctx, bug, { hx: l.x, hy: side * 3, edge: bodyEdge(l.x, outline) - 3, side, angle: l.angle, ...insectGait(bug, i, side), color: br.leg, segs: [
              [20 * sh.legs, 0, 3.2], [22 * sh.legs, i === 0 ? -0.5 : 0.45, 2.4], [11 * sh.legs, 0.25, 1.6]
            ] });
          });
        }
        drawGaster(ctx, L, sh, br.gaster);
        for (const [nx, nr] of sh.nodes) shadedEllipse(ctx, L, nx, 0, nr, nr * 1.05, br.front);   // waist nodes
        shadedEllipse(ctx, L, mx, 0, mrx, mry, br.front);   // mesosoma
        if (sh.spines) {                                    // spines along the mesosoma
          ctx.fillStyle = br.front[2];
          for (const side of [-1, 1]) for (const u of [0.45, -0.1, -0.6]) {
            ctx.beginPath();
            ctx.moveTo(mx + u * mrx, side * mry * 0.6);
            ctx.lineTo(mx + u * mrx - 3, side * (mry + 4));
            ctx.lineTo(mx + u * mrx + 2, side * mry * 0.7);
            ctx.fill();
          }
        }
        specular(ctx, L, mx, 0, mrx, mry, 0.3);
        drawHead(ctx, L, sh, br.front);
        drawJaws(ctx, sh, br.leg);
        for (const side of [-1, 1]) {                         // elbowed antennae
          const w = bug.meet
            ? Math.sin(bug.t * 24 + side * 2.1) * 0.4 + Math.sin(bug.t * 37 + side) * 0.15   // rapid antennation
            : Math.sin(bug.t * 9 + side * 1.3) * 0.18;
          const sx = hx + hrx * 0.55, sy = Math.min(5, hry * 0.5), a = sh.antennae;
          const ex = sx + Math.cos(0.9 + w) * 16 * a, ey = sy + Math.sin(0.9 + w) * 16 * a;
          const tx = ex + Math.cos(-0.25 + w * 2) * 22 * a, ty = ey + Math.sin(-0.25 + w * 2) * 22 * a;
          antenna(ctx, sx, side * sy, side, [[ex, ey], [tx, ty]], 1.7, br.leg);
        }
      });
    }
  };
}

export const ANTS = ANT_BREEDS.map(makeAnt);
export default ANTS[0];
