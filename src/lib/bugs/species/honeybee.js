import { withBugFrame, shadedEllipse, bodyGradient, specular, groundShadow, walkLeg, insectGait, antenna, TAU, bodyEdge, fixedRandom } from '../common.js';

// Western honey bee (Apis mellifera) workers. Every breed shares one body; they differ in colour and
// temperament, following beekeepers' descriptions:
//  - Italian (A. m. ligustica): bright golden-yellow abdomen with clear bands; gentle and calm.
//  - Cordovan: an Italian strain lacking black pigment, so caramel-gold all over.
//  - Buckfast: Brother Adam's hybrid, amber-tan with brownish bands; very gentle.
//  - Carniolan (A. m. carnica): dark brown-grey with grey hair bands; very calm on the comb.
//  - Caucasian (A. m. caucasia): lead-grey with brownish hair; the gentlest of all.
//  - Russian (Primorsky): dark with faint brown bands; more defensive and quick to alarm.
//  - German / European dark bee (A. m. mellifera): almost black, sparse hair; nervous and "runny".

const LEGS = [
  { x: 22, angle: 0.9 },   // prothorax: short, reaching forward
  { x: 15, angle: 1.65 },  // mesothorax: out to the side
  { x: 9, angle: 2.55 }    // metathorax: long, sweeping back along the abdomen; broad pollen-basket segments
];

// Honey bee legs are always dark brown to black: yellow legs are a wasp's mark, never a bee's.
export const BREEDS = [
  { id: 'italianbee', label: 'Italian honey bees', temper: 0.9,
    body: ['#f4c24a', '#c98a1c', '#5a3a08'], band: '#3a2408', fuzz: '#e8c88a', legs: '#3a2a14', bands: 3 },
  { id: 'cordovanbee', label: 'Cordovan honey bees', temper: 0.9,
    body: ['#f0b860', '#c47c2c', '#6a3a10'], band: '#9a5a20', fuzz: '#ecc890', legs: '#5a3418', bands: 3 },
  { id: 'buckfastbee', label: 'Buckfast honey bees', temper: 0.85,
    body: ['#d8a050', '#a86c24', '#4a2c0a'], band: '#3a240c', fuzz: '#d8b888', legs: '#3a2a16', bands: 4 },
  { id: 'carniolanbee', label: 'Carniolan honey bees', temper: 0.8,
    body: ['#7a6a5a', '#4a3a2c', '#1a120c'], band: '#b8b0a4', fuzz: '#c0b8aa', legs: '#2a2018', bands: 4, hairBands: true },
  { id: 'caucasianbee', label: 'Caucasian honey bees', temper: 0.7,
    body: ['#6a6660', '#3e3a36', '#141210'], band: '#a8a090', fuzz: '#a89c88', legs: '#24201c', bands: 4, hairBands: true },
  { id: 'russianbee', label: 'Russian honey bees', temper: 1.2,
    body: ['#6a5a48', '#3e3022', '#120c06'], band: '#8a6a3a', fuzz: '#b0a48e', legs: '#241c14', bands: 4 },
  { id: 'darkbee', label: 'German black honey bees', temper: 1.4,
    body: ['#4a423a', '#26201a', '#080604'], band: '#5a4a38', fuzz: '#7a6e5e', legs: '#1a1612', bands: 4 }
];

export const BEE_IDS = BREEDS.map(b => b.id);

// Pale hairs fringing the thorax, fixed per bee so they don't flicker.
function fuzz(ctx, bug, color) {
  const rnd = fixedRandom(Math.floor(bug.variant * 1e6) + 7);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const a = rnd() * TAU, r0 = THORAX_RY - 1.5 + rnd() * 2, r1 = r0 + 1.5 + rnd() * 2;
    ctx.moveTo(16 + Math.cos(a) * r0 * 1.1, Math.sin(a) * r0);
    ctx.lineTo(16 + Math.cos(a) * r1 * 1.1, Math.sin(a) * r1);
  }
  ctx.stroke();
}

// Real body dimensions in mm (mid-range): total length, thorax width, widest point of the abdomen. The thorax
// is a rigid shell, so its width is what stays constant within a caste (it is what queen excluders, spaced
// about 4.1-4.4 mm, rely on); every caste's shape below is derived from these numbers.
export const REAL_MM = {
  worker: { length: 13.5, thorax: 4.05, abdomen: 4.15 },
  drone: { length: 16, thorax: 4.75, abdomen: 5.25 },
  queen: { length: 19, thorax: 5, abdomen: 5.5 }
};

