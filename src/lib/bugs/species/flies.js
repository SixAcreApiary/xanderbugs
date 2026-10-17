import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg3D, drawLeg3D, legShadow, insectGait, antenna, TAU, bodyEdge, fixedRandom, mirroredPath, bodyGradient } from '../common.js';

// Flies (Diptera): twelve common North American kinds, picked to look unlike one another. They share one body plan
// (head, thorax, abdomen, one pair of wings, six legs in a tripod gait); each kind has its own proportions,
// markings, wing pose and pattern, legs and mouthparts. Sizes are each kind's typical adult body length (head to
// tail; the house fly a female's). The house fly keeps the original 'housefly' id so saved settings carry over.
const PX_PER_MM = 2.8;   // the scale the rest of the bugs are drawn at

// Proportions are [length, width] in body units. Wings: len is a fraction of the body's length, width a fraction of
// the wing's length; spread is how far each wing angles out from straight back (radians): small for wings laid
// flat over the back, about 0.4 for the classic V, more for wings held out sideways.
const BASE = { head: [18, 28], eyes: { size: 0.55, gap: 0.55, colors: ['#d4583a', '#8e2a16', '#3a0c04'] },
  thorax: [28, 27], abdomen: [40, 33], wing: { len: 0.9, width: 0.38, spread: 0.42, tint: 'rgba(205,210,215,0.28)' },
  legs: 1.5, legW: 1, legColor: '#1a1714', speed: [45, 85], pauseRate: 1.1, nerves: 1.4 };   // a fly's legs are nearly as long as its body

