import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg, insectGait, antenna, TAU, bodyEdge, fixedRandom } from '../common.js';
import { wingOutline, pollenColor, POLLEN_SIZE, POLLEN_AT } from './honeybee.js';

// Bumble bees (Bombus): big, round and thickly furred, told apart mostly by their bands of coloured hair.
// Unlike honey bees they vary a lot in size, even among workers from one nest, and they don't waggle dance.
// Their wings are smoky brown and lie back over the abdomen in a shallow V; workers carry pollen in baskets
// on their hind legs. Bands run front to back: face, thorax front and back, then abdomen segments T1-T5.
const Y = '#e8c440', K = '#1c1812', W = '#efe8d8', BF = '#e6d8a2', R = '#c8501c', G = '#c88a4a', GD = '#9a6a3a';
export const BUMBLE_BREEDS = [
  { id: 'easternbumblebee', label: 'Common eastern bumble bees', face: K, thorax: [Y, Y], abdomen: [Y, K, K, K, K] },   // B. impatiens
  { id: 'bufftailedbumblebee', label: 'Buff-tailed bumble bees', face: K, thorax: [Y, K], abdomen: [K, Y, K, K, BF] },  // B. terrestris
  { id: 'redtailedbumblebee', label: 'Red-tailed bumble bees', face: K, thorax: [K, K], abdomen: [K, K, K, R, R] },      // B. lapidarius
  { id: 'carderbumblebee', label: 'Common carder bees', face: GD, thorax: [G, G], abdomen: [G, GD, GD, G, G] },         // B. pascuorum
  { id: 'gardenbumblebee', label: 'Garden bumble bees', face: K, thorax: [Y, Y], abdomen: [Y, K, K, W, W] },            // B. hortorum
  { id: 'americanbumblebee', label: 'American bumble bees', face: K, thorax: [Y, K], abdomen: [Y, Y, K, K, K] },        // B. pensylvanicus
  { id: 'yellowfacedbumblebee', label: 'Yellow-faced bumble bees', face: Y, thorax: [Y, K], abdomen: [K, K, K, Y, K] }  // B. vosnesenskii
];
export const BUMBLE_IDS = BUMBLE_BREEDS.map(b => b.id);

// Chubby: a real bumble bee is only about twice as long as it is wide, with a big, nearly round abdomen.
export const HEAD_FRONT = 39;
export const THORAX = { cx: 14, rx: 15, ry: 16 };
export const ABDOMEN = { cx: -17, rx: 23, ry: 22 };
const OUTLINE = [[THORAX.cx, THORAX.rx, THORAX.ry]];
const LEGS = [
  { x: 22, angle: 0.9 },
  { x: 14, angle: 1.65 },
  { x: 6, angle: 2.5 }     // hind legs, with the pollen baskets
];
// Bumble bee forewings are long for the body (about 12-13 mm on a 11-17 mm worker), so at rest the tips reach
// the end of the abdomen or a little past it. DRAWN_BODY is the drawing's head-to-tail length in body units.
export const DRAWN_BODY = 82;
export const WING = { root: { x: 12, y: 12 }, spread: 0.3, length: 66, width: 21 };

// Short hairs bristling out round an ellipse, in the colours of the bands beneath.
function fur(ctx, rnd, cx, rx, ry, colorAt, n) {
  ctx.lineWidth = 1.1;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, r0 = 0.9 + rnd() * 0.1, r1 = 1.05 + rnd() * 0.14;
    const x0 = cx + Math.cos(a) * rx * r0, y0 = Math.sin(a) * ry * r0;
    ctx.strokeStyle = colorAt(x0);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(cx + Math.cos(a) * rx * r1, Math.sin(a) * ry * r1);
    ctx.stroke();
  }
}

