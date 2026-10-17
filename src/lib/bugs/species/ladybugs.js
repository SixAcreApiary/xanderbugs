import { withBugFrame, shadedEllipse, specular, groundShadow, walkLeg3D, drawLeg3D, legShadow, insectGait, antenna, TAU, bodyEdge } from '../common.js';

// Lady beetles (Coccinellidae): twelve common North American kinds, picked to look unlike one another. They share
// one body: a domed, nearly round pair of wing covers (elytra), a pronotum shield in front with its own markings,
// a small head, and short legs that barely show beneath the shell. Each kind has its own colour, spots, bands or
// checkers. Sizes are each kind's typical adult length.
const PX_PER_MM = 2.8;   // the scale the rest of the bugs are drawn at

// Spots are given for the right wing cover as [u, v, r]: u from the front (1) to the back (-1) of the shell, v
// out from the midline (0) to the edge (1), r a fraction of the shell's half-width; a spot at v = 0 sits on the
// seam and is drawn once. They are mirrored onto the left cover.
const RED = ['#ff6a50', '#d81c10', '#6a0804'];
const BLACK_SHELL = ['#5a5658', '#121012', '#020202'];
const BASE = { shell: [-8, 30, 32], spotColor: '#120c0a', pronotum: { colors: BLACK_SHELL, mark: 'whiteCorners' }, legs: '#141010', speed: [25, 50], stride: 7 };