// Drawing in body units (a bug's size is 100 units): the head's front is at x = 39, the abdomen joins the
// waist at x = 8, the thorax is the same shape in every caste and the whole body is scaled by caste size.
const HEAD_FRONT = 39;
const ABDOMEN_FRONT = 8;
const WORKER_SIZE = 48;
const WORKER_LENGTH = 79;   // worker head-to-tip length in body units
export const THORAX_RY = (WORKER_LENGTH * REAL_MM.worker.thorax) / REAL_MM.worker.length / 2;

// Each caste's size scales the rigid thorax to its real width; the abdomen is then stretched (or not) to give
// the real body length and widened to the real abdomen width. A worker's abdomen ends about where her folded
// wings do; a drone's is stout and blunt (no sting); a queen's reaches well past her folded wings.
export const CASTE_SIZE = {};
export const ABDOMEN = {};
for (const [caste, mm] of Object.entries(REAL_MM)) {
  const size = (WORKER_SIZE * mm.thorax) / REAL_MM.worker.thorax;
  const length = (WORKER_LENGTH * (mm.length / REAL_MM.worker.length) * WORKER_SIZE) / size;
  const rx = (ABDOMEN_FRONT - (HEAD_FRONT - length)) / 2;
  CASTE_SIZE[caste] = size;
  ABDOMEN[caste] = { cx: ABDOMEN_FRONT - 4 - rx, rx, ry: (THORAX_RY * mm.abdomen) / mm.thorax, tip: caste !== 'drone' };
}
const OUTLINE = [[16, 12, THORAX_RY]];   // thorax
export const WING_ROOT = 14;   // where the folded wings attach on the thorax (body units)
export const WING_SPREAD = 0.35;   // radians each resting wing angles out from the midline (about 20 degrees)
export const WING_ROOT_Y = 0.75;   // wings hinge on the sides of the thorax: this share of its half-width out
// Real wing dimensions in mm by caste (morphometric studies, mid-range; drones from European stocks). The
// hindwing is tucked mostly beneath the forewing at rest. A worker's forewing (~9.1 mm, mean chord ~1.84 mm)
// ends about where her abdomen does; a queen's is barely longer, so her long abdomen sticks out well behind
// it; a drone's big wings reach just past his abdomen.
export const WING_MM = {
  worker: { fore: 9.18, foreWidth: 3.065, hind: 6.2, hindWidth: 1.82 },
  queen: { fore: 9.55, foreWidth: 3.33, hind: 7.5, hindWidth: 2.2 },
  drone: { fore: 11.07, foreWidth: 3.41, hind: 7.15, hindWidth: 2.61 }
};
export const WING_MEAN_CHORD = 1.84 / 3.065;   // a worker forewing's mean width over its widest
const PX_PER_MM = (WORKER_SIZE * WORKER_LENGTH) / 100 / REAL_MM.worker.length;
// A caste's wing dimensions in its own body units.
export function wingDims(caste) {
  const u = (PX_PER_MM * 100) / CASTE_SIZE[caste], w = WING_MM[caste];
  return { fore: w.fore * u, foreWidth: w.foreWidth * u, hind: w.hind * u, hindWidth: w.hindWidth * u };
}
// Folded wings reach back to WING_ROOT - fore; an abdomen tip is at 4 + cx - rx.

// A folded wing's outline (root at 0, tip at x = len): narrower at the hinge (but no thin stalk), widest about
// four fifths of the way out, with a rounded tip, and more of it behind the leading edge than in front. Its
// mean width is ~2/3 of its widest, a little fuller than a real forewing's ~60% so the base isn't pinched.
// side picks the mirror image.
const chordShape = t => (0.2 + 0.8 * t ** 1.6) * Math.sqrt(Math.max(0, 1 - t ** 6));
const CHORD_PEAK = Math.max(...Array.from({ length: 1001 }, (_, i) => chordShape(i / 1000)));
export const wingChord = (t, width) => (width * chordShape(t)) / CHORD_PEAK;
export function wingOutline(len, width, side, n = 40) {
  const chord = t => wingChord(t, width);
  const lead = [], trail = [];
  for (let i = 0; i <= n; i++) {
    const t = 1 - (1 - i / n) ** 1.5, c = chord(t);   // points bunch up toward the rounded tip
    lead.push([t * len, -side * c * 0.35]);
    trail.push([t * len, side * c * 0.65]);
  }
  return [...lead, ...trail.reverse()];
}

