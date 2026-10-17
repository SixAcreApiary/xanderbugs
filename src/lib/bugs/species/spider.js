import { withBugFrame, shadedEllipse, specular, groundShadow, leg, walkLeg3D, drawLeg3D, legShadow, VIEW_TILT, tetrapodGait, TAU, bodyEdge } from '../common.js';

// Spiders. They share one body plan: eight legs fanning round the cephalothorax (alternating tetrapod gait:
// L1,R2,L3,R4 step together, opposite the other four), and an abdomen behind. Each kind has its own body
// proportions, leg length and build, colours, markings and pace. The wolf spider keeps the original 'spider' id
// so saved settings carry over. Sizes are scaled to each kind's typical adult body length (legs not included).
const PX_PER_MM = 2.8;           // the scale the rest of the bugs are drawn at (a 13.5 mm honey bee is ~38 px)

// Hips fan round the rim of the cephalothorax, legs I at the front through IV at the back.
const BASE_LEGS = [
  { hx: 22, hy: 8, angle: 0.55, len: 1.05, bend: -0.35 },
  { hx: 17, hy: 10.5, angle: 1.15, len: 0.9, bend: -0.15 },
  { hx: 11, hy: 10.5, angle: 1.95, len: 0.85, bend: 0.25 },
  { hx: 5, hy: 8, angle: 2.55, len: 1.0, bend: 0.4 }
];