export const FLY_BREEDS = [
  // Musca domestica: grey thorax with four dark stripes, buff-grey checkered abdomen, red-brown eyes.
  { id: 'housefly', label: 'House fly', mm: 7, thoraxColors: ['#a8a49c', '#6e6a64', '#2c2a26'], thoraxMark: 'stripes',
    abdomenColors: ['#c8b48a', '#8a7a5e', '#3a3226'], abdomenMark: 'checker', stride: 9 },
  // Lucilia sericata: shining metallic green all over, red eyes.
  { id: 'greenbottlefly', label: 'Green bottle fly', mm: 9, thorax: [28, 28], abdomen: [36, 34], gloss: true,
    thoraxColors: ['#9ef0a0', '#2aa04a', '#0a3a18'], abdomenColors: ['#a8f4b0', '#30b058', '#0a4020'], stride: 9.5 },
  // Drosophila melanogaster: tiny and tan, bright red eyes, dark bands toward the tail, clear wings laid back.
  { id: 'fruitfly', label: 'Fruit fly', mm: 2.5, head: [16, 24], thorax: [26, 24], abdomen: [34, 26],
    eyes: { size: 0.6, gap: 0.7, colors: ['#ff5040', '#c01808', '#5a0400'] },
    thoraxColors: ['#e0b878', '#b07e3e', '#5a3a14'], abdomenColors: ['#e8c890', '#b8884a', '#5a3a14'], abdomenMark: 'bands',
    wing: { len: 1.15, width: 0.4, spread: 0.2, tint: 'rgba(220,220,215,0.25)' }, legColor: '#9a7040', speed: [24, 44], stride: 4.4 },
  // Tipula: a slender grey-brown body on enormously long, thin legs, narrow wings held out to the sides.
  { id: 'cranefly', label: 'Crane fly', mm: 20, head: [9, 9], thorax: [18, 15], abdomen: [62, 10], snout: true, halteres: true,
    eyes: { size: 0.7, gap: 0.8, colors: ['#3a3430', '#1a1614', '#060504'] },
    thoraxColors: ['#b8a890', '#7a6a54', '#3a3024'], abdomenColors: ['#c0ac8a', '#80705a', '#3a3226'], abdomenMark: 'midline',
    wing: { len: 0.62, width: 0.22, spread: 1.15, tint: 'rgba(190,175,150,0.3)' }, legs: 3.4, legW: 0.6, legColor: '#4a3a2a',
    arch: 1.3, lift: 0.22, keepApart: 1.5,   // knees bent outward, feet lifted high: slow, high-stepping strides; others keep clear of its long legs
    speed: [20, 40], pauseRate: 0.8, nerves: 1, stride: 20 },
  // Culex pipiens: slender, brown with pale bands, a long needle proboscis, scaly wings folded over the back.
  { id: 'mosquito', label: 'Mosquito', mm: 5, head: [9, 10], thorax: [18, 14], abdomen: [44, 9], proboscis: 22, longAntennae: true,
    eyes: { size: 0.7, gap: 0.8, colors: ['#3a3430', '#1a1614', '#060504'] },
    thoraxColors: ['#a08460', '#6a5438', '#2a2014'], abdomenColors: ['#8a6e4c', '#5a4430', '#20160c'], abdomenMark: 'paleBands',
    wing: { len: 0.72, width: 0.22, spread: 0.1, tint: 'rgba(150,130,100,0.3)' }, legs: 2.2, legW: 0.5, legColor: '#6a5438',
    speed: [20, 40], pauseRate: 1.3, nerves: 1.2, stride: 12 },
  // Eristalis tenax: a fuzzy honey-bee mimic, dark brown with orange-brown patches at the front of the abdomen.
  { id: 'dronefly', label: 'Drone fly', mm: 13, head: [16, 30], thorax: [26, 28], abdomen: [36, 32], fuzz: '#b08a50',
    eyes: { size: 0.6, gap: 0.2, colors: ['#8a5a30', '#4a2a10', '#1a0a04'] },
    thoraxColors: ['#6a5034', '#3a2a18', '#120a04'], abdomenColors: ['#4a3a28', '#2a1e12', '#0a0604'], abdomenMark: 'droneflyPatches',
    wing: { len: 0.85, width: 0.36, spread: 0.45, tint: 'rgba(200,190,170,0.25)' }, speed: [40, 75], stride: 11 },
  // Toxomerus geminatus: a small flower fly, flat yellow abdomen with fine black calligraphy, bronze thorax with yellow sides.
  { id: 'calligrapherfly', label: 'Eastern calligrapher', mm: 7, head: [14, 24], thorax: [22, 20], abdomen: [44, 22],
    eyes: { size: 0.6, gap: 0.3, colors: ['#c06a3a', '#7a3416', '#2a0e04'] },
    thoraxColors: ['#8a7a3a', '#4a3e18', '#1a1406'], thoraxMark: 'yellowSides',
    abdomenColors: ['#ffe46a', '#e8b820', '#7a5a04'], abdomenMark: 'calligraphy',
    wing: { len: 0.82, width: 0.34, spread: 0.3 }, legColor: '#c8a040', speed: [45, 85], stride: 8 },
  // Tabanus: big and stout, huge green eyes with purple stripes, grey striped thorax, pale triangles down the abdomen.
  { id: 'horsefly', label: 'Horse fly', mm: 18, head: [18, 40], thorax: [30, 34], abdomen: [46, 40],
    eyes: { size: 0.62, gap: 0.12, colors: ['#7af0a0', '#20905a', '#0a3a20'], stripes: '#6a2a7a' },
    thoraxColors: ['#9a9284', '#5a544a', '#24201a'], thoraxMark: 'stripes',
    abdomenColors: ['#7a7064', '#4a4238', '#1a1610'], abdomenMark: 'triangles',
    wing: { len: 0.8, width: 0.36, spread: 0.5, tint: 'rgba(110,100,90,0.32)' }, legs: 1.6, speed: [38, 70], nerves: 0.9, stride: 13.5 },
  // Chrysops: yellow and black, gold-green spotted eyes, clear wings crossed by a dark band.
  { id: 'deerfly', label: 'Deer fly', mm: 9, head: [14, 28], thorax: [24, 24], abdomen: [36, 28],
    eyes: { size: 0.6, gap: 0.2, colors: ['#d8e060', '#7a9a20', '#2a3a08'], spots: '#3a2a10' },
    thoraxColors: ['#e8c860', '#a88420', '#3a2a08'], thoraxMark: 'blackStripes',
    abdomenColors: ['#f0d070', '#c09830', '#4a3408'], abdomenMark: 'deerV',
    wing: { len: 0.88, width: 0.36, spread: 0.55, pattern: 'band' }, speed: [40, 75], stride: 10 },
  // Hermetia illucens: black and wasp-like, long antennae, dark wings folded flat, two clear windows at the abdomen's base.
  { id: 'soldierfly', label: 'Black soldier fly', mm: 16, head: [12, 20], thorax: [26, 22], abdomen: [48, 26], longAntennae: true,
    eyes: { size: 0.5, gap: 0.5, colors: ['#4a5a4a', '#1a221a', '#060806'] },
    thoraxColors: ['#3a3a3a', '#141414', '#040404'], abdomenColors: ['#3a3a3a', '#141414', '#040404'], abdomenMark: 'windows',
    wing: { len: 0.72, width: 0.3, spread: 0.06, tint: 'rgba(40,40,45,0.55)' }, legColor: '#1a1a1a', speed: [30, 60], nerves: 1, stride: 13 },
  // Efferia: a long, tapering abdomen, a humped thorax, a bearded face, long strong legs; it hunts other insects.
  { id: 'robberfly', label: 'Robber fly', mm: 22, head: [14, 22], thorax: [28, 22], abdomen: [72, 14], taper: true, beard: '#e8e0c8',
    eyes: { size: 0.55, gap: 0.5, colors: ['#5a5040', '#2a2418', '#0a0804'] },
    thoraxColors: ['#9a8a70', '#5a4e3a', '#221c12'], thoraxMark: 'stripes',
    abdomenColors: ['#9a8a70', '#5a4e3a', '#221c12'], abdomenMark: 'paleBands',
    wing: { len: 0.55, width: 0.28, spread: 0.08, tint: 'rgba(170,160,140,0.3)' }, legs: 1.8, legW: 1.2, legColor: '#2a2018',
    speed: [45, 90], pauseRate: 0.9, nerves: 0.7, stride: 17 },
  // Bombylius major: a round, fuzzy tan body, a long straight beak, wings held out with a dark leading half.
  { id: 'beefly', label: 'Bee fly', mm: 10, head: [10, 16], thorax: [26, 30], abdomen: [30, 34], proboscis: 20, fuzz: '#d8b880',
    eyes: { size: 0.6, gap: 0.4, colors: ['#4a3a28', '#1a120a', '#060402'] },
    thoraxColors: ['#c8a670', '#8a6a3a', '#3a2a14'], abdomenColors: ['#c8a670', '#8a6a3a', '#3a2a14'],
    wing: { len: 0.75, width: 0.34, spread: 0.95, pattern: 'half' }, legs: 1.7, legW: 0.7, speed: [35, 65], stride: 9 }
].map(b => ({ ...BASE, ...b, eyes: { ...BASE.eyes, ...b.eyes }, wing: { ...BASE.wing, ...b.wing } }));
export const FLY_IDS = FLY_BREEDS.map(b => b.id);