// Honey bee forewing venation, as (t along the wing, s across it) with s = -0.35 the leading edge and 0.65
// the trailing edge: a heavy costal vein along the front, the long narrow marginal cell near the tip, three
// submarginal cells beneath it, and the basal veins and cells. The outer part of the wing has no veins at
// all (unlike a fly's, whose veins run right out to the edge).
const VEINS = [
  [[0.02, -0.3], [0.5, -0.32], [0.62, -0.34]],                                          // costa / radius
  [[0.56, -0.3], [0.72, -0.34], [0.86, -0.3], [0.9, -0.2], [0.8, -0.12], [0.62, -0.16], [0.56, -0.3]],   // marginal cell
  [[0.5, -0.18], [0.62, -0.06], [0.72, 0.0], [0.82, -0.04], [0.86, -0.18]],            // lower edge of the submarginals
  [[0.6, -0.16], [0.62, -0.06]], [[0.68, -0.14], [0.7, -0.01]], [[0.78, -0.13], [0.8, -0.03]],   // submarginal cross-veins
  [[0.04, -0.12], [0.3, -0.12], [0.5, -0.18]],                                          // media
  [[0.06, 0.05], [0.3, 0.12], [0.46, 0.22], [0.62, -0.06]],                              // cubitus, closing the discoidal cell
  [[0.3, -0.12], [0.3, 0.12]],                                                           // basal cross-vein
  [[0.46, 0.22], [0.58, 0.32]], [[0.1, 0.2], [0.32, 0.38]]                               // anal veins
];
function drawVenation(ctx, len, width, side) {
  const P = (t, s) => [t * len, side * s * Math.max(wingChord(t, width), width * 0.35)];
  ctx.strokeStyle = 'rgba(46,32,18,0.7)';
  VEINS.forEach((vein, i) => {
    ctx.lineWidth = i === 0 ? 1.1 : 0.55;
    ctx.beginPath();
    vein.forEach(([t, s], j) => { const [x, y] = P(t, s); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  });
}
export const VEIN_REACH = Math.max(...VEINS.flat().map(([t]) => t));   // how far out along the wing the veins go

function wing(ctx, len, width, side) {
  ctx.beginPath();
  wingOutline(len, width, side).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// On-screen dimensions in pixels: head-to-tip length, thorax width and abdomen width.
export function beeDims(b) {
  const a = ABDOMEN[b.caste ?? 'worker'], k = b.size / 100;
  return { length: (HEAD_FRONT - (4 + a.cx - a.rx)) * k, thorax: 2 * THORAX_RY * k, abdomen: 2 * a.ry * k };
}
export const beeLength = b => beeDims(b).length;

// The abdomen seen from above is egg-shaped: it joins the thorax broadly (no visible waist), is widest about
// a third of the way back and tapers to a rounded point; a drone's is blunter. Spans cx +- rx, half-width ry.
const EGG = { worker: { widest: 0.36, taper: 0.75 }, queen: { widest: 0.3, taper: 0.8 }, drone: { widest: 0.42, taper: 0.45 } };
export function abdomenOutline({ cx, rx, ry }, egg, n = 24) {
  const front = cx + rx, len = rx * 2, wx = front - len * egg.widest;
  const half = x => {
    if (x >= wx) return ry * Math.sqrt(Math.max(0, 1 - ((x - wx) / (front - wx)) ** 2));
    return ry * Math.max(0, 1 - ((wx - x) / (wx - (cx - rx))) ** 2) ** egg.taper;
  };
  const xs = Array.from({ length: n + 1 }, (_, i) => front - (len * i) / n);
  return [...xs.map(x => [x, -half(x)]), ...xs.reverse().map(x => [x, half(x)])];
}

function abdomen(ctx, L, br, sway, shape, egg) {
  const { cx, rx, ry, tip } = shape;
  const outline = () => {
    ctx.beginPath();
    abdomenOutline(shape, egg).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(4, 0);
  ctx.rotate(sway);                          // waggling, or curling round to sting: it swings from the thorax
  ctx.fillStyle = bodyGradient(ctx, L, cx + rx * 0.3, 0, rx, ry, br.body);
  outline();
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Tergites: curved segment edges bowing toward the tip, with the breed's colour bands along them.
  const front = cx + rx - 6, step = (rx * 2 - 10) / 6;
  ctx.lineCap = 'butt';
  for (let i = 0; i < 6; i++) {
    const x = front - i * step;
    const arc = w => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, -ry * 1.2); ctx.quadraticCurveTo(x - ry * 0.55, 0, x, ry * 1.2); ctx.stroke(); };
    if (i < br.bands) {
      ctx.strokeStyle = br.band;
      ctx.globalAlpha = br.hairBands ? 0.75 : 0.9;
      arc(br.hairBands ? 2.5 : 3.5);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    arc(0.6);
  }
  ctx.fillStyle = br.body[2];                 // dark tip
  ctx.beginPath();
  if (tip) ctx.ellipse(cx - rx + 4, 0, 6, ry * 0.65, 0, 0, TAU);
  else ctx.ellipse(cx - rx + 2, 0, 3, ry * 0.8, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  specular(ctx, L, cx + rx * 0.2, 0, rx * 0.8, ry, 0.28);
  ctx.restore();
}

// Pollen loads take the colour of the flowers visited: yellow (dandelion, sunflower), orange (crocus), brick
// red (horse chestnut), cream (clover), grey (willow), blue (phacelia), olive (lime), brown (oak). A bee's
// two loads match, since both come from the same flowers.
export const POLLEN_COLORS = ['#f0c020', '#f08a20', '#b8441c', '#e8dca0', '#9a9a92', '#4a5aa8', '#8a9a3a', '#9a6a30'];
export const POLLEN_SIZE = [5.5, 4.2];   // half length and half width of a load, in body units
export const POLLEN_AT = 0.55;           // where the basket sits along the hind tibia, knee to ankle
export const pollenColor = bug => POLLEN_COLORS[Math.floor(bug.variant * 1e4) % POLLEN_COLORS.length];

const QUEEN_MARKS = ['#f4f4f4', '#f0d020', '#e02020', '#20a040', '#2060e0'];   // beekeepers' year colours

function makeBee(br) {
  return {
    id: br.id,
    // Honey bees are all but identical in size (each is raised in a standard comb cell): one size per caste.
    size: [CASTE_SIZE.worker, CASTE_SIZE.worker],
    previewSize: 56,
    // Legs attach only to the thorax; the test suite checks every hip lies within it.
    anatomy: { legSection: [5, 27], hips: LEGS.map(l => l.x) },
    speed: [55, 100].map(v => v * (0.85 + 0.15 * br.temper)),
    // Nervous breeds dart and pause more; calm ones plod steadily.
    pace: { drift: 0.25, dartRate: 0.06 * br.temper, dart: [1.5, 0.4] },
    pauseRate: 0.4 * br.temper,
    pauseTime: [0.4, 2],
    maxTurn: 4.5,
    wander: 1.1 * br.temper,
    stride: 21,            // long, unhurried steps for a bee this size
    nerves: br.temper,     // scales how readily it takes fright
    dances: true,          // workers now and then perform a waggle dance (drones and queens never do)
    // Most bees are workers; some are drones and a few are queens, sized from REAL_MM. Only one queen of each
    // breed is ever about at once.
    castes: {
      drone: { chance: 0.01, size: [CASTE_SIZE.drone, CASTE_SIZE.drone], pace: 0.9 },
      queen: { chance: 0.01, size: [CASTE_SIZE.queen, CASTE_SIZE.queen], pace: 0.55 }   // stately
    },
    draw(ctx, bug) {
      const L = bug.light;
      const caste = bug.caste ?? 'worker';
      const d = bug.dance;
      const waggling = d?.stage === 'run';
      const fighting = !!bug.duel;
      // The waggle is the abdomen swinging fast from side to side (the wings stay folded); a fighting queen
      // curls hers round, trying to sting.
      const sway = waggling ? Math.sin(bug.t * 12 * TAU) * 0.22 : fighting ? Math.sin(bug.t * 5) * 0.4 : 0;
      // Wings buzz in a fight, and in short bursts while resting.
      const resting = bug.paused && Math.sin(bug.t * 0.6) > 0.93;           // a resting bee only rarely twitches its wings
      const flick = fighting || bug.loosen ? Math.sin(bug.t * 95) * 0.1 : resting ? Math.sin(bug.t * 95) * 0.05 : 0;   // whirring free of a tangle
      const pollen = caste === 'worker' && bug.variant < 0.35;
      const wd = wingDims(caste);
      const loads = [];
      withBugFrame(ctx, bug, () => {
        if (caste === 'queen') groundShadow(ctx, L, -14, 0, 60, 19);
        else groundShadow(ctx, L, -6, 0, 50, 19);
        for (const side of [-1, 1]) {
          LEGS.forEach((l, i) => {
            const leg = walkLeg(ctx, bug, { hx: l.x, hy: side * 5, edge: bodyEdge(l.x, OUTLINE) - 5, side, angle: l.angle, ...insectGait(bug, i, side), color: br.legs, segs: [
              ...(i === 2 ? [[13, 0, 2.8], [17, 0.3, 3.8], [10, 0.12, 2.6]] : [[12, 0, 2.6], [13, i === 0 ? -0.4 : 0.4, 1.9], [8, 0.2, 1.3]])
            ] });
            // The pollen basket is a fixed spot on the hind tibia, so the load moves with that segment; it's drawn
            // later, over the wings' edges.
            if (i === 2 && pollen) {
              const { knee, ankle } = leg.joints;
              loads.push({ x: knee.x + (ankle.x - knee.x) * POLLEN_AT, y: knee.y + (ankle.y - knee.y) * POLLEN_AT, angle: Math.atan2(ankle.y - knee.y, ankle.x - knee.x), side });
            }
          });
        }
        abdomen(ctx, L, br, sway, ABDOMEN[caste], EGG[caste]);
        shadedEllipse(ctx, L, 16, 0, 12, THORAX_RY, [br.fuzz, br.body[1], br.body[2]]);   // hairy thorax
        fuzz(ctx, bug, br.fuzz);
        specular(ctx, L, 16, 0, 12, THORAX_RY, 0.18);
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';                              // the rounded scutum plate on top
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(17, 0, 7.5, THORAX_RY * 0.62, 0, 0, TAU);
        ctx.stroke();
        if (caste === 'queen' && bug.variant < 0.6) {                        // beekeeper's paint mark
          ctx.fillStyle = QUEEN_MARKS[Math.floor(bug.variant * 100) % QUEEN_MARKS.length];
          ctx.beginPath();
          ctx.arc(17, 0, 3.6, 0, TAU);
          ctx.fill();
        }
        for (const side of [-1, 1]) {                                        // clear wings folded over the back
          ctx.save();
          // Each wing hinges on its own side of the thorax and, at rest, lies back along that side of the abdomen,
          // angled a little outward, so the two never cross.
          ctx.translate(WING_ROOT, side * THORAX_RY * WING_ROOT_Y);
          ctx.rotate(Math.PI - side * (WING_SPREAD + flick));
          // Forewing over the smaller hindwing tucked beneath it: clear membrane, dark veins, a faint sheen.
          const F = wd.fore, W = wd.foreWidth;
          ctx.fillStyle = 'rgba(226,232,240,0.4)';
          ctx.strokeStyle = 'rgba(40,34,28,0.6)';
          ctx.lineWidth = 0.7;
          ctx.save();
          ctx.translate(2, side * 1.5);
          wing(ctx, wd.hind, wd.hindWidth, side);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          wing(ctx, F, W, side);
          ctx.fill();
          const sheen = ctx.createLinearGradient(0, -W, F, W);
          sheen.addColorStop(0, 'rgba(255,255,255,0)');
          sheen.addColorStop(0.4, 'rgba(255,255,255,0.3)');
          sheen.addColorStop(0.6, 'rgba(255,255,255,0)');
          ctx.fillStyle = sheen;
          ctx.fill();
          ctx.stroke();
          drawVenation(ctx, F, W, side);
          ctx.restore();
        }
        for (const p of loads) {                                             // pollen loads packed in the baskets
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);                                              // lies along the tibia
          ctx.fillStyle = pollenColor(bug);
          ctx.beginPath();
          ctx.ellipse(0, 0, POLLEN_SIZE[0], POLLEN_SIZE[1], 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';                         // packed and slightly moist, so it catches the light
          ctx.beginPath();
          ctx.ellipse(-1, -p.side, POLLEN_SIZE[0] * 0.4, POLLEN_SIZE[1] * 0.35, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        shadedEllipse(ctx, L, 32, 0, 7, THORAX_RY * 0.88, [br.body[1], br.body[2], '#040302']);   // head, nearly as wide as the thorax
        ctx.fillStyle = '#16120e';
        for (const side of [-1, 1]) {                                        // compound eyes: a drone's wrap round and meet on top
          ctx.beginPath();
          if (caste === 'drone') ctx.ellipse(31, side * 4.2, 6.5, 4.6, side * 0.15, 0, TAU);
          else ctx.ellipse(32, side * 6.5, 4.5, 2.8, side * 0.25, 0, TAU);
          ctx.fill();
          // Antennae flicker during a dance, and work busily over the queen when tending her.
          const w = Math.sin(bug.t * (bug.attend ? 13 : waggling ? 9 : 4) + side * 1.3) * (bug.attend ? 0.3 : 0.2);  // elbowed antennae
          antenna(ctx, 37, side * 2.5, side, [[44, 4.5 + w * 8], [50, 10 + w * 18]], 1.9, '#1a140e');   // short, stout, elbowed
        }
      });
    }
  };
}

export const BEES = BREEDS.map(makeBee);
export const BEE_LABELS = BREEDS.map(b => ({ id: b.id, label: b.label }));
