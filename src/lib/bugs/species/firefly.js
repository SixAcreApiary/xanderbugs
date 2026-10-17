import { withBugFrame, bodyGradient, specular, groundShadow, walkLeg, insectGait, antenna, TAU, bodyEdge, mirroredPath } from '../common.js';

// Flashing fireflies (Lampyridae). Flash patterns follow the Firefly Atlas (fireflyatlas.org) where it gives them,
// and published accounts for the Smokies synchronous firefly. A male repeats his pattern; a female doesn't flash
// on her own but answers males of her own kind after a short, species-typical delay. Pulses are listed as
// [start s, duration s, shape]: 'soft' rises and falls, 'crescendo' builds and then cuts off abruptly.
const between = (rng, [a, b]) => a + (b - a) * rng();
const pick = (rng, weights) => {
  let r = rng() * weights.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of weights) if ((r -= w) < 0) return v;
  return weights[weights.length - 1][0];
};

export const FIREFLY_BREEDS = [
  {
    // Photinus pyralis: one long yellow J-flash every 4-7 s, flying low over open ground; the female answers
    // with a single flash about two seconds later. 9-19 mm.
    id: 'bigdipperfirefly', label: 'Big Dipper', size: [38.1, 43.9], color: [250, 222, 80],
    // A rounded pink-red shield with a black central spot and a pale yellow rim; long black wing covers with
    // narrow yellow edges and seam.
    look: { shield: ['#f0a088', '#d86a58', '#7a2a1e'], rim: '#efd88a', mark: 'spot', markColor: '#1a1210',
      elytra: ['#3a3634', '#1c1a18', '#080706'], edge: '#e6d27a', edgeW: 1.6, legs: '#1e1814', antenna: 0.5 },
    male: rng => [[0, 0.6, 'crescendo']], every: [4.5, 7],
    female: { delay: [1.8, 2.4], train: () => [[0, 0.5, 'soft']] }
  },
  {
    // Pyractomena borealis: one short (quarter second) amber flash every 2-3 s, high in the trees; the female
    // answers with a long flash. 14-22 mm.
    id: 'treetopfirefly', label: 'Spring tree-top flasher', size: [48.4, 55.6], color: [255, 176, 48],
    // Big and broad: a bell-shaped shield with translucent pale edges, a large black central patch and pink spots at
    // the sides; grey-black, lengthwise-ridged wing covers bordered in yellow; shortish antennae.
    look: { shield: ['#f0e2b8', '#d8c08a', '#7a6440'], rim: '#f2e6c0', mark: 'patch', markColor: '#141010', flanks: '#e87a8a',
      elytra: ['#4a4846', '#262422', '#0c0b0a'], edge: '#d8b860', edgeW: 2, ridges: true, legs: '#141010', antenna: 0.36 },
    male: rng => [[0, 0.25, 'soft']], every: [2, 3],
    female: { delay: [0.6, 1.2], train: () => [[0, 1.4, 'soft']] }
  },
  {
    // Photinus knulli: a quick triplet over about a second (sometimes 2, 4 or 5), every 3-5 s, males flashing
    // in step at high density; the female answers with a single flash. 5-8 mm.
    id: 'southwestsyncfirefly', label: 'Southwest synchronous', size: [20.5, 23.5], color: [232, 240, 70],
    // A cream shield with two red patches either side of a dark central stripe, rounded hind corners; dark brown
    // wing covers with broad pale yellow outer edges.
    look: { shield: ['#f6ecc8', '#e2d2a0', '#8a7a50'], rim: '#f4ead0', mark: 'bar', markColor: '#2a1a14', flanks: '#e04a50',
      elytra: ['#3e3430', '#221a16', '#0a0806'], edge: '#ecdca0', edgeW: 3.2, legs: '#1e1814', antenna: 0.5 },
    male: rng => { const n = pick(rng, [[3, 70], [2, 10], [4, 15], [5, 5]]); return Array.from({ length: n }, (_, i) => [i * 0.42, 0.14, 'soft']); },
    every: [3, 5], sync: true,
    female: { delay: [0.5, 1], train: () => [[0, 0.3, 'soft']] }
  },
  {
    // Photuris forresti: 4-7 erratic greenish-yellow pulses looping over 2.5-3 s, the last sometimes blurring into a
    // long, wavering flash, then more than 10 s of darkness. Photuris "femme fatale" females lure and eat Photinus
    // males. 11-12 mm.
    id: 'loopyfivefirefly', label: 'Loopy five', size: [38.1, 43.9], color: [200, 240, 80],
    // Slim and long-legged (pale legs): a pale yellow shield with a dark centre and red-brown sides; dark wing covers
    // with pale edges and only short, faint pale stripes.
    look: { shield: ['#f2e2a8', '#d8c080', '#7a6438'], rim: '#f4e8c0', mark: 'bar', markColor: '#3a2218', flanks: '#b8502a',
      elytra: ['#3a3230', '#1e1816', '#0a0806'], edge: '#e8d690', edgeW: 2, stripes: true, legs: '#d8c078', legLength: 1.25, antenna: 0.55 },
    male: rng => {
      const n = pick(rng, [[5, 60], [4, 12], [6, 18], [7, 10]]), span = between(rng, [2.5, 3]);
      return Array.from({ length: n }, (_, i) => {
        const at = (span * i) / (n - 1) + (i && i < n - 1 ? (rng() - 0.5) * 0.18 : 0);
        return i === n - 1 && rng() < 0.4 ? [at - 0.25, 0.7, 'wavering'] : [at, between(rng, [0.15, 0.32]), 'soft'];
      });
    },
    dark: [10, 14]
  },
  {
    // Photinus carolinus: bursts of 5-8 quick flashes about half a second apart, then 8-10 s of darkness, the males
    // of a display flashing in unison; the female answers a burst with a double flash. 11-15 mm.
    id: 'smokiessyncfirefly', label: 'Smokies synchronous', size: [41, 47.1], color: [220, 245, 80],
    // A pale yellow shield with a dark rectangular central mark and thin black side edges; dark wing covers with
    // lighter side edges.
    look: { shield: ['#f4e6a8', '#dcc47a', '#7a6434'], rim: '#f2e4b0', mark: 'rect', markColor: '#1a1210', sides: '#141010',
      elytra: ['#383230', '#1c1816', '#080706'], edge: '#e2cc7a', edgeW: 2, legs: '#1e1814', antenna: 0.5 },
    male: rng => { const n = 5 + Math.floor(rng() * 4); return Array.from({ length: n }, (_, i) => [i * 0.5, 0.15, 'soft']); },
    dark: [8, 10], sync: true,
    female: { delay: [1, 2], train: () => [[0, 0.15, 'soft'], [0.45, 0.15, 'soft']] }
  }
];
export const FIREFLY_IDS = FIREFLY_BREEDS.map(b => b.id);
export const PHOTINUS_IDS = ['bigdipperfirefly', 'southwestsyncfirefly', 'smokiessyncfirefly'];

