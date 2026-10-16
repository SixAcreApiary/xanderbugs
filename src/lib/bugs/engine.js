import { localLight, TAU } from './common.js';
import ant from './species/ant.js';
import cockroach from './species/cockroach.js';
import centipede from './species/centipede.js';
import spider from './species/spider.js';
import silverfish from './species/silverfish.js';
import beetle from './species/beetle.js';
import earwig from './species/earwig.js';
import yellowjacket from './species/yellowjacket.js';
import stinkbug from './species/stinkbug.js';
import bedbug from './species/bedbug.js';
import housecentipede from './species/housecentipede.js';

export const SPECIES = Object.fromEntries([ant, cockroach, centipede, spider, silverfish, beetle, earwig, yellowjacket, stinkbug, bedbug, housecentipede].map(s => [s.id, s]));

const MAX_LIFETIME_S = 45;
const NEVER_ENTERED_S = 12;
const WAYPOINT_RADIUS = 40;
const STALL_SECONDS = 2.5;
// Personal space: walking bugs steer round anyone within this many combined half-lengths.
const AVOID_RANGE = 1.6;
const AVOID_LOOKAHEAD_S = 0.3;   // fast bugs start giving way earlier
// Ants that meet head on sometimes stop to touch antennae, as real ants do.
const MEET_CHANCE = 0.5;
const MEET_TIME = [1.2, 3];
const MEET_COOLDOWN = [6, 12];
// Pace variation while walking: a smooth wander of ±drift around the bug's speed, plus occasional darts.
const DEFAULT_GAIT_VARIATION = { drift: 0.25, dartRate: 0.05, dart: [1.5, 0.5] };       // give up on a waypoint that isn't getting any closer (orbiting it)

const lerp = (a, b, t) => a + (b - a) * t;
const between = (rng, [a, b]) => lerp(a, b, rng());
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

function edgePoint(edge, w, h, along, margin) {
  switch (edge) {
    case 0: return { x: along * w, y: -margin };
    case 1: return { x: w + margin, y: along * h };
    case 2: return { x: along * w, y: h + margin };
    default: return { x: -margin, y: along * h };
  }
}

// speed multiplies the species' natural pace (user setting); legs keep stepping in proportion.
export function createBug(speciesId, { width, height, rng = Math.random, delay = 0, speed = 1 }) {
  const sp = SPECIES[speciesId];
  if (!sp) throw new Error(`unknown species ${speciesId}`);
  const size = between(rng, sp.size);
  const margin = size * 1.6;
  const startEdge = Math.floor(rng() * 4);
  const exitEdge = rng() < 0.65 ? (startEdge + 2) % 4 : (startEdge + 1 + Math.floor(rng() * 3)) % 4;
  const start = edgePoint(startEdge, width, height, 0.1 + rng() * 0.8, margin);
  const exit = edgePoint(exitEdge, width, height, 0.1 + rng() * 0.8, margin * 2);
  const waypoints = [];
  const nWay = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < nWay; i++) waypoints.push({ x: width * (0.15 + rng() * 0.7), y: height * (0.15 + rng() * 0.7) });
  waypoints.push(exit);
  const speedScale = speed;
  const gait0 = rng() * TAU;
  const bug = {
    species: sp,
    size,
    x: start.x,
    y: start.y,
    heading: Math.atan2(waypoints[0].y - start.y, waypoints[0].x - start.x),
    speed: 0,
    cruise: between(rng, sp.speed) * speedScale,
    speedScale,
    // Slow crawlers get proportionally longer before they're hurried off screen.
    maxLife: MAX_LIFETIME_S / Math.min(1, speedScale),
    waypoints,
    paused: false,
    stateTime: 0,
    phase: 0,
    phaseL: gait0,
    phaseR: gait0,
    t: 0,
    delay,
    age: 0,
    entered: false,
    done: false,
    moving: 0,
    variant: rng(),
    noise: [rng() * TAU, rng() * TAU, 0.6 + rng() * 0.8, 1.7 + rng() * 1.5],
    paceNoise: [rng() * TAU, rng() * TAU, 0.25 + rng() * 0.35, 0.7 + rng() * 0.6],
    dartTime: 0,
    meet: null,           // { partner, time } while two ants stand head to head
    meetCooldown: 0,
    veer: 0,
    trail: sp.trail ? [] : null,
    best: Infinity,
    stall: 0,
    light: localLight(0),
    rng
  };
  bug.stridePx = strideLength(bug);   // travel per full leg cycle, used to keep planted feet still
  return bug;
}