// Where each part sits along the body (thorax centred on 0), and the body's drawn length head to tail.
export function flyPlan(br) {
  const [hl, hw] = br.head, [tl, tw] = br.thorax, [al, aw] = br.abdomen;
  const head = { cx: tl / 2 + hl / 2 - 2, rx: hl / 2, ry: hw / 2 };
  const thorax = { cx: 0, rx: tl / 2, ry: tw / 2 };
  const abdomen = { cx: -(tl / 2 + al / 2 - 3), rx: al / 2, ry: aw / 2 };
  const front = head.cx + head.rx, back = abdomen.cx - abdomen.rx;
  return { head, thorax, abdomen, front, back, length: front - back };
}

const ellipsePath = (ctx, { cx, rx, ry }) => { ctx.beginPath(); ctx.ellipse(cx, 0, rx, ry, 0, 0, TAU); };

// A long abdomen that narrows to a point (a robber fly's), as right-side points front to back.
const taperPoints = ({ cx, rx, ry }) => Array.from({ length: 9 }, (_, i) => {
  const t = i / 8;
  return [cx + rx - t * 2 * rx, ry * Math.max(0.12, Math.sin(Math.PI * Math.min(1, 0.35 + t * 0.65)) ** 0.6 * (1 - t * 0.55))];
});