function makeBumble(br) {
  // The colour of the hair at a given x along the body.
  const abdomenAt = x => br.abdomen[Math.min(4, Math.max(0, Math.floor((ABDOMEN.cx + ABDOMEN.rx - 2 - x) / ((ABDOMEN.rx * 2 - 2) / 5))))];
  const colorAt = x => (x > THORAX.cx - THORAX.rx + 2 ? (x > THORAX.cx ? br.thorax[0] : br.thorax[1]) : abdomenAt(x));
  return {
    id: br.id,
    size: [48.4, 55.6],        // adults, give or take a little
    previewSize: 54,
    // Legs attach only to the thorax; the test suite checks every hip lies within it.
    anatomy: { legSection: [THORAX.cx - THORAX.rx, THORAX.cx + THORAX.rx], hips: LEGS.map(l => l.x) },
    speed: [40, 75],
    pace: { drift: 0.3, dartRate: 0.02, dart: [1.3, 0.4] },   // a slow, bumbling walk
    pauseRate: 0.5,
    pauseTime: [0.6, 2.5],
    maxTurn: 3.5,
    wander: 1.2,
    stride: 20,
    discR: 0.22,           // a round, broad body for keeping bugs apart
    draw(ctx, bug) {
      const L = bug.light;
      const rnd = fixedRandom(Math.floor(bug.variant * 1e6) + 3);
      const pollen = bug.variant < 0.4;
      const loads = [];
      withBugFrame(ctx, bug, () => {
        groundShadow(ctx, L, -4, 0, 46, 28);
        for (const side of [-1, 1]) {
          LEGS.forEach((l, i) => {
            const leg = walkLeg(ctx, bug, { hx: l.x, hy: side * 7, edge: bodyEdge(l.x, OUTLINE) - 7, side, angle: l.angle, ...insectGait(bug, i, side), color: '#141008', segs: [
              ...(i === 2 ? [[14, 0, 3.2], [18, 0.3, 4.4], [10, 0.12, 2.8]] : [[13, 0, 3], [14, i === 0 ? -0.4 : 0.4, 2.4], [9, 0.2, 1.6]])
            ] });
            if (i === 2 && pollen) {
              const { knee, ankle } = leg.joints;
              loads.push({ x: knee.x + (ankle.x - knee.x) * POLLEN_AT, y: knee.y + (ankle.y - knee.y) * POLLEN_AT, angle: Math.atan2(ankle.y - knee.y, ankle.x - knee.x) });
            }
          });
        }
        // Abdomen: furred bands of colour.
        shadedEllipse(ctx, L, ABDOMEN.cx, 0, ABDOMEN.rx, ABDOMEN.ry, ['#5a5040', '#2a2418', '#0a0804']);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ABDOMEN.cx, 0, ABDOMEN.rx, ABDOMEN.ry, 0, 0, TAU);
        ctx.clip();
        const step = (ABDOMEN.rx * 2 - 2) / 5, front = ABDOMEN.cx + ABDOMEN.rx - 2;
        br.abdomen.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.globalAlpha = 0.92;
          ctx.fillRect(front - (i + 1) * step - 0.5, -ABDOMEN.ry - 1, step + 1, ABDOMEN.ry * 2 + 2);
        });
        ctx.globalAlpha = 1;
        ctx.restore();
        specular(ctx, L, ABDOMEN.cx, 0, ABDOMEN.rx, ABDOMEN.ry, 0.12);
        fur(ctx, rnd, ABDOMEN.cx, ABDOMEN.rx, ABDOMEN.ry, colorAt, 70);
        // Thorax: a furry ball, front and back halves in their own colours.
        shadedEllipse(ctx, L, THORAX.cx, 0, THORAX.rx, THORAX.ry, ['#5a5040', '#2a2418', '#0a0804']);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(THORAX.cx, 0, THORAX.rx, THORAX.ry, 0, 0, TAU);
        ctx.clip();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = br.thorax[0];
        ctx.fillRect(THORAX.cx, -THORAX.ry - 1, THORAX.rx + 1, THORAX.ry * 2 + 2);
        ctx.fillStyle = br.thorax[1];
        ctx.fillRect(THORAX.cx - THORAX.rx - 1, -THORAX.ry - 1, THORAX.rx + 1, THORAX.ry * 2 + 2);
        ctx.globalAlpha = 1;
        ctx.restore();
        specular(ctx, L, THORAX.cx, 0, THORAX.rx, THORAX.ry, 0.12);
        fur(ctx, rnd, THORAX.cx, THORAX.rx, THORAX.ry, colorAt, 50);
        // Smoky wings, lying back along each side.
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.translate(WING.root.x, side * WING.root.y);
          ctx.rotate(Math.PI - side * (WING.spread + (bug.loosen ? Math.sin(bug.t * 80) * 0.1 : 0)));   // whirring free of a tangle
          ctx.fillStyle = 'rgba(110,92,70,0.42)';
          ctx.strokeStyle = 'rgba(40,30,18,0.6)';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          wingOutline(WING.length, WING.width, side).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fill();
          const sheen = ctx.createLinearGradient(0, -WING.width, WING.length, WING.width);
          sheen.addColorStop(0, 'rgba(255,255,255,0)');
          sheen.addColorStop(0.45, 'rgba(255,245,230,0.18)');
          sheen.addColorStop(0.65, 'rgba(255,255,255,0)');
          ctx.fillStyle = sheen;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        for (const p of loads) {                                             // pollen in the baskets
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = pollenColor(bug);
          ctx.beginPath();
          ctx.ellipse(0, 0, POLLEN_SIZE[0] * 1.2, POLLEN_SIZE[1] * 1.2, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        // Head, tucked against the thorax, with dark eyes and elbowed antennae.
        shadedEllipse(ctx, L, 32, 0, 7, 10, [br.face, br.face, '#0a0804']);
        ctx.fillStyle = '#100c08';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(32, side * 7.5, 4.5, 2.6, side * 0.25, 0, TAU);
          ctx.fill();
          const w = Math.sin(bug.t * 3.5 + side * 1.3) * 0.15;
          antenna(ctx, 37, side * 3, side, [[44, 5 + w * 8], [50, 11 + w * 16]], 2, '#141008');
        }
      });
    }
  };
}

export const BUMBLES = BUMBLE_BREEDS.map(makeBumble);