const BROWN = ['#8a7058', '#4a3828', '#18100a'];
export const SPIDER_BREEDS = [
  // Pardosa-type wolf spider: brown, a pale stripe down the carapace, chevrons on the abdomen; a fast runner.
  { id: 'spider', label: 'Wolf spider', mm: 8, body: BROWN, legs: ['#5a4634', '#2a1e14'], carapace: 'stripe', stripe: 'rgba(220,190,140,0.55)', abdomen: 'chevrons', mark: 'rgba(20,12,6,0.65)',
    speed: [85, 170], stride: 1.35, arch: 1.5, pace: { drift: 0.2, dartRate: 0.2, dart: [1.9, 0.5] }, pauseRate: 0.9 },
  // Parasteatoda tepidariorum: small, a round mottled brown abdomen, thin banded legs.
  { id: 'housespider', label: 'American house spider', mm: 6, body: ['#a08868', '#6a5038', '#2a1c10'], legs: ['#c8a878', '#6a5038'], bands: '#4a3424',
    ceph: 0.8, abd: [1, 1.15], legLen: 1.1, legW: 0.7, abdomen: 'mottle', mark: 'rgba(40,24,12,0.6)', speed: [30, 60], pauseRate: 1.2 },
  // Latrodectus mactans: glossy black, a big round abdomen with a red mark at the back; long slender legs.
  { id: 'blackwidow', label: 'Black widow', mm: 10, body: ['#3a3a40', '#0e0e12', '#020203'], legs: ['#202024', '#060608'], gloss: true,
    ceph: 0.75, abd: [1.05, 1.3], legLen: 1.25, legW: 0.75, abdomen: 'redmark', mark: '#d02020', speed: [30, 60], pauseRate: 1.3 },
  // Phidippus audax: black and furry, white spots and a white band on the abdomen, huge front eyes, short stout legs,
  // iridescent green jaws; stalks and hops.
  { id: 'boldjumper', label: 'Bold jumping spider', mm: 12, body: ['#3a3836', '#141312', '#040404'], legs: ['#2a2826', '#0a0a0a'], bands: '#9a9690',
    ceph: 1.15, abd: [0.95, 0.95], legLen: 0.7, legW: 1.35, stride: 1.7, arch: 1.55, abdomen: 'spots', mark: '#f0ece4', eyes: 'jumper', chelicerae: '#3aa08a',
    speed: [60, 120], pace: { drift: 0.25, dartRate: 0.5, dart: [2, 0.25] }, pauseRate: 1.2 },
  // Loxosceles reclusa: plain tan, a dark violin on the carapace, long uniform legs.
  { id: 'brownrecluse', label: 'Brown recluse', mm: 8, body: ['#c8a070', '#94683c', '#3a2410'], legs: ['#b88c5c', '#7a5430'], carapace: 'violin', mark: 'rgba(60,32,14,0.85)',
    abd: [0.95, 0.85], legLen: 1.2, legW: 0.75, abdomen: 'none', speed: [60, 120], pauseRate: 1 },
  // Pholcus phalangioides: a small, pale, long body on extremely long, thread-thin legs; slow and swaying.
  { id: 'cellarspider', label: 'Cellar spider', mm: 7, body: ['#e8dcc0', '#c0ac88', '#6a5a40'], legs: ['#d8c8a8', '#9a8868'],
    ceph: 0.7, abd: [1.15, 0.6], legLen: 3.2, legW: 0.3, abdomen: 'none', speed: [25, 50], pauseRate: 1.4 },
  // Araneus diadematus: a round orange-brown abdomen with a white cross of spots, banded legs.
  { id: 'gardenspider', label: 'European garden spider', mm: 13, body: ['#c88a50', '#8a5428', '#3a200a'], legs: ['#c89868', '#7a5030'], bands: '#3a2414',
    ceph: 0.85, abd: [1.1, 1.3], legLen: 1.15, legW: 0.9, abdomen: 'cross', mark: '#f4ecdc', speed: [30, 60], pauseRate: 1.2 },
  // Argiope aurantia: a long black abdomen boldly patched with yellow, a silvery carapace, long black legs banded orange.
  { id: 'yellowgardenspider', label: 'Yellow garden spider', mm: 22, body: ['#3a3836', '#141312', '#040404'], legs: ['#1e1c1a', '#060606'], bands: '#d88a3a',
    ceph: 0.85, abd: [1.25, 1.05], legLen: 1.3, legW: 0.85, carapace: 'silver', abdomen: 'argiope', mark: '#f0d020', speed: [30, 60], pauseRate: 1.3 },
  // Misumena vatia: white or yellow, a broad abdomen, the long front two pairs of legs held out sideways like a crab's;
  // ambushes bees on flowers.
  { id: 'crabspider', label: 'Goldenrod crab spider', mm: 9, body: ['#fff8d8', '#f0e08a', '#9a8a3a'], legs: ['#f4ecb0', '#c8b868'],
    ceph: 0.85, abd: [0.95, 1.25], legW: 0.85, crab: true, abdomen: 'crabsides', mark: '#d84a4a', speed: [25, 50], pauseRate: 1.5 },
  // Eratigena atrica: brown, pale chevrons on the abdomen, a striped carapace, long hairy legs; a fast sprinter.
  { id: 'giantspider', label: 'Giant house spider', mm: 15, body: ['#8a6a4a', '#4a3420', '#180e06'], legs: ['#6a5038', '#2e2016'], bands: '#9a7a58',
    abd: [1.05, 0.9], legLen: 1.4, legW: 0.95, carapace: 'stripe', stripe: 'rgba(30,18,8,0.6)', abdomen: 'chevrons', mark: 'rgba(230,200,150,0.55)',
    speed: [100, 200], stride: 1.3, pace: { drift: 0.2, dartRate: 0.25, dart: [1.9, 0.4] }, pauseRate: 1 },
  // Salticus scenicus: small, boldly black-and-white striped, big front eyes; hops.
  { id: 'zebrajumper', label: 'Zebra jumping spider', mm: 6, body: ['#3a3836', '#141312', '#040404'], legs: ['#5a5650', '#1a1816'], bands: '#d8d4cc',
    ceph: 1.1, abd: [1, 0.85], legLen: 0.7, legW: 1.1, arch: 1.5, abdomen: 'stripes', mark: '#f0ece4', eyes: 'jumper',
    speed: [40, 85], pace: { drift: 0.25, dartRate: 0.5, dart: [2, 0.25] }, pauseRate: 1.2 },
  // Cheiracanthium inclusum: pale yellow-green, an oval abdomen, dark-tipped feet and dark jaws; a quick night hunter.
  { id: 'sacspider', label: 'Yellow sac spider', mm: 7, body: ['#f0ecb8', '#ccc888', '#6a6a3a'], legs: ['#e8e4b0', '#a8a470'], tips: '#2a2418', chelicerae: '#3a2a18',
    ceph: 0.9, abd: [1.05, 0.85], legLen: 1.1, legW: 0.75, stride: 1.3, arch: 1.6, abdomen: 'none', speed: [80, 160], pauseRate: 1 }
];
export const SPIDER_IDS = SPIDER_BREEDS.map(b => b.id);

// Body units (size = 100): cephalothorax centred at x 14, abdomen behind, both scaled per kind.
export function bodyPlan(br) {
  const c = br.ceph ?? 1, [al, aw] = br.abd ?? [1, 1];
  const ceph = { cx: 14, rx: 15 * c, ry: 12.5 * c };
  const abd = { rx: 24 * al, ry: 18 * aw };
  abd.cx = ceph.cx - ceph.rx - abd.rx + 5;
  return { ceph, abd, front: ceph.cx + ceph.rx + 3, back: abd.cx - abd.rx };
}

