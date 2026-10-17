import { shadedEllipse, specular, groundShadow, TAU, fixedRandom } from '../common.js';
import { sampleTrail } from './centipede.js';

// Caterpillars: twelve common North American kinds, picked to look unlike one another, the woolly bear among them.
// The body is a chain of segments that follows the head's path. A caterpillar crawls with a wave that runs from
// tail to head: the segment it reaches bunches up, lifts its prolegs and is carried forward, while the rest stay
// planted. An inchworm instead loops: it draws its tail up behind its front legs, arching its middle, then reaches
// forward. Three pairs of small true legs sit behind the head; fleshy prolegs grip midway and at the tail.
// Sizes are each kind's typical full-grown length. They crawl faster than real caterpillars (a few mm a second)
// so that they still cross the page in reasonable time, but remain the slowest bugs.
const PX_PER_MM = 2.8;   // the scale the rest of the bugs are drawn at
const N = 13;            // head and twelve body segments
const SPACING = 100 / (N - 1);
const TRUE_LEGS = [1, 2, 3], PROLEGS = [6, 7, 8, 9, 12];
const WAVE = 0.35;       // how far a segment bunches up as the wave passes (fraction of its spacing)

const GREEN = ['#b8f080', '#6ab838', '#2a5a10'];
export const CATERPILLAR_BREEDS = [
  // Pyrrharctia isabella, the woolly bear: densely bristly, black at both ends with a rusty-orange middle.
  { id: 'woollybear', label: 'Woolly bear', mm: 50, width: 0.17, body: ['#3a3430', '#141210', '#040404'], head: ['#2a2420', '#0a0806', '#000000'],
    bands: i => (i >= 4 && i <= 9 ? ['#d88a40', '#a85818', '#4a2004'] : null), hair: { color: i => (i >= 4 && i <= 9 ? '#c87a34' : '#1a1614'), len: 7, n: 12 },
    speed: [26, 42], prey: 0.2 },
  // Danaus plexippus, the monarch: banded black, yellow and white, with a pair of black filaments at each end.
  { id: 'monarchcaterpillar', label: 'Monarch', mm: 45, width: 0.13, body: ['#ffffff', '#ece8dc', '#8a8678'], head: ['#3a3a3a', '#0a0a0a', '#000000'],
    rings: ['#141414', '#ffd820', '#141414'], filaments: [2, 11], speed: [20, 34], prey: 0.3 },
  // Papilio polyxenes, the black swallowtail: green, each segment banded black and dotted yellow-orange.
  { id: 'blackswallowtailcaterpillar', label: 'Black swallowtail', mm: 45, width: 0.15, body: GREEN, head: GREEN,
    rings: ['#141414'], ringDots: '#ffb020', speed: [20, 32], prey: 0.6 },
  // Papilio troilus, the spicebush swallowtail: green and fat in front, with two big false eyes and rows of blue dots.
  { id: 'spicebushcaterpillar', label: 'Spicebush swallowtail', mm: 40, width: 0.17, body: ['#c8f090', '#78c040', '#2a5a10'], head: ['#d8c890', '#a8946a', '#4a3a20'],
    swell: [2, 3, 4], eyespots: 3, dots: { color: '#4a8aff', v: [0.35], from: 5 }, speed: [18, 30], prey: 0.6 },
  // Manduca quinquemaculata, the tomato hornworm: big and green, white V marks along each side, a horn at the tail.
  { id: 'hornworm', label: 'Tomato hornworm', mm: 75, width: 0.16, body: ['#c0f088', '#68b83a', '#285a10'], head: ['#a8e070', '#58a030', '#205010'],
    chevrons: '#f4f8e8', horn: '#2a3a8a', spiracles: '#1a1a1a', speed: [18, 30], prey: 0.6 },
  // Hyalophora cecropia: huge and blue-green, with red-orange knobs behind the head, yellow ones down the back
  // and blue ones along the sides.
  { id: 'cecropiacaterpillar', label: 'Cecropia', mm: 90, width: 0.18, body: ['#c8f0d8', '#78c8a0', '#2a6a4a'], head: ['#a8d8b0', '#68a878', '#2a5a3a'],
    knobs: [{ from: 1, to: 3, color: '#ff6a2a', v: 0.55, r: 2.6 }, { from: 4, to: 12, color: '#ffd830', v: 0.4, r: 1.8 }, { from: 1, to: 12, color: '#4a8aff', v: 0.9, r: 1.2 }],
    speed: [22, 34], prey: 0.4 },
  // Acharia stimulea, the saddleback: short and squat, brown with a green saddle bearing a white-ringed brown spot,
  // and stinging horns at both ends.
  { id: 'saddleback', label: 'Saddleback', mm: 22, width: 0.32, body: ['#a87a5a', '#6a4430', '#2a1408'], head: ['#6a4430', '#3a2010', '#140804'],
    saddle: true, horns: [1, 12], speed: [18, 28], prey: 0.1 },
  // Lophocampa caryae, the hickory tussock moth: white and fluffy, black tufts down the back and long black lashes.
  { id: 'tussockcaterpillar', label: 'Hickory tussock', mm: 40, width: 0.14, body: ['#ffffff', '#ecece8', '#9a9a94'], head: ['#3a3a3a', '#0a0a0a', '#000000'],
    hair: { color: () => '#f4f4f0', len: 9, n: 16 }, tufts: { color: '#141414', from: 2, to: 11 }, lashes: [3, 10], speed: [20, 34], prey: 0.1 },
  // A geometrid inchworm: slender and green, with legs only at the front and the tail end; it loops along.
  { id: 'inchworm', label: 'Inchworm', mm: 25, width: 0.07, body: ['#d0f8a0', '#88c850', '#3a6a18'], head: ['#c0e890', '#78b040', '#305a14'],
    stripe: '#e8ffd0', loops: true, prolegs: [11, 12], speed: [20, 32], prey: 0.5 },
  // Megalopyge opercularis, the puss caterpillar: a furry teardrop of long tan hair combed into a crest and a tail.
  { id: 'pusscaterpillar', label: 'Puss caterpillar', mm: 30, width: 0.32, taper: 'teardrop', body: ['#e8d0a8', '#b8946a', '#5a4026'], head: ['#5a4026', '#2a1c10', '#0a0604'],
    fur: { colors: ['#e8d4b0', '#c8a878', '#a8865a'], len: 13, n: 26 }, crest: '#8a6a44', speed: [18, 28], prey: 0.1 },
  // Automeris io: lime green, a red-over-white stripe along each side, rosettes of branched stinging spines.
  { id: 'iocaterpillar', label: 'Io moth', mm: 60, width: 0.15, body: ['#d8ff90', '#98d840', '#4a7a10'], head: ['#c8e880', '#88c040', '#3a6a10'],
    sideStripes: ['#e82a2a', '#ffffff'], spines: { color: '#a8e050', tip: '#2a2a1a' }, speed: [18, 30], prey: 0.1 },
  // Malacosoma americanum, the eastern tent caterpillar: dark, a white stripe down the back flanked by broken
  // orange lines, blue spots along the sides, sparse long hairs.
  { id: 'tentcaterpillar', label: 'Eastern tent', mm: 50, width: 0.13, body: ['#4a4a5a', '#1e1e2a', '#08080c'], head: ['#3a3a3a', '#141414', '#000000'],
    stripe: '#ffffff', brokenLines: '#ff9a3a', dots: { color: '#5a9aff', v: [0.75], from: 1 }, hair: { color: () => '#c8b898', len: 8, n: 6 }, speed: [22, 36], prey: 0.4 }
];
export const CATERPILLAR_IDS = CATERPILLAR_BREEDS.map(b => b.id);

