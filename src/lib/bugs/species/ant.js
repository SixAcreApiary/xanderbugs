import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg, insectGait, antenna, bodyEdge } from '../common.js';

// Tripod gait: L1,R2,L3 move together, opposite to R1,L2,R3.
const OUTLINE = [[12, 14, 6.5]];   // mesosoma, where the legs leave the body

const LEGS = [
  { x: 20, angle: 0.95 },  // prothorax
  { x: 13, angle: 1.65 },  // mesothorax
  { x: 7, angle: 2.25 }    // metathorax
];

// Common household and garden ants. They share one body; each kind has its own size (real worker lengths
// run from ~1.5 mm for pharaoh ants to ~13 mm for carpenter ants), colours and pace. The carpenter ant keeps
// the original 'ant' id so saved settings carry over.
//  - Carpenter (Camponotus): big and black.          - Field (Formica): red-orange head and thorax, black gaster.
//  - Fire (Solenopsis): reddish brown, darker gaster. - Pavement (Tetramorium): dark brown-black, paler legs.
//  - Odorous house (Tapinoma): small, dark brown.     - Argentine (Linepithema): tiny, light to mid brown.
//  - Pharaoh (Monomorium): the tiniest, pale yellow-amber with a darker tip.
const BLACK = ['#5a4a42', '#1c1310', '#060302'];
export const ANT_BREEDS = [
  { id: 'ant', label: 'Carpenter ants', size: [24, 30], speed: [60, 100], front: BLACK, gaster: BLACK, leg: '#1a120e' },
  { id: 'fieldant', label: 'Field ants', size: [17, 22], speed: [70, 115], front: ['#d8643a', '#a03a18', '#401406'], gaster: BLACK, leg: '#3a1a0c' },
  { id: 'fireant', label: 'Fire ants', size: [11, 15], speed: [50, 85], front: ['#d0703a', '#8a3414', '#3a1205'], gaster: ['#7a3a1c', '#3a1608', '#140602'], leg: '#5a230c' },
  { id: 'pavementant', label: 'Pavement ants', size: [9, 12], speed: [45, 75], front: ['#5a4232', '#2a1a10', '#0a0604'], gaster: ['#4a3628', '#20140a', '#080402'], leg: '#7a5a3a' },
  { id: 'odoroushouseant', label: 'Odorous house ants', size: [8, 11], speed: [55, 90], front: ['#5a4030', '#2a1a10', '#0a0604'], gaster: ['#4a3426', '#22140a', '#080402'], leg: '#3a2818' },
  { id: 'argentineant', label: 'Argentine ants', size: [7, 10], speed: [60, 95], front: ['#a0784a', '#6a4a28', '#2a1a0a'], gaster: ['#8a643c', '#5a3c1e', '#22140a'], leg: '#6a4a2a' },
  { id: 'pharaohant', label: 'Pharaoh ants', size: [6, 8], speed: [40, 65], front: ['#ecc678', '#c8902c', '#6a4410'], gaster: ['#c89a50', '#8a5a1c', '#3a2208'], leg: '#b8883a' }
];
export const ANT_IDS = ANT_BREEDS.map(b => b.id);

function makeAnt(br) {
  return {
    id: br.id,
    size: br.size,
    previewSize: 38,
    // Legs attach only to the mesosoma (thorax); the test suite checks every hip lies within it.
    anatomy: { legSection: [-2, 26], hips: LEGS.map(l => l.x) },
    speed: br.speed,
    pace: { drift: 0.3, dartRate: 0.08, dart: [1.5, 0.5] },   // speed drift and dart frequency/strength while walking
    pauseRate: 0.35,
    pauseTime: [0.2, 0.9],
    maxTurn: 4.5,
    wander: 1.6,
    stride: (7 * br.size[0]) / 15,   // steps in proportion to its size
    greets: true,   // stops head to head with another ant of its own kind to touch antennae
    scent: true,    // lays a scent trail that other ants of its kind sometimes follow
    backLength: [0.06, 0.15],   // ants only shuffle back a fraction of their length
    draw(ctx, bug) {
      const pal = { body: br.front, gaster: br.gaster, leg: br.leg };
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
        shadedEllipse(ctx, L, -25, 0, 21, 14.5, pal.gaster);   // gaster
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
}

export const ANTS = ANT_BREEDS.map(makeAnt);
export default ANTS[0];
