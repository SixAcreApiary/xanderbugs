// Leg attachment audit. Draws a species on a recording canvas through a full gait cycle and, for every
// walking leg, finds where its femur comes out from under the body (the fills drawn on top of it). Where
// a leg attaches, that visible joint should stay put while the leg walks; if it moves, the leg looks like
// it slides along the body.
import { SPECIES, createBug, Swarm, keepApart } from '../../src/lib/bugs/engine.js';

const mul = (m, [a, b, c, d, e, f]) => [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// Canvas stand-in that keeps filled shapes as polygons and stroked single lines as segments, in draw order.
export function recorder() {
  const ops = [];
  let m = [1, 0, 0, 1, 0, 0], stack = [], subs = [], cur = null, lineWidth = 1, fillStyle = '#000', alpha = 1;
  const pt = (x, y) => { const p = apply(m, x, y); (cur ??= (subs.push([]), subs.at(-1))).push(p); return p; };
  const api = {
    save: () => stack.push([m, alpha]), restore: () => { [m, alpha] = stack.pop() ?? [m, alpha]; },
    translate: (x, y) => { m = mul(m, [1, 0, 0, 1, x, y]); },
    rotate: a => { const c = Math.cos(a), s = Math.sin(a); m = mul(m, [c, s, -s, c, 0, 0]); },
    scale: (x, y = x) => { m = mul(m, [x, 0, 0, y, 0, 0]); },
    transform: (a, b, c, d, e, f) => { m = mul(m, [a, b, c, d, e, f]); },
    setTransform: (a, b, c, d, e, f) => { m = [a, b, c, d, e, f]; },
    beginPath: () => { subs = []; cur = null; },
    moveTo: (x, y) => { cur = null; pt(x, y); },
    lineTo: (x, y) => { pt(x, y); },
    closePath: () => { cur = null; },
    quadraticCurveTo: (cx, cy, x, y) => {
      const [x0, y0] = cur?.at(-1) ? invLast() : [cx, cy];
      for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; pt(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y); }
    },
    bezierCurveTo: (c1x, c1y, c2x, c2y, x, y) => {
      const [x0, y0] = cur?.at(-1) ? invLast() : [c1x, c1y];
      for (let i = 1; i <= 12; i++) {
        const t = i / 12, u = 1 - t;
        pt(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y);
      }
    },
    ellipse: (x, y, rx, ry, rot, a0, a1, ccw) => {
      let span = a1 - a0;
      if (ccw) span = -((a0 - a1) % (2 * Math.PI) || 2 * Math.PI); else if (span > 2 * Math.PI) span = 2 * Math.PI;
      const c = Math.cos(rot), s = Math.sin(rot);
      for (let i = 0; i <= 48; i++) {
        const a = a0 + span * i / 48, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
        pt(x + ex * c - ey * s, y + ex * s + ey * c);
      }
    },
    arc: (x, y, r, a0, a1, ccw) => api.ellipse(x, y, r, r, 0, a0, a1, ccw),
    rect: (x, y, w, h) => { cur = null; pt(x, y); pt(x + w, y); pt(x + w, y + h); pt(x, y + h); cur = null; },
    fill: () => {
      const polys = subs.filter(p => p.length > 2);
      if (polys.length) ops.push({ kind: 'fill', polys, opaque: alpha * opacity(fillStyle) > 0.6 });
    },
    stroke: () => {
      if (subs.length === 1 && subs[0].length === 2) ops.push({ kind: 'line', a: subs[0][0], b: subs[0][1], w: lineWidth * Math.hypot(m[0], m[1]) });
      else ops.push({ kind: 'path' });
    },
    createRadialGradient: gradient, createLinearGradient: gradient, createConicGradient: gradient,
    fillRect() {}, strokeRect() {}, clip() {}, fillText() {}, setLineDash() {}, drawImage() {}
  };
  function invLast() {
    const [px, py] = cur.at(-1), det = m[0] * m[3] - m[1] * m[2];
    const dx = px - m[4], dy = py - m[5];
    return [(m[3] * dx - m[2] * dy) / det, (m[0] * dy - m[1] * dx) / det];
  }
  const ctx = new Proxy(api, {
    get: (t, k) => k in t ? t[k] : undefined,
    set: (t, k, v) => {
      if (k === 'lineWidth') lineWidth = v;
      if (k === 'fillStyle') fillStyle = v;
      if (k === 'globalAlpha') alpha = v;
      return true;
    }
  });
  return { ctx, ops };
}

// Rough opacity of a fill: rgba()/hsla() alpha, or a gradient's most opaque stop.
function opacity(style) {
  if (style?.stops) return Math.max(0, ...style.stops.map(opacity));
  const m = /^(?:rgba|hsla)\([^)]*,\s*([\d.]+)\s*\)$/.exec(String(style).trim());
  return m ? +m[1] : 1;
}

function gradient() {
  const g = { stops: [], addColorStop: (o, c) => g.stops.push(c) };
  return g;
}

function inside(polys, x, y) {
  let wind = 0;
  for (const p of polys) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i], [xj, yj] = p[j];
      if ((yj <= y) !== (yi <= y)) {
        const cross = (xi - xj) * (y - yj) - (x - xj) * (yi - yj);
        wind += yi > yj ? (cross > 0 ? 1 : 0) : (cross < 0 ? -1 : 0);
      }
    }
  }
  return wind !== 0;
}