function abdomenPath(ctx, br, a) {
  if (br.taper) mirroredPath(ctx, taperPoints(a));
  else ellipsePath(ctx, a);
}

function abdomenMarks(ctx, br, a) {
  const { cx, rx, ry } = a, x0 = cx + rx, len = rx * 2;
  const blob = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill(); };
  switch (br.abdomenMark) {
    case 'checker':                  // a dark midline and soft, shimmering checkering
      blob(cx, 0, rx * 0.95, ry * 0.16, 'rgba(30,26,20,0.5)');
      for (const [u, v] of [[0.25, 0.45], [0.45, 0.58], [0.7, 0.45], [0.35, 0.21], [0.55, 0.24], [0.8, 0.21]]) {
        for (const s of [-1, 1]) blob(x0 - u * len, s * v * ry, rx * 0.09, ry * 0.15, 'rgba(30,26,20,0.28)');
      }
      break;
    case 'bands':                    // dark bands across the rear segments
      for (const u of [0.45, 0.62, 0.78, 0.92]) { ctx.fillStyle = 'rgba(40,24,8,0.75)'; ctx.fillRect(x0 - u * len - 2.5, -ry, 5, ry * 2); }
      break;
    case 'paleBands':                // pale rings between darker segments
      for (let u = 0.12; u < 0.95; u += 0.14) { ctx.fillStyle = 'rgba(235,220,190,0.6)'; ctx.fillRect(x0 - u * len - 1.2, -ry, 2.4, ry * 2); }
      break;
    case 'midline':
      blob(cx, 0, rx * 0.95, ry * 0.25, 'rgba(40,30,20,0.45)');
      break;
    case 'droneflyPatches':          // orange-brown patches either side at the front, pale rings behind
      for (const s of [-1, 1]) blob(x0 - len * 0.22, s * ry * 0.5, rx * 0.22, ry * 0.36, 'rgba(210,130,50,0.85)');
      for (const u of [0.45, 0.66]) { ctx.fillStyle = 'rgba(200,170,110,0.5)'; ctx.fillRect(x0 - u * len - 1, -ry, 2, ry * 2); }
      break;
    case 'calligraphy': {            // fine black bars and hooks on yellow
      ctx.strokeStyle = 'rgba(20,14,4,0.9)';
      ctx.lineWidth = 1.6;
      for (const u of [0.2, 0.42, 0.64]) {
        ctx.beginPath();
        ctx.moveTo(x0 - u * len, -ry * 0.85);
        ctx.quadraticCurveTo(x0 - u * len - 6, 0, x0 - u * len, ry * 0.85);
        ctx.stroke();
      }
      blob(cx - rx * 0.1, 0, rx * 0.8, ry * 0.1, 'rgba(20,14,4,0.85)');
      for (const s of [-1, 1]) blob(x0 - len * 0.82, s * ry * 0.4, rx * 0.12, ry * 0.18, 'rgba(20,14,4,0.85)');
      break;
    }
    case 'triangles':                // pale triangles down the midline, one per segment
      ctx.fillStyle = 'rgba(220,210,190,0.7)';
      for (let u = 0.12; u < 0.85; u += 0.17) {
        const x = x0 - u * len;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - len * 0.1, -ry * 0.18);
        ctx.lineTo(x - len * 0.1, ry * 0.18);
        ctx.fill();
      }
      break;
    case 'deerV':                    // black V marks on yellow
      ctx.strokeStyle = 'rgba(20,14,4,0.85)';
      ctx.lineWidth = 2.6;
      for (const u of [0.3, 0.55, 0.78]) {
        const x = x0 - u * len;
        ctx.beginPath();
        ctx.moveTo(x - 5, -ry * 0.7);
        ctx.lineTo(x + 3, 0);
        ctx.lineTo(x - 5, ry * 0.7);
        ctx.stroke();
      }
      break;
    case 'windows':                  // two clear windows at the base, as a black soldier fly has
      for (const s of [-1, 1]) blob(x0 - len * 0.14, s * ry * 0.32, rx * 0.12, ry * 0.25, 'rgba(235,240,245,0.85)');
      break;
  }
}