const trainEnd = train => Math.max(...train.map(([s, d]) => s + d));

// How bright one pulse is, u = 0..1 through it.
function pulse(shape, u) {
  if (u <= 0 || u >= 1) return 0;
  if (shape === 'crescendo') return u < 0.85 ? (u / 0.85) ** 1.6 : (1 - u) / 0.15;
  if (shape === 'wavering') return Math.sin(Math.PI * u) ** 0.5 * (0.75 + 0.25 * Math.sin(u * 30));
  return Math.sin(Math.PI * u) ** 0.7;
}
export function trainIntensity(train, t) {
  let v = 0;
  for (const [s, d, shape] of train) v = Math.max(v, pulse(shape, (t - s) / d));
  return v;
}

const SEE_RANGE = 380;           // px: how far a firefly notices another's flashes

// Advances a firefly's flashing: males run their pattern (falling into step with neighbours, for synchronous
// kinds), females answer nearby males of their kind. Sets bug.glow (0..1) and starts a male's courtship walk
// toward a female who answers him.
export function updateFlash(b, dt, others) {
  const br = b.species.breed, rng = b.rng;
  const f = b.flash ??= { next: rng() * (br.every ?? br.dark)[1], train: null, t: 0, answer: null };
  if (f.train) {
    f.t += dt;
    if (f.t > trainEnd(f.train)) f.train = null;
  }
  if (b.sex === 'female') {
    if (f.answer && (f.answer.wait -= dt) <= 0) {
      f.train = br.female.train(rng);
      f.t = 0;
      if (f.answer.male && !f.answer.male.done) f.answer.male.court = { female: b, time: 6 };   // he heads for her
      f.answer = null;
    }
  } else if ((f.next -= dt) <= 0) {
    f.train = br.male(rng);
    f.t = 0;
    f.next = br.every ? between(rng, br.every) : trainEnd(f.train) + between(rng, br.dark);
    for (const o of others) {
      if (o === b || o.done || o.species !== b.species || Math.hypot(o.x - b.x, o.y - b.y) > SEE_RANGE) continue;
      if (o.sex === 'female') {
        if (br.female && !o.flash?.answer && !o.flash?.train && rng() < 0.7) {
          (o.flash ??= { next: 0, train: null, t: 0, answer: null }).answer = { wait: trainEnd(f.train) + between(rng, br.female.delay), male: b };
        }
      } else if (br.sync && o.flash && !o.flash.train && o.flash.next > 0.15) {
        o.flash.next = rng() * 0.12;   // joins in, all but together
      }
    }
  }
  b.glow = f.train ? trainIntensity(f.train, f.t) : 0;
}