// Joined runs of single-line strokes (hip -> knee -> ankle -> foot) that start a new run where the pen jumps.
function legChains(ops) {
  const chains = [];
  let run = null;
  ops.forEach((op, i) => {
    if (op.kind !== 'line') { run = null; return; }
    if (run && Math.hypot(op.a[0] - run.end[0], op.a[1] - run.end[1]) < 1e-6) { run.segs.push(op); run.end = op.b; return; }
    run = { at: i, segs: [op], end: op.b };
    chains.push(run);
  });
  return chains.filter(c => c.segs.length >= 2);
}

// Where the leg [hip -> knee -> ...] first shows outside everything opaque filled after it, and how far along
// the leg that is. Null if the whole leg is hidden.
function exitPoint(ops, chain) {
  const above = ops.slice(chain.at + 1).filter(o => o.kind === 'fill' && o.opaque).map(o => o.polys);
  const covered = (x, y) => above.some(polys => inside(polys, x, y));
  let along = 0;
  for (const { a, b } of chain.segs) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let i = 0; i <= 200; i++) {
      const t = i / 200, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      if (!covered(x, y)) return { x, y, depth: along + len * t };
    }
    along += len;
  }
  return null;
}

// For one species, the femur exit point of every leg across a gait cycle. Coordinates are body-drawing units.
export function auditSpecies(id, { frames = 48, turnMix = 0, speedScale = 1 } = {}) {
  const sp = SPECIES[id];
  const bug = createBug(id, { width: 800, height: 600, rng: () => 0.5 });
  Object.assign(bug, { x: 0, y: 0, heading: 0, size: 100, light: { x: -0.45, y: -0.65 }, turnMix, speedScale, flying: false, airborne: 0, moving: 1 });
  const legs = [];
  for (let f = 0; f < frames; f++) {
    bug.phaseL = bug.phaseR = (f / frames) * 2 * Math.PI;
    const { ctx, ops } = recorder();
    sp.draw(ctx, bug, 1 / 60);
    legChains(ops).forEach((c, i) => {
      (legs[i] ??= { root: c.segs[0].a, femur: [], exits: [] });
      legs[i].femur.push(Math.hypot(c.segs[0].b[0] - c.segs[0].a[0], c.segs[0].b[1] - c.segs[0].a[1]));
      legs[i].exits.push(exitPoint(ops, c));
    });
  }
  return legs.map(l => {
    const pts = l.exits.filter(Boolean);
    const cx = pts.reduce((s, p) => s + p.x, 0) / (pts.length || 1), cy = pts.reduce((s, p) => s + p.y, 0) / (pts.length || 1);
    const slide = pts.reduce((s, p) => Math.max(s, ...pts.map(q => Math.hypot(p.x - q.x, p.y - q.y))), 0);
    const depth = pts.map(p => p.depth);
    return { root: l.root, exit: [cx, cy], slide, hidden: l.exits.length - pts.length, depth: [Math.min(...depth), Math.max(...depth)], femur: Math.max(...l.femur) };
  });
}

// A crowd in a real Swarm: 99th-percentile per-frame slip of planted feet (px), change in turn rate
// (rad/frame), and the closest any two on-screen bugs that keep a personal space came, as a share of it (not
// counting a frightened bug, which bolts regardless).
// Needs species that record their leg poses (bug.legPoses).
export function auditCrowd(species, { count = 20, seconds = 12, width = 1280, height = 800, rng = Math.random } = {}) {
  const swarm = new Swarm({ species, count, width, height, rng });
  const prev = new Map(), slips = [], jerks = [];
  let closest = Infinity;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  for (let f = 0; f < 60 * seconds && !swarm.done; f++) {
    swarm.update(1 / 60);
    swarm.draw(recorder().ctx);
    const live = swarm.bugs.filter(b => !b.done && b.delay <= 0 && !(b.alarm > 0.15));
    for (const b of live) for (const o of live) {
      const room = o !== b && keepApart(b, o);
      if (room) closest = Math.min(closest, Math.hypot(o.x - b.x, o.y - b.y) / room);
    }
    for (const b of swarm.bugs) {
      if (!b.legPoses || b.done || b.delay > 0) continue;
      const k = b.size / 100, c = Math.cos(b.heading), s = Math.sin(b.heading);
      const feet = b.legPoses.map(p => ({ x: b.x + (p.foot.x * c - p.foot.y * s) * k, y: b.y + (p.foot.x * s + p.foot.y * c) * k, up: p.lift > 0 }));
      const p = prev.get(b), turn = p ? wrap(b.heading - p.h) : 0;
      if (p) {
        feet.forEach((ft, i) => { if (!ft.up && !p.feet[i].up) slips.push(Math.hypot(ft.x - p.feet[i].x, ft.y - p.feet[i].y)); });
        jerks.push(Math.abs(wrap(turn - p.turn)));
      }
      prev.set(b, { feet, h: b.heading, turn });
    }
  }
  const p99 = a => [...a].sort((x, y) => x - y)[Math.floor(0.99 * (a.length - 1))] ?? 0;
  return { slip99: p99(slips), jerk99: p99(jerks), closest, samples: slips.length };
}
