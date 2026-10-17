import { localLight, TAU, TURN_RADIUS, sideDrive } from './common.js';
import { ANTS } from './species/ant.js';
import cockroach from './species/cockroach.js';
import centipede from './species/centipede.js';
import { SPIDERS } from './species/spider.js';
import silverfish from './species/silverfish.js';
import beetle from './species/beetle.js';
import earwig from './species/earwig.js';
import yellowjacket from './species/yellowjacket.js';
import { FLIES } from './species/flies.js';
import { LADYBUGS } from './species/ladybugs.js';
import { CATERPILLARS } from './species/caterpillars.js';
import stinkbug from './species/stinkbug.js';
import bedbug from './species/bedbug.js';
import housecentipede from './species/housecentipede.js';
import { BEES } from './species/honeybee.js';
import { BUMBLES } from './species/bumblebee.js';
import { FIREFLIES, updateFlash } from './species/firefly.js';
import { sampleTrail } from './species/centipede.js';
import { danger, REPELLENT, LOOM } from './ecology.js';
import { lifeScale } from './lifesize.js';

export const SPECIES = Object.fromEntries([...ANTS, cockroach, centipede, ...SPIDERS, silverfish, beetle, earwig, yellowjacket, stinkbug, bedbug, housecentipede, ...BEES, ...BUMBLES, ...FIREFLIES, ...FLIES, ...LADYBUGS, ...CATERPILLARS].map(s => [s.id, s]));

const MAX_LIFETIME_S = 45;
const NEVER_ENTERED_S = 12;
const WAYPOINT_RADIUS = 40;
const STALL_SECONDS = 2.5;
const MIN_TRAIL_RADIUS = 0.25;   // tightest turning circle of a trail-following body, in body lengths
const MIN_WALK_RADIUS = 0.5;     // tightest turning circle of any other bug while it's walking, in body lengths
// A bug whose way is almost completely blocked by another sometimes backs up a little, as real ones do.
const BACK_PACE = 0.3;           // backing speed, as a fraction of cruising speed
const BACK_LENGTH = [0.12, 0.3]; // how far, in body lengths (species may override with backLength)
const BACK_BLOCKED = 0.7;        // only when another body holds up at least this much of its step (0..1)
const UNSTICK_AFTER = 0.5;       // seconds held up before a bug backs off and sidesteps
const BUMP_BACK_RATE = 2.5;      // back-ups per second while that blocked
// Ants lay scent as they walk; now and then another ant picks up the trail and follows it to the same goal.
// Following isn't all or nothing: how keen an ant is varies from ant to ant, waxes and wanes as it goes,
// and fades when it strays from the trail, so followers weave along it and sometimes wander off.
const SCENT_SPACING = 0.25;      // body lengths between scent marks
const SCENT_MARKS = 120;         // marks kept per ant (about 30 body lengths of trail)
const SCENT_FRESH = 60;          // only the newest marks (about 15 body lengths behind the ant) are strong enough to pick up
const SCENT_SENSE = 2;           // an ant keeps to a trail within about this many body lengths
const SCENT_NOTICE = 3.5;        // and notices a fresh one from this far away
const FOLLOW_JOIN_RATE = 0.55;   // per second near a trail, scaled by the ant's affinity (most ants have little)
const FOLLOW_LOSE_RATE = 0.05;   // per second, scaled by how little affinity the ant has
const FOLLOW_CATCH_UP = 1.7;     // a follower far behind on the trail hurries to close the gap, up to this pace
const FOLLOW_LOOKAHEAD = 4;      // marks ahead on the trail a follower steers for
// Predators and prey (see ecology.js). Prey that sense a predator close by bolt away, more urgently the more
// dangerous it is to them, and stay jumpy for a moment after; predators now and then stalk prey for a while.
const FLEE_RANGE = 1.7;          // a prey notices a predator within this many combined half-lengths (at full danger)
const ALARM_DECAY = 0.7;         // per second, once the predator is out of range
const FLEE_SPRINT = 0.7;         // extra pace at full alarm
const SPRINT_FADE = 1.5;         // seconds: a fleeing bug's burst of speed wears off, so a determined predator can gain
const HUNT_RANGE = 2.2;          // a predator spots prey within this many combined half-lengths
const HUNT_RATE = 0.18;          // stalks begun per second with prey in sight, scaled by its danger to that prey
const HUNT_TIME = [3, 6];        // seconds a stalk lasts
const HUNT_GIVE_UP = 6;          // prey further away than this many body lengths (the predator's, capped) is let go
const HUNT_LOSING = 2.5;         // and so is prey that has pulled this many body lengths clear of its closest approach,
                                 // once the prey's opening burst has had time to fade
const HUNT_PACE = 1.15;          // stalking pace, as a multiple of cruising speed
const LUNGE_RANGE = 2;           // body lengths: close enough to strike
const LUNGE_PACE = 1.6;          // the strike is a short, fully committed burst
const LUNGE_TIME = [0.4, 0.7];   // seconds
const HUNT_COOLDOWN = [6, 14];   // seconds before it stalks again
// Honey bees now and then perform a waggle dance: a straight run with the abdomen waggling and wings
// buzzing, then a loop back round to the start, alternating sides, repeated for several circuits.
const DANCE_RATE = 0.006;        // dances begun per second while walking
const DANCE_CIRCUITS = [2, 5];
const WAGGLE_RUN = [0.8, 1.3];   // body lengths
// Two honey bee queens that come close fight: they face off and grapple, jabbing back and forth with their
// abdomens curled to sting, until one breaks away and flees. Then neither will fight again for a while.
const DUEL_RANGE = 2.5;          // combined half-lengths
const DUEL_TIME = [2.5, 4.5];    // seconds
const DUEL_COOLDOWN = [8, 15];   // seconds
// Honey bee queens keep to the edge of the screen they came in by, moving little and resting long; workers of
// her own colony (breed) nearby now and then gather round her, as her retinue does in the hive: each walks up,
// stops with its head to her, and works its antennae over her (grooming and feeding) before wandering off.
const QUEEN_BAND = 0.14;         // how far in from her edge a queen wanders, as a share of the screen's shorter side
const QUEEN_REST = { rate: 1.4, time: [2.5, 6] };
const RETINUE_RANGE = 4;         // workers within this many of her body lengths may join her retinue
const RETINUE_RATE = 0.5;        // per second, for a worker in range
const RETINUE_MAX = 8;
const ATTEND_TIME = [3, 7];      // seconds a worker attends her
const ATTEND_COOLDOWN = [10, 20];
// A safety net for any bug that ends up stuck against another: trying to walk, getting nowhere for a while,
// and touching someone. It gently "buzzes loose": turns away and drifts clear of whoever it's stuck to (winged
// bugs whirr their wings), then carries on. Resting, greeting, tending, fighting and dancing bugs are close on
// purpose and never count as stuck.
const STUCK_AFTER = 1.2;         // seconds of near-standstill while touching another bug
const STUCK_PACE = 0.25;         // "near standstill": under this many body lengths a second
const LOOSEN_TIME = 1;           // seconds spent buzzing loose
const LOOSEN_DRIFT = 0.8;        // body lengths a second it shuffles sideways, away from the other bug
const LOOSEN_COOLDOWN = 0.5;
const REST_TURN_MIN = 1.75;      // a resting bug only turns on the spot to face a goal more than ~100 degrees off
// Personal space: walking bugs steer round anyone within this many combined half-lengths.
const AVOID_RANGE = 1.6;
const AVOID_LOOKAHEAD_S = 0.3;   // fast bugs start giving way earlier
// Ants that meet head on sometimes stop to touch antennae, as real ants do.
const MEET_CHANCE = 0.4;
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
// lifePxPerMm (life-size mode) scales a bug to its real size, with its pace and stride, so it walks just the same.
export function createBug(speciesId, { width, height, rng = Math.random, delay = 0, speed = 1, lifePxPerMm = 0 }) {
  const sp = SPECIES[speciesId];
  if (!sp) throw new Error(`unknown species ${speciesId}`);
  const size0 = between(rng, sp.size), scale = lifePxPerMm ? lifeScale(sp, size0, lifePxPerMm) : 1;
  const size = size0 * scale;
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
    cruise: between(rng, sp.speed) * speedScale * scale,
    scale,
    speedScale,
    // Slow crawlers get proportionally longer before they're hurried off screen.
    maxLife: MAX_LIFETIME_S / Math.min(1, speedScale),
    waypoints,
    paused: false,
    stateTime: 0,
    phase: 0,
    phaseL: gait0,
    phaseR: gait0,
    turnMix: 0,
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
    backing: 0,
    fullyIn: false,       // whole body on screen
    slow: 0,              // seconds it has been trying to walk but getting nowhere
    loosen: null,         // { from, time } while buzzing loose from a bug it got stuck against
    loosenCooldown: 0,
    hemmed: 0,            // share of last step another bug's body was in the way of
    stuck: 0,             // seconds it has been held up
    scent: sp.scent ? [] : null,   // marks laid, oldest first; scentBase counts marks dropped off the front
    scentBase: 0,
    affinity: sp.scent ? rng() ** 1.8 : 0,
    follow: null,         // { leader, idx, strength, time } while following another ant's trail
    alarm: 0,             // 0..1: how frightened of a nearby predator it is
    sprint: 0,            // seconds it has been fleeing flat out (the burst fades)
    fleeDir: 0,           // heading away from the danger
    hunt: null,           // { prey, time } while stalking
    dance: null,          // { stage, angle, circuits, side, len, start, loop } during a waggle dance
    caste: null,          // honey bees: 'drone' or 'queen' (null = worker)
    duel: null,           // { rival, time, lose } while two queens fight
    attend: null,         // { queen, time } while a worker tends her queen
    attendCooldown: 0,
    duelCooldown: 0,
    huntCooldown: 0,
    trail: sp.trail ? [] : null,
    best: Infinity,
    stall: 0,
    light: localLight(0),
    rng
  };
  bug.stridePx = strideLength(bug);   // travel per full leg cycle, used to keep planted feet still
  if (sp.flash) bug.sex = rng() < sp.females ? 'female' : 'male';
  return bug;
}

