import { shadedEllipse, specular, groundShadow, TAU, fixedRandom } from '../common.js';
import { sampleTrail } from './centipede.js';

// Caterpillars: twelve common North American kinds, picked to look unlike one another, the woolly bear among them.
// The body is a chain of segments that follows the head's path. A caterpillar crawls with a wave that runs from
// tail to head: the segment it reaches bunches up, lifts its prolegs and is carried forward, while the rest stay
// planted. An inchworm instead loops: it draws its tail up behind its front legs, arching its middle, then reaches
// forward. Three pairs of small true legs sit behind the head; fleshy prolegs grip midway and at the tail.
// Sizes are each kind's typical full-grown length; pace is body lengths a second (a woolly bear is quick, an
// inchworm's loops cover ground). They are slow, and given time on screen to match (see the engine's maxLife).
const PX_PER_MM = 2.8;   // the scale the rest of the bugs are drawn at
const N = 13;            // head and twelve body segments
const SPACING = 100 / (N - 1);
const TRUE_LEGS = [1, 2, 3], PROLEGS = [6, 7, 8, 9, 12];

const GREEN = ['#b8f080', '#6ab838', '#2a5a10'];
export const CATERPILLAR_BREEDS = [
  // Pyrrharctia isabella, the woolly bear: densely bristly, black at both ends with a rusty-orange middle.
  // Its rusty band's width varies from one caterpillar to the next (folklore reads winter in it).
  { id: 'woollybear', label: 'Woolly bear', mm: 50, width: 0.17, body: ['#2a2420', '#0e0c0a', '#020202'], head: ['#2a2420', '#0a0806', '#000000'],
    bristles: { black: ['#0c0a08', '#2a2420', '#4a4038'], rust: ['#8a3a0c', '#b8581a', '#d8862a'], tips: '#f0b050', band: [3, 8] },
    pace: [0.06, 0.09], prey: 0.2 },
  // Danaus plexippus, the monarch: banded black, yellow and white, with a pair of black filaments at each end.
  { id: 'monarchcaterpillar', label: 'Monarch', mm: 45, width: 0.13, body: ['#ffffff', '#ece8dc', '#8a8678'], head: ['#3a3a3a', '#0a0a0a', '#000000'],
    rings: ['#141414', '#ffd820', '#141414'], filaments: [2, 11], pace: [0.08, 0.11], prey: 0.3 },
  // Papilio polyxenes, the black swallowtail: green, each segment banded black and dotted yellow-orange.
  { id: 'blackswallowtailcaterpillar', label: 'Black swallowtail', mm: 45, width: 0.15, body: GREEN, head: GREEN,
    rings: ['#141414'], ringDots: '#ffb020', pace: [0.08, 0.11], prey: 0.6 },
  // Papilio troilus, the spicebush swallowtail: green and fat in front, with two big false eyes and rows of blue dots.
  { id: 'spicebushcaterpillar', label: 'Spicebush swallowtail', mm: 40, width: 0.17, body: ['#c8f090', '#78c040', '#2a5a10'], head: ['#d8c890', '#a8946a', '#4a3a20'],
    swell: [2, 3, 4], eyespots: 3, dots: { color: '#4a8aff', v: [0.35], from: 5 }, pace: [0.07, 0.1], prey: 0.6 },
  // Manduca quinquemaculata, the tomato hornworm: big and green, white V marks along each side, a horn at the tail.
  { id: 'hornworm', label: 'Tomato hornworm', mm: 75, width: 0.16, body: ['#c0f088', '#68b83a', '#285a10'], head: ['#a8e070', '#58a030', '#205010'],
    chevrons: '#f4f8e8', horn: '#2a3a8a', spiracles: '#1a1a1a', pace: [0.06, 0.09], prey: 0.6 },
  // Hyalophora cecropia: huge and blue-green, with red-orange knobs behind the head, yellow ones down the back
  // and blue ones along the sides.
  { id: 'cecropiacaterpillar', label: 'Cecropia', mm: 90, width: 0.18, body: ['#c8f0d8', '#78c8a0', '#2a6a4a'], head: ['#a8d8b0', '#68a878', '#2a5a3a'],
    knobs: [{ from: 1, to: 3, color: '#ff6a2a', v: 0.55, r: 2.6 }, { from: 4, to: 12, color: '#ffd830', v: 0.4, r: 1.8 }, { from: 1, to: 12, color: '#4a8aff', v: 0.9, r: 1.2 }],
    pace: [0.05, 0.08], prey: 0.4 },
  // Acharia stimulea, the saddleback: short and squat, brown with a green saddle bearing a white-ringed brown spot,
  // and stinging horns at both ends.
  { id: 'saddleback', label: 'Saddleback', mm: 22, width: 0.32, body: ['#a87a5a', '#6a4430', '#2a1408'], head: ['#6a4430', '#3a2010', '#140804'],
    saddle: true, horns: [1, 12], pace: [0.06, 0.09], prey: 0.1 },
  // Lophocampa caryae, the hickory tussock moth: white and fluffy, black tufts down the back and long black lashes.
  { id: 'tussockcaterpillar', label: 'Hickory tussock', mm: 40, width: 0.14, body: ['#ffffff', '#ecece8', '#9a9a94'], head: ['#3a3a3a', '#0a0a0a', '#000000'],
    hair: { color: () => '#f4f4f0', len: 9, n: 16 }, tufts: { color: '#141414', from: 2, to: 11 }, lashes: [3, 10], pace: [0.08, 0.12], prey: 0.1 },
  // A geometrid inchworm: slender and green, with legs only at the front and the tail end; it loops along.
  { id: 'inchworm', label: 'Inchworm', mm: 25, width: 0.07, body: ['#d0f8a0', '#88c850', '#3a6a18'], head: ['#c0e890', '#78b040', '#305a14'],
    stripe: '#e8ffd0', loops: true, prolegs: [11, 12], pace: [0.2, 0.28], prey: 0.5 },
  // Megalopyge opercularis, the puss caterpillar: a furry teardrop of long tan hair combed into a crest and a tail.
  { id: 'pusscaterpillar', label: 'Puss caterpillar', mm: 30, width: 0.32, taper: 'teardrop', body: ['#e8d0a8', '#b8946a', '#5a4026'], head: ['#5a4026', '#2a1c10', '#0a0604'],
    fur: { colors: ['#e8d4b0', '#c8a878', '#a8865a'], len: 13, n: 26 }, crest: '#8a6a44', pace: [0.06, 0.09], prey: 0.1 },
  // Automeris io: lime green, a red-over-white stripe along each side, rosettes of branched stinging spines.
  { id: 'iocaterpillar', label: 'Io moth', mm: 60, width: 0.15, body: ['#d8ff90', '#98d840', '#4a7a10'], head: ['#c8e880', '#88c040', '#3a6a10'],
    sideStripes: ['#e82a2a', '#ffffff'], spines: { color: '#a8e050', tip: '#2a2a1a' }, pace: [0.06, 0.09], prey: 0.1 },
  // Malacosoma americanum, the eastern tent caterpillar: dark, a white stripe down the back flanked by broken
  // orange lines, blue spots along the sides, sparse long hairs.
  { id: 'tentcaterpillar', label: 'Eastern tent', mm: 50, width: 0.13, body: ['#4a4a5a', '#1e1e2a', '#08080c'], head: ['#3a3a3a', '#141414', '#000000'],
    stripe: '#ffffff', brokenLines: '#ff9a3a', dots: { color: '#5a9aff', v: [0.75], from: 1 }, hair: { color: () => '#c8b898', len: 8, n: 6 }, pace: [0.09, 0.13], prey: 0.4 }
];
export const CATERPILLAR_IDS = CATERPILLAR_BREEDS.map(b => b.id);