// Legs step for both forward travel and rotation. When turning, the outer side's feet travel further
// than the inner side's; turning on the spot drives the two sides in opposite directions, so a bug
// pivoting in place visibly walks itself round instead of spinning like it's on a turntable.
const TURN_RADIUS = 0.35;  // foot distance from the body axis, as a fraction of body length
// Real animals run faster mostly by lengthening their stride, not by moving their legs faster.
// Above natural pace the stride grows as speed^STRIDE_GROWTH, so leg cadence rises only gently.
const STRIDE_BASE = 1.25;
const STRIDE_GROWTH = 0.65;

export function strideLength(b) {
  return b.species.stride * STRIDE_BASE * Math.max(1, b.speedScale) ** STRIDE_GROWTH;
}
const WRAP = TAU * 1000;

export function advanceGait(b, dist, turn, dt = 0) {
  const rot = turn * b.size * TURN_RADIUS;
  const k = TAU / strideLength(b);
  b.phaseL = (b.phaseL + (dist + rot) * k) % WRAP;   // +turn = clockwise on screen: left side is outer
  b.phaseR = (b.phaseR + (dist - rot) * k) % WRAP;
  b.phase = (b.phase + (dist + Math.abs(rot)) * k) % WRAP;
  // After a turn the two sides drift apart; ease them back into a coordinated gait while walking.
  const drift = wrapAngle(b.phaseL - b.phaseR) * Math.min(1, dt * 1.5) * b.moving * 0.5;
  b.phaseL -= drift;
  b.phaseR += drift;
}

// How much faster or slower than its cruising speed a walking bug goes right now: it surges and dawdles
// smoothly, and now and then darts forward for a moment (cockroaches and silverfish far more than beetles).
export function paceFactor(b, dt) {
  const v = { ...DEFAULT_GAIT_VARIATION, ...b.species.pace };
  const [q1, q2, g1, g2] = b.paceNoise;
  const drift = 1 + v.drift * (Math.sin(b.t * g1 * TAU + q1) * 0.6 + Math.sin(b.t * g2 * TAU + q2) * 0.4);
  if (b.dartTime > 0) b.dartTime -= dt;
  else if (b.entered && b.rng() < v.dartRate * dt) b.dartTime = v.dart[1] * (0.6 + b.rng() * 0.8);
  return drift * (b.dartTime > 0 ? v.dart[0] : 1);
}