// Legs step for both forward travel and rotation. When turning, the outer side's feet travel further
// than the inner side's; turning on the spot drives the two sides in opposite directions, so a bug
// pivoting in place visibly walks itself round instead of spinning like it's on a turntable.
// Real animals run faster mostly by lengthening their stride, not by moving their legs faster.
// Above natural pace the stride grows as speed^STRIDE_GROWTH, so leg cadence rises only gently.
const STRIDE_BASE = 1.25;
const STRIDE_GROWTH = 0.65;
const TURN_EASE = 10;              // 1/s: how quickly the turn rate follows steering (~0.1 s)
const RUN_STRIDE_MAX = 2;          // the most a burst of speed lengthens the stride
const RUN_STRIDE_GROWTH = 0.9;     // in a burst nearly all the extra speed comes from longer strides

export function strideLength(b) {
  const caste = b.caste ? b.size / ((b.scale ?? 1) * b.species.size[0]) : 1;   // a drone or queen steps in proportion to her bigger body
  return b.species.stride * STRIDE_BASE * Math.max(1, b.speedScale) ** STRIDE_GROWTH * caste * (b.scale ?? 1);
}
const WRAP = TAU * 1000;

export function advanceGait(b, dist, turn, dt = 0) {
  // Backing up is forward walking played in reverse: the phases run backward, so planted feet stay put and
  // swinging feet step rearward. Reversed, a clockwise turn plays as an anticlockwise one, hence dir on rot.
  const dir = dist < 0 ? -1 : 1, fwd = Math.abs(dist);
  const rot = turn * dir * b.size * TURN_RADIUS;
  // Running (darting, fleeing, lunging) lengthens the stride too, eased so planted feet aren't jerked.
  const run = Math.min(RUN_STRIDE_MAX, Math.max(1, Math.abs(b.speed ?? 0) / Math.max(1, b.cruise ?? 1)) ** RUN_STRIDE_GROWTH);
  b.run = (b.run ?? 1) + (run - (b.run ?? 1)) * Math.min(1, dt * 4);
  b.stridePx = strideLength(b) * b.run;
  const k = TAU / b.stridePx;
  b.phaseL = (b.phaseL + dir * sideDrive(fwd, rot, -1) * k) % WRAP;   // +turn = clockwise on screen: left side is outer
  b.phaseR = (b.phaseR + dir * sideDrive(fwd, rot, 1) * k) % WRAP;
  b.phase = (b.phase + (fwd + Math.abs(rot)) * k) % WRAP;
  // Share of recent motion that was turning (-1..1), which sets the direction each foot strides in.
  // Eased over a fraction of a stride so a planted foot isn't jerked when the bug starts or stops turning.
  const drive = fwd + Math.abs(rot);
  if (drive > 0) b.turnMix += (rot / drive - b.turnMix) * Math.min(1, drive / (strideLength(b) * 0.2));
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

export function stepBug(b, dt, width, height, others = [], pointer = null) {
  if (b.done) return;
  if (b.delay > 0) {
    // Wait to set off until nobody is standing on the spot.
    if ((b.delay -= dt) <= 0 && overlapDepth(b, neighbours(b, others), b.heading) > 0) b.delay = 0.25;
    return;
  }
  if (waitForRoom(b, others)) { b.delay = 0.25; b.speed = 0; return; }
  const sp = b.species;
  const rng = b.rng;
  const x0 = b.x, y0 = b.y;
  b.t += dt;
  b.age += dt;
  if (b.loosen && ((b.loosen.time -= dt) <= 0 || b.loosen.from.done)) { b.loosen = null; b.loosenCooldown = LOOSEN_COOLDOWN; }
  if (b.loosenCooldown > 0) b.loosenCooldown -= dt;
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
      b.cruise = between(rng, sp.speed) * b.speedScale * b.scale * (b.castePace ?? 1);   // a queen stays stately
    }
  } else if (!urgent && b.entered && !(b.backing > 0) && !(b.alarm > 0.05) && !b.hunt && !b.dance && !b.duel && !b.attend &&
    (b.caste !== 'queen' || b.fullyIn) &&   // a queen walks fully onto the screen before she settles
    rng() < (b.caste === 'queen' ? QUEEN_REST.rate : sp.pauseRate) * dt) {
    b.paused = true;
    b.stateTime = between(rng, b.caste === 'queen' ? QUEEN_REST.time : sp.pauseTime);
  }

  sensePredators(b, others, dt, pointer);
  if (b.alarm > 0.15) {                     // startled: no resting, greeting, tending or dawdling along a trail
    b.paused = false;
    if (b.meet) endMeeting(b);
    b.follow = null;
    if (b.attend) endAttending(b);
  }
  if (!urgent) stalk(b, others, dt); else b.hunt = null;
  if (sp.scent) followScent(b, others, dt, urgent);
  if (sp.flash) {
    updateFlash(b, dt, others);
    if (b.court && ((b.court.time -= dt) <= 0 || b.court.female.done || urgent || b.alarm > 0.15)) b.court = null;
  }
  if (sp.castes && !b.caste) attendQueen(b, others, dt, urgent);
  if (sp.dances && !b.caste && !b.attend) waggleDance(b, dt, urgent);
  if (b.caste === 'queen') queenRivalry(b, others, dt, urgent);
  const wp = b.waypoints[0];
  const queenSpot = b.attend ? nearestDisc(b.attend.queen, b) : null;
  const goal = b.meet ? b.meet.partner : queenSpot ?? wp;
  // A resting bug lets others walk round it; a worker standing at her queen just faces her (bodies still can't overlap).
  const avoid = b.meet || b.paused || b.attend?.arrived ? null : avoidance(b, others);
  // Only a bug whose way is nearly blocked backs up; an ant on a trail just slows behind the one ahead.
  // A trail-following body can't reverse along its own path, so centipedes never back up.
  // Held up nose to nose for a moment (not fighting or greeting): back off a little and sidestep to the right;
  // the other bug does the same, so they pass on opposite sides instead of standing locked together.
  b.stuck = b.hemmed > 0.7 && !b.duel && !b.meet && !b.attend ? b.stuck + dt : Math.max(0, b.stuck - dt);
  if (b.stuck > UNSTICK_AFTER) {
    b.stuck = 0;
    b.veer = 0.8;
    if (!sp.trail && !(b.backing > 0)) b.backing = Math.min(1.5, (between(rng, sp.backLength ?? BACK_LENGTH) * b.size) / Math.max(1, b.cruise * BACK_PACE));
  }
  if (b.backing > 0) b.backing -= dt;
  else if (!sp.trail && !b.follow && !b.paused && !b.meet && !urgent && b.entered &&
    b.hemmed > BACK_BLOCKED && rng() < BUMP_BACK_RATE * dt) {
    b.backing = Math.min(1.5, (between(rng, sp.backLength ?? BACK_LENGTH) * b.size) / Math.max(1, b.cruise * BACK_PACE));   // seconds
  }
  const backing = b.backing > 0;
  let desired = Math.atan2(goal.y - b.y, goal.x - b.x);
  if (b.hunt) {
    const p = b.hunt.prey, w = b.hunt.lunge > 0 ? 1 : 0.5 + 0.5 * danger(b, p);
    const ta = Math.atan2(p.y - b.y, p.x - b.x);
    desired = Math.atan2((1 - w) * Math.sin(desired) + w * Math.sin(ta), (1 - w) * Math.cos(desired) + w * Math.cos(ta));
  }
  if (b.follow?.target) {
    const s = 1 - (1 - b.follow.strength) ** 3, t = b.follow.target;   // even a half-hearted follower mostly keeps to it
    const ta = Math.atan2(t.y - b.y, t.x - b.x);
    desired = Math.atan2((1 - s) * Math.sin(desired) + s * Math.sin(ta), (1 - s) * Math.cos(desired) + s * Math.cos(ta));
  }
  if (b.veer > 0) { b.veer -= dt; desired += 1.2; }
  if (avoid) desired = Math.atan2(Math.sin(desired) + avoid.y, Math.cos(desired) + avoid.x);
  if (b.dance) desired = b.dance.heading;
  if (b.court) desired = Math.atan2(b.court.female.y - b.y, b.court.female.x - b.x);   // a male firefly heads for the female who answered
  if (b.loosen) desired = Math.atan2(b.y - b.loosen.from.y, b.x - b.loosen.from.x);   // away from whoever it's stuck to
  if (b.duel) desired = Math.atan2(b.duel.rival.y - b.y, b.duel.rival.x - b.x);
  if (b.alarm > 0) {                        // running from a predator outweighs everything else
    const w = Math.min(1, b.alarm * 1.4);
    desired = Math.atan2((1 - w) * Math.sin(desired) + w * Math.sin(b.fleeDir), (1 - w) * Math.cos(desired) + w * Math.cos(b.fleeDir));
  }
  const [p1, p2, f1, f2] = b.noise;
  const turnRate = sp.maxTurn;
  const wander = sp.wander;
  // Wandering only happens while moving; a stopped bug holds its heading instead of drifting round.
  // An ant on a scent trail wanders less, the more keenly it follows.
  const wobble = (Math.sin(b.t * f1 + p1) * 0.6 + Math.sin(b.t * f2 + p2) * 0.4) * wander * (urgent ? 0.2 : 1) * b.moving *
    (1 - 0.8 * (b.follow?.strength ?? 0));
  const diff = backing ? 0 : wrapAngle(desired - b.heading) + (b.dance ? 0 : wobble * 0.6);   // backs straight, then walks off

  // Real insects slow down to make a sharp turn; without this a fast bug's turning circle can be wider
  // than the waypoint and it orbits the spot forever.
  const sharpness = Math.min(1, Math.abs(wrapAngle(desired - b.heading)) / Math.PI);
  let target = b.paused ? 0 : b.cruise * (urgent ? 1.4 : 1) * (1 - 0.65 * sharpness) * paceFactor(b, dt);
  if (avoid) target *= 1 - 0.7 * avoid.blocked;   // give way to a bug right in front
  if (b.follow?.close) target = Math.min(target, Math.max(0, b.follow.leader.speed) * 1.05);   // don't climb over the leader
  else if (b.follow) {
    const gap = Math.hypot(b.follow.leader.x - b.x, b.follow.leader.y - b.y) / b.size;
    target *= 1 + (FOLLOW_CATCH_UP - 1) * b.follow.strength * Math.min(1, Math.max(0, (gap - 1.5) / 3));
  }
  if (b.dance) target = b.cruise * b.dance.pace;
  if (b.court) target = Math.min(target, b.cruise * Math.max(0, Math.min(1, (Math.hypot(b.court.female.x - b.x, b.court.female.y - b.y) - b.size) / b.size)));
  if (b.duel) {                             // close in, then grapple: lunge and pull back
    const r = b.duel.rival, gap = Math.hypot(r.x - b.x, r.y - b.y) - (b.size + r.size) * 0.45;
    target = gap > b.size * 0.2 ? b.cruise * 0.7 : b.cruise * 0.45 * Math.sin(b.t * 7 + b.noise[1]);
  }
  if (b.alarm > 0 && !b.paused) {
    const fade = Math.max(0.25, Math.exp(-b.sprint / SPRINT_FADE));
    target = Math.max(target, b.cruise * (1 + FLEE_SPRINT * b.alarm * fade));
  }
  if (b.hunt) target = Math.max(target, b.cruise * (b.hunt.lunge > 0 ? LUNGE_PACE : HUNT_PACE));
  if (backing) target = -b.cruise * BACK_PACE;
  if (b.loosen) target = b.cruise * 0.5;
  if (b.meet) {
    const p = b.meet.partner;
    const stop = (b.size + p.size) * 0.55;          // mandibles just touching
    target = b.cruise * 0.3 * Math.max(0, Math.min(1, (Math.hypot(p.x - b.x, p.y - b.y) - stop) / (stop * 0.5)));
  }
  if (queenSpot) {                                  // walk up until her head touches the queen, then stay
    const hx = b.x + Math.cos(b.heading) * b.size * 0.35, hy = b.y + Math.sin(b.heading) * b.size * 0.35;
    const gap = Math.hypot(queenSpot.x - hx, queenSpot.y - hy) - queenSpot.r;
    // Walks up, slowing for the last body length, and stands still once her head is at the queen.
    target = gap < b.size * 0.15 ? 0 : b.cruise * Math.max(0, Math.min(1, gap / b.size));
    b.attend.arrived = gap < b.size * 0.3;
  }
  b.speed += (target - b.speed) * Math.min(1, dt * (b.paused || b.meet || b.attend || backing || b.hunt?.lunge > 0 ? 14 : 5));   // a strike is sudden
  b.moving = Math.min(1, Math.abs(b.speed) / Math.max(1, b.cruise));

  const want = b.speed * dt;
  const hood = neighbours(b, others);
  const dist = clearance(b, hood, want, dt);
  const hemmed = want ? 1 - dist / want : 0;   // how much another bug's body is in the way (0..1)
  b.hemmed = hemmed;
  if (hemmed > 0) { b.speed = dist / dt; b.moving = Math.min(1, Math.abs(b.speed) / Math.max(1, b.cruise)); }
  let maxTurn = turnRate * dt * (b.meet || b.attend || b.veer > 0 ? 0.6 : 0.12 + 0.88 * b.moving);   // greeting ants step round to face, and aside after
  // A long body that follows the head's path can't swivel on the spot: it turns only as it walks.
  if (sp.trail) maxTurn = Math.min(maxTurn, Math.max(Math.abs(dist) / (b.size * MIN_TRAIL_RADIUS), turnRate * dt * 0.3 * hemmed));
  // Any other walking bug also turns along an arc as it goes; only a stopped bug (or an ant turning to
  // greet another) pivots in place. Without this, a bug slowed by a crowd swivels instead of walking round.
  // A bug held up by another's body may turn on the spot to find a way round, as it must to get unstuck.
  else if (!b.paused && !b.meet && !b.attend && !(b.veer > 0)) maxTurn = Math.min(maxTurn, Math.max(Math.abs(dist) / (b.size * MIN_WALK_RADIUS), turnRate * dt * 0.5 * hemmed));
  // Bugs rarely turn on the spot: a resting one only reorients when its goal is well behind it, and
  // leaves any smaller correction to walk off along an arc.
  else if (b.paused && Math.abs(wrapAngle(desired - b.heading)) < REST_TURN_MIN) maxTurn = 0;
  // A startled bug spins round to run, whatever it was doing.
  if (b.alarm > 0.15 && !sp.trail) maxTurn = Math.max(maxTurn, turnRate * dt * b.alarm);
  if (b.dance || b.duel || b.loosen) maxTurn = Math.max(maxTurn, turnRate * dt);   // the dance's tight loops; squaring up to a rival
  // Bodies have some inertia: the turn rate eases toward what steering asks rather than flicking to it, or a
  // crowd's push and pull would twitch a bug left and right from frame to frame. A startled bug spins faster.
  const asked = Math.max(-maxTurn, Math.min(maxTurn, diff));
  b.spin = (b.spin ?? 0) + (asked / Math.max(dt, 1e-6) - (b.spin ?? 0)) * Math.min(1, dt * (b.alarm > 0.15 ? TURN_EASE * 3 : TURN_EASE));
  let turn = Math.max(-maxTurn, Math.min(maxTurn, b.spin * dt));
  if (turn * diff > 0 && Math.abs(turn) > Math.abs(diff)) turn = diff;   // don't swing past the heading it wants
  if (turn && hood.length) {   // don't swing into a neighbour, or any deeper into one already touching
    // A worker tending her queen may turn her head to touch the queen, but no more than touch.
    const q = b.attend?.queen, near = q ? hood.filter(o => o !== q) : hood;
    if (overlapDepth(b, near, b.heading + turn) > overlapDepth(b, near, b.heading) + 1e-9) turn = 0;
    else if (q && hood.includes(q)) {
      const now = overlapDepth(b, [q], b.heading), next = overlapDepth(b, [q], b.heading + turn);
      if (next > Math.max(now, b.size * 0.05)) turn = 0;
    }
  }
  if (Math.abs(turn) < Math.abs(b.spin * dt)) b.spin = turn / Math.max(dt, 1e-6);   // held back: the spin goes too
  b.heading = wrapAngle(b.heading + turn);

  b.x += Math.cos(b.heading) * dist;
  b.y += Math.sin(b.heading) * dist;
  advanceGait(b, dist, turn, dt);
  if (b.loosen) buzzLoose(b, hood, dt);

  if (b.trail) {
    const last = b.trail[0];
    if (!last || Math.hypot(last.x - b.x, last.y - b.y) > 1) {
      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > Math.max(400, b.size * 2)) b.trail.length = Math.max(400, Math.ceil(b.size * 2));   // long enough for the whole body
    }
  }

  if (b.scent) {
    const last = b.scent[b.scent.length - 1];
    if (!last || Math.hypot(last.x - b.x, last.y - b.y) > b.size * SCENT_SPACING) {
      b.scent.push({ x: b.x, y: b.y });
      if (b.scent.length > SCENT_MARKS) { b.scent.shift(); b.scentBase++; }
    }
  }

  // Arrival zone grows with the turning circle, and a waypoint that stops getting closer is dropped.
  const d = Math.hypot(wp.x - b.x, wp.y - b.y);
  if (b.meet || b.dance || b.duel || b.attend) { b.best = Math.min(b.best, d + 1); b.stall = 0; }   // greeting, dancing, fighting or tending isn't being stuck
  const reach = Math.max(WAYPOINT_RADIUS, (b.speed / Math.max(0.1, turnRate)) * 1.1, b.size * MIN_WALK_RADIUS * 1.1);
  if (d < b.best - 1) { b.best = d; b.stall = 0; } else if (!b.paused) b.stall += dt;
  if (b.waypoints.length > 1 && (d < reach || b.stall > STALL_SECONDS)) {
    b.waypoints.shift();
    b.best = Infinity;
    b.stall = 0;
  }

  const pad = b.size * 1.2;
  const inside = b.x > -pad * 0.2 && b.y > -pad * 0.2 && b.x < width + pad * 0.2 && b.y < height + pad * 0.2;
  if (inside) b.entered = true;
  b.fullyIn = wholeBodyOnScreen(b, width, height);
  const farOut = b.x < -pad * 2 || b.y < -pad * 2 || b.x > width + pad * 2 || b.y > height + pad * 2;
  // A big, slow crawler starts further off screen and needs longer to walk on: give it time for the distance.
  const enterBy = Math.max(NEVER_ENTERED_S, (4 * b.size) / Math.max(1, b.cruise));
  if ((b.entered && farOut && b.waypoints.length === 1) || (!b.entered && b.age > enterBy / Math.min(1, b.speedScale))) b.done = true;
  checkStuck(b, hood, Math.hypot(b.x - x0, b.y - y0), dt);
  b.light = localLight(b.heading);
}