// Body half-width of segment i in body units.
function halfWidth(br, i) {
  const w = (br.width * 100) / 2;
  if (br.taper === 'teardrop') return w * (i === 0 ? 0.55 : 1 - (i / (N - 1)) * 0.65);
  const end = i === 0 ? 0.8 : i === 1 ? 0.92 : i >= N - 2 ? 0.75 + 0.1 * (N - 1 - i) : 1;
  return w * end * (br.swell?.includes(i) ? 1.3 : 1);
}

// Where every segment is along the trail, as a distance behind the head's position (body units), and how lifted it
// is. A segment eases along while the body's head moves on; when the wave reaches it, it steps forward with its legs
// lifted, tail first, head last, so neighbours bunch a little as the step passes between them.
// An inchworm grips with its front legs while it draws its tail up behind them, arching its middle, then grips with
// its tail while it reaches forward. Returns segments head first: position, heading, half-width, how lifted the
// body is there (0..1) and whether its legs are up.
const STEP = 0.45;                    // share of the cycle a segment spends stepping
// Most of the motion is carried by the wave (RIPPLE), the rest a gentle glide, so it neither pulses like a slinky
// nor skates; each wave carries the body about one segment (WAVE_TRAVEL), about once a second at its pace.
const RIPPLE = 0.7;
const WAVE_TRAVEL = 1.1;              // segments of travel per wave
const LAG = 0.7 / (N - 1);            // cycle between neighbouring segments' steps (the wave takes 0.7 of a cycle)
const ease = t => t * t * (3 - 2 * t);
export function bodySegments(br, bug) {
  const k = bug.size / 100, cycles = (bug.phase ?? 0) / TAU, stride = (bug.stridePx ?? 0) / k;
  const frac = v => v - Math.floor(v);
  let behind, lift, legsUp;
  if (br.loops) {
    const c = frac(cycles), L0 = (N - 1) * SPACING;
    const head = c < 0.5 ? 0 : ease((c - 0.5) / 0.5);                     // how far the front has reached this cycle
    const drawn = c < 0.5 ? ease(c / 0.5) : 1 - ease((c - 0.5) / 0.5);  // how far the tail is drawn up
    const len = L0 - stride * drawn, h0 = stride * (c - head);
    behind = i => h0 + (i * len) / (N - 1);
    lift = i => Math.sin((Math.PI * i) / (N - 1)) * drawn;
    legsUp = i => (i <= 3 ? c > 0.5 && head < 1 : i >= N - 2 ? c < 0.5 && drawn < 1 : false);
  } else {
    const step = i => {
      const f = frac(cycles + i * LAG), t = f > 1 - STEP ? (f - (1 - STEP)) / STEP : -1;
      return { f, t, moved: t < 0 ? 0 : ease(t) };
    };
    behind = i => { const { f, t, moved } = step(i); return i * SPACING + RIPPLE * stride * (t < 0 ? f : (1 - STEP) * (1 - moved)); };
    lift = i => { const { t } = step(i); return t < 0 ? 0 : Math.sin(Math.PI * t); };
    legsUp = i => step(i).t >= 0;
  }
  const fine = SPACING / 6, far = (N - 1) * SPACING + stride * 1.5;
  const pts = sampleTrail(bug.trail ?? [], bug.x, bug.y, bug.heading, fine * k, Math.ceil(far / fine) + 3);
  const along = d => {
    const f = Math.max(0, d) / fine, i = Math.min(pts.length - 2, Math.floor(f)), t = f - i, a = pts[i], b = pts[i + 1];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: i === 0 && d <= 0 ? bug.heading : Math.atan2(a.y - b.y, a.x - b.x) };
  };
  return Array.from({ length: N }, (_, i) => ({ ...along(behind(i)), w: halfWidth(br, i), lift: Math.min(1, lift(i)), legsUp: legsUp(i) }));
}