// Body plan from above (body units, head forward): the pronotum shield, semicircular in front and straight behind,
// hides the head; long parallel-sided wing covers with rounded tips; the abdomen tip with its lantern just shows
// beyond them.
const SHIELD = { back: 17, cx: 19, rx: 20, ry: 14.5 };
const ELYTRA = [[17, 14.5], [-25, 14.5], [-32, 12.5], [-36, 8], [-37.5, 3], [-37.5, 0]];   // right half, mirrored
const OUTLINE = [[14, 9, 10]];   // the thorax beneath, where the legs leave the body
const LEGS = [
  { x: 20, angle: 0.95 },
  { x: 14, angle: 1.65 },
  { x: 8, angle: 2.3 }
];
export const LANTERN_X = -40;     // the light organ on the last abdominal segments

const rgb = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

function shieldPath(ctx) {
  const { back, cx, rx, ry } = SHIELD;
  ctx.beginPath();
  ctx.moveTo(back, -ry);
  ctx.lineTo(cx, -ry);
  ctx.ellipse(cx, 0, rx, ry, 0, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(back, ry);
  ctx.closePath();
}

// A pale band just inside the edge of the current path (a rim or a wing cover's margin).
function innerBand(ctx, path, color, width) {
  ctx.save();
  path();
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width * 2;
  path();
  ctx.stroke();
  ctx.restore();
}

function drawShield(ctx, L, look) {
  shieldPath(ctx);
  ctx.fillStyle = bodyGradient(ctx, L, 26, 0, 14, 14.5, look.shield);
  ctx.fill();
  ctx.save();
  shieldPath(ctx);
  ctx.clip();
  if (look.flanks) {                                  // red or pink patches either side
    ctx.fillStyle = look.flanks;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(27, side * 6.5, 6, 4.2, side * 0.25, 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = look.markColor;
  ctx.beginPath();
  if (look.mark === 'spot') ctx.ellipse(27, 0, 5.5, 5, 0, 0, TAU);
  else if (look.mark === 'bar') ctx.rect(SHIELD.back, -2.2, 21, 4.4);
  else if (look.mark === 'rect') ctx.rect(20, -4.5, 13, 9);
  else {                                              // a broad patch, wide behind and narrowing forward
    ctx.moveTo(SHIELD.back, -8.5);
    ctx.lineTo(31, -5);
    ctx.quadraticCurveTo(36, 0, 31, 5);
    ctx.lineTo(SHIELD.back, 8.5);
    ctx.closePath();
  }
  ctx.fill();
  if (look.sides) {                                   // thin dark edging along the sides
    ctx.strokeStyle = look.sides;
    ctx.lineWidth = 1.4;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(SHIELD.back, side * 14);
      ctx.quadraticCurveTo(26, side * 14.5, 32, side * 12);
      ctx.stroke();
    }
  }
  ctx.restore();
  innerBand(ctx, () => shieldPath(ctx), look.rim, 1.6);
  specular(ctx, L, 26, 0, 13, 13, 0.22);
}

function drawElytra(ctx, L, look) {
  const path = () => mirroredPath(ctx, ELYTRA);
  path();
  ctx.fillStyle = bodyGradient(ctx, L, -10, 0, 28, 14.5, look.elytra);
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  if (look.ridges) {                                  // Pyractomena: lengthwise ridges on each wing cover
    for (const y of [-10, -5, 5, 10]) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(15, y);
      ctx.lineTo(-33, y * 0.85);
      ctx.stroke();
    }
  }
  if (look.stripes) {                                 // Photuris: a short, faint pale stripe on each
    ctx.strokeStyle = look.edge;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(10, side * 7.5);
      ctx.lineTo(-22, side * 7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = look.edge;                        // the seam down the middle
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(17, 0);
  ctx.lineTo(-37.5, 0);
  ctx.stroke();
  ctx.restore();
  innerBand(ctx, path, look.edge, look.edgeW);        // pale outer margins
  specular(ctx, L, -6, 0, 26, 13, 0.16);
}

function makeFirefly(br) {
  const look = br.look, legLength = look.legLength ?? 1, reach = look.antenna * 100;
  return {
    id: br.id,
    breed: br,
    size: br.size,
    previewSize: 50,
    // Legs attach only to the thorax; the test suite checks every hip lies within it.
    anatomy: { legSection: [4, 24], hips: LEGS.map(l => l.x) },
    speed: [35, 65],
    pace: { drift: 0.25, dartRate: 0.03, dart: [1.3, 0.4] },
    pauseRate: 0.6,
    pauseTime: [1, 4],
    maxTurn: 3.5,
    wander: 1.1,
    stride: ((14 * br.size[0]) / 36) * legLength,
    flash: true,                 // runs updateFlash each step
    females: 0.25,               // share of fireflies that are females (answering, not leading)
    draw(ctx, bug) {
      const L = bug.light, g = bug.glow ?? 0;
      withBugFrame(ctx, bug, () => {
        groundShadow(ctx, L, -4, 0, 44, 16);
        for (const side of [-1, 1]) {
          LEGS.forEach((l, i) => {
            walkLeg(ctx, bug, { hx: l.x, hy: side * 4, edge: bodyEdge(l.x, OUTLINE) - 4, side, angle: l.angle, ...insectGait(bug, i, side), color: look.legs, segs: [
              [12 * legLength, 0, 1.8], [13 * legLength, i === 0 ? -0.4 : 0.4, 1.4], [8 * legLength, 0.2, 1]
            ] });
          });
        }
        // The abdomen tip with its lantern, pale when dark and lit from within when flashing.
        ctx.fillStyle = g > 0.02 ? rgb(br.color.map(c => Math.round(c * (0.75 + 0.25 * g))), 0.55 + 0.45 * g) : '#ece4c0';
        ctx.beginPath();
        ctx.ellipse(-37, 0, 4.5, 7, 0, 0, TAU);
        ctx.fill();
        drawElytra(ctx, L, look);
        // The head is tucked under the shield; only the eyes peep out in front.
        ctx.fillStyle = '#141008';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(38, side * 4.2, 2.6, 2.2, 0, 0, TAU);
          ctx.fill();
        }
        drawShield(ctx, L, look);
        for (const side of [-1, 1]) {                       // long, threadlike antennae
          const w = Math.sin(bug.t * 3 + side * 1.2) * 0.1;
          antenna(ctx, 39, side * 2.5, side, [[39 + reach * 0.45, (3 + reach * 0.22) * (1 + w)], [39 + reach * 0.8, (4 + reach * 0.5) * (1 + w)]],
            look.antenna < 0.4 ? 1.6 : 1.1, '#1e1610', true);
        }
      });
    },
    // The flash's glow, drawn in its own pass over everything (so it casts no shadow and lights what's near).
    drawGlow(ctx, bug) {
      const g = bug.glow ?? 0;
      if (g < 0.02) return;
      const k = bug.size / 100, c = Math.cos(bug.heading), s = Math.sin(bug.heading);
      const x = bug.x + c * LANTERN_X * k, y = bug.y + s * LANTERN_X * k;
      const r = bug.size * (0.45 + 0.55 * g);
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r);
      halo.addColorStop(0, rgb([255, 255, 220], 0.9 * g));
      halo.addColorStop(0.18, rgb(br.color, 0.75 * g));
      halo.addColorStop(1, rgb(br.color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  };
}

export const FIREFLIES = FIREFLY_BREEDS.map(makeFirefly);