function thoraxMarks(ctx, br, t) {
  const { cx, rx, ry } = t;
  const stripe = (y, color, w = 0.08) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(cx, y, rx * 0.8, ry * w, 0, 0, TAU); ctx.fill(); };
  switch (br.thoraxMark) {
    case 'stripes': for (const v of [-0.55, -0.19, 0.19, 0.55]) stripe(v * ry, 'rgba(20,18,16,0.7)'); break;
    case 'blackStripes': for (const v of [-0.4, 0, 0.4]) stripe(v * ry, 'rgba(20,14,4,0.8)', 0.12); break;
    case 'yellowSides': for (const s of [-1, 1]) stripe(s * ry * 0.75, 'rgba(240,210,70,0.95)', 0.14); break;
  }
}

function fuzzRing(ctx, part, color, rnd) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * TAU + rnd() * 0.1, x = part.cx + Math.cos(a) * part.rx, y = Math.sin(a) * part.ry, out = 2 + rnd() * 2.5;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * out, y + Math.sin(a) * out);
  }
  ctx.stroke();
}

// One wing, root at 0 pointing along +x: rounded tip, the trailing edge bulging behind.
function wingPath(ctx, len, w, side) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.3, -side * w * 0.28, len * 0.85, -side * w * 0.42, len, -side * w * 0.12);
  ctx.bezierCurveTo(len * 1.04, side * w * 0.2, len * 0.7, side * w * 0.62, len * 0.32, side * w * 0.45);
  ctx.bezierCurveTo(len * 0.12, side * w * 0.35, len * 0.03, side * w * 0.12, 0, 0);
  ctx.closePath();
}