// Body half-width of segment i in body units.
function halfWidth(br, i) {
  const w = (br.width * 100) / 2;
  if (br.taper === 'teardrop') return w * (i === 0 ? 0.55 : 1 - (i / (N - 1)) * 0.65);
  const end = i === 0 ? 0.8 : i === 1 ? 0.92 : i >= N - 2 ? 0.75 + 0.1 * (N - 1 - i) : 1;
  return w * end * (br.swell?.includes(i) ? 1.3 : 1);
}

// Positions of every segment along the trail, bunched where the crawling wave is (or looped, for an inchworm).
// Returns segments head first, each with its position, heading, half-width and how far it is lifted (0..1).
export function bodySegments(br, bug) {
  const k = bug.size / 100, cycle = ((bug.phase ?? 0) / TAU) % 1;
  let gaps, lift;
  if (br.loops) {                            // inchworm: the whole middle arches as the tail is drawn up
    const loop = (1 - Math.cos(cycle * TAU)) / 2;
    gaps = Array.from({ length: N - 1 }, () => SPACING * (1 - 0.42 * loop));
    lift = i => Math.sin((Math.PI * i) / (N - 1)) * loop;
  } else {                                   // a wave from the tail (segment N-1) to the head
    const at = (N - 1) * (1 - cycle);
    const bump = i => Math.exp(-((i - at) ** 2) / 1.2);
    gaps = Array.from({ length: N - 1 }, (_, i) => SPACING * (1 - WAVE * bump(i + 0.5)));
    lift = bump;
  }
  const fine = SPACING / 6, total = gaps.reduce((s, g) => s + g, 0);
  const pts = sampleTrail(bug.trail ?? [], bug.x, bug.y, bug.heading, fine * k, Math.ceil(total / fine) + 2);
  const along = d => {
    const f = d / fine, i = Math.min(pts.length - 2, Math.floor(f)), t = f - i, a = pts[i], b = pts[i + 1];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(a.y - b.y, a.x - b.x) };
  };
  let d = 0;
  return Array.from({ length: N }, (_, i) => {
    if (i) d += gaps[i - 1];
    const p = i === 0 ? { x: bug.x, y: bug.y, angle: bug.heading } : along(d);
    return { ...p, w: halfWidth(br, i), lift: Math.min(1, lift(i)) };
  });
}