// Legs drawn under a segment: three pairs of small, pointed true legs behind the head, and fleshy prolegs with a
// dark gripping sole. Planted, they spread out from the body; lifted for a step, they tuck in.
function legNubs(ctx, br, i, seg) {
  const prolegs = br.prolegs ?? PROLEGS;
  const trueLeg = TRUE_LEGS.includes(i), proleg = prolegs.includes(i);
  if (!trueLeg && !proleg) return;
  const tuck = seg.legsUp ? 0.55 : 1;
  for (const side of [-1, 1]) {
    if (trueLeg) {
      ctx.strokeStyle = '#2a2018';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, side * seg.w * 0.6);
      ctx.lineTo(1.5, side * (seg.w + 2.2 * tuck));
      ctx.lineTo(3, side * (seg.w + 2.6 * tuck));
      ctx.stroke();
    } else {
      const y = side * (seg.w * 0.8 + 2 * tuck);
      ctx.fillStyle = br.body[1];
      ctx.beginPath();
      ctx.ellipse(0, y, 2.4, 2 * tuck, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,14,8,0.6)';                  // the sole, ringed with tiny hooks
      ctx.beginPath();
      ctx.ellipse(0, y + side * tuck, 1.6, 0.8 * tuck, 0, 0, TAU);
      ctx.fill();
    }
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

// A dense brush of stiff bristles springing from the whole body and hiding it (a woolly bear's): bristles splay out
// from the midline in every direction, their tips catching the light. mix is how much of the rust colour the
// segment carries (0 black .. 1 rust), so the band's edges blend.
function bristles(ctx, b, w, mix, rnd) {
  const pick = () => (rnd() < mix ? b.rust : b.black);
  for (let j = 0; j < 95; j++) {
    const x = (rnd() - 0.5) * SPACING * 1.3, y = (rnd() * 2 - 1) * w * 0.8;
    const a = Math.atan2(y, x * 0.3) + (rnd() - 0.5) * 0.45, l = w * (0.7 + rnd() * 0.25);
    const cols = pick(), ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
    ctx.strokeStyle = cols[Math.floor(rnd() * cols.length)];
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (cols === b.rust && rnd() < 0.35) {          // golden tips
      ctx.strokeStyle = b.tips;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(x + (ex - x) * 0.7, y + (ey - y) * 0.7);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }
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
    speed: br.pace.map(p => p * sizeMid),
    pace: { drift: 0.15, dartRate: 0, dart: [1, 0] },
    pauseRate: 0.3,
    pauseTime: [0.6, 2],
    maxTurn: 1.6,
    wander: 0.8,
    stride: (sizeMid * (br.loops ? 0.4 : (WAVE_TRAVEL * SPACING) / 100)) / 1.25,   // travel per wave; per loop, nearly half its length
    trail: true,
    trailDiscR: br.width / 2,
    passable: true,      // crawls over other bugs, and they over it (see engine passable)
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
      // A woolly bear's rusty band: its own width, centred on the body, its edges blending over a segment.
      const band = br.bristles && (() => {
        const [lo, hi] = br.bristles.band, n = lo + (hi - lo) * (bug.variant ?? 0.5), mid = (N - 1) / 2 + 0.5;
        return i => Math.max(0, Math.min(1, n / 2 + 0.5 - Math.abs(i - mid)));
      })();
      for (let i = N - 1; i >= 0; i--) {
        const seg = segs[i], rnd = fixedRandom(rndSeed + i * 13);
        inFrame(seg, () => {
          const up = 1 + seg.lift * (br.loops ? 0.1 : 0.04);   // a lifted segment is a little nearer the eye
          ctx.scale(up, up);
          if (br.bristles) {                 // all brush: the body is only a dark core beneath it
            const m = i === 0 ? 0 : band(i);   // the core takes its band's colour, so any gap shows fur, not a hole
            shadedEllipse(ctx, L, 0, 0, SPACING * 0.75, seg.w * 0.95, m > 0.5 ? br.bristles.rust : br.bristles.black);
            if (i === 0) { shadedEllipse(ctx, L, SPACING * 0.3, 0, SPACING * 0.4, seg.w * 0.55, br.head); specular(ctx, L, SPACING * 0.3, 0, SPACING * 0.4, seg.w * 0.55, 0.5); }
            bristles(ctx, br.bristles, seg.w, m, rnd);
            return;
          }
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