function drawWing(ctx, br, plan, side, flick) {
  const { wing } = br, len = wing.len * plan.length, w = wing.width * len;
  ctx.save();
  ctx.translate(plan.thorax.rx * 0.3, side * plan.thorax.ry * 0.45);
  ctx.rotate(Math.PI - side * (wing.spread + flick));
  wingPath(ctx, len, w, side);
  ctx.fillStyle = wing.tint;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (wing.pattern === 'band') {                     // a dark band across the middle and along the leading edge
    ctx.fillStyle = 'rgba(50,34,18,0.75)';
    ctx.fillRect(len * 0.35, -w, len * 0.22, w * 2);
    ctx.fillRect(0, -side * w * 0.6, len * 0.4, side * w * 0.35);
  } else if (wing.pattern === 'half') {              // the leading half dark
    ctx.fillStyle = 'rgba(50,34,18,0.75)';
    ctx.fillRect(0, side > 0 ? -w : 0, len * 1.1, w);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,36,30,0.5)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,36,30,0.4)';             // veins fanning from the root
  ctx.lineWidth = 0.45;
  for (const [ex, ey] of [[0.95, -0.2], [0.8, 0.05], [0.62, 0.3]]) {
    ctx.beginPath();
    ctx.moveTo(len * 0.04, 0);
    ctx.lineTo(len * ex, side * w * ey);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHead(ctx, L, br, h) {
  const grey = br.thoraxColors;
  if (br.proboscis) {                                    // a long straight beak
    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(h.cx + h.rx * 0.8, 0);
    ctx.lineTo(h.cx + h.rx + br.proboscis, 0);
    ctx.stroke();
  }
  if (br.snout) shadedEllipse(ctx, L, h.cx + h.rx, 0, h.rx * 0.6, h.ry * 0.35, grey);
  shadedEllipse(ctx, L, h.cx, 0, h.rx, h.ry, grey);
  const e = br.eyes, ey = h.ry * (1 - e.size * 0.55) * (0.6 + e.gap * 0.4), er = h.ry * e.size;
  for (const side of [-1, 1]) {
    shadedEllipse(ctx, L, h.cx, side * ey, h.rx * 0.85, er, e.colors, side * 0.2);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(h.cx, side * ey, h.rx * 0.85, er, side * 0.2, 0, TAU);
    ctx.clip();
    if (e.stripes) {                                     // a horse fly's iridescent bands
      ctx.strokeStyle = e.stripes;
      ctx.lineWidth = 1.4;
      for (const dx of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(h.cx + dx * h.rx - 4, side * (ey - er)); ctx.lineTo(h.cx + dx * h.rx + 4, side * (ey + er)); ctx.stroke(); }
    }
    if (e.spots) {
      ctx.fillStyle = e.spots;
      for (const [dx, dy] of [[-0.3, -0.3], [0.2, 0.2], [-0.1, 0.5]]) { ctx.beginPath(); ctx.arc(h.cx + dx * h.rx, side * (ey + dy * er), er * 0.15, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    specular(ctx, L, h.cx, side * ey, h.rx * 0.85, er, 0.4);
  }
  if (br.beard) {                                        // a robber fly's bristly face
    ctx.strokeStyle = br.beard;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) { ctx.moveTo(h.cx + h.rx * 0.7, i * 1.3); ctx.lineTo(h.cx + h.rx + 4, i * 1.8); }
    ctx.stroke();
  }
}

function makeFly(br) {
  const plan = flyPlan(br), { head, thorax, abdomen } = plan;
  const sizeMid = (br.mm * PX_PER_MM * 100) / plan.length;
  const tw = thorax.ry, tl = thorax.rx;
  const LEGS = [{ x: tl * 0.45, angle: br.legs > 2 ? 0.6 : 0.8 }, { x: 0, angle: 1.6 }, { x: -tl * 0.45, angle: br.legs > 2 ? 2.5 : 2.3 }];
  const outline = [[thorax.cx, thorax.rx, thorax.ry]];
  return {
    id: br.id,
    breed: br,
    plan,
    size: [sizeMid * 0.93, sizeMid * 1.07],
    previewSize: Math.min(60, Math.max(30, 48 / Math.sqrt(br.legs))),
    // Legs attach only to the thorax; the test suite checks every hip lies within it.
    anatomy: { legSection: [thorax.cx - thorax.rx, thorax.cx + thorax.rx], hips: LEGS.map(l => l.x) },
    speed: br.speed,
    pace: { drift: 0.3, dartRate: 0.35, dart: [2, 0.3] },   // quick bursts
    pauseRate: br.pauseRate,   // many short stops
    pauseTime: [0.3, 1.6],
    maxTurn: 6,
    wander: 1.8,
    stride: br.stride,         // long enough that its legs don't flicker
    nerves: br.nerves,         // flies take fright sooner than most
    keepApart: br.keepApart,   // personal space around long legs (fraction of size)
    twitchy: ['housefly', 'greenbottlefly', 'fruitfly', 'deerfly', 'horsefly', 'robberfly'].includes(br.id),   // stop-start walkers and darting hunters
    draw(ctx, bug) {
      const L = bug.light;
      const flick = bug.loosen || bug.alarm > 0.3 ? Math.sin(bug.t * 95) * 0.08 : 0;   // wings whir when it bolts
      const rnd = fixedRandom(Math.floor(bug.variant * 1e6) + 7);
      withBugFrame(ctx, bug, () => {
        groundShadow(ctx, L, abdomen.cx * 0.5, 0, plan.length * 0.6, Math.max(abdomen.ry, thorax.ry) * 1.5);
        // Legs posed in 3D as a spider's are (see walkLeg3D): each climbs to a knee and reaches down to its foot,
        // folds in as it lifts and reaches out before it sets down, and casts a shadow that fades as it lifts. A fly's
        // knees stand lower than a spider's, except on the long-legged kinds.
        const legs = [];
        for (const side of [-1, 1]) {
          LEGS.forEach((l, i) => {
            const bend = i === 0 ? -0.4 : 0.4, segs = [[13 * br.legs, 0, 2.3 * br.legW], [14 * br.legs, bend, 1.6 * br.legW], [10 * br.legs, 0.2, 1.1 * br.legW]];
            const pose = walkLeg3D(bug, { hx: l.x, hy: side * tw * 0.3, edge: bodyEdge(l.x, outline) - tw * 0.3, side, angle: l.angle, segs, ...insectGait(bug, i, side),
              hz: tw * 0.4, curl: bend, arch: br.arch ?? (br.legs > 2 ? 1.45 : 1.3), lift: br.lift ?? 0.12, key: i * 2 + (side > 0), recoil: bug.recoil?.[legs.length] ?? 0 });
            legs.push({ pose, widths: segs.map(([, , w]) => w) });
          });
        }
        bug.legPoses = legs.map(g => g.pose);   // last drawn pose of each leg, for touches, tests and diagnostics
        for (const { pose, widths } of legs) legShadow(ctx, L, pose, widths[1], 0.12);
        for (const { pose, widths } of legs) drawLeg3D(ctx, L, pose, widths, br.legColor);
        if (br.fuzz) fuzzRing(ctx, abdomen, br.fuzz, rnd);
        abdomenPath(ctx, br, abdomen);
        ctx.fillStyle = bodyGradient(ctx, L, abdomen.cx, 0, abdomen.rx, abdomen.ry, br.abdomenColors);
        ctx.fill();
        ctx.save();
        abdomenPath(ctx, br, abdomen);
        ctx.clip();
        abdomenMarks(ctx, br, abdomen);
        ctx.restore();
        specular(ctx, L, abdomen.cx, 0, abdomen.rx, abdomen.ry, br.gloss ? 0.7 : 0.25);
        if (br.fuzz) fuzzRing(ctx, thorax, br.fuzz, rnd);
        shadedEllipse(ctx, L, thorax.cx, 0, thorax.rx, thorax.ry, br.thoraxColors);
        thoraxMarks(ctx, br, thorax);
        specular(ctx, L, thorax.cx, 0, thorax.rx, thorax.ry, br.gloss ? 0.7 : 0.25);
        if (br.halteres) {                                   // the little knobbed balancers behind the wings
          ctx.strokeStyle = '#6a5a44';
          ctx.lineWidth = 0.8;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(-tl * 0.6, side * tw * 0.5);
            ctx.lineTo(-tl * 0.9, side * tw * 0.95);
            ctx.stroke();
            ctx.fillStyle = '#6a5a44';
            ctx.beginPath();
            ctx.arc(-tl * 0.9, side * tw * 0.95, 1.4, 0, TAU);
            ctx.fill();
          }
        }
        for (const side of [-1, 1]) drawWing(ctx, br, plan, side, flick);
        drawHead(ctx, L, br, head);
        for (const side of [-1, 1]) {                         // antennae: short stubs, or long and thin
          const len = br.longAntennae ? 16 : 4;
          antenna(ctx, head.cx + head.rx * 0.8, side * 1.5, side, [[head.cx + head.rx + len * 0.6, len * 0.25], [head.cx + head.rx + len, len * 0.5]], 0.9, '#2a2018');
        }
      });
    }
  };
}

export const FLIES = FLY_BREEDS.map(makeFly);