function legNubs(ctx, br, i, seg) {
  const prolegs = br.prolegs ?? PROLEGS;
  const trueLeg = TRUE_LEGS.includes(i), proleg = prolegs.includes(i);
  if (!trueLeg && !proleg) return;
  if (proleg && seg.lift > 0.4) return;      // lifted off the ground as the wave passes
  ctx.fillStyle = trueLeg ? '#2a2018' : br.body[2];
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (trueLeg) ctx.ellipse(1, side * (seg.w + 1.2), 0.9, 1.6, 0, 0, TAU);
    else ctx.ellipse(0, side * (seg.w * 0.85 + 1), 1.8, 1.4, 0, 0, TAU);
    ctx.fill();
  }
}

function hairs(ctx, color, len, n, w, rnd) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU + rnd() * 0.3, x = Math.cos(a) * SPACING * 0.55, y = Math.sin(a) * w, l = len * (0.7 + rnd() * 0.5);
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l * 0.4, y + Math.sin(a) * l);
  }
  ctx.stroke();
}

// Long fur combed back along the body, thick enough to hide it (a puss caterpillar's).
function fur(ctx, f, w, rnd) {
  ctx.lineWidth = 0.8;
  for (let j = 0; j < f.n; j++) {
    const y = (rnd() * 2 - 1) * w * 0.9, x = (rnd() - 0.3) * SPACING, l = f.len * (0.6 + rnd() * 0.6);
    ctx.strokeStyle = f.colors[j % f.colors.length];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - l * 0.5, y * 1.15, x - l, y * (1.25 + rnd() * 0.3));
    ctx.stroke();
  }
}