const grounded = (b, o) => o !== b && !o.done && o.delay <= 0 && o.entered;

// A bug's body as a chain of discs, for keeping bodies apart. Most bodies are long and narrow, so three
// discs down the midline; a centipede's position is its head and its body trails behind along its path.
export function bodyDiscs(b, heading = b.heading, x = b.x, y = b.y) {
  if (b.trail) {
    return sampleTrail(b.trail, x, y, heading, b.size / 5, 6).map(p => ({ x: p.x, y: p.y, r: b.size * (b.species.trailDiscR ?? 0.08) }));
  }
  const hx = Math.cos(heading), hy = Math.sin(heading), r = b.size * (b.species.discR ?? 0.14);
  const along = b.caste === 'queen' ? [-0.52, -0.3, -0.05, 0.22] : [-0.3, -0.05, 0.22];   // a queen's long abdomen
  return along.map(o => ({ x: x + hx * o * b.size, y: y + hy * o * b.size, r }));
}

// How far apart (px, centre to centre) two bugs that both keep a personal space like to stay: spiders give each
// other room so their legs no more than touch. 0 when either doesn't care. On screen it is kept by steering
// (avoidance) and by not stepping closer (keepRoom), never as a solid wall, so nobody is trapped; a spider
// still off screen instead waits to come on until it has room (see waitForRoom).
// A bug with long legs keeps room around them from anyone (others count their body's half-width); a hunter may
// still close in on its prey.
const BODY_ROOM = 0.25;
export function roomBetween(b, o) {
  const rb = b.species.keepApart, ro = o.species.keepApart;
  if (!rb && !ro) return 0;
  if (b.hunt?.prey === o || o.hunt?.prey === b) return 0;
  return (rb ?? BODY_ROOM) * b.size + (ro ?? BODY_ROOM) * o.size;
}
export const keepApart = (b, o) => (b.entered && o.entered ? roomBetween(b, o) : 0);