export const LADYBUG_BREEDS = [
  // Coccinella septempunctata: red, seven black spots (one on the seam), white corners on a black pronotum.
  { id: 'sevenspotladybug', label: 'Seven-spotted', mm: 7, shellColors: RED,
    spots: [[0.78, 0, 0.17], [0.38, 0.55, 0.16], [-0.2, 0.5, 0.18], [-0.62, 0.38, 0.13]] },
  // Harmonia axyridis: orange, a scatter of small spots, a cream pronotum with a black M.
  { id: 'asianladybug', label: 'Asian multicolored', mm: 7, shellColors: ['#ffb05a', '#e8761a', '#6a2a04'],
    pronotum: { colors: ['#fff6e0', '#e8dcc0', '#8a7a5a'], mark: 'M' },
    spots: [[0.55, 0.35, 0.08], [0.3, 0.72, 0.08], [0.1, 0.3, 0.09], [-0.15, 0.62, 0.08], [-0.4, 0.28, 0.08], [-0.55, 0.7, 0.07], [-0.78, 0.4, 0.07]] },
  // Hippodamia convergens: orange-red, a little oval, small spots, two white dashes converging on the pronotum.
  { id: 'convergentladybug', label: 'Convergent', mm: 5.5, shell: [-8, 31, 28], shellColors: ['#ff8a5a', '#e0401c', '#6a1404'],
    pronotum: { colors: BLACK_SHELL, mark: 'converging' },
    spots: [[0.7, 0.3, 0.07], [0.35, 0.6, 0.07], [0.05, 0.35, 0.08], [-0.25, 0.7, 0.07], [-0.5, 0.35, 0.08], [-0.75, 0.55, 0.07]] },
  // Adalia bipunctata: red with a single black spot on each wing cover.
  { id: 'twospotladybug', label: 'Two-spotted', mm: 4.5, shellColors: RED, pronotum: { colors: BLACK_SHELL, mark: 'whiteSides' },
    spots: [[0.05, 0.5, 0.2]] },
  // Chilocorus stigma: a glossy black dome with one red spot on each cover.
  { id: 'twicestabbedladybug', label: 'Twice-stabbed', mm: 4.5, shell: [-8, 31, 33], shellColors: BLACK_SHELL, gloss: true,
    pronotum: { colors: BLACK_SHELL }, spotColor: '#e02414', spots: [[0.05, 0.55, 0.16]] },
  // Propylea quatuordecimpunctata: yellow with black squarish spots that run together like a checkerboard.
  { id: 'fourteenspotladybug', label: 'Fourteen-spotted', mm: 4, shell: [-8, 31, 29], shellColors: ['#fff07a', '#f0c820', '#7a5a04'],
    pronotum: { colors: ['#fff07a', '#f0c820', '#7a5a04'], mark: 'blackTrapezoid' }, squares: true,
    spots: [[0.72, 0.15, 0.17], [0.55, 0.7, 0.14], [0.25, 0.35, 0.17], [-0.05, 0.75, 0.14], [-0.3, 0.3, 0.17], [-0.6, 0.65, 0.14], [-0.8, 0.2, 0.12]] },
  // Psyllobora vigintimaculata: tiny, cream-white with soft tan-brown spots, some running together.
  { id: 'twentyspotladybug', label: 'Twenty-spotted', mm: 2.5, shellColors: ['#ffffff', '#ece4d0', '#8a806a'], spotColor: '#9a6a3a',
    pronotum: { colors: ['#ffffff', '#ece4d0', '#8a806a'], mark: 'brownDots' },
    spots: [[0.7, 0.25, 0.12], [0.55, 0.75, 0.11], [0.3, 0.45, 0.13], [0.05, 0.8, 0.11], [-0.1, 0.25, 0.12], [-0.35, 0.6, 0.13], [-0.6, 0.3, 0.12], [-0.75, 0.7, 0.1], [-0.88, 0, 0.1]] },
  // Coleomegilla maculata: pink and oval, six black spots on each cover, two black triangles on a pink pronotum.
  { id: 'pinkladybug', label: 'Pink spotted', mm: 6, shell: [-9, 34, 25], shellColors: ['#ffb4c0', '#ec6a82', '#7a2434'],
    pronotum: { colors: ['#ffb4c0', '#ec6a82', '#7a2434'], mark: 'twoTriangles' },
    spots: [[0.75, 0, 0.15], [0.5, 0.45, 0.16], [0.15, 0.75, 0.15], [0.05, 0.25, 0.15], [-0.35, 0.55, 0.16], [-0.7, 0.3, 0.15]] },
  // Cryptolaemus montrouzieri: dark brown-black and downy, with an orange head, pronotum and tail end.
  { id: 'mealybugdestroyer', label: 'Mealybug destroyer', mm: 4, shell: [-8, 31, 28], shellColors: ['#5a4434', '#2a1c14', '#0a0604'],
    pronotum: { colors: ['#f0a060', '#c8682a', '#5a2808'] }, tail: '#e08a40', headColor: ['#f0a060', '#c8682a', '#5a2808'] },
  // Cycloneda munda: a polished, unspotted red dome.
  { id: 'polishedladybug', label: 'Polished', mm: 5, shellColors: ['#ff7a5a', '#e02818', '#701006'], gloss: true,
    pronotum: { colors: BLACK_SHELL, mark: 'whiteM' } },
  // Coccinella trifasciata: orange-red crossed by three wavy black bands.
  { id: 'threebandedladybug', label: 'Three-banded', mm: 5, shellColors: ['#ff9a5a', '#e8501c', '#6a1a04'], bands: [0.55, 0, -0.55] },
  // Anatis mali: large, deep red, its black spots each ringed with a pale halo.
  { id: 'eyespottedladybug', label: 'Eye-spotted', mm: 9, shell: [-8, 32, 30], shellColors: ['#e06a50', '#a8281c', '#4a0a06'], rings: '#f0dc9a',
    spots: [[0.75, 0, 0.12], [0.5, 0.5, 0.12], [0.15, 0.25, 0.12], [0.05, 0.75, 0.11], [-0.3, 0.45, 0.12], [-0.62, 0.65, 0.11], [-0.7, 0.2, 0.11]] }
].map(b => ({ ...BASE, ...b, pronotum: { ...BASE.pronotum, ...b.pronotum } }));
export const LADYBUG_IDS = LADYBUG_BREEDS.map(b => b.id);

// Where each part sits (shell centred a little behind 0), and the body's drawn length, head to tail.
export function ladybugPlan(br) {
  const [cx, rx, ry] = br.shell;
  const pronotum = { cx: cx + rx * 0.9, rx: rx * 0.3, ry: ry * 0.64 };   // overlapping the front of the shell
  const head = { cx: pronotum.cx + pronotum.rx * 0.95, rx: rx * 0.2, ry: ry * 0.32 };
  const shell = { cx, rx, ry };
  return { shell, pronotum, head, length: head.cx + head.rx - (cx - rx) };
}

function shellPath(ctx, s) {
  ctx.beginPath();
  ctx.ellipse(s.cx, 0, s.rx, s.ry, 0, 0, TAU);
}