export function stepBug(b, dt, width, height, others = []) {
  if (b.done) return;
  if (b.delay > 0) { b.delay -= dt; return; }
  const sp = b.species;
  const rng = b.rng;
  b.t += dt;
  b.age += dt;
  b.stateTime -= dt;

  if (b.age > b.maxLife && b.waypoints.length > 1) b.waypoints.splice(0, b.waypoints.length - 1);
  const urgent = b.age > b.maxLife;

  if (b.meetCooldown > 0) b.meetCooldown -= dt;
  if (b.meet && ((b.meet.time -= dt) <= 0 || b.meet.partner.done || urgent)) endMeeting(b);
  if (!b.meet && !urgent) tryMeeting(b, others);

  if (b.meet) {
    b.paused = false;
  } else if (b.paused) {
    if (b.stateTime <= 0) {
      b.paused = false;
      b.speed = b.cruise * 0.3;
      b.cruise = between(rng, sp.speed) * b.speedScale;
    }
  } else if (!urgent && b.entered && rng() < sp.pauseRate * dt) {
    b.paused = true;
    b.stateTime = between(rng, sp.pauseTime);
  }

  const wp = b.waypoints[0];
  const goal = b.meet ? b.meet.partner : wp;
  const avoid = b.meet ? null : avoidance(b, others);
  let desired = Math.atan2(goal.y - b.y, goal.x - b.x);
  if (b.veer > 0) { b.veer -= dt; desired += 1.2; }
  if (avoid) desired = Math.atan2(Math.sin(desired) + avoid.y, Math.cos(desired) + avoid.x);
  const [p1, p2, f1, f2] = b.noise;
  const turnRate = sp.maxTurn;
  const wander = sp.wander;
  // Wandering only happens while moving; a stopped bug holds its heading instead of drifting round.
  const wobble = (Math.sin(b.t * f1 + p1) * 0.6 + Math.sin(b.t * f2 + p2) * 0.4) * wander * (urgent ? 0.2 : 1) * b.moving;
  const diff = wrapAngle(desired - b.heading) + wobble * 0.6;

  // Real insects slow down to make a sharp turn; without this a fast bug's turning circle can be wider
  // than the waypoint and it orbits the spot forever.
  const sharpness = Math.min(1, Math.abs(wrapAngle(desired - b.heading)) / Math.PI);
  let target = b.paused ? 0 : b.cruise * (urgent ? 1.4 : 1) * (1 - 0.65 * sharpness) * paceFactor(b, dt);
  if (avoid) target *= 1 - 0.7 * avoid.blocked;   // give way to a bug right in front
  if (b.meet) {
    const p = b.meet.partner;
    const stop = (b.size + p.size) * 0.55;          // mandibles just touching
    target = b.cruise * 0.3 * Math.max(0, Math.min(1, (Math.hypot(p.x - b.x, p.y - b.y) - stop) / (stop * 0.5)));
  }
  b.speed += (target - b.speed) * Math.min(1, dt * (b.paused || b.meet ? 14 : 5));
  b.moving = Math.min(1, b.speed / Math.max(1, b.cruise));

  const maxTurn = turnRate * dt * (b.meet || b.veer > 0 ? 0.6 : 0.12 + 0.88 * b.moving);   // greeting ants step round to face, and aside after
  const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
  b.heading = wrapAngle(b.heading + turn);

  const dist = b.speed * dt;
  b.x += Math.cos(b.heading) * dist;
  b.y += Math.sin(b.heading) * dist;
  advanceGait(b, dist, turn, dt);

  if (b.trail) {
    const last = b.trail[0];
    if (!last || Math.hypot(last.x - b.x, last.y - b.y) > 1) {
      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > 400) b.trail.length = 400;
    }
  }

  // Arrival zone grows with the turning circle, and a waypoint that stops getting closer is dropped.
  const d = Math.hypot(wp.x - b.x, wp.y - b.y);
  if (b.meet) b.best = Math.min(b.best, d + 1);    // standing still to greet isn't being stuck
  const reach = Math.max(WAYPOINT_RADIUS, (b.speed / Math.max(0.1, turnRate)) * 1.1);
  if (d < b.best - 1) { b.best = d; b.stall = 0; } else if (!b.paused) b.stall += dt;
  if (b.waypoints.length > 1 && (d < reach || b.stall > STALL_SECONDS)) {
    b.waypoints.shift();
    b.best = Infinity;
    b.stall = 0;
  }

  const pad = b.size * 1.2;
  const inside = b.x > -pad * 0.2 && b.y > -pad * 0.2 && b.x < width + pad * 0.2 && b.y < height + pad * 0.2;
  if (inside) b.entered = true;
  const farOut = b.x < -pad * 2 || b.y < -pad * 2 || b.x > width + pad * 2 || b.y > height + pad * 2;
  if ((b.entered && farOut && b.waypoints.length === 1) || (!b.entered && b.age > NEVER_ENTERED_S / Math.min(1, b.speedScale))) b.done = true;
  b.light = localLight(b.heading);
}

const grounded = (b, o) => o !== b && !o.done && o.delay <= 0 && o.entered;