// A spider that hasn't come on screen yet holds back while one already on screen is within its room, so
// spiders don't arrive tangled together (and, held back, it doesn't give up on ever entering).
function waitForRoom(b, others) {
  if (b.entered || !b.species.keepApart) return false;
  return others.some(o => o !== b && !o.done && o.entered && Math.hypot(o.x - b.x, o.y - b.y) < roomBetween(b, o) * KEEP_FLOOR);
}

// Bugs keep their bodies apart off screen too, so two arriving from the same spot don't enter tangled.
export const neighbours = (b, others) => others.filter(o => o !== b && !o.done && o.delay <= 0 &&
  Math.hypot(o.x - b.x, o.y - b.y) < Math.max((b.size + o.size) * 1.2, keepApart(b, o) * 1.5));

// How deeply a bug's body would cut into its neighbours' in a given pose (0 = clear). Each neighbour is
// padded by how far it may move this frame, so two bugs can't both step into the same gap at once.
export function overlapDepth(b, hood, heading, x = b.x, y = b.y, dt = 0) {
  let depth = 0;
  const mine = bodyDiscs(b, heading, x, y);
  for (const o of hood) {
    const pad = Math.abs(o.speed) * dt;
    for (const t of bodyDiscs(o)) for (const m of mine) depth += Math.max(0, m.r + t.r + pad - Math.hypot(t.x - m.x, t.y - m.y));
  }
  return depth;
}

// Personal space is mostly kept by steering, which lets spiders squeeze past each other when they must. Only
// well inside it (KEEP_FLOOR of the room, where legs would be deeply interleaved) may a step not bring the two
// any closer; it may always take them apart, and turning is never held back, so nobody is trapped.
export const KEEP_FLOOR = 0.7;
export function keepRoom(b, hood, dist) {
  if (b.alarm > 0.15) return dist;   // a frightened spider bolts, manners or not (bodies still can't overlap)
  const hx = Math.cos(b.heading), hy = Math.sin(b.heading);
  const ok = step => hood.every(o => {
    const floor = keepApart(b, o) * KEEP_FLOOR;
    if (!floor) return true;
    const now = Math.hypot(o.x - b.x, o.y - b.y), next = Math.hypot(o.x - b.x - hx * step, o.y - b.y - hy * step);
    return next >= Math.min(now, floor) - 1e-9;
  });
  for (const f of [1, 0.6, 0.3, 0.1]) if (ok(dist * f)) return dist * f;
  return 0;
}