function decorate(ctx, br, i, seg, rnd) {
  const w = seg.w, d = SPACING;
  const dot = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  if (br.rings) {                            // bands across the segment
    const n = br.rings.length;
    br.rings.forEach((c, j) => { ctx.fillStyle = c; ctx.fillRect(-d * 0.3 + (j * d * 0.6) / n, -w, (d * 0.6) / n * 0.8, w * 2); });
    if (br.ringDots) for (const v of [-0.6, -0.2, 0.2, 0.6]) dot(-d * 0.05, v * w, 1, br.ringDots);
  }
  if (br.stripe) { ctx.fillStyle = br.stripe; ctx.fillRect(-d * 0.6, -w * 0.12, d * 1.2, w * 0.24); }
  if (br.brokenLines) for (const s of [-1, 1]) { ctx.fillStyle = br.brokenLines; ctx.fillRect(-d * 0.35, s * w * 0.35 - 0.5, d * 0.5, 1); }
  if (br.sideStripes) br.sideStripes.forEach((c, j) => { for (const s of [-1, 1]) { ctx.fillStyle = c; ctx.fillRect(-d * 0.6, s * w * (0.62 + j * 0.14) - 0.6, d * 1.2, 1.2); } });
  if (br.dots && i >= br.dots.from) for (const v of br.dots.v) for (const s of [-1, 1]) dot(0, s * v * w, 1.1, br.dots.color);
  if (br.chevrons && i >= 4 && i <= 11) {    // white slashes along each side, angled back like a V
    ctx.strokeStyle = br.chevrons;
    ctx.lineWidth = 1.3;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 0.4, s * w * 0.25); ctx.lineTo(-d * 0.5, s * w * 0.9); ctx.stroke(); }
    if (br.spiracles) for (const s of [-1, 1]) dot(-d * 0.1, s * w * 0.8, 0.7, br.spiracles);
  }
  if (br.eyespots === i) {                   // big false eyes: yellow ring, black pupil, a glint
    for (const s of [-1, 1]) { dot(0, s * w * 0.45, w * 0.32, '#ffe040'); dot(0.5, s * w * 0.45, w * 0.2, '#101010'); dot(1.2, s * w * 0.4, w * 0.06, '#ffffff'); }
  }
  for (const kn of br.knobs ?? []) if (i >= kn.from && i <= kn.to) {
    for (const s of [-1, 1]) {
      dot(0, s * kn.v * w, kn.r, kn.color);
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      for (let j = 0; j < 4; j++) { const a = j * 1.6; ctx.moveTo(0, s * kn.v * w); ctx.lineTo(Math.cos(a) * kn.r * 1.8, s * kn.v * w + Math.sin(a) * kn.r * 1.8); }
      ctx.stroke();
    }
  }
  if (br.spines && i >= 2 && i <= 11) {      // rosettes of branched spines down each side
    for (const s of [-1, 1]) for (const v of [0.35, 0.8]) {
      ctx.strokeStyle = br.spines.color;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) { const a = (j / 6) * TAU; ctx.moveTo(0, s * v * w); ctx.lineTo(Math.cos(a) * 3, s * v * w + Math.sin(a) * 3); }
      ctx.stroke();
      dot(0, s * v * w, 0.6, br.spines.tip);
    }
  }
  if (br.tufts && i >= br.tufts.from && i <= br.tufts.to && i % 2 === 0) dot(0, 0, w * 0.35, br.tufts.color);
  if (br.saddle && i >= 4 && i <= 9) {       // the green saddle blanket with a white edge
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-d * 0.6, -w * 0.82, d * 1.2, w * 1.64);
    ctx.fillStyle = '#78c838';
    ctx.fillRect(-d * 0.6, -w * 0.72, d * 1.2, w * 1.44);
    if (i === 6 || i === 7) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(i === 6 ? -d * 0.5 : d * 0.5, 0, d * 0.7, w * 0.42, 0, 0, TAU); ctx.fill(); }
    if (i === 6 || i === 7) { ctx.fillStyle = '#6a3a20'; ctx.beginPath(); ctx.ellipse(i === 6 ? -d * 0.5 : d * 0.5, 0, d * 0.55, w * 0.32, 0, 0, TAU); ctx.fill(); }
  }
  if (br.crest) { ctx.fillStyle = br.crest; ctx.beginPath(); ctx.ellipse(0, 0, d * 0.6, w * 0.18, 0, 0, TAU); ctx.fill(); }
}