function drawSpots(ctx, br, s) {
  const at = (u, v) => [s.cx + u * s.rx, v * s.ry * Math.sqrt(Math.max(0, 1 - u * u))];
  for (const [u, v, r] of br.spots ?? []) {
    for (const side of v === 0 ? [0] : [-1, 1]) {
      const [x, y0] = at(u, v), y = side * y0, rr = r * s.ry;
      if (br.rings) { ctx.fillStyle = br.rings; ctx.beginPath(); ctx.arc(x, y, rr * 1.45, 0, TAU); ctx.fill(); }
      ctx.fillStyle = br.spotColor;
      ctx.beginPath();
      if (br.squares) ctx.rect(x - rr, y - rr * 0.85, rr * 2, rr * 1.7);
      else ctx.ellipse(x, y, rr, rr * 0.9, 0, 0, TAU);
      ctx.fill();
    }
  }
  for (const u of br.bands ?? []) {                  // wavy bands across both covers
    ctx.strokeStyle = br.spotColor;
    ctx.lineWidth = s.rx * 0.16;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const v = -1 + i / 6, x = s.cx + u * s.rx + Math.sin(i * 1.6) * s.rx * 0.05;
      i ? ctx.lineTo(x, v * s.ry) : ctx.moveTo(x, v * s.ry);
    }
    ctx.stroke();
  }
  if (br.tail) {                                     // a different-coloured tail end
    ctx.fillStyle = br.tail;
    ctx.beginPath();
    ctx.ellipse(s.cx - s.rx * 0.85, 0, s.rx * 0.32, s.ry * 0.75, 0, 0, TAU);
    ctx.fill();
  }
}

function drawPronotum(ctx, L, br, p) {
  const colors = br.pronotum.colors;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(p.cx, 0, p.rx, p.ry, 0, -Math.PI / 2, Math.PI / 2);   // the front half: a curved shield
  ctx.lineTo(p.cx - p.rx * 0.2, p.ry);
  ctx.lineTo(p.cx - p.rx * 0.2, -p.ry);
  ctx.closePath();
  ctx.clip();
  shadedEllipse(ctx, L, p.cx, 0, p.rx * 1.2, p.ry, colors);
  const w = '#f4f0e8', k = '#120c0a';
  const blob = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); };
  switch (br.pronotum.mark) {
    case 'whiteCorners': for (const s of [-1, 1]) blob(p.cx + p.rx * 0.3, s * p.ry * 0.75, p.rx * 0.5, p.ry * 0.25, w); break;
    case 'whiteSides': for (const s of [-1, 1]) blob(p.cx, s * p.ry * 0.85, p.rx * 0.7, p.ry * 0.2, w); break;
    case 'whiteM':
    case 'M': {                                       // an M (white on black, or black on cream)
      ctx.strokeStyle = br.pronotum.mark === 'M' ? k : w;
      ctx.lineWidth = p.rx * 0.22;
      ctx.beginPath();
      ctx.moveTo(p.cx - p.rx * 0.1, -p.ry * 0.55);
      ctx.lineTo(p.cx + p.rx * 0.6, -p.ry * 0.3);
      ctx.lineTo(p.cx + p.rx * 0.1, 0);
      ctx.lineTo(p.cx + p.rx * 0.6, p.ry * 0.3);
      ctx.lineTo(p.cx - p.rx * 0.1, p.ry * 0.55);
      ctx.stroke();
      break;
    }
    case 'converging':                                // two white dashes converging to the back, and white edges
      for (const s of [-1, 1]) {
        blob(p.cx, s * p.ry * 0.9, p.rx * 0.9, p.ry * 0.15, w);
        ctx.strokeStyle = w;
        ctx.lineWidth = p.rx * 0.16;
        ctx.beginPath();
        ctx.moveTo(p.cx + p.rx * 0.1, s * p.ry * 0.5);
        ctx.lineTo(p.cx - p.rx * 0.15, s * p.ry * 0.18);
        ctx.stroke();
      }
      break;
    case 'blackTrapezoid': blob(p.cx, 0, p.rx * 0.6, p.ry * 0.45, k); break;
    case 'brownDots': for (const y of [-0.45, 0, 0.45]) blob(p.cx + p.rx * 0.1, y * p.ry, p.rx * 0.18, p.ry * 0.12, '#9a6a3a'); break;
    case 'twoTriangles':
      for (const s of [-1, 1]) {
        ctx.fillStyle = k;
        ctx.beginPath();
        ctx.moveTo(p.cx - p.rx * 0.2, s * p.ry * 0.1);
        ctx.lineTo(p.cx + p.rx * 0.5, s * p.ry * 0.25);
        ctx.lineTo(p.cx - p.rx * 0.2, s * p.ry * 0.55);
        ctx.fill();
      }
      break;
  }
  ctx.restore();
  specular(ctx, L, p.cx, 0, p.rx, p.ry, 0.4);
}