// How far a bug may move along its heading this frame (negative when backing). Bugs never walk over each
// other: a step is cut short if it would push further into a neighbour's body, while a bug that has somehow
// ended up overlapping may always move or turn to ease out of it, so nobody gets locked together.
export function clearance(b, hood, dist, dt = 0) {
  if (!dist || !hood.length) return dist;
  dist = keepRoom(b, hood, dist);
  if (!dist) return 0;
  const now = overlapDepth(b, hood, b.heading, b.x, b.y, dt);
  const hx = Math.cos(b.heading), hy = Math.sin(b.heading);
  // Actually tangled (bodies touching, not just a fast neighbour's padding): a step away from everyone it
  // touches is fine as long as it doesn't cut any deeper.
  const touching = overlapDepth(b, hood, b.heading);
  if (touching > 0 && hood.every(o => overlapDepth(b, [o], b.heading) === 0 || (o.x - b.x) * hx * dist + (o.y - b.y) * hy * dist <= 0) &&
    overlapDepth(b, hood, b.heading, b.x + hx * dist, b.y + hy * dist) <= touching * 1.05) return dist;
  for (const f of [1, 0.6, 0.3, 0.1]) {
    const x = dist * f;
    if (overlapDepth(b, hood, b.heading, b.x + hx * x, b.y + hy * x, dt) <= now + 1e-9) return x;
  }
  return 0;
}

// A steering push away from nearby walkers, weighted by closeness and stronger for whoever is dead ahead,
// plus how blocked the path in front is (0..1). Bugs side-step each other rather than walking through.
export function avoidance(b, others) {
  let x = 0, y = 0, blocked = 0;
  const hx = Math.cos(b.heading), hy = Math.sin(b.heading);
  for (const o of others) {
    // Everyone on the move counts, on screen or not, so two bugs arriving side by side don't walk into each other.
    if (o === b || o.done || o.delay > 0) continue;
    if (o === b.follow?.leader || o === b.hunt?.prey || o === b.duel?.rival || o === b.attend?.queen) continue;   // not an obstacle: it's after them
    const dx = o.x - b.x, dy = o.y - b.y;
    const d = Math.hypot(dx, dy) || 0.01;
    const range = Math.max((b.size + o.size) * 0.5 * AVOID_RANGE, keepApart(b, o) * 1.2) * (1 + (REPELLENT[o.species.id] ?? 0)) +
      (Math.abs(b.speed) + Math.abs(o.speed)) * AVOID_LOOKAHEAD_S;
    if (d > range) continue;
    const ahead = (dx * hx + dy * hy) / d;
    // Only what's in front matters much: a bug beside it counts a little and one behind not at all. (Steering
    // away from bugs alongside or behind let two bugs keep pushing each other round in circles.)
    // Inside another's personal space, though, it backs off whichever way the other is.
    const room = keepApart(b, o), crowd = room && d < room ? 1 - d / room : 0;
    const w = Math.max((1 - d / range) * Math.max(0, 0.3 + ahead), crowd);
    if (!w) continue;
    // Push away, and for a bug ahead also slightly sideways, so two meeting head on pass on opposite sides.
    const side = (dx * hy - dy * hx) >= 0 ? 1 : -1, slip = ahead > 0 ? 0.8 : 0;
    x -= (dx / d) * w + side * hy * w * slip;
    y -= (dy / d) * w - side * hx * w * slip;
    if (ahead > 0.6) blocked = Math.max(blocked, 1 - d / range);
    if (ahead > 0.2 && crowd) blocked = Math.max(blocked, Math.min(1, crowd * 2));
  }
  return x || y ? { x: x * 1.6, y: y * 1.6, blocked } : null;
}

function facing(a, b) {
  return Math.cos(Math.atan2(b.y - a.y, b.x - a.x) - a.heading);
}