// A steering push away from nearby walkers, weighted by closeness and stronger for whoever is dead ahead,
// plus how blocked the path in front is (0..1). Bugs side-step each other rather than walking through.
export function avoidance(b, others) {
  let x = 0, y = 0, blocked = 0;
  const hx = Math.cos(b.heading), hy = Math.sin(b.heading);
  for (const o of others) {
    if (!grounded(b, o)) continue;
    const dx = o.x - b.x, dy = o.y - b.y;
    const d = Math.hypot(dx, dy) || 0.01;
    const range = (b.size + o.size) * 0.5 * AVOID_RANGE + (b.speed + o.speed) * AVOID_LOOKAHEAD_S;
    if (d > range) continue;
    const ahead = (dx * hx + dy * hy) / d;
    const w = (1 - d / range) * (1 + Math.max(0, ahead));
    // Push away and slightly sideways, so two bugs meeting head on pass on opposite sides.
    const side = (dx * hy - dy * hx) >= 0 ? 1 : -1;
    x -= (dx / d) * w + side * hy * w * 0.8;
    y -= (dy / d) * w - side * hx * w * 0.8;
    if (ahead > 0.6) blocked = Math.max(blocked, 1 - d / range);
  }
  return x || y ? { x: x * 1.6, y: y * 1.6, blocked } : null;
}

function facing(a, b) {
  return Math.cos(Math.atan2(b.y - a.y, b.x - a.x) - a.heading);
}

function tryMeeting(b, others) {
  if (!b.species.greets || b.meetCooldown > 0 || !b.entered) return;
  for (const o of others) {
    if (!grounded(b, o) || o.species !== b.species || o.meet || o.meetCooldown > 0) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    // An ant heading roughly at another senses it from about a body length away; the other turns to face it.
    if (d > (b.size + o.size) * 1.3 || facing(b, o) < 0.3 || facing(o, b) < -0.2) continue;
    const rng = b.rng;
    if (rng() < MEET_CHANCE) {
      const time = between(rng, MEET_TIME);
      b.meet = { partner: o, time };
      o.meet = { partner: b, time };
      b.paused = o.paused = false;
    } else {
      b.meetCooldown = o.meetCooldown = between(rng, MEET_COOLDOWN) * 0.3;
    }
    return;
  }
}

function endMeeting(b) {
  const p = b.meet.partner;
  for (const a of [b, p]) {
    if (a.meet?.partner !== (a === b ? p : b)) continue;
    a.meet = null;
    a.veer = 0.7;   // both steer clockwise for a moment, so they pass on opposite sides
    a.meetCooldown = between(a.rng, MEET_COOLDOWN);
    a.stall = 0;
  }
}

// Picks one species id; each is chosen in proportion to its weight (missing weights count as 1).
export function pickWeighted(species, weights, rng = Math.random) {
  const w = species.map(id => Math.max(0, weights?.[id] ?? 1));
  const total = w.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return species[Math.floor(rng() * species.length)];
  let r = rng() * total;
  for (let i = 0; i < species.length; i++) if ((r -= w[i]) < 0) return species[i];
  return species[species.length - 1];
}

// Bugs from every swarm on the page share one crowd so they avoid each other too.
export class Swarm {
  constructor({ species, count, width, height, speed = 1, weights, rng = Math.random, crowd = new Set() }) {
    this.width = width;
    this.height = height;
    this.crowd = crowd;
    this.bugs = [];
    for (let i = 0; i < count; i++) {
      const id = pickWeighted(species, weights, rng);
      this.bugs.push(createBug(id, { width, height, rng, speed, delay: i === 0 ? 0 : rng() * 2.5 }));
    }
    crowd.add(this);
  }

  // Keep every bug's route proportional to the new window so nobody steers for a spot that moved.
  resize(width, height) {
    const sx = width / (this.width || width), sy = height / (this.height || height);
    for (const b of this.bugs) {
      for (const wp of b.waypoints) { wp.x *= sx; wp.y *= sy; }
      b.best = Infinity;
      b.stall = 0;
    }
    this.width = width;
    this.height = height;
  }

  update(dt) {
    const step = Math.min(dt, 0.05);
    const others = [];
    for (const s of this.crowd) others.push(...s.bugs);
    for (const b of this.bugs) stepBug(b, step, this.width, this.height, others);
    if (this.done) this.crowd.delete(this);
  }

  draw(ctx) {
    for (const b of this.bugs) if (!b.done && b.delay <= 0) b.species.draw(ctx, b);
  }

  get done() {
    return this.bugs.every(b => b.done);
  }
}