function makeLadybug(br) {
  const plan = ladybugPlan(br), { shell, pronotum, head } = plan;
  const sizeMid = (br.mm * PX_PER_MM * 100) / plan.length;
  // The legs leave the thorax, hidden beneath the front of the shell and the pronotum.
  const thorax = { cx: pronotum.cx - pronotum.rx * 1.2, rx: pronotum.rx * 1.3, ry: pronotum.ry * 0.5 };
  const LEGS = [{ x: thorax.cx + thorax.rx * 0.6, angle: 0.9 }, { x: thorax.cx, angle: 1.6 }, { x: thorax.cx - thorax.rx * 0.6, angle: 2.2 }];
  const edgeAt = x => Math.max(bodyEdge(x, [[shell.cx, shell.rx, shell.ry]]), bodyEdge(x, [[pronotum.cx, pronotum.rx, pronotum.ry]]));
  // The shell widens behind the legs, so a femur swung back would pass under it: each leg pivots at the edge of
  // the widest part just behind its hip.
  const cover = x => Math.max(edgeAt(x), edgeAt(x - shell.rx * 0.25));
  return {
    id: br.id,
    breed: br,
    plan,
    size: [sizeMid * 0.93, sizeMid * 1.07],
    previewSize: 48,
    // Legs attach only to the thorax; the test suite checks every hip lies within it.
    anatomy: { legSection: [thorax.cx - thorax.rx, thorax.cx + thorax.rx], hips: LEGS.map(l => l.x) },
    speed: br.speed,
    pace: { drift: 0.25, dartRate: 0.04, dart: [1.4, 0.4] },
    pauseRate: 0.6,
    pauseTime: [0.5, 2.5],
    maxTurn: 4,
    wander: 1.4,
    stride: br.stride,
    draw(ctx, bug) {
      const L = bug.light;
      withBugFrame(ctx, bug, () => {
        groundShadow(ctx, L, shell.cx + 4, 0, shell.rx * 1.15, shell.ry * 1.05);
        // Short legs posed in 3D (see walkLeg3D); only their outer parts show beyond the shell.
        const legs = [];
        for (const side of [-1, 1]) {
          LEGS.forEach((l, i) => {
            const bend = i === 0 ? -0.4 : 0.4, segs = [[12, 0, 2.2], [12, bend, 1.7], [7, 0.2, 1.2]];
            const pose = walkLeg3D(bug, { hx: l.x, hy: side * thorax.ry * 0.4, edge: cover(l.x) - thorax.ry * 0.4, side, angle: l.angle, segs, ...insectGait(bug, i, side),
              hz: shell.ry * 0.3, curl: bend, arch: 1.25, key: i * 2 + (side > 0), recoil: bug.recoil?.[legs.length] ?? 0 });
            legs.push({ pose, widths: segs.map(([, , w]) => w) });
          });
        }
        bug.legPoses = legs.map(g => g.pose);
        for (const { pose, widths } of legs) legShadow(ctx, L, pose, widths[1], 0.12);
        for (const { pose, widths } of legs) drawLeg3D(ctx, L, pose, widths, br.legs);
        for (const side of [-1, 1]) {                       // short clubbed antennae
          antenna(ctx, head.cx + head.rx * 0.5, side * head.ry * 0.5, side, [[head.cx + head.rx * 1.6, head.ry * 0.9], [head.cx + head.rx * 2.1, head.ry * 1.1]], 0.9, '#1a1210');
        }
        shadedEllipse(ctx, L, head.cx, 0, head.rx, head.ry, br.headColor ?? BLACK_SHELL);
        for (const side of [-1, 1]) {                       // pale patches either side of the head
          ctx.fillStyle = br.headColor ? 'rgba(0,0,0,0)' : '#f0ece0';
          ctx.beginPath();
          ctx.ellipse(head.cx + head.rx * 0.3, side * head.ry * 0.55, head.rx * 0.35, head.ry * 0.25, 0, 0, TAU);
          ctx.fill();
        }
        shadedEllipse(ctx, L, shell.cx, 0, shell.rx, shell.ry, br.shellColors);
        ctx.save();
        shellPath(ctx, shell);
        ctx.clip();
        drawSpots(ctx, br, shell);
        ctx.restore();
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';               // the seam between the wing covers
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(shell.cx + shell.rx, 0);
        ctx.lineTo(shell.cx - shell.rx, 0);
        ctx.stroke();
        specular(ctx, L, shell.cx, 0, shell.rx, shell.ry, br.gloss ? 0.9 : 0.6);
        drawPronotum(ctx, L, br, pronotum);
      });
    }
  };
}

export const LADYBUGS = LADYBUG_BREEDS.map(makeLadybug);