function tryMeeting(b, others) {
  if (!b.species.greets || b.meetCooldown > 0 || !b.entered) return;
  for (const o of others) {
    if (!grounded(b, o) || o.species.id !== b.species.id || o.meet || o.meetCooldown > 0) continue;   // only its own kind
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

// Makes a honey bee a drone or a queen now and then (otherwise it stays a worker). A queen is only made if
// no queen of the same breed is already about.
export function assignCaste(b, rng, others, width = 0, height = 0) {
  const c = b.species.castes;
  if (!c) return;
  const r = rng();
  let caste = null;
  if (r < c.queen.chance) caste = others.some(o => !o.done && o.species.id === b.species.id && o.caste === 'queen') ? null : 'queen';
  else if (r < c.queen.chance + c.drone.chance) caste = 'drone';
  if (caste) setCaste(b, caste, rng, width, height);
}

function setCaste(b, caste, rng, width, height) {
  const c = b.species.castes;
  b.caste = caste;
  b.size = between(rng, c[caste].size) * (b.scale ?? 1);
  b.castePace = c[caste].pace;
  b.cruise *= b.castePace;
  b.stridePx = strideLength(b);
  if (caste === 'queen' && width && height) queenRoute(b, rng, width, height);
}

// A queen's route: a few spots in a band along the edge she comes in by, then out again by that same edge.
export function queenRoute(b, rng, width, height) {
  const edge = b.y < 0 ? 0 : b.x > width ? 1 : b.y > height ? 2 : 3;
  const along = edge % 2 ? b.y / height : b.x / width;
  const band = Math.min(width, height) * QUEEN_BAND;
  const spot = (u, depth) => {
    u = Math.min(0.92, Math.max(0.08, u));
    return [{ x: u * width, y: depth }, { x: width - depth, y: u * height }, { x: u * width, y: height - depth }, { x: depth, y: u * height }][edge];
  };
  let u = along;
  b.waypoints = [];
  for (let i = 0; i < 3; i++) {
    u += (rng() - 0.5) * 0.25;
    const inset = b.size * 1.1;   // far enough in that her whole body, long abdomen and all, is on screen
    b.waypoints.push(spot(u, inset + rng() * Math.max(0, band - inset)));
  }
  b.waypoints.push(edgePoint(edge, width, height, Math.min(0.92, Math.max(0.08, u + (rng() - 0.5) * 0.2)), b.size * 3.2));
  b.heading = Math.atan2(b.waypoints[0].y - b.y, b.waypoints[0].x - b.x);
}

// The point on a bug's body (one of its body discs) closest to another bug: where a retinue worker aims.
function nearestDisc(q, from) {
  let best = null, bd = Infinity;
  for (const d of bodyDiscs(q)) {
    const dist = Math.hypot(d.x - from.x, d.y - from.y);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
}

// The narrowest gap between two bugs' bodies (negative when they overlap).
function bodyGap(a, b) {
  let gap = Infinity;
  for (const m of bodyDiscs(a)) for (const t of bodyDiscs(b)) gap = Math.min(gap, Math.hypot(t.x - m.x, t.y - m.y) - m.r - t.r);
  return gap;
}

// Notices a bug that has been trying to walk but getting nowhere while touching another, and sets it buzzing loose.
export function checkStuck(b, hood, moved, dt) {
  const meaning = b.entered && !b.paused && !b.meet && !b.attend && !b.duel && !b.dance && !b.loosen && !(b.hunt?.lunge > 0);
  b.slow = meaning && moved < b.size * STUCK_PACE * dt ? (b.slow ?? 0) + dt : 0;
  if (b.slow < STUCK_AFTER || b.loosenCooldown > 0) return;
  const touching = hood.filter(o => bodyGap(b, o) < b.size * 0.06).sort((p, q) => bodyGap(b, p) - bodyGap(b, q))[0];
  if (touching) b.loosen = { from: touching, time: LOOSEN_TIME };
  b.slow = 0;
}

// The gentle drift of a bug buzzing loose: a sideways shuffle to whichever side is away from the bug it was stuck
// to, as long as that doesn't push it into anyone else. Wedged in with that side blocked too, it tries the other
// side, then backing out, then edging forward, so a bug caught between two others still works its way free.
function buzzLoose(b, hood, dt) {
  if (b.trail) return;   // a centipede's body follows its head's path: it just turns away and walks off
  const o = b.loosen.from;
  const px = -Math.sin(b.heading), py = Math.cos(b.heading);                 // its right-hand side
  const fx = Math.cos(b.heading), fy = Math.sin(b.heading);
  const side = (b.x - o.x) * px + (b.y - o.y) * py < 0 ? -1 : 1;            // away from the other bug (right if head on)
  const step = b.size * LOOSEN_DRIFT * dt;
  const now = overlapDepth(b, hood, b.heading);
  for (const [ux, uy] of [[px * side, py * side], [-px * side, -py * side], [-fx, -fy], [fx, fy]]) {
    if (overlapDepth(b, hood, b.heading, b.x + ux * step, b.y + uy * step) <= now + 1e-9) {
      b.x += ux * step;
      b.y += uy * step;
      return;
    }
  }
}

// True when every part of a bug's body is within the screen.
export function wholeBodyOnScreen(b, width, height) {
  return bodyDiscs(b).every(d => d.x - d.r >= 0 && d.y - d.r >= 0 && d.x + d.r <= width && d.y + d.r <= height);
}

// A worker near her colony's queen now and then joins her retinue for a few seconds.
export function attendQueen(b, others, dt, urgent) {
  if (b.attendCooldown > 0) b.attendCooldown -= dt;
  const a = b.attend;
  if (a) {
    // Her time with the queen counts from reaching her; a worker that can't get to her soon gives up.
    if (a.arrived) a.time -= dt;
    else a.approach = (a.approach ?? 0) + dt;
    if (a.time <= 0 || a.approach > 6 || a.queen.done || !a.queen.fullyIn || urgent) endAttending(b);   // she's leaving: let her go
    return;
  }
  if (b.attendCooldown > 0 || !b.entered || urgent || b.dance || b.alarm > 0.05) return;
  for (const q of others) {
    if (q.caste !== 'queen' || q.species.id !== b.species.id || q.done || !q.fullyIn || q.duel) continue;   // only once she's fully on screen
    if (Math.hypot(q.x - b.x, q.y - b.y) > q.size * RETINUE_RANGE) continue;
    if (others.filter(o => o.attend?.queen === q).length >= RETINUE_MAX) continue;
    if (b.rng() < RETINUE_RATE * dt) {
      b.attend = { queen: q, time: between(b.rng, ATTEND_TIME) };
      b.paused = false;
    }
    return;
  }
}

function endAttending(b) {
  b.attend = null;
  b.attendCooldown = between(b.rng, ATTEND_COOLDOWN);
  b.veer = 0.4;   // turns away and carries on
}

// Starts, runs and ends a fight between two queens.
export function queenRivalry(b, others, dt, urgent) {
  if (b.duelCooldown > 0) b.duelCooldown -= dt;
  const duel = b.duel;
  if (duel) {
    duel.time -= dt;
    if (duel.time <= 0 || duel.rival.done || urgent) endDuel(b);
    return;
  }
  if (b.duelCooldown > 0 || !b.entered || urgent) return;
  for (const o of others) {
    if (o === b || o.caste !== 'queen' || o.done || !o.entered || o.duel || o.duelCooldown > 0) continue;
    if (Math.hypot(o.x - b.x, o.y - b.y) > (b.size + o.size) * 0.5 * DUEL_RANGE) continue;
    const time = between(b.rng, DUEL_TIME), bLoses = b.rng() < 0.5;
    b.duel = { rival: o, time, lose: bLoses };
    o.duel = { rival: b, time, lose: !bLoses };
    for (const q of [b, o]) { q.paused = false; q.dance = null; q.follow = null; q.hunt = null; }
    return;
  }
}

function endDuel(b) {
  const r = b.duel.rival;
  for (const [q, other] of [[b, r], [r, b]]) {
    if (q.duel?.rival !== other) continue;
    const lost = q.duel.lose;
    q.duel = null;
    q.duelCooldown = between(q.rng, DUEL_COOLDOWN);
    if (lost) {                                   // breaks away and bolts
      q.alarm = 1;
      q.sprint = 0;
      q.fleeDir = Math.atan2(q.y - other.y, q.x - other.x);
    } else q.veer = 0.5;
  }
}

// Runs a honey bee's waggle dance. While dancing, b.dance.heading is the way to steer and b.dance.pace the
// share of cruising speed. Stages: 'turn' to face the dance bearing, 'run' (the waggle run), 'loop' back
// round to the start on alternate sides.
export function waggleDance(b, dt, urgent) {
  const rng = b.rng;
  let d = b.dance;
  if (!d) {
    if (!b.entered || urgent || b.paused || b.meet || b.hunt || b.alarm > 0.05 || !(rng() < DANCE_RATE * dt)) return;
    d = b.dance = {
      stage: 'turn', angle: rng() * TAU, circuits: Math.round(between(rng, DANCE_CIRCUITS)), side: rng() < 0.5 ? -1 : 1,
      len: between(rng, WAGGLE_RUN) * b.size, start: { x: b.x, y: b.y }, loop: [], heading: b.heading, pace: 0.2
    };
  }
  if (urgent || b.alarm > 0.15) { b.dance = null; return; }
  const dx = Math.cos(d.angle), dy = Math.sin(d.angle);
  if (d.stage === 'turn') {
    d.heading = d.angle;
    d.pace = 0.35;
    if (Math.abs(wrapAngle(b.heading - d.angle)) < 0.25) { d.stage = 'run'; d.start = { x: b.x, y: b.y }; }
  } else if (d.stage === 'run') {
    d.heading = d.angle;
    d.pace = 0.5;
    if (Math.hypot(b.x - d.start.x, b.y - d.start.y) >= d.len) {
      const px = -dy * d.side, py = dx * d.side;   // out to one side, then back to just behind the start
      d.loop = [
        { x: d.start.x + dx * d.len * 0.6 + px * d.len * 0.6, y: d.start.y + dy * d.len * 0.6 + py * d.len * 0.6 },
        { x: d.start.x + px * d.len * 0.6, y: d.start.y + py * d.len * 0.6 },
        { x: d.start.x - dx * d.len * 0.2, y: d.start.y - dy * d.len * 0.2 }
      ];
      d.stage = 'loop';
    }
  } else {
    d.pace = 0.9;
    while (d.loop.length && Math.hypot(d.loop[0].x - b.x, d.loop[0].y - b.y) < b.size * 0.3) d.loop.shift();
    if (d.loop.length) d.heading = Math.atan2(d.loop[0].y - b.y, d.loop[0].x - b.x);
    else if (--d.circuits <= 0) b.dance = null;
    else { d.side = -d.side; d.stage = 'turn'; }
  }
}

// Raises b's alarm when a predator is near and points b.fleeDir away from the danger.
// The mouse pointer, when the "scatter" option is on and it has moved lately, is a looming threat to every bug.
const POINTER_RANGE = 70;        // px, plus a little more for bigger bugs
const POINTER_FEAR = 0.9;

export function sensePredators(b, others, dt, pointer = null) {
  let x = 0, y = 0, level = 0;
  if (b.entered && pointer) {
    const dx = b.x - pointer.x, dy = b.y - pointer.y, d = Math.hypot(dx, dy) || 0.01;
    const range = (POINTER_RANGE + b.size * 1.2) * (b.species.nerves ?? 1);
    if (d < range) {
      const fear = POINTER_FEAR * (1 - d / range) ** 0.5;
      x += (dx / d) * fear;
      y += (dy / d) * fear;
      level = fear;
    }
  }
  if (b.entered) {
    for (const o of others) {
      const w = grounded(b, o) ? danger(o, b) : 0;
      if (!w) continue;
      const dx = b.x - o.x, dy = b.y - o.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const range = ((b.size + o.size * (LOOM[o.species.id] ?? 1)) * 0.5 * FLEE_RANGE * (0.6 + 0.4 * w) + Math.max(0, o.speed) * 0.3) *
        (b.species.nerves ?? 1);   // nervous breeds take fright sooner
      if (d > range) continue;
      const fear = w * (1 - d / range) ** 0.5;
      x += (dx / d) * fear;
      y += (dy / d) * fear;
      level = Math.max(level, fear);
    }
  }
  if (level > 0) b.fleeDir = Math.atan2(y, x);
  b.alarm = Math.max(level, b.alarm - ALARM_DECAY * dt);
  b.sprint = b.alarm > 0.15 ? b.sprint + dt : Math.max(0, b.sprint - dt * 0.5);   // gets its breath back slowly
}

// A predator now and then stalks a prey it can see for a few seconds, then loses interest for a while.
export function stalk(b, others, dt) {
  if (b.huntCooldown > 0) b.huntCooldown -= dt;
  const h = b.hunt;
  if (h) {
    h.time -= dt;
    const d = Math.hypot(h.prey.x - b.x, h.prey.y - b.y);
    if (h.lunge > 0) h.lunge -= dt;
    else if (!h.lunged && d < b.size * LUNGE_RANGE) { h.lunge = between(b.rng, LUNGE_TIME); h.lunged = true; }   // one strike per stalk
    h.best = Math.min(h.best ?? d, d);
    h.age = (h.age ?? 0) + dt;
    const len = Math.min(b.size, 45);
    const losing = h.age > SPRINT_FADE && d > h.best + len * HUNT_LOSING;
    if (h.time <= 0 || h.prey.done || d > len * HUNT_GIVE_UP || losing || b.alarm > 0.15) {
      b.hunt = null;
      b.huntCooldown = between(b.rng, HUNT_COOLDOWN);
    }
    return;
  }
  if (b.huntCooldown > 0 || !b.entered || b.meet || b.paused) return;
  for (const o of others) {
    const w = grounded(b, o) ? danger(b, o) : 0;
    // It sees as far as it is seen (long legs reach), and prey that bolts catches its eye.
    const range = (b.size * (LOOM[b.species.id] ?? 1) + o.size) * 0.5 * HUNT_RANGE;
    if (!w || Math.hypot(o.x - b.x, o.y - b.y) > range || facing(b, o) < 0) continue;
    if (b.rng() < HUNT_RATE * w * (o.alarm > 0.15 ? 2.5 : 1) * dt) b.hunt = { prey: o, time: between(b.rng, HUNT_TIME), lunge: 0, lunged: false };
    return;
  }
}

// True if following o would close a loop: o is already (directly or down a column) following b.
function leadsBackTo(o, b) {
  for (let a = o, n = 0; a && n < 50; a = a.follow?.leader, n++) if (a === b) return true;
  return false;
}

// Picks up, follows or loses another ant's scent trail. While following, b.follow.target is the trail point
// to steer for and b.follow.strength (0..1) how strongly to steer for it rather than for the ant's own goal.
export function followScent(b, others, dt, urgent) {
  const f = b.follow;
  if (f) {
    const L = f.leader, marks = L.scent;
    f.time += dt;
    let best = Infinity, bestAbs = f.idx;
    const from = Math.max(f.idx, L.scentBase);
    for (let a = from; a < Math.min(from + 12, L.scentBase + marks.length); a++) {
      const m = marks[a - L.scentBase];
      const d = Math.hypot(m.x - b.x, m.y - b.y);
      if (d < best) { best = d; bestAbs = a; }
    }
    f.idx = bestAbs;
    const last = L.scentBase + marks.length - 1;
    const ti = Math.min(last, f.idx + FOLLOW_LOOKAHEAD);
    f.target = ti >= f.idx && marks.length ? marks[ti - L.scentBase] : null;
    f.close = ti === last && Math.hypot(L.x - b.x, L.y - b.y) < (b.size + L.size) * 0.9;
    // A newly joined ant gets a couple of seconds to walk over to the trail before it must keep close to it.
    const reach = SCENT_SENSE + (SCENT_NOTICE - SCENT_SENSE) * Math.max(0, 1 - f.time / 2);
    const onTrail = Math.exp(-((best / (b.size * reach)) ** 2));
    const keen = (0.75 + 0.25 * b.affinity) * (0.8 + 0.2 * Math.sin(b.t * 0.9 + b.noise[0]));
    f.strength += (keen * onTrail - f.strength) * Math.min(1, dt * 2);
    if (L.done || urgent || !f.target || (f.time > 2 && f.strength < 0.08) || b.rng() < FOLLOW_LOSE_RATE * (1 - b.affinity) * dt) b.follow = null;
    return;
  }
  if (urgent || !b.entered || b.meet || !(b.affinity > 0)) return;
  for (const o of others) {
    if (o === b || o.done || !o.entered || !o.scent || o.species.id !== b.species.id || o.scent.length < FOLLOW_LOOKAHEAD + 2 || leadsBackTo(o, b)) continue;   // its own kind's trail
    if (Math.hypot(o.x - b.x, o.y - b.y) > b.size * SCENT_MARKS * SCENT_SPACING) continue;
    for (let i = Math.max(0, o.scent.length - SCENT_FRESH); i < o.scent.length - 1; i++) {
      const m = o.scent[i];
      if (Math.hypot(m.x - b.x, m.y - b.y) > b.size * SCENT_NOTICE) continue;
      const n = o.scent[i + 1];
      if (Math.cos(Math.atan2(n.y - m.y, n.x - m.x) - b.heading) < -0.3) break;   // won't double back onto it
      if (b.rng() < FOLLOW_JOIN_RATE * b.affinity * dt) {
        b.follow = { leader: o, idx: o.scentBase + i, strength: 0, time: 0, target: null, close: false };
        b.waypoints = o.waypoints.map(w => ({ ...w }));   // heading for the same place
        b.cruise = Math.max(b.cruise, o.cruise);           // and keeping up with the ant ahead
        b.best = Infinity;
        b.stall = 0;
      }
      return;
    }
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
// A species' abundance scales its slider weight, so naturally scarcer bugs stay scarcer at every setting.
export function pickWeighted(species, weights, rng = Math.random) {
  const w = species.map(id => Math.max(0, weights?.[id] ?? 1) * (SPECIES[id]?.abundance ?? 1));
  const total = w.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return species[Math.floor(rng() * species.length)];
  let r = rng() * total;
  for (let i = 0; i < species.length; i++) if ((r -= w[i]) < 0) return species[i];
  return species[species.length - 1];
}

// Whenever honey bees are enabled and no queen is about, a new swarm brings one: a worker of an enabled breed
// in it is made queen, or if it has none, its last bug is swapped for a queen of an enabled breed (picked by the
// same weights).
export function ensureQueen(swarm, species, weights, rng, crowd, speed = 1) {
  const bees = species.filter(id => SPECIES[id]?.castes);
  if (!bees.length || !swarm.bugs.length) return;
  const about = [...swarm.bugs, ...[...crowd].flatMap(s => s.bugs)];
  if (about.some(b => !b.done && b.caste === 'queen')) return;
  let q = swarm.bugs.find(b => b.species.castes && !b.caste);
  if (!q) {
    const last = swarm.bugs.length - 1;
    const id = pickWeighted(bees, weights, rng);
    q = createBug(id, { width: swarm.width, height: swarm.height, rng, speed, delay: swarm.bugs[last].delay, lifePxPerMm: swarm.lifePxPerMm });
    swarm.bugs[last] = q;
  }
  setCaste(q, 'queen', rng, swarm.width, swarm.height);
}

// Bugs from every swarm on the page share one crowd so they avoid each other too.
// Legs that brush another's flinch: the touched leg is drawn back a little and lifted (see walkLeg3D's recoil),
// easing in over a few frames and fading in about a third of a second once free. A leg left touching (or that
// brushes the same legs again as it steps) stays mildly drawn back rather than flinching over and over; it only
// flinches afresh at a touch after a second or so clear. Uses the leg
// poses each bug last drew (bug.legPoses, in its own frame); bug.recoil[i] is the flinch of leg i (0..1).
const RECOIL_FADE = 0.35;   // s
const RECOIL_EASE = 15;     // 1/s
const RECOIL_HOLD = 0.5;    // how far a leg left touching stays drawn back
const RETOUCH = 1;          // s: touching again sooner than this after contact is the same encounter, not a new flinch
// Now and then a touch startles one of the pair into a short dash away. Who takes fright follows soft rules (see
// touchFear): prey from its predator, then the smaller from the bigger (the more so the bigger the gap), and between
// near equals the one that was walked into (the slower). Touches also wear on a bug's patience: each new one, and
// every moment legs stay tangled, adds irritation (fading at IRK_FADE); when it boils over the same candidate gives
// way with a dash, so a knot of bugs breaks up instead of standing there twitching. Social insects among their own
// colony kind (ants with ants, honey bees with honey bees, bumble bees with bumble bees) jostle all the time: they
// still flinch, but rarely take fright or lose patience.
const STARTLE_CHANCE = 0.06;  // per fresh touch
const STARTLE_ALARM = 0.55;   // alarm it starts with (fades at ALARM_DECAY, so about two thirds of a second of flight)
const GIVE_WAY_ALARM = 0.9;   // giving way after a tangle is a proper retreat: over a second, to get its legs clear
const IRK_TOUCH = 1, IRK_TANGLED = 2, IRK_FADE = 0.5, IRK_LIMIT = 3;   // per touch, per s tangled, per s, threshold
const COLONY_CALM = 0.2;      // how much of the usual startle chance and irritation a social insect has among its own
const COLONY = new Map([...ANTS.map(s => [s.id, 'ants']), ...BEES.map(s => [s.id, 'honeybees']), ...BUMBLES.map(s => [s.id, 'bumblebees'])]);
export const sameColony = (b, o) => COLONY.has(b.species.id) && COLONY.get(b.species.id) === COLONY.get(o.species.id);

// How much a touch from o frightens b: being hunted by it counts most, then how much bigger it is (log2 of the
// size ratio, so twice the size is +1).
export function touchFear(b, o) {
  return 2 * (danger(o, b) - danger(b, o)) + Math.log2(o.size / b.size);
}

export function startleCandidate(b, o) {
  const lean = touchFear(b, o) - touchFear(o, b);
  if (Math.abs(lean) > 0.15) return lean > 0 ? b : o;
  return Math.abs(b.speed) <= Math.abs(o.speed) ? b : o;
}

// Chance that a fresh touch from o startles b (when b is the likelier to take fright).
export function startleChance(b, o) {
  const lean = Math.max(0, touchFear(b, o) - touchFear(o, b));
  return STARTLE_CHANCE * Math.min(4, 1 + lean) * (sameColony(b, o) ? COLONY_CALM : 1);
}

function startle(b, from, alarm = STARTLE_ALARM) {
  if (b.alarm >= 0.15) return;
  b.alarm = alarm;
  b.fleeDir = Math.atan2(b.y - from.y, b.x - from.x);
  b.sprint = 0;
}

// A touch is a leg meeting another's leg or pressing on its body. The leg flinches either way; a bug whose body
// is touched counts it too (for its patience and the chance of a fright) though it has no leg to draw back. A bug
// drawn without leg poses (the scolopendrid) still has a body to be touched.
export function touchLegs(bugs, others, dt) {
  const world = b => {
    if (b.done || b.delay > 0) return null;
    const k = b.size / 100, c = Math.cos(b.heading), s = Math.sin(b.heading);
    const at = p => ({ x: b.x + (p.x * c - p.y * s) * k, y: b.y + (p.x * s + p.y * c) * k });
    const legs = (b.legPoses ?? []).map(p => [at(p.hip), at(p.knee), at(p.ankle), at(p.foot)]);
    const body = bodyDiscs(b);
    const reach = Math.max(b.size * 0.5, ...legs.flat().map(p => Math.hypot(p.x - b.x, p.y - b.y)));
    return { legs, body, reach };
  };
  const cache = new Map(), get = b => (cache.has(b) ? cache.get(b) : cache.set(b, world(b)).get(b));
  for (const b of bugs) {
    const me = get(b);
    if (!me) continue;
    const hits = (b.recoilHit ??= []), flinch = (b.recoil ??= []), free = (b.legFree ??= []);   // free: s since leg i last touched
    const by = me.legs.map(() => null);
    let bodyBy = null;
    for (const o of others) {
      if (o === b) continue;
      const them = get(o);
      if (!them || Math.hypot(o.x - b.x, o.y - b.y) > me.reach + them.reach) continue;
      const touch = (b.size + o.size) * 0.012;
      me.legs.forEach((leg, i) => {
        if (!by[i] && (them.legs.some(other => legsCross(leg, other, touch)) || legOnBody(leg, them.body, touch))) by[i] = o;
      });
      if (!bodyBy && them.legs.some(leg => legOnBody(leg, me.body, touch))) bodyBy = o;
    }
    b.irk = Math.max(0, (b.irk ?? 0) - IRK_FADE * dt);
    let fresh = null, tangled = null;
    me.legs.forEach((leg, i) => {
      hits[i] = Math.max(0, (hits[i] ?? 0) - dt / RECOIL_FADE);
      if (by[i] && (free[i] ?? Infinity) > RETOUCH) { hits[i] = 1; fresh ??= by[i]; }
      else if (by[i]) { hits[i] = Math.max(hits[i], RECOIL_HOLD); tangled ??= by[i]; }
      free[i] = by[i] ? 0 : (free[i] ?? Infinity) + dt;
      flinch[i] = (flinch[i] ?? 0) + (hits[i] - (flinch[i] ?? 0)) * Math.min(1, dt * RECOIL_EASE);
    });
    if (bodyBy && (b.bodyFree ?? Infinity) > RETOUCH) fresh ??= bodyBy;
    else if (bodyBy) tangled ??= bodyBy;
    b.bodyFree = bodyBy ? 0 : (b.bodyFree ?? Infinity) + dt;
    const o = fresh ?? tangled;
    if (!o) continue;
    const calm = sameColony(b, o) ? COLONY_CALM : 1;
    if (fresh) b.irk += IRK_TOUCH * calm;   // once per touch, however many legs it caught
    if (tangled) b.irk += IRK_TANGLED * calm * dt;
    const c = startleCandidate(b, o);
    if (b.irk > IRK_LIMIT) {
      startle(c, c === b ? o : b, GIVE_WAY_ALARM);
      b.irk = 0;
      o.irk = 0;
    } else if (fresh && c === b && b.rng() < startleChance(b, o)) startle(b, o);
  }
}

// Whether a leg (hip, knee, ankle, foot) presses on a body given as discs: any part of it beyond the hip within
// `gap` of a disc.
function legOnBody(leg, discs, gap) {
  for (let i = 0; i < 3; i++) {
    for (const d of discs) if (segmentGap(leg[i], leg[i + 1], { x: d.x, y: d.y }, { x: d.x, y: d.y }) < d.r + gap) return true;
  }
  return false;
}

// Whether two legs (each hip, knee, ankle, foot) come within `gap` of each other anywhere along them.
function legsCross(a, b, gap) {
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (segmentGap(a[i], a[i + 1], b[j], b[j + 1]) < gap) return true;
  return false;
}

function segmentGap(p, q, r, s) {
  const d1x = q.x - p.x, d1y = q.y - p.y, d2x = s.x - r.x, d2y = s.y - r.y;
  const den = d1x * d2y - d1y * d2x;
  if (den) {
    const t = ((r.x - p.x) * d2y - (r.y - p.y) * d2x) / den, u = ((r.x - p.x) * d1y - (r.y - p.y) * d1x) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  const toSeg = (pt, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l)) : 0;
    return Math.hypot(pt.x - a.x - dx * t, pt.y - a.y - dy * t);
  };
  return Math.min(toSeg(p, r, s), toSeg(q, r, s), toSeg(r, p, q), toSeg(s, p, q));
}

export class Swarm {
  // lifePxPerMm (CSS pixels per mm on a calibrated screen) draws every bug at its real size.
  constructor({ species, count, width, height, speed = 1, weights, rng = Math.random, crowd = new Set(), lifePxPerMm = 0 }) {
    this.width = width;
    this.height = height;
    this.crowd = crowd;
    this.lifePxPerMm = lifePxPerMm;
    this.pointer = null;   // { x, y } while a moving mouse pointer should scatter the bugs
    this.bugs = [];
    for (let i = 0; i < count; i++) {
      const id = pickWeighted(species, weights, rng);
      const bug = createBug(id, { width, height, rng, speed, delay: i === 0 ? 0 : rng() * 2.5, lifePxPerMm });
      assignCaste(bug, rng, [...this.bugs, ...[...crowd].flatMap(s => s.bugs)], width, height);
      this.bugs.push(bug);
    }
    ensureQueen(this, species, weights, rng, crowd, speed);
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
    for (const b of this.bugs) stepBug(b, step, this.width, this.height, others, this.pointer);
    touchLegs(this.bugs, others, step);
    if (this.done) this.crowd.delete(this);
  }

  draw(ctx) {
    for (const b of this.bugs) if (!b.done && b.delay <= 0) b.species.draw(ctx, b);
  }

  // Light that bugs give off (fireflies' flashes), drawn over everything else in a pass of its own.
  drawGlow(ctx) {
    for (const b of this.bugs) if (!b.done && b.delay <= 0) b.species.drawGlow?.(ctx, b);
  }

  get done() {
    return this.bugs.every(b => b.done);
  }
}