// Things that stick out past the body: filaments, lashes, horns, a tail of hair. Drawn in the segment's frame.
function appendages(ctx, br, i, seg) {
  const w = seg.w;
  const line = (pts, width, color) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
  const front = i <= 3;
  if (br.filaments?.includes(i)) for (const s of [-1, 1]) line([[0, s * w * 0.5], [front ? 6 : -6, s * (w + 7)], [front ? 10 : -10, s * (w + 9)]], 1.1, '#141414');
  if (br.lashes?.includes(i)) for (const s of [-1, 1]) line([[0, s * w * 0.4], [front ? 8 : -8, s * (w + 10)]], 1, '#141414');
  if (br.horns?.includes(i)) for (const s of [-1, 1]) {
    line([[0, s * w * 0.5], [front ? 4 : -4, s * (w + 6)]], 2.2, '#3a2010');
    line([[front ? 4 : -4, s * (w + 6)], [front ? 6 : -6, s * (w + 8)]], 0.6, '#1a0e04');
  }
  if (br.horn && i === N - 1) line([[0, 0], [-7, -1], [-10, 1]], 1.8, br.horn);
  if (br.taper === 'teardrop' && i === N - 1) line([[0, 0], [-9, 0]], 3, br.fur.colors[2]);
}

function makeCaterpillar(br) {
  const sizeMid = br.mm * PX_PER_MM;   // the body is 100 units long, so its size is its length in px
  const rndSeed = br.id.length * 97;
  return {
    id: br.id,
    breed: br,
    size: [sizeMid * 0.93, sizeMid * 1.07],
    previewSize: 100,
    previewShift: 0.5,   // the body trails behind the head, so centre the whole length in the cell
    speed: br.speed,
    pace: { drift: 0.15, dartRate: 0, dart: [1, 0] },
    pauseRate: 0.3,
    pauseTime: [0.6, 2],
    maxTurn: 1.6,
    wander: 0.8,
    stride: (sizeMid * (br.loops ? 0.45 : 0.12)) / 1.25,   // a wave carries it about a segment; a loop, most of a body length
    trail: true,
    trailDiscR: br.width / 2,
    nerves: 0.5,
    backLength: [0, 0],
    draw(ctx, bug) {
      const L = bug.light, k = bug.size / 100;
      const segs = bodySegments(br, bug);
      const inFrame = (seg, fn) => { ctx.save(); ctx.translate(seg.x, seg.y); ctx.rotate(seg.angle); ctx.scale(k, k); fn(); ctx.restore(); };
      segs.forEach(seg => inFrame(seg, () => groundShadow(ctx, L, -L.x * seg.lift * 4, -L.y * seg.lift * 4, SPACING * 0.8, seg.w * 1.3, 0.22)));
      // One continuous body underneath, so the segments read as rings on a soft tube rather than a string of beads.
      ctx.lineCap = 'butt';
      for (let i = N - 1; i >= 1; i--) {
        const a = segs[i], b = segs[i - 1];
        ctx.strokeStyle = (br.bands?.(i) ?? br.body)[1];
        ctx.lineWidth = (a.w + b.w) * k * 0.95;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (let i = N - 1; i >= 0; i--) inFrame(segs[i], () => legNubs(ctx, br, i, segs[i]));
      for (let i = N - 1; i >= 0; i--) {
        const seg = segs[i], rnd = fixedRandom(rndSeed + i * 13);
        inFrame(seg, () => {
          const up = 1 + seg.lift * 0.1;     // a lifted segment is a little nearer the eye
          ctx.scale(up, up);
          appendages(ctx, br, i, seg);
          if (br.hair) hairs(ctx, br.hair.color(i), br.hair.len, br.hair.n, seg.w, rnd);
          const colors = i === 0 ? br.head : (br.bands?.(i) ?? br.body);
          shadedEllipse(ctx, L, 0, 0, SPACING * (i === 0 ? 0.55 : 0.7), seg.w, colors);
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(0, 0, SPACING * 0.62, seg.w, 0, 0, TAU);
          ctx.clip();
          if (i > 0) decorate(ctx, br, i, seg, rnd);
          ctx.restore();
          specular(ctx, L, 0, 0, SPACING * 0.62, seg.w, 0.12);
          if (br.fur && i > 0) fur(ctx, br.fur, seg.w, rnd);
        });
      }
    }
  };
}

export const CATERPILLARS = CATERPILLAR_BREEDS.map(makeCaterpillar);