function abdomenMarks(ctx, br, { cx, rx, ry }, rnd) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, 0, rx, ry, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = br.mark;
  ctx.strokeStyle = br.mark;
  switch (br.abdomen) {
    case 'chevrons':
      for (let c = 0; c < 4; c++) {
        const x = cx + rx * 0.5 - c * rx * 0.3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - rx * 0.2, -ry * (0.45 - c * 0.07));
        ctx.lineTo(x - rx * 0.12, 0);
        ctx.lineTo(x - rx * 0.2, ry * (0.45 - c * 0.07));
        ctx.fill();
      }
      break;
    case 'mottle':
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + (rnd() - 0.5) * rx * 1.5, (rnd() - 0.5) * ry * 1.5, 2 + rnd() * 3, 1.5 + rnd() * 2.5, rnd() * 3, 0, TAU);
        ctx.fill();
      }
      break;
    case 'redmark':                                   // the red mark near the spinnerets
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.75, 0, 3.2, 2.4, 0, 0, TAU);
      ctx.fill();
      break;
    case 'spots':                                     // a white band in front and paired spots behind
      ctx.beginPath();
      ctx.ellipse(cx + rx * 0.45, 0, rx * 0.12, ry * 0.55, 0, 0, TAU);
      ctx.fill();
      for (const x of [cx - rx * 0.1, cx - rx * 0.45]) for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x, s * ry * 0.35, 2.4, 0, TAU);
        ctx.fill();
      }
      break;
    case 'cross':                                     // the white cross of spots
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(cx + rx * 0.2 + i * rx * 0.18, 0, 2.2, 0, TAU);
        ctx.fill();
      }
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + rx * 0.2, s * ry * 0.3, 2.2, 0, TAU);
        ctx.arc(cx + rx * 0.2, s * ry * 0.55, 1.8, 0, TAU);
        ctx.fill();
      }
      break;
    case 'argiope':                                   // bold yellow patches down each side
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + rx * 0.55 - i * rx * 0.38, s * ry * 0.5, rx * 0.13, ry * 0.32, 0, 0, TAU);
        ctx.fill();
      }
      break;
    case 'crabsides':                                 // red streaks along the sides
      ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + rx * 0.5, s * ry * 0.75);
        ctx.quadraticCurveTo(cx, s * ry * 0.95, cx - rx * 0.6, s * ry * 0.6);
        ctx.stroke();
      }
      break;
    case 'stripes':                                   // black-and-white bands across
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + rx * 0.4 - i * rx * 0.45, 0, rx * 0.1, ry, 0, 0, TAU);
        ctx.fill();
      }
      break;
  }
  ctx.restore();
}

function carapaceMarks(ctx, br, { cx, rx, ry }) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, 0, rx, ry, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = br.mark;
  if (br.carapace === 'stripe') {                     // a band down the middle
    ctx.fillStyle = br.stripe;
    ctx.beginPath();
    ctx.ellipse(cx - 1, 0, rx * 0.75, ry * 0.25, 0, 0, TAU);
    ctx.fill();
  } else if (br.carapace === 'violin') {              // the violin: body behind the eyes, neck running back
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.25, 0, rx * 0.35, ry * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(cx - rx * 0.6, -ry * 0.1, rx * 0.7, ry * 0.2);
  } else if (br.carapace === 'silver') {              // silvery hairs
    ctx.fillStyle = 'rgba(230,230,224,0.75)';
    ctx.beginPath();
    ctx.ellipse(cx, 0, rx * 0.85, ry * 0.8, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function eyes(ctx, br, { cx, rx }) {
  const f = cx + rx * 0.8;
  ctx.fillStyle = '#050403';
  if (br.eyes === 'jumper') {                         // two huge forward-facing eyes, smaller ones beside and behind
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(f, s * 3, 3.4, 0, TAU);
      ctx.arc(f - 1, s * 7, 1.6, 0, TAU);
      ctx.arc(f - rx * 0.8, s * 7.5, 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(f + 0.6, s * 3 - 1, 0.9, 0, TAU); ctx.fill(); }
    return;
  }
  [[f, 0, 2.4], [f - 1, 3.5, 2], [f - 1, -3.5, 2], [f - 4, 5, 1.4], [f - 4, -5, 1.4], [f + 2, 2, 1.2], [f + 2, -2, 1.2]]
    .forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); });
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  [[f - 0.6, -0.6], [f - 1.5, 2.9], [f - 1.5, -4.1]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 0.6, 0, TAU); ctx.fill(); });
}

const fixed = seed => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

function makeSpider(br) {
  const plan = bodyPlan(br), { ceph, abd } = plan;
  const legLen = br.legLen ?? 1, legW = br.legW ?? 1;
  const LEGS = BASE_LEGS.map((l, i) => {
    const c = ceph.rx / 15;
    const leg = { ...l, hx: ceph.cx + (l.hx - 14) * c, hy: l.hy * c, len: l.len * legLen };
    if (br.crab && i < 2) Object.assign(leg, { angle: i === 0 ? 1.0 : 1.35, len: l.len * 1.45, bend: -0.5 });   // held out like a crab's
    return leg;
  });
  const outline = [[ceph.cx, ceph.rx, ceph.ry]];
  const sizeMid = (br.mm * PX_PER_MM * 100) / (plan.front - plan.back);
  return {
    id: br.id,
    breed: br,
    plan,
    size: [sizeMid * 0.93, sizeMid * 1.07],
    previewSize: Math.min(60, Math.max(28, 44 / Math.sqrt(legLen))),
    // Legs attach only to the cephalothorax, never the abdomen; the test suite checks every hip lies within it.
    anatomy: { legSection: [ceph.cx - ceph.rx, ceph.cx + ceph.rx], hips: LEGS.map(l => l.hx) },
    speed: br.speed,
    pace: br.pace ?? { drift: 0.2, dartRate: 0.08, dart: [1.5, 0.4] },
    pauseRate: br.pauseRate,
    pauseTime: [0.6, 3.0],
    maxTurn: 5,
    wander: 0.9,
    stride: 18 * legLen * (br.stride ?? 1),   // long-legged kinds take longer steps, and quick runners longer still
    keepApart: Math.min(1.6, 0.8 * legLen),
    twitchy: br.eyes === 'jumper',   // jumping spiders move in sudden starts and stops   // personal space from other spiders (fraction of size): legs at most touch
    draw(ctx, bug) {
      const L = bug.light;
      withBugFrame(ctx, bug, () => {
        groundShadow(ctx, L, abd.cx + 10, 0, abd.rx + ceph.rx + 8, Math.max(abd.ry, ceph.ry) * 1.6, 0.28);
        const legs = [];
        for (const side of [-1, 1]) {
          LEGS.forEach((l, i) => {
            const segs = [[26 * l.len, 0, 4.6 * legW], [30 * l.len, l.bend, 3.6 * legW], [22 * l.len, l.bend * 0.6, 2.4 * legW]];
            const pose = walkLeg3D(bug, { hx: l.hx, hy: side * l.hy, edge: bodyEdge(l.hx, outline) - l.hy, side, angle: l.angle, segs, ...tetrapodGait(bug, i, side), hz: ceph.ry * 0.5, curl: l.bend, arch: br.arch ?? 1.45, key: i * 2 + (side > 0), recoil: bug.recoil?.[legs.length] ?? 0 });
            legs.push({ l, pose, widths: segs.map(([, , w]) => w) });
          });
        }
        bug.legPoses = legs.map(g => g.pose);   // last drawn pose of each leg, for tests and diagnostics
        for (const { pose, widths } of legs) legShadow(ctx, L, pose, widths[1]);
        for (const { l, pose, widths } of legs) {
          drawLeg3D(ctx, L, pose, widths, br.legs[1]);
          // A lighter core along the same leg gives a hairy look; banded kinds get dashes of their band colour.
          drawLeg3D(ctx, L, pose, widths.map(w => w * 0.45), br.legs[0]);
          if (br.bands) {
            ctx.setLineDash([4 * l.len, 6 * l.len]);
            drawLeg3D(ctx, L, pose, widths.map(w => w * 0.7), br.bands);
            ctx.setLineDash([]);
          }
          if (br.tips) {
            ctx.fillStyle = br.tips;
            ctx.beginPath();
            ctx.arc(pose.foot.x + L.x * -pose.hip.z * VIEW_TILT, pose.foot.y + L.y * -pose.hip.z * VIEW_TILT, 1.6 * legW + 0.6, 0, TAU);
            ctx.fill();
          }
        }
        for (const side of [-1, 1]) {
          const pw = Math.sin(bug.t * 5 + side) * 0.2;                     // pedipalps
          leg(ctx, ceph.cx + ceph.rx * 0.8, side * 4, side, 0.35 + pw, [[9 * Math.min(1, legLen), 0, 3 * legW], [7, -0.3, 2.4 * legW]], br.legs[1]);
        }
        shadedEllipse(ctx, L, abd.cx, 0, abd.rx, abd.ry, br.body);
        abdomenMarks(ctx, br, abd, fixed(Math.floor(bug.variant * 1e6) + 11));
        specular(ctx, L, abd.cx, 0, abd.rx, abd.ry, br.gloss ? 0.6 : 0.25);
        shadedEllipse(ctx, L, ceph.cx, 0, ceph.rx, ceph.ry, br.body);
        carapaceMarks(ctx, br, ceph);
        specular(ctx, L, ceph.cx, 0, ceph.rx, ceph.ry, br.gloss ? 0.5 : 0.3);
        if (br.chelicerae) {                                                 // the jaws, showing in front
          ctx.fillStyle = br.chelicerae;
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(ceph.cx + ceph.rx + 1, s * 2.4, 3, 2.2, 0, 0, TAU);
            ctx.fill();
          }
        }
        eyes(ctx, br, ceph);
      });
    }
  };
}

export const SPIDERS = SPIDER_BREEDS.map(makeSpider);
export default SPIDERS[0];
