import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Swarm, SPECIES, createBug, stepBug } from '../src/lib/bugs/engine.js';
import { sampleTrail } from '../src/lib/bugs/species/centipede.js';
import { BUG_SPECIES } from '../src/lib/settings.js';
import { seeded, mockCanvas } from './helpers/mocks.js';
import * as BEE_MODULE from '../src/lib/bugs/species/honeybee.js';
import { ANT_IDS, ANT_BREEDS } from '../src/lib/bugs/species/ant.js';
import { BUMBLE_IDS, BUMBLE_BREEDS } from '../src/lib/bugs/species/bumblebee.js';
import { SPIDER_IDS } from '../src/lib/bugs/species/spider.js';

// Front, middle and hind feet on both sides, in tripod timing.
const FEET = [-1, 1].flatMap(side => [[45, 30, 0], [0, 40, 0.5], [-40, 35, 0]].map(([x, y, o]) =>
  ({ x, y: side * y, side, offset: (o + (side > 0 ? 0.5 : 0)) % 1 })));

test('every selectable species has a renderer', () => {
  for (const s of BUG_SPECIES) assert.ok(SPECIES[s.id], s.id);
});

for (const id of Object.keys(SPECIES)) {
  test(`${id}: walks across the screen, draws with finite values, and leaves`, () => {
    const rng = seeded(id.length * 31);
    const { ctx, calls } = mockCanvas();
    const swarm = new Swarm({ species: [id], count: 3, width: 1280, height: 800, rng });
    let frames = 0;
    while (!swarm.done && frames < 60 * 120) {
      swarm.update(1 / 60);
      if (frames % 10 === 0) swarm.draw(ctx);
      for (const b of swarm.bugs) for (const k of ['x', 'y', 'heading', 'speed', 'phase']) assert.ok(Number.isFinite(b[k]), `${k} finite`);
      frames++;
    }
    assert.ok(swarm.done, 'all bugs exit within two minutes of simulated time');
    assert.ok(swarm.bugs.every(b => b.entered), 'every bug actually crossed into view');
    assert.ok(calls.length > 0, 'renderer drew something');
  });
}

test('the system reduced-motion setting no longer caps or slows bugs', async () => {
  const rng = seeded(5);
  const swarm = new Swarm({ species: ['cockroach'], count: 20, width: 800, height: 600, rng, reducedMotion: true });
  assert.equal(swarm.bugs.length, 20, 'every requested bug is released');
  for (const b of swarm.bugs) assert.ok(b.cruise >= SPECIES.cockroach.speed[0], 'full natural pace');
  const { readFile } = await import('node:fs/promises');
  for (const f of ['src/lib/bugs/overlay.js', 'src/lib/bugs/engine.js', 'src/options/options.js']) {
    assert.doesNotMatch(await readFile(new URL(`../${f}`, import.meta.url), 'utf8'), /prefers-reduced-motion|reducedMotion/, f);
  }
});

test('createBug rejects unknown species', () => {
  assert.throws(() => createBug('dragon', { width: 10, height: 10 }));
});

test('huge frame gaps (tab backgrounded) do not teleport bugs', () => {
  const swarm = new Swarm({ species: ['ant'], count: 1, width: 800, height: 600, rng: seeded(9) });
  const b = swarm.bugs[0];
  const x0 = b.x, y0 = b.y;
  swarm.update(30);
  assert.ok(Math.hypot(b.x - x0, b.y - y0) < 50);
});

test('centipede trail sampling yields evenly spaced segments', () => {
  const trail = Array.from({ length: 200 }, (_, i) => ({ x: -i, y: 0 }));
  const segs = sampleTrail(trail, 0, 0, 0, 5, 10);
  assert.equal(segs.length, 10);
  segs.forEach((s, i) => assert.ok(Math.abs(s.x + i * 5) < 1e-6));
  const short = sampleTrail([], 100, 100, Math.PI / 2, 4, 5);
  assert.ok(Math.abs(short[4].y - 84) < 1e-6, 'extends straight back when trail is short');
});

test('stepBug is a no-op while delayed', () => {
  const b = createBug('ant', { width: 100, height: 100, rng: seeded(1), delay: 1 });
  const x = b.x;
  stepBug(b, 0.5, 100, 100);
  assert.equal(b.x, x);
});

test('crawl speed setting scales how fast bugs move', () => {
  const pace = speed => {
    const swarm = new Swarm({ species: ['beetle'], count: 1, width: 4000, height: 3000, speed, rng: seeded(11) });
    return swarm.bugs[0].cruise;
  };
  assert.ok(Math.abs(pace(2) / pace(1) - 2) < 1e-9);
  assert.ok(Math.abs(pace(0.25) / pace(1) - 0.25) < 1e-9);
});

test('slowest crawlers still cross the screen and leave', () => {
  for (const id of Object.keys(SPECIES)) {
    const swarm = new Swarm({ species: [id], count: 2, width: 1280, height: 800, speed: 0.25, rng: seeded(21) });
    let frames = 0;
    while (!swarm.done && frames < 30 * 60 * 8) { swarm.update(1 / 30); frames++; }
    assert.ok(swarm.done, `${id} left within 8 simulated minutes`);
    assert.ok(swarm.bugs.every(b => b.entered), `${id} crossed into view`);
  }
});

test('lighting is softened: highlights are blended toward the body colour', async () => {
  const { mix, LIGHTING } = await import('../src/lib/bugs/common.js');
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mix('#a0552a', '#a0552a', 0.3), '#a0552a');
  assert.ok(LIGHTING.highlight < 1 && LIGHTING.specular < 1);
});

test('turning on the spot steps the legs: the two sides stride in opposite directions', async () => {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const gaitLib = await import('../src/lib/bugs/common.js');
  const b = createBug('cockroach', { width: 800, height: 600, rng: seeded(2) });
  const l0 = b.phaseL, r0 = b.phaseR;
  for (let i = 0; i < 100; i++) advanceGait(b, 0, 0.03);
  assert.ok(b.phaseL > l0 && b.phaseR > r0, 'both sides keep stepping');
  assert.ok(gaitLib.strideDirection(b, -1, { x: 0, y: -40 }).x > 0, 'outer (left) side strides forward on a clockwise turn');
  assert.ok(gaitLib.strideDirection(b, 1, { x: 0, y: 40 }).x < 0, 'inner (right) side strides backward');
  assert.ok(b.phase > 0, 'overall gait advances, so antennae/body flex animate too');
});

test('no leg snaps: foot positions change smoothly as a turn tightens through the inner side reversing', async () => {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const gaitLib = await import('../src/lib/bugs/common.js');
  const b = createBug('spider', { width: 800, height: 600, rng: seeded(5) });
  const rests = FEET;
  let prev = null, worst = 0, straight = 0;
  for (let i = 0; i < 2000; i++) {
    const turn = 0.04 * Math.sin(i / 150);            // sweeps straight -> tight pivot -> other way
    advanceGait(b, 1 - Math.abs(turn) / 0.04 * 0.95, turn, 0);
    const now = rests.map(r => gaitLib.footPosition(b, r.side, r, r.offset, 0.5, 1e9));
    if (prev) for (const [j, f] of now.entries()) {
      const d = Math.hypot(f.x - prev[j].x, f.y - prev[j].y);
      worst = Math.max(worst, d);
      if (Math.abs(turn) < 0.002) straight = Math.max(straight, d);
    }
    prev = now;
  }
  assert.ok(straight > 0, 'feet swing while walking straight');
  assert.ok(worst < straight * 1.5, `a foot jumped ${worst.toFixed(2)} units in a frame (straight-walk swing ${straight.toFixed(2)})`);
});

test('walking straight keeps both sides in step and re-syncs them after a turn', async () => {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const b = createBug('ant', { width: 800, height: 600, rng: seeded(4) });
  assert.equal(b.phaseL, b.phaseR, 'start in a coordinated tripod gait');
  advanceGait(b, 4, 0.5);                              // turning while walking: outer side out-steps inner
  b.moving = 1;
  const off = () => Math.abs(Math.atan2(Math.sin(b.phaseL - b.phaseR), Math.cos(b.phaseL - b.phaseR)));
  const before = off();
  for (let i = 0; i < 120; i++) advanceGait(b, 2, 0, 1 / 60);
  assert.ok(off() < before * 0.2, `phase offset shrinks (${before.toFixed(3)} -> ${off().toFixed(3)})`);
});

test('a paused bug barely rotates (no turntable spinning)', () => {
  for (const id of Object.keys(SPECIES)) {
    const b = createBug(id, { width: 800, height: 600, rng: seeded(6) });
    Object.assign(b, { x: 400, y: 300, entered: true, paused: true, stateTime: 5, speed: 0 });
    b.waypoints = [{ x: 0, y: 290 }, { x: -500, y: 290 }];   // goal behind: worth turning round for
    b.heading = 0;
    const l0 = b.phaseL;
    for (let i = 0; i < 60; i++) stepBug(b, 1 / 60, 800, 600);
    if (SPECIES[id].trail) {
      assert.equal(b.heading, 0, `${id}: a body that follows its head can't swivel on the spot`);
      continue;
    }
    assert.ok(Math.abs(b.heading) < SPECIES[id].maxTurn * 0.15, `${id} turned ${b.heading.toFixed(3)} rad in 1 s while stopped`);
    assert.notEqual(b.phaseL, l0, `${id} legs stepped while turning`);
  }
});

test('drop shadow: whole bug layer is composited once with a down-right shadow', async () => {
  const { compositeWithShadow, DROP_SHADOW } = await import('../src/lib/bugs/shadow.js');
  const { ctx, calls } = mockCanvas();
  const layer = { width: 10, height: 10 };
  compositeWithShadow(ctx, layer, 2);
  assert.equal(calls.filter(c => c === 'drawImage').length, 1);
  assert.equal(ctx.shadowOffsetX, DROP_SHADOW.x * 2, 'offset scales with device pixel ratio');
  assert.equal(ctx.shadowOffsetY, DROP_SHADOW.y * 2);
  assert.equal(ctx.shadowBlur, DROP_SHADOW.blur * 2);
  assert.ok(DROP_SHADOW.x > 0 && DROP_SHADOW.y > 0, 'shadow falls away from the top-left light');
});

test('leg cadence rises only gently with crawl speed (longer strides instead)', async () => {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const cadence = speed => {
    const b = createBug('cockroach', { width: 800, height: 600, rng: seeded(3), speed });
    const before = b.phase;
    advanceGait(b, b.cruise, 0);           // one second of travel at cruise speed
    return b.phase - before;
  };
  const ratio = cadence(2.5) / cadence(1);
  assert.ok(ratio > 1 && ratio < 1.5, `cadence ratio at max speed ${ratio.toFixed(2)}`);
  assert.ok(Math.abs(cadence(0.5) / cadence(1) - 0.5) < 1e-9, 'below natural pace legs simply slow down');
});

test('every species declares a preview size for the settings page', () => {
  for (const [id, sp] of Object.entries(SPECIES)) assert.ok(sp.previewSize > 10 && sp.previewSize < 130, id);
});

const gaitLib = await import('../src/lib/bugs/common.js');

test('insects walk with an alternating tripod: L1+R2+L3 together, opposite R1+L2+R3', () => {
  const bug = { speedScale: 1 };
  const o = (leg, side) => gaitLib.insectGait(bug, leg, side).offset;
  assert.equal(o(0, -1), o(1, 1));
  assert.equal(o(0, -1), o(2, -1));
  assert.equal(o(0, 1), o(1, -1));
  assert.equal(o(0, 1), o(2, 1));
  assert.equal(Math.abs(o(0, -1) - o(0, 1)), 0.5);
});

test('very slow insects switch to a back-to-front wave, sides half a cycle apart', () => {
  const bug = { speedScale: 0.3 };
  const o = (leg, side) => gaitLib.insectGait(bug, leg, side).offset;
  assert.ok(o(2, -1) > o(1, -1) && o(1, -1) > o(0, -1), 'hind leg leads, then middle, then front');
  assert.equal(Math.abs(o(0, -1) - o(0, 1)), 0.5);
  assert.ok(gaitLib.insectGait(bug, 0, -1).duty > gaitLib.insectGait({ speedScale: 1 }, 0, -1).duty, 'more feet down when slow');
});

test('spiders use an alternating tetrapod: L1+R2+L3+R4 vs R1+L2+R3+L4, rippling back to front', () => {
  const bug = { speedScale: 1 };
  const o = (leg, side) => gaitLib.tetrapodGait(bug, leg, side).offset;
  const dist = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
  const groupA = [o(0, -1), o(1, 1), o(2, -1), o(3, 1)];
  const groupB = [o(0, 1), o(1, -1), o(2, 1), o(3, -1)];
  for (const g of [groupA, groupB]) assert.ok(g.every(v => dist(v, g[0]) <= 0.25), 'a tetrapod steps roughly together');
  for (let leg = 0; leg < 4; leg++) assert.ok(Math.abs(dist(o(leg, -1), o(leg, 1)) - 0.5) < 1e-9, 'the two sides half a cycle apart');
  for (let leg = 0; leg < 3; leg++) {
    const lag = dist(o(leg, -1), o(leg + 1, -1));
    assert.ok(lag > 0.35 && lag < 0.5, `adjacent legs ${leg + 1}/${leg + 2} near, not exactly, antiphase (${lag.toFixed(2)})`);
  }
  assert.ok(o(2, -1) > o(0, -1) && o(3, 1) > o(1, 1), 'within a tetrapod the hind legs step first');
  assert.ok(gaitLib.tetrapodGait(bug, 0, -1).duty >= 0.6, 'walking spiders keep most feet down');
});

test('a spider swing carries the foot round the hip instead of folding the leg in', () => {
  const hip = { x: 10, y: 8 }, rest = { x: 20, y: 60 };
  const b = { size: 100, stridePx: 40, phaseL: 0, phaseR: 0 };
  const radius = f => Math.hypot(f.x - hip.x, f.y - hip.y);
  const swing = [];
  for (let i = 0; i < 60; i++) {
    b.phaseL = (i / 60) * 2 * Math.PI;
    const arc = gaitLib.footPosition(b, -1, rest, 0, 0.6, 1e9, hip), line = gaitLib.footPosition(b, -1, rest, 0, 0.6, 1e9);
    if (arc.lift > 0.5) swing.push([radius(arc), radius(line)]);
    else if (!arc.lift) assert.ok(Math.hypot(arc.x - line.x, arc.y - line.y) < 1e-9, 'planted feet are unchanged');
  }
  assert.ok(swing.length && swing.every(([a, l]) => a > l), 'mid-swing the foot stays further out than on a straight path');
});

test('a 3D leg keeps its segment lengths, arches its knee up and reaches the foot', () => {
  const hip = { x: 20, y: 10 }, foot = { x: 40, y: 60 }, lens = [30, 34, 24];
  const p = gaitLib.legPose3D(hip, 6, foot, 0, lens);
  const dist = (u, v) => Math.hypot(u.x - v.x, u.y - v.y, u.z - v.z);
  assert.ok(Math.abs(dist(p.hip, p.knee) - 30) < 1e-6 && Math.abs(dist(p.knee, p.ankle) - 34) < 1e-6 && Math.abs(dist(p.ankle, p.foot) - 24) < 1e-6);
  assert.ok(p.knee.z > p.hip.z && p.knee.z > p.ankle.z && p.ankle.z > 0, 'femur climbs to a high knee, the leg comes down to the foot');
  assert.deepEqual([p.foot.x, p.foot.y, p.foot.z], [40, 60, 0]);
  const curled = gaitLib.legPose3D(hip, 6, foot, 0, lens, -0.4, 1);
  assert.notDeepEqual([curled.knee.x, curled.knee.y], [p.knee.x, p.knee.y], 'curl swings the knee off the hip-foot line');
  assert.equal(curled.knee.z, p.knee.z);
});

test('a 3D leg moves smoothly through a stride: no knee snaps, foot planted then lifted', () => {
  const bug = { size: 100, stridePx: 60, phaseL: 0, phaseR: 0, speedScale: 1 };
  const segs = [[27, 0, 4], [31, -0.35, 3], [23, -0.2, 2]];
  let prev = null, lifted = 0;
  for (let i = 0; i <= 400; i++) {
    bug.phaseL = (i / 400) * 2 * Math.PI;
    const p = gaitLib.walkLeg3D(bug, { hx: 22, hy: -8, side: -1, angle: 0.55, segs, offset: 0, duty: 0.64, edge: 4, curl: -0.35 });
    if (prev) assert.ok(Math.hypot(p.knee.x - prev.knee.x, p.knee.y - prev.knee.y, p.knee.z - prev.knee.z) < 1, `knee jumped at step ${i}`);
    if (p.lift > 0) { lifted++; assert.ok(p.foot.z > 0); } else assert.equal(p.foot.z, 0);
    prev = p;
  }
  assert.ok(lifted > 400 * 0.3 && lifted < 400 * 0.4, 'the foot is up for the swing share of the cycle');
});

test('running lengthens the stride and puts feet down for less of it, so legs speed up only gently', async () => {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const b = createBug('spider', { width: 800, height: 600, rng: seeded(5) });
  const cadence = speed => {
    b.speed = speed;
    for (let i = 0; i < 120; i++) advanceGait(b, (speed / 60), 0, 1 / 60);
    return speed / b.stridePx;
  };
  const walk = cadence(b.cruise), walkDuty = gaitLib.tetrapodGait(b, 0, -1).duty;
  const run = cadence(b.cruise * 1.8), runDuty = gaitLib.tetrapodGait(b, 0, -1).duty;
  assert.ok(run / walk < 1.35, `cadence rose ${(run / walk).toFixed(2)}x for 1.8x the speed`);
  assert.ok(runDuty < walkDuty && runDuty >= 0.45, `duty ${walkDuty.toFixed(2)} -> ${runDuty.toFixed(2)}`);
  cadence(b.cruise * 0.5);
  assert.ok(Math.abs(b.run - 1) < 1e-3, 'back to its walking stride when it slows');
});

test('spiders keep their distance from each other (legs at most touching), and other bugs from them', async () => {
  const { keepApart } = await import('../src/lib/bugs/engine.js');
  const closest = ids => {
    const bugs = ids.map((id, i) => {
      const b = createBug(id, { width: 800, height: 600, rng: seeded(10 + i) });
      Object.assign(b, { x: i ? 600 : 200, y: 300, heading: i ? Math.PI : 0, entered: true, delay: 0 });
      b.species = { ...b.species, pauseRate: 0 };
      b.waypoints = [{ x: i ? -100 : 900, y: 300 }];
      return b;
    });
    let min = Infinity;
    for (let f = 0; f < 60 * 8; f++) {
      for (const b of bugs) stepBug(b, 1 / 60, 800, 600, bugs);
      min = Math.min(min, Math.hypot(bugs[0].x - bugs[1].x, bugs[0].y - bugs[1].y));
    }
    return { min, room: keepApart(...bugs), bugs };
  };
  const spiders = closest(['spider', 'giantspider']);
  assert.ok(spiders.room > 0);
  assert.ok(spiders.min > spiders.room * 0.7, `two spiders meeting head on came within ${spiders.min.toFixed(0)} px (room ${spiders.room.toFixed(0)})`);
  const mixed = closest(['spider', 'cockroach']);
  assert.ok(mixed.room > 0 && mixed.room < spiders.room, 'other bugs keep clear of a spider\'s legs too, with less room than two spiders need');
});

test('a planted 3D foot sticks to the page while steering changes how the stride bends', () => {
  const bug = { x: 400, y: 300, heading: 0.3, size: 100, stridePx: 60, phaseL: 0.2, phaseR: 0.2, speedScale: 1, turnMix: 0 };
  const leg = { hx: 22, hy: -8, side: -1, angle: 0.55, segs: [[27, 0, 4], [31, -0.35, 3], [23, -0.2, 2]], offset: 0, duty: 0.64, edge: 4, key: 0 };
  const world = p => ({ x: bug.x + p.x * Math.cos(bug.heading) - p.y * Math.sin(bug.heading), y: bug.y + p.x * Math.sin(bug.heading) + p.y * Math.cos(bug.heading) });
  const start = world(gaitLib.walkLeg3D(bug, leg).foot);
  for (let i = 0; i < 10; i++) {
    bug.turnMix = (i % 2 ? 1 : -1) * 0.4;   // a crowd jostling its steering
    bug.phaseL += 0.05;
    bug.x += 0.5;
    const p = gaitLib.walkLeg3D(bug, leg);
    assert.equal(p.lift, 0);
    const now = world(p.foot);
    assert.ok(Math.hypot(now.x - start.x, now.y - start.y) < 1e-6, `planted foot moved at step ${i}`);
  }
  assert.ok(bug.feet[0].planted);
});

test('a settings-page specimen walks in place, so its feet slide back under it instead of sticking to the page', async () => {
  const { createPreviewBug } = await import('../src/lib/bugs/preview.js');
  const b = createPreviewBug('housefly');
  assert.equal(b.inPlace, true);
  const target = { x: 10, y: 20, lift: 0 };
  Object.assign(b, { x: 50, y: 50, heading: 0 });
  assert.equal(gaitLib.stickyFoot(b, 0, target, 5), target, 'the gait places its feet, untouched');
});

test('a lifted leg casts no shadow at the top of its swing', () => {
  const drawn = [];
  const ctx = new Proxy({}, { get: (t, k) => k === 'stroke' ? () => drawn.push(t.strokeStyle) : (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  const pose = gaitLib.legPose3D({ x: 0, y: 0 }, 6, { x: 30, y: 40 }, 0, [30, 34, 24]);
  gaitLib.legShadow(ctx, { x: -0.4, y: -0.6 }, { ...pose, lift: 0 }, 3);
  gaitLib.legShadow(ctx, { x: -0.4, y: -0.6 }, { ...pose, lift: 0.5 }, 3);
  gaitLib.legShadow(ctx, { x: -0.4, y: -0.6 }, { ...pose, lift: 1 }, 3);
  const alpha = drawn.map(c => +/,([\d.]+)\)$/.exec(c)[1]);
  assert.equal(alpha.length, 2, 'nothing drawn at full lift');
  assert.ok(alpha[1] < alpha[0], 'fades as the foot lifts');
});

test('turning eases: a sudden flip in steering does not flick the body round', () => {
  const b = createBug('spider', { width: 800, height: 600, rng: seeded(4) });
  Object.assign(b, { x: 400, y: 300, heading: 0, entered: true, delay: 0 });
  b.species = { ...b.species, pauseRate: 0 };
  const turns = [];
  for (let f = 0; f < 40; f++) {
    b.waypoints = [{ x: 400 + 300 * Math.cos(f % 10 < 5 ? 1.2 : -1.2), y: 300 + 300 * Math.sin(f % 10 < 5 ? 1.2 : -1.2) }];   // goal flips side every 5 frames
    const h = b.heading;
    stepBug(b, 1 / 60, 800, 600, [b]);
    turns.push(b.heading - h);
  }
  const maxTurn = b.species.maxTurn / 60;
  for (let i = 1; i < turns.length; i++) assert.ok(Math.abs(turns[i] - turns[i - 1]) < maxTurn * 0.5, `turn rate jumped at frame ${i}`);
});

test('a crowd of spiders: planted feet hold, bodies turn smoothly and nobody crowds in', async () => {
  const { auditCrowd } = await import('./helpers/legaudit.js');
  const { SPIDER_IDS } = await import('../src/lib/bugs/species/spider.js');
  const r = auditCrowd(SPIDER_IDS, { count: 20, seconds: 12, rng: seeded(21) });
  assert.ok(r.slip99 < 0.3, `planted feet slipped ${r.slip99.toFixed(2)} px (99th percentile)`);
  assert.ok(r.jerk99 < 0.04, `turn rate jerked ${r.jerk99.toFixed(3)} rad/frame (99th percentile)`);
  assert.ok(r.closest > 0.68, `two spiders came within ${(r.closest * 100).toFixed(0)}% of their personal space`);
});

test('a swinging spider leg folds in as it lifts, then reaches out before it sets down', () => {
  const hip = { x: 10, y: 8 }, rest = { x: 20, y: 60 };
  const b = { size: 100, stridePx: 40, phaseL: 0, phaseR: 0 };
  const radius = f => Math.hypot(f.x - hip.x, f.y - hip.y);
  let early = 0, late = 0;
  for (let i = 0; i < 200; i++) {
    b.phaseL = (i / 200) * 2 * Math.PI;
    const plain = gaitLib.footPosition(b, -1, rest, 0, 0.6, 1e9, hip);
    const shaped = gaitLib.footPosition(b, -1, rest, 0, 0.6, 1e9, { ...hip, fold: 0.14, bulge: 0.07 });
    if (!plain.lift) { assert.ok(Math.hypot(shaped.x - plain.x, shaped.y - plain.y) < 1e-9, 'planted feet are unchanged'); continue; }
    if (plain.swing > 0.1 && plain.swing < 0.4) { early++; assert.ok(radius(shaped) < radius(plain), 'folded in early in the swing'); }
    if (plain.swing > 0.6 && plain.swing < 0.9) { late++; assert.ok(radius(shaped) > radius(plain), 'reaching out late in the swing'); }
  }
  assert.ok(early && late);
});

// Legs I pull by flexing and legs IV push by extending; legs II and III mostly swing about the hip.
test('spider knees flex and extend through a stride but never lock straight', async () => {
  const { SPIDER_IDS } = await import('../src/lib/bugs/species/spider.js');
  const { recorder } = await import('./helpers/legaudit.js');
  const ang = (p, a, c) => {
    const u = [a.x - p.x, a.y - p.y, a.z - p.z], v = [c.x - p.x, c.y - p.y, c.z - p.z];
    return Math.acos((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(...u) / Math.hypot(...v)) * 180 / Math.PI;
  };
  for (const id of SPIDER_IDS) {
    const b = createBug(id, { width: 800, height: 600, rng: seeded(3) });
    Object.assign(b, { x: NaN, heading: 0, size: 100, stridePx: (b.stridePx * 100) / b.size, light: { x: -0.45, y: -0.65 }, moving: 1 });
    const lo = Array(8).fill(180), hi = Array(8).fill(0);
    for (let k = 0; k < 120; k++) {
      b.phaseL = b.phaseR = (k / 120) * 2 * Math.PI;
      SPECIES[id].draw(recorder().ctx, b, 1 / 60);
      b.legPoses.forEach((p, i) => { const a = ang(p.knee, p.hip, p.ankle); lo[i] = Math.min(lo[i], a); hi[i] = Math.max(hi[i], a); });
    }
    lo.forEach((l, i) => {
      assert.ok(hi[i] < 160, `${id} leg ${i}: knee straightens to ${hi[i].toFixed(0)} deg`);
      assert.ok(l > 30, `${id} leg ${i}: knee folds to ${l.toFixed(0)} deg`);
      if (i % 4 === 0 || i % 4 === 3) assert.ok(hi[i] - l > 25, `${id} leg ${i}: knee barely moves (${l.toFixed(0)}-${hi[i].toFixed(0)} deg)`);
    });
  }
});

test('deep inside another spider\'s room a step may not close the gap, but may always open it', async () => {
  const { keepRoom, keepApart, KEEP_FLOOR } = await import('../src/lib/bugs/engine.js');
  const a = createBug('spider', { width: 800, height: 600, rng: seeded(1) });
  const o = createBug('spider', { width: 800, height: 600, rng: seeded(2) });
  Object.assign(a, { x: 300, y: 300, heading: 0, entered: true });
  o.entered = true;
  const room = keepApart(a, o);
  Object.assign(o, { x: 300 + room * (KEEP_FLOOR - 0.05), y: 300 });
  assert.equal(keepRoom(a, [o], 5), 0, 'no closer');
  assert.equal(keepRoom(a, [o], -5), -5, 'backing away is fine');
  a.heading = Math.PI / 2;
  assert.equal(keepRoom(a, [o], 5), 5, 'stepping aside opens the gap');
  Object.assign(o, { x: 300 + room * 0.95 });
  a.heading = 0;
  assert.equal(keepRoom(a, [o], 5), 5, 'the outer part of its room is kept by steering alone, so spiders can squeeze past');
});

test('a big release of every kind of spider flows instead of jamming', async () => {
  const { SPIDER_IDS } = await import('../src/lib/bugs/species/spider.js');
  const sw = new Swarm({ species: SPIDER_IDS, count: 30, width: 1280, height: 720, rng: seeded(5) });
  let walking = 0, held = 0, f = 0;
  for (; !sw.done && f < 60 * 240; f++) {
    sw.update(1 / 60);
    for (const b of sw.bugs) if (!b.done && b.entered && !b.paused && b.delay <= 0) { walking++; if (b.hemmed > 0.5) held++; }
  }
  assert.ok(sw.done, 'every spider has left within four minutes');
  assert.ok(held / walking < 0.12, `held up ${(100 * held / walking).toFixed(1)}% of their walking time`);
});

test('a touched spider leg flinches mildly, only that leg, and settles back once free', async () => {
  const { touchLegs } = await import('../src/lib/bugs/engine.js');
  const { recorder } = await import('./helpers/legaudit.js');
  const make = (seed, x, heading) => {
    const b = createBug('spider', { width: 800, height: 600, rng: seeded(seed) });
    Object.assign(b, { x, y: 300, heading, entered: true, delay: 0 });
    b.species.draw(recorder().ctx, b);
    return b;
  };
  const a = make(1, 300, 0), far = make(2, 700, Math.PI);
  touchLegs([a], [a, far], 1 / 60);
  assert.ok(a.recoil.every(r => r === 0), 'nothing touching, no flinch');
  const reach = Math.max(...a.legPoses.map(p => Math.hypot(p.foot.x, p.foot.y))) * a.size / 100;
  const near = make(2, 300 + reach * 1.6, Math.PI);   // face to face, front legs crossing at the tips
  for (let f = 0; f < 6; f++) touchLegs([a], [a, near], 1 / 60);
  const flinched = a.recoil.filter(r => r > 0.3).length;
  assert.ok(flinched > 0 && flinched < a.recoil.length, `${flinched} of ${a.recoil.length} legs flinched`);
  near.x = 1000;
  for (let f = 0; f < 60; f++) touchLegs([a], [a, near], 1 / 60);
  assert.ok(a.recoil.every(r => r < 0.05), 'settled back within a second');
});

test('a flinch draws the foot back and up but leaves its planted spot alone', () => {
  const leg = { hx: 22, hy: -8, side: -1, angle: 0.55, segs: [[27, 0, 4], [31, -0.35, 3], [23, -0.2, 2]], offset: 0, duty: 0.64, edge: 4, key: 0 };
  const bug = () => ({ x: 400, y: 300, heading: 0, size: 100, stridePx: 60, phaseL: 0.2, phaseR: 0.2, speedScale: 1 });
  const calm = bug(), touched = bug();
  const p0 = gaitLib.walkLeg3D(calm, leg), p1 = gaitLib.walkLeg3D(touched, { ...leg, recoil: 1 });
  const reach = p => Math.hypot(p.foot.x - p.hip.x, p.foot.y - p.hip.y);
  assert.ok(reach(p1) < reach(p0) * 0.95 && reach(p1) > reach(p0) * 0.85, 'drawn back a little');
  assert.ok(p1.foot.z > 0 && p0.foot.z === 0, 'lifted a touch');
  assert.deepEqual(touched.feet[0].world, calm.feet[0].world, 'still planted on the same spot');
});

test('now and then a leg touch startles the smaller spider (or, between equals, the one walked into) into a short dash', async () => {
  const { touchLegs, startleCandidate } = await import('../src/lib/bugs/engine.js');
  const { recorder } = await import('./helpers/legaudit.js');
  const make = (id, seed, x, heading) => {
    const b = createBug(id, { width: 800, height: 600, rng: seeded(seed) });
    Object.assign(b, { x, y: 300, heading, entered: true, delay: 0, speed: 0 });
    b.species.draw(recorder().ctx, b);
    return b;
  };
  const big = make('giantspider', 1, 300, 0), small = make('spider', 2, 0, Math.PI);
  assert.equal(startleCandidate(big, small), small);
  const twinA = make('spider', 3, 0, 0), twinB = make('spider', 3, 0, 0);
  twinA.speed = 40;
  assert.equal(startleCandidate(twinA, twinB), twinB, 'the slower one was walked into');

  const meet = (rngValue) => {
    const a = make('blackwidow', 4, 300, 0), b = make('spider', 5, 300, Math.PI);
    const reach = Math.max(...a.legPoses.map(p => Math.hypot(p.foot.x, p.foot.y))) * a.size / 100;
    const breach = Math.max(...b.legPoses.map(p => Math.hypot(p.foot.x, p.foot.y))) * b.size / 100;
    b.x = 300 + (reach + breach) * 0.6;   // face to face, legs crossing
    a.rng = b.rng = () => rngValue;
    touchLegs([a, b], [a, b], 1 / 60);
    return { a, b };
  };
  const lucky = meet(0.99);
  assert.ok(lucky.a.alarm === 0 && lucky.b.alarm === 0, 'usually nothing more than a flinch');
  const { a, b } = meet(0);
  const smaller = startleCandidate(a, b), other = smaller === a ? b : a;
  assert.ok(smaller.alarm > 0.5 && other.alarm === 0, 'only the more likely one takes fright');
  const away = Math.atan2(smaller.y - other.y, smaller.x - other.x);
  assert.ok(Math.abs(Math.atan2(Math.sin(smaller.fleeDir - away), Math.cos(smaller.fleeDir - away))) < 1e-9, 'and dashes away from the other');
});

test('legs left touching hold back instead of flinching over and over, and a knot breaks up', async () => {
  const { touchLegs, startleCandidate } = await import('../src/lib/bugs/engine.js');
  const { recorder } = await import('./helpers/legaudit.js');
  const make = (id, seed, x, heading) => {
    const b = createBug(id, { width: 800, height: 600, rng: seeded(seed) });
    Object.assign(b, { x, y: 300, heading, entered: true, delay: 0, speed: 0 });
    b.species.draw(recorder().ctx, b);
    b.rng = () => 0.99;   // no chance startles: only irritation
    return b;
  };
  const a = make('spider', 4, 300, 0), b = make('spider', 5, 300, Math.PI);
  const r = s => Math.max(...s.legPoses.map(p => Math.hypot(p.foot.x, p.foot.y))) * s.size / 100;
  b.x = 300 + (r(a) + r(b)) * 0.6;
  const fresh = () => a.recoilHit.filter(h => h === 1).length;
  touchLegs([a, b], [a, b], 1 / 60);
  assert.ok(fresh() > 0, 'a first touch is a flinch');
  for (let f = 0; f < 20; f++) touchLegs([a, b], [a, b], 1 / 60);
  assert.equal(fresh(), 0, 'still touching: held back, not flinching afresh');
  assert.ok(a.recoil.some(v => v > 0.4 && v < 0.6), 'held mildly drawn back');
  const away = b.x;
  b.x = 2000;
  for (let f = 0; f < 20; f++) touchLegs([a, b], [a, b], 1 / 60);
  b.x = away;
  touchLegs([a, b], [a, b], 1 / 60);
  assert.equal(fresh(), 0, 'brushing the same legs again moments later is the same encounter');
  let gaveWay = null;
  for (let f = 0; f < 60 * 4 && !gaveWay; f++) {
    touchLegs([a, b], [a, b], 1 / 60);
    gaveWay = [a, b].find(s => s.alarm > 0.8) ?? null;
  }
  assert.ok(gaveWay, 'tangled for a few seconds, one gives way');
  assert.equal(gaveWay, startleCandidate(a, b), 'the bumped one (they are equal sizes and both still)');
});

test('a jointed leg folds at the ankle to reach a foot close in, keeping every segment its length', () => {
  const segs = [[10, 0, 2], [16, 0.4, 1.5], [10, 0.2, 1]];
  const j = gaitLib.legJoints(0, 0, { x: 4, y: 3 }, 1, segs);   // much closer than tibia+tarsus minus femur (16)
  const len = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  assert.ok(len(j.foot, { x: 4, y: 3 }) < 1e-6, 'the foot reaches its spot');
  assert.ok(Math.abs(len(j.hip, j.knee) - 10) < 1e-6 && Math.abs(len(j.knee, j.ankle) - 16) < 1e-6 && Math.abs(len(j.ankle, j.foot) - 10) < 1e-6);
});

test('every walking insect keeps its planted feet on the spot in a crowd', async () => {
  const { auditCrowd } = await import('./helpers/legaudit.js');
  const { SPIDER_IDS } = await import('../src/lib/bugs/species/spider.js');
  // The silverfish's tiny legs step faster than frames are drawn (a blur), and the scolopendrid's ride its segments.
  const ids = Object.keys(SPECIES).filter(id => !SPIDER_IDS.includes(id) && !['silverfish', 'centipede'].includes(id));
  const r = auditCrowd(ids, { count: 30, seconds: 12, rng: seeded(21) });
  assert.ok(r.samples > 1000);
  assert.ok(r.slip99 < 1, `planted feet slipped ${r.slip99.toFixed(2)} px (99th percentile)`);
});

test('who takes fright at a touch follows soft rules: prey from predator, small from big, colony mates calmly', async () => {
  const { startleCandidate, startleChance, touchFear, sameColony } = await import('../src/lib/bugs/engine.js');
  const bug = (id, size, speed = 0) => Object.assign(createBug(id, { width: 800, height: 600, rng: seeded(1) }), { size, speed });
  // A yellowjacket hunts spiders: the spider takes fright though it is the bigger of the two.
  const wasp = bug('yellowjacket', 42), spider = bug('giantspider', 78);
  assert.equal(startleCandidate(wasp, spider), spider);
  assert.ok(touchFear(spider, wasp) > 0 && touchFear(wasp, spider) < 0);
  // No hunting between them: the smaller gives way, and a big gap startles more readily than a small one.
  const beetle = bug('beetle', 28), roach = bug('cockroach', 49), roach2 = bug('cockroach', 31);
  assert.equal(startleCandidate(beetle, roach), beetle);
  assert.ok(startleChance(beetle, roach) > startleChance(beetle, roach2));
  // Between near equals, the one walked into (the slower).
  const a = bug('cockroach', 49, 0), b = bug('cockroach', 49.5, 80);
  assert.equal(startleCandidate(a, b), a);
  // Colony mates jostle all the time: far less likely to take fright than strangers.
  const ant1 = bug('ant', 27), ant2 = bug('fieldant', 27.5), roachSmall = bug('cockroach', 27.5);
  assert.ok(sameColony(ant1, ant2) && !sameColony(ant1, roachSmall));
  assert.ok(startleChance(ant1, ant2) < startleChance(ant1, roachSmall) * 0.5);
});

test('insect legs flinch at a touch too', async () => {
  const { touchLegs } = await import('../src/lib/bugs/engine.js');
  const { recorder } = await import('./helpers/legaudit.js');
  const make = (seed, x, heading) => {
    const b = createBug('cockroach', { width: 800, height: 600, rng: seeded(seed) });
    Object.assign(b, { x, y: 300, heading, entered: true, delay: 0 });
    b.species.draw(recorder().ctx, b);
    b.rng = () => 0.99;
    return b;
  };
  const a = make(1, 300, Math.PI / 2), b = make(2, 300, -Math.PI / 2);   // side by side, facing opposite ways
  const reach = Math.max(...a.legPoses.map(p => Math.hypot(p.foot.x, p.foot.y))) * a.size / 100;
  b.x = 300 + reach * 1.2;
  for (let f = 0; f < 6; f++) touchLegs([a, b], [a, b], 1 / 60);
  assert.ok(a.recoil.some(r => r > 0.3) && b.recoil.some(r => r > 0.3), 'both cockroaches flinch');
  const before = a.legPoses.map(p => Math.hypot(p.foot.x - p.hip.x, p.foot.y - p.hip.y));
  a.species.draw(recorder().ctx, a);
  const after = a.legPoses.map(p => Math.hypot(p.foot.x - p.hip.x, p.foot.y - p.hip.y));
  const i = a.recoil.findIndex(r => r > 0.3);
  assert.ok(after[i] < before[i], 'the touched leg is drawn in');
});

test('a leg pressing on another bug\'s body counts as a touch: the leg flinches and the touched bug notices', async () => {
  const { touchLegs, bodyDiscs } = await import('../src/lib/bugs/engine.js');
  const { recorder } = await import('./helpers/legaudit.js');
  const place = (id, seed, x, y, heading) => {
    const b = createBug(id, { width: 800, height: 600, rng: seeded(seed) });
    Object.assign(b, { x, y, heading, entered: true, delay: 0, speed: 0 });
    b.species.draw(recorder().ctx, b);
    b.rng = () => 0;   // any chance of a fright comes up
    return b;
  };
  // An ant beside a bumble bee, close enough that its legs reach under the bee's body but not the bee's legs.
  const bee = place('easternbumblebee', 1, 300, 300, 0);
  const ant = place('fieldant', 2, 300, 300, 0);
  const world = (b, p) => ({ x: b.x + (p.x * Math.cos(b.heading) - p.y * Math.sin(b.heading)) * b.size / 100, y: b.y + (p.x * Math.sin(b.heading) + p.y * Math.cos(b.heading)) * b.size / 100 });
  let found = false;
  for (let dy = bee.size * 0.6; dy > 0 && !found; dy -= 0.5) {
    ant.y = 300 + dy;
    ant.species.draw(recorder().ctx, ant);
    const discs = bodyDiscs(bee);
    found = ant.legPoses.some(p => discs.some(d => Math.hypot(world(ant, p.foot).x - d.x, world(ant, p.foot).y - d.y) < d.r));
  }
  assert.ok(found, 'set up an ant foot on the bee');
  touchLegs([ant, bee], [ant, bee], 1 / 60);
  assert.ok(ant.recoil.some(r => r > 0), 'the ant\'s leg flinches');
  assert.equal(bee.bodyFree, 0, 'the bee feels it');
  assert.ok(ant.alarm > 0.5, 'and the smaller ant takes fright (chance forced)');
  // A centipede has no posed legs but its body can still be touched.
  const pede = place('centipede', 3, 500, 300, 0);
  touchLegs([pede], [pede], 1 / 60);
  assert.equal(pede.bodyFree, Infinity, 'nothing touching yet');
});

test('long legs get room from every bug: others keep clear of a crane fly, but a hunter still closes on its prey', async () => {
  const { roomBetween } = await import('../src/lib/bugs/engine.js');
  const make = id => createBug(id, { width: 800, height: 600, rng: seeded(2) });
  const crane = make('cranefly'), ant = make('ant'), ant2 = make('fieldant'), spider = make('spider'), fly = make('housefly');
  assert.ok(roomBetween(crane, ant) > crane.size, 'an ant keeps well clear of a crane fly\'s legs');
  assert.equal(roomBetween(ant, ant2), 0, 'short-legged bugs only keep their bodies apart');
  assert.ok(roomBetween(spider, fly) > 0);
  spider.hunt = { prey: fly };
  assert.equal(roomBetween(spider, fly), 0, 'a spider stalking a fly may close in');
});

test('a planted foot stays put on the ground while the body walks over it', async () => {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const b = createBug('beetle', { width: 800, height: 600, rng: seeded(12) });
  b.phaseL = b.phaseR = 0;
  b.moving = 0;
  const rest = { x: 10, y: 30 };
  const toWorld = f => b.x + (f.x * b.size) / 100;   // heading 0: body x axis = world x
  const start = gaitLib.footPosition(b, -1, rest, 0, 0.5, 1e9);
  const w0 = toWorld(start);
  for (let i = 0; i < 10; i++) {                       // walk 40% of a stride: still within stance
    const d = b.stridePx * 0.04;
    b.x += d;
    advanceGait(b, d, 0, 0);
    const f = gaitLib.footPosition(b, -1, rest, 0, 0.5, 1e9);
    assert.equal(f.lift, 0, 'foot stays down during stance');
    assert.ok(Math.abs(toWorld(f) - w0) < 1e-6, `foot slid ${toWorld(f) - w0}px`);
  }
});

test('swinging feet lift and move forward; IK keeps leg bones at their true lengths', () => {
  const b = createBug('ant', { width: 800, height: 600, rng: seeded(1) });
  b.phaseL = Math.PI * 2 * 0.75;                       // mid-swing with duty 0.5
  const f = gaitLib.footPosition(b, -1, { x: 0, y: 20 }, 0, 0.5, 1e9);
  assert.ok(f.lift > 0.9);
  const { knee, foot } = gaitLib.solveKnee(0, 0, 30, 5, 20, 22, 1);
  assert.ok(Math.abs(Math.hypot(knee.x, knee.y) - 20) < 1e-6);
  assert.ok(Math.abs(Math.hypot(foot.x - knee.x, foot.y - knee.y) - 22) < 1e-6);
  assert.ok(knee.y > 0, 'knee bends outward on the right side');
});

test('legs attach only to the thorax (cephalothorax for spiders, trunk for house centipedes), front to back', () => {
  for (const [id, sp] of Object.entries(SPECIES)) {
    if (id === 'centipede') continue;   // one pair per trunk segment; checked by its own renderer
    assert.ok(sp.anatomy, `${id} declares its leg-bearing section`);
    const { legSection: [lo, hi], hips } = sp.anatomy;
    assert.equal(hips.length, SPIDER_IDS.includes(id) ? 4 : id === 'housecentipede' ? 15 : 3, `${id} leg pairs`);
    for (const h of hips) assert.ok(h >= lo && h <= hi, `${id} hip at ${h} is outside ${lo}..${hi}`);
    const ordered = id === 'silverfish' ? hips.every((h, i) => !i || h > hips[i - 1]) : hips.every((h, i) => !i || h < hips[i - 1]);
    assert.ok(ordered, `${id} hips run front to back`);
  }
});

test('house centipede: direct wave (rear legs lead), sides alternate, last pair trails', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/lib/bugs/species/housecentipede.js', import.meta.url), 'utf8');
  assert.match(src, /i \* WAVE_LAG/, 'offset grows toward the rear so the ripple runs tail to head');
  assert.match(src, /side > 0 \? 0\.5 : 0/, 'left and right legs of a pair half a cycle apart');
  assert.match(src, /trailing: i === PAIRS - 1/);
});

test('weighted picking follows the sliders', async () => {
  const { pickWeighted } = await import('../src/lib/bugs/engine.js');
  const rng = seeded(77);
  const counts = { ant: 0, spider: 0 };
  for (let i = 0; i < 22000; i++) counts[pickWeighted(['ant', 'spider'], { ant: 10, spider: 1 }, rng)]++;
  const ratio = counts.ant / counts.spider;
  assert.ok(ratio > 8 && ratio < 12, `ant:spider ratio ${ratio.toFixed(2)} should be about 10`);
  for (let i = 0; i < 50; i++) assert.equal(pickWeighted(['beetle'], { beetle: 3 }, rng), 'beetle');
  assert.ok(['ant', 'spider'].includes(pickWeighted(['ant', 'spider'], undefined, rng)), 'no weights = even odds');
  const swarm = new Swarm({ species: ['ant', 'spider'], count: 20, width: 800, height: 600, weights: { ant: 10, spider: 1 }, rng: seeded(5) });
  assert.ok(swarm.bugs.filter(b => b.species.id === 'ant').length > 12, 'swarm mostly made of the heavier species');
});

// Circling = covering lots of ground without getting anywhere. Checked over 4 s windows of
// uninterrupted walking (pauses, grooming and waggle dances reset the window).
function circlingEpisodes(swarm, seconds) {
  const track = swarm.bugs.map(b => ({ x: b.x, y: b.y, sx: b.x, sy: b.y, path: 0, clean: true, t: 0 }));
  let episodes = 0;
  for (let t = 0; t < seconds && !swarm.done; t += 1 / 30) {
    swarm.update(1 / 30);
    swarm.bugs.forEach((b, i) => {
      const k = track[i];
      if (b.done || b.delay > 0) return;
      k.path += Math.hypot(b.x - k.x, b.y - k.y);
      k.x = b.x; k.y = b.y; k.t += 1 / 30;
      if (b.paused || b.dance) k.clean = false;
      if (k.t >= 4) {
        const disp = Math.hypot(b.x - k.sx, b.y - k.sy);
        if (k.clean && k.path > b.size * 6 && disp < k.path * 0.2) episodes++;
        Object.assign(k, { sx: b.x, sy: b.y, path: 0, clean: true, t: 0 });
      }
    });
  }
  return episodes;
}

test('fast bugs in huge windows never get stuck circling', () => {
  for (const [w, h] of [[3840, 2160], [7680, 4320]]) {
    for (const id of Object.keys(SPECIES)) {
      for (let seed = 1; seed <= 4; seed++) {
        const swarm = new Swarm({ species: [id], count: 2, width: w, height: h, speed: 2.5, rng: seeded(seed * 13) });
        assert.equal(circlingEpisodes(swarm, 60), 0, `${id} seed ${seed} circled in a ${w}x${h} window`);
      }
    }
  }
});

test('even the slowest bug eventually leaves a 4K window at max speed', () => {
  for (const id of Object.keys(SPECIES)) {
    const swarm = new Swarm({ species: [id], count: 2, width: 3840, height: 2160, speed: 2.5, rng: seeded(29) });
    let t = 0;
    while (!swarm.done && t < 180) { swarm.update(1 / 30); t += 1 / 30; }
    assert.ok(swarm.done, `${id} still on screen after 180 s`);
  }
});

test('resizing the window keeps routes inside the new window', () => {
  const swarm = new Swarm({ species: ['cockroach'], count: 3, width: 800, height: 600, rng: seeded(3) });
  for (let i = 0; i < 30; i++) swarm.update(1 / 30);
  const before = swarm.bugs.map(b => b.waypoints.map(w => ({ ...w })));
  swarm.resize(3200, 1800);
  swarm.bugs.forEach((b, i) => b.waypoints.forEach((w, j) => {
    assert.ok(Math.abs(w.x - before[i][j].x * 4) < 1e-6 && Math.abs(w.y - before[i][j].y * 3) < 1e-6);
  }));
  let t = 0;
  while (!swarm.done && t < 120) { swarm.update(1 / 30); t += 1 / 30; }
  assert.ok(swarm.done);
});

test('walking pace varies: smooth surges and dawdles plus occasional darts', async () => {
  const { paceFactor } = await import('../src/lib/bugs/engine.js');
  const sample = id => {
    const b = createBug(id, { width: 800, height: 600, rng: seeded(id.length * 7) });
    b.entered = true;
    const f = [];
    let darts = 0, inDart = false;
    for (let i = 0; i < 30 * 120; i++) {
      b.t += 1 / 30;
      f.push(paceFactor(b, 1 / 30));
      if (b.dartTime > 0 && !inDart) darts++;
      inDart = b.dartTime > 0;
    }
    return { min: Math.min(...f), max: Math.max(...f), darts };
  };
  const roach = sample('cockroach'), beetle = sample('beetle'), stink = sample('stinkbug');
  assert.ok(roach.min < 0.85 && roach.max > 1.5, `cockroach pace ranged ${roach.min.toFixed(2)}..${roach.max.toFixed(2)}`);
  assert.ok(roach.darts >= 10, `cockroach darted ${roach.darts} times in 2 min`);
  assert.ok(beetle.darts < roach.darts / 3, 'beetles dart far less than cockroaches');
  assert.ok(stink.max < 1.5, 'stink bugs plod: no big surges');
  for (const id of Object.keys(SPECIES)) {
    const { min, max } = sample(id);
    assert.ok(min > 0.5 && max <= 2.6, `${id} pace stays sane (${min.toFixed(2)}..${max.toFixed(2)})`);
  }
});

// Places a bug at (x, y) walking straight toward (tx, ty), already on screen.
function placed(id, x, y, tx, ty, rng) {
  const b = createBug(id, { width: 1280, height: 800, rng, speed: 1 });
  Object.assign(b, { x, y, heading: Math.atan2(ty - y, tx - x), entered: true, waypoints: [{ x: tx, y: ty }, { x: tx * 2, y: ty }] });
  return b;
}

test('bugs from different swarms steer round each other instead of walking through', () => {
  const crowd = new Set();
  const rng = seeded(5);
  const a = new Swarm({ species: ['cockroach'], count: 1, width: 1280, height: 800, rng, crowd });
  const b = new Swarm({ species: ['cockroach'], count: 1, width: 1280, height: 800, rng, crowd });
  a.bugs[0] = placed('cockroach', 300, 400, 1000, 400, () => 0.3);
  b.bugs[0] = placed('cockroach', 1000, 400, 300, 400, () => 0.3);
  const [p, q] = [a.bugs[0], b.bugs[0]];
  let closest = Infinity, passed = false;
  for (let t = 0; t < 15 && !passed; t += 1 / 60) {
    a.update(1 / 60);
    b.update(1 / 60);
    closest = Math.min(closest, Math.hypot(p.x - q.x, p.y - q.y));
    passed = p.x > 800 && q.x < 500;
  }
  assert.ok(passed, 'both carried on past each other');
  assert.ok(closest > (p.size + q.size) * 0.4, `closest approach ${closest.toFixed(1)} px for bugs ${p.size.toFixed(0)}/${q.size.toFixed(0)} px long`);
});

test('without a shared crowd the same pair would collide (avoidance is what keeps them apart)', () => {
  const p = placed('cockroach', 300, 400, 1000, 400, () => 0.3);
  const q = placed('cockroach', 1000, 400, 300, 400, () => 0.3);
  let closest = Infinity;
  for (let t = 0; t < 15; t += 1 / 60) {
    stepBug(p, 1 / 60, 1280, 800);
    stepBug(q, 1 / 60, 1280, 800);
    closest = Math.min(closest, Math.hypot(p.x - q.x, p.y - q.y));
  }
  assert.ok(closest < (p.size + q.size) * 0.3);
});

test('ants meeting head on stop face to face, wiggle antennae, then go their ways', () => {
  const p = placed('ant', 500, 400, 800, 400, () => 0.1);
  const q = placed('ant', 538, 400, 200, 400, () => 0.1);
  const others = [p, q];
  let met = false, stoppedTogether = false, parted = false, closest = Infinity;
  const { ctx } = mockCanvas();
  for (let t = 0; t < 20; t += 1 / 60) {
    stepBug(p, 1 / 60, 1280, 800, others);
    stepBug(q, 1 / 60, 1280, 800, others);
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    closest = Math.min(closest, d);
    if (p.meet && q.meet) {
      met = true;
      assert.equal(p.meet.partner, q);
      if (p.speed < 3 && q.speed < 3 && d < (p.size + q.size) * 0.6) {
        stoppedTogether = true;
        assert.ok(Math.cos(p.heading - q.heading) < -0.7, 'facing each other');
        SPECIES.ant.draw(ctx, p);
      }
    }
    if (met && !p.meet && !q.meet) parted = true;
  }
  assert.ok(met && stoppedTogether && parted, JSON.stringify({ met, stoppedTogether, parted }));
  // Ant bodies are under 0.3 body lengths wide, so this clearance means no overlap even when passing side by side.
  assert.ok(closest > (p.size + q.size) * 0.25, `heads touch but bodies do not overlap (closest ${closest.toFixed(1)} px)`);
  assert.ok(p.meetCooldown > 0 || p.x > 700, 'no immediate re-greeting');
});

test('flies: twelve kinds in their own group, the house fly among them at a female\'s size', async () => {
  const { FLY_BREEDS, FLY_IDS, flyPlan } = await import('../src/lib/bugs/species/flies.js');
  const { REAL_LENGTH_MM } = await import('../src/lib/bugs/lifesize.js');
  assert.equal(FLY_IDS.length, 12);
  for (const id of FLY_IDS) assert.equal(BUG_SPECIES.find(s => s.id === id)?.group, 'Flies', id);
  assert.ok(FLY_IDS.includes('housefly'), 'the house fly keeps its id, so saved settings carry over');
  const { validate } = await import('../src/lib/settings.js');
  assert.deepEqual(validate({ bugs: { species: ['housefly', 'ant'] } }).bugs.species, ['housefly', 'ant']);
  const [lo, hi] = REAL_LENGTH_MM.housefly;
  assert.ok(lo < 7 && hi > 7, 'a female house fly, about 7 mm');
  // Varied in look: no two kinds share the same proportions, colours, markings and wing pose.
  const looks = new Set(FLY_BREEDS.map(b => JSON.stringify([b.head, b.thorax, b.abdomen, b.abdomenColors, b.abdomenMark, b.wing.spread, b.wing.pattern])));
  assert.equal(looks.size, 12);
  for (const b of FLY_BREEDS) assert.ok(flyPlan(b).length > 40, `${b.id} has a body`);
});

test('fly legs are posed in 3D like a spider\'s: knees flex through a stride but never fold shut or lock straight', async () => {
  const { FLY_IDS } = await import('../src/lib/bugs/species/flies.js');
  const { recorder } = await import('./helpers/legaudit.js');
  const ang = (p, a, c) => {
    const u = [a.x - p.x, a.y - p.y, a.z - p.z], v = [c.x - p.x, c.y - p.y, c.z - p.z];
    return Math.acos((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(...u) / Math.hypot(...v)) * 180 / Math.PI;
  };
  for (const id of FLY_IDS) {
    const b = createBug(id, { width: 800, height: 600, rng: seeded(5) });
    Object.assign(b, { x: NaN, heading: 0, size: 100, stridePx: (b.stridePx * 100) / b.size, light: { x: -0.45, y: -0.65 }, moving: 1 });
    let lo = 180, hi = 0;
    for (let k = 0; k < 96; k++) {
      b.phaseL = b.phaseR = (k / 96) * 2 * Math.PI;
      SPECIES[id].draw(recorder().ctx, b);
      assert.equal(b.legPoses.length, 6);
      for (const p of b.legPoses) { assert.ok(p.knee.z > p.hip.z, `${id}: knee above the hip`); const a = ang(p.knee, p.hip, p.ankle); lo = Math.min(lo, a); hi = Math.max(hi, a); }
    }
    assert.ok(lo > 30 && hi < 162, `${id}: knee ranges ${lo.toFixed(0)}-${hi.toFixed(0)} deg`);
  }
});

test('flies are prey to spiders, centipedes and yellowjackets; robber flies hunt other flies and bees', async () => {
  const { danger } = await import('../src/lib/bugs/ecology.js');
  const { FLY_IDS } = await import('../src/lib/bugs/species/flies.js');
  const as = id => ({ species: SPECIES[id] });
  for (const fly of FLY_IDS) {
    for (const hunter of ['spider', 'crabspider', 'housecentipede', 'centipede', 'yellowjacket']) assert.ok(danger(as(hunter), as(fly)) > 0, `${hunter} hunts ${fly}`);
    if (fly !== 'robberfly') assert.ok(danger(as('robberfly'), as(fly)) > 0, `robber flies hunt ${fly}`);
  }
  assert.equal(danger(as('robberfly'), as('robberfly')), 0, 'not each other');
  assert.ok(danger(as('robberfly'), as('italianbee')) > 0 && danger(as('robberfly'), as('easternbumblebee')) > 0);
  assert.ok(SPECIES.housefly.nerves > 1, 'house flies take fright sooner than most');
});

test('only ants greet each other; other bugs just give way', () => {
  assert.ok(SPECIES.ant.greets);
  assert.ok(Object.values(SPECIES).filter(s => s.greets).every(s => ANT_IDS.includes(s.id)));
  const p = placed('beetle', 500, 400, 800, 400, () => 0.1);
  const q = placed('beetle', 560, 400, 200, 400, () => 0.1);
  for (let t = 0; t < 10; t += 1 / 60) {
    stepBug(p, 1 / 60, 1280, 800, [p, q]);
    stepBug(q, 1 / 60, 1280, 800, [p, q]);
    assert.equal(p.meet, null);
  }
});


test('settings-page previews stroll at an unhurried pace with steps scaled to the magnified body', async () => {
  const { createPreviewBug, drawPreview, PREVIEW_PACE } = await import('../src/lib/bugs/preview.js');
  for (const id of Object.keys(SPECIES)) {
    const bug = createPreviewBug(id);
    assert.equal(bug.speedScale, 1, `${id} previews at 1x regardless of the crawl speed setting`);
    const real = bug.size, stride = bug.stridePx;
    let drawnSize, drawnStride;
    const spy = SPECIES[id].draw;
    SPECIES[id].draw = (ctx, b) => { drawnSize = b.size; drawnStride = b.stridePx; };
    try { drawPreview({}, bug, 1 / 60, 160, 118); } finally { SPECIES[id].draw = spy; }
    assert.equal(drawnSize, SPECIES[id].previewSize);
    assert.ok(Math.abs(drawnStride / drawnSize - stride / real) < 1e-9, `${id} stride keeps its proportion to the body`);
    assert.equal(bug.size, real, 'true size restored for the next step');
    const { ctx } = mockCanvas();
    for (let i = 0; i < 30; i++) drawPreview(ctx, bug, 1 / 60, 160, 118);
    // Slower than the bug ever walks on a page, even at 1x, and with no darts.
    assert.ok(bug.speed > 0 && bug.speed <= SPECIES[id].speed[0] * PREVIEW_PACE * 1.4, `${id} preview pace ${bug.speed.toFixed(0)} px/s`);
    assert.ok(!(bug.dartTime > 0), `${id} never darts in the preview`);
    // Both sides step forward together at the same steady rate (no turning on the spot).
    const l0 = bug.phaseL, r0 = bug.phaseR;
    for (let i = 0; i < 60; i++) {
      const l = bug.phaseL, r = bug.phaseR;
      drawPreview(ctx, bug, 1 / 60, 160, 118);
      assert.ok(bug.phaseL > l && bug.phaseR > r, `${id} legs never step backwards`);
    }
    assert.ok(Math.abs((bug.phaseL - l0) - (bug.phaseR - r0)) < 1e-6, `${id} left and right sides keep the same pace`);
  }
});

test('legs pivot at the body edge: the visible joint stays put while the leg walks', async () => {
  const { walkLeg, bodyEdge } = await import('../src/lib/bugs/common.js');
  const starts = [];
  const ctx = new Proxy({}, { get: (t, k) => k === 'moveTo' ? (x, y) => starts.push([x, y]) : () => {}, set: () => true });
  const bug = { size: 40, stridePx: 10, phaseL: 0, phaseR: 0 };
  const segs = [[20, 0, 3], [22, 0.4, 2.4], [11, 0.25, 1.6]];
  const edge = bodyEdge(12, [[12, 14, 6.5]]) - 3;
  const bases = new Set();
  for (let i = 0; i < 40; i++) {
    bug.phaseL = (i / 40) * 2 * Math.PI;
    starts.length = 0;
    const foot = walkLeg(ctx, bug, { hx: 12, hy: -3, side: -1, angle: 1.6, segs, offset: 0, duty: 0.5, color: '#000', edge });
    bases.add(starts[0].map(v => v.toFixed(6)).join());
    assert.ok(Math.abs(foot.py) > 3 && Math.abs(foot.py) <= 6.5, 'pivot sits just inside the outline, not deep under the body');
    assert.ok(foot.segs[0][0] < segs[0][0], 'hidden part of the femur is left out');
  }
  assert.equal(bases.size, 1, 'femur always starts from the same point on the body');
});

test('every species: each leg leaves the body at a fixed point while it walks', async () => {
  const { auditSpecies } = await import('./helpers/legaudit.js');
  for (const id of Object.keys(SPECIES)) {
    for (const [turnMix, speedScale] of [[0, 1], [0.6, 1], [0, 0.4]]) {
      auditSpecies(id, { frames: 24, turnMix, speedScale }).forEach((l, i) => {
        assert.ok(l.slide <= 0.8, `${id} leg ${i} (turn ${turnMix}, speed ${speedScale}): joint slides ${l.slide.toFixed(2)} units along the body`);
      });
    }
  }
});

test('a leg mostly hidden under the body keeps a femur stub and stands from its pivot', async () => {
  const { legPivot } = await import('../src/lib/bugs/common.js');
  const segs = [[16, 0, 3], [16, 0.4, 2.4], [8, 0.2, 1.6]];
  const deep = legPivot(9, 1, segs, 15);
  assert.equal(deep.py, 24, 'pivot sits on the outline');
  assert.ok(deep.stub && deep.segs[0][0] === 16 * 0.35);
  const shallow = legPivot(-9, -1, segs, 4);
  assert.equal(shallow.py, -13);
  assert.ok(!shallow.stub && shallow.segs[0][0] === 12);
});

test('every species tells its walking legs where the body edge is', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const dir = new URL('../src/lib/bugs/species/', import.meta.url);
  for (const f of await readdir(dir)) {
    const src = await readFile(new URL(f, dir), 'utf8');
    for (const call of src.match(/walkLeg(?:3D)?\((?:ctx, )?bug, \{[^}]*/g) ?? []) assert.match(call, /\bedge:/, `${f}: ${call.slice(0, 60)}`);
  }
});

// Walks a bug along a path of (dist, turn) steps and reports the worst ground slip of any planted foot.
async function plantedSlip(id, steps, rests) {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const b = createBug(id, { width: 800, height: 600, rng: seeded(21) });
  Object.assign(b, { x: 400, y: 300, heading: 0.4, moving: 0 });
  const world = f => {
    const k = b.size / 100, c = Math.cos(b.heading), s = Math.sin(b.heading);
    return { x: b.x + (f.x * c - f.y * s) * k, y: b.y + (f.x * s + f.y * c) * k };
  };
  const step = (dist, turn) => {
    const chord = turn ? dist * Math.sin(turn / 2) / (turn / 2) : dist;   // exact arc of length dist
    b.heading += turn / 2;
    b.x += Math.cos(b.heading) * chord;
    b.y += Math.sin(b.heading) * chord;
    b.heading += turn / 2;
    advanceGait(b, dist, turn, 0);
  };
  for (let i = 0; i < 600; i++) step(...steps(i));     // settle into the motion (stride direction eases in)
  let worst = 0, planted = 0;
  const prev = new Map();
  for (let i = 600; i < 1000; i++) {
    step(...steps(i));
    for (const [j, r] of rests.entries()) {
      const f = gaitLib.footPosition(b, r.side, r, r.offset, 0.5, 1e9);
      const w = world(f), p = prev.get(j);
      if (f.lift === 0 && p) { worst = Math.max(worst, Math.hypot(w.x - p.x, w.y - p.y)); planted++; }
      prev.set(j, f.lift === 0 ? w : null);
    }
  }
  return { worst, planted };
}

test('turning on the spot: every planted foot stays put on the ground (no turntable)', async () => {
  for (const turn of [0.02, -0.03]) {
    const { worst, planted } = await plantedSlip('cockroach', () => [0, turn], FEET);
    assert.ok(planted > 500, 'feet spend time planted while pivoting');
    assert.ok(worst < 1e-6, `planted foot slid ${worst}px in a frame while pivoting ${turn}`);
  }
});

test('walking round a curve: planted feet stay put, front and hind ones included', async () => {
  for (const [dist, turn] of [[1.5, 0.02], [0.4, -0.04], [3, 0.005]]) {
    const { worst } = await plantedSlip('spider', () => [dist, turn], FEET);
    assert.ok(worst < 1e-6, `planted foot slid ${worst}px a frame (dist ${dist}, turn ${turn})`);
  }
});

test('pivoting feet step round the body: front and hind feet move sideways, not just fore and aft', async () => {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const b = createBug('ant', { width: 800, height: 600, rng: seeded(3) });
  for (let i = 0; i < 30; i++) advanceGait(b, 0, 0.02);
  const front = gaitLib.strideDirection(b, -1, { x: 45, y: -30 });
  const hind = gaitLib.strideDirection(b, -1, { x: -40, y: -35 });
  assert.ok(front.y > 0.3 && hind.y < -0.3, `front ${front.y.toFixed(2)}, hind ${hind.y.toFixed(2)}: opposite sideways steps`);
  for (let i = 0; i < 200; i++) advanceGait(b, 2, 0);
  const straight = gaitLib.strideDirection(b, -1, { x: 45, y: -30 });
  assert.ok(Math.abs(straight.x - 1) < 1e-3 && Math.abs(straight.y) < 1e-3, 'walking straight strides straight ahead again');
});

test('centipedes only turn while walking, never swivelling the head over a still body', () => {
  const b = createBug('centipede', { width: 800, height: 600, rng: seeded(8) });
  Object.assign(b, { x: 400, y: 300, entered: true, heading: 0 });
  b.waypoints = [{ x: 400, y: 600 }, { x: 400, y: 900 }];
  let maxRate = 0;
  for (let i = 0; i < 120; i++) {
    const h0 = b.heading, x0 = b.x, y0 = b.y;
    stepBug(b, 1 / 60, 800, 600);
    const moved = Math.hypot(b.x - x0, b.y - y0);
    const turned = Math.abs(Math.atan2(Math.sin(b.heading - h0), Math.cos(b.heading - h0)));
    if (turned > 0) maxRate = Math.max(maxRate, turned / Math.max(moved, 1e-9));
  }
  assert.ok(Math.abs(b.heading) > 0.5, 'still turns toward its goal');
  assert.ok(maxRate <= 1 / (b.size * 0.25) + 1e-9, `turned ${maxRate.toFixed(3)} rad per px walked`);
});

test('in a crowd, walking bugs turn along arcs instead of pivoting; only stopped bugs turn on the spot', () => {
  const ids = Object.keys(SPECIES);
  const sw = new Swarm({ species: ids, count: 60, width: 1600, height: 900, rng: seeded(31) });
  let walkingTurn = 0, tight = 0;
  for (let f = 0; f < 60 * 20; f++) {
    const prev = sw.bugs.map(b => ({ h: b.heading, x: b.x, y: b.y, still: b.paused || b.meet || b.attend || b.veer > 0 }));   // greeting or tending: squaring up
    sw.update(1 / 60);
    sw.bugs.forEach((b, i) => {
      const p = prev[i];
      if (b.done || b.delay > 0 || p.still || b.veer > 0 || b.paused || b.hemmed > 0 || b.alarm > 0.15 || b.dance || b.loosen || b.attend) return;   // held up, sidestepping, startled, dancing or buzzing loose: may turn tightly
      const t = Math.abs(Math.atan2(Math.sin(b.heading - p.h), Math.cos(b.heading - p.h)));
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      const minR = b.size * (b.species.trail ? 0.25 : 0.5);
      walkingTurn += t;
      if (t > 0 && d < t * minR * 0.99) tight += t;
    });
  }
  assert.ok(walkingTurn > 10, 'bugs turned plenty while walking');
  assert.equal(tight, 0, `${tight.toFixed(3)} rad of walking turns were tighter than the minimum turning circle`);
});

test('a paused bug ignores passers-by instead of swivelling to dodge them', () => {
  const b = createBug('spider', { width: 800, height: 600, rng: seeded(9) });
  Object.assign(b, { x: 400, y: 300, entered: true, paused: true, stateTime: 5, speed: 0, heading: 0 });
  b.waypoints = [{ x: 800, y: 300 }, { x: 900, y: 300 }];        // already facing its goal
  const passer = createBug('beetle', { width: 800, height: 600, rng: seeded(10) });
  Object.assign(passer, { x: 420, y: 305, entered: true, delay: 0 });
  for (let i = 0; i < 60; i++) stepBug(b, 1 / 60, 800, 600, [b, passer]);
  assert.ok(Math.abs(b.heading) < 1e-3, `turned ${b.heading.toFixed(3)} rad while resting`);
});

test('a resting bug leaves small corrections for walking: it only turns on the spot for a goal behind it', () => {
  for (const id of Object.keys(SPECIES)) {
    const b = createBug(id, { width: 800, height: 600, rng: seeded(6) });
    Object.assign(b, { x: 400, y: 300, entered: true, paused: true, stateTime: 5, speed: 0, heading: 0 });
    b.waypoints = [{ x: 400, y: 0 }, { x: 400, y: -500 }];   // 90 degrees off
    for (let i = 0; i < 60; i++) stepBug(b, 1 / 60, 800, 600);
    assert.equal(b.heading, 0, `${id} swivelled ${b.heading.toFixed(3)} rad at rest for a 90 degree correction`);
  }
});

test('backing up: planted feet stay put and swinging feet step rearward', async () => {
  for (const [dist, turn] of [[-0.6, 0], [-0.5, 0.01], [-0.4, -0.015]]) {
    const { worst, planted } = await plantedSlip('cockroach', () => [dist, turn], FEET);
    assert.ok(planted > 500, 'feet spend time planted while backing');
    assert.ok(worst < 1e-6, `planted foot slid ${worst}px a frame backing (dist ${dist}, turn ${turn})`);
  }
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const b = createBug('beetle', { width: 800, height: 600, rng: seeded(14) });
  const l0 = b.phaseL;
  advanceGait(b, -1, 0);
  assert.ok(b.phaseL < l0, 'gait runs in reverse');
});

test('no leg snaps when a bug stops, backs up and walks on again', async () => {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const gaitLib = await import('../src/lib/bugs/common.js');
  const b = createBug('ant', { width: 800, height: 600, rng: seeded(15) });
  let prev = null, worst = 0, straight = 0;
  for (let i = 0; i < 1500; i++) {
    const dist = 0.35 + 0.65 * Math.cos(i / 60);        // forward 1 .. back 0.3, crossing zero smoothly
    advanceGait(b, dist, 0.004 * Math.sin(i / 90), 0);
    const now = FEET.map(r => gaitLib.footPosition(b, r.side, r, r.offset, 0.5, 1e9));
    if (prev) for (const [j, f] of now.entries()) {
      const d = Math.hypot(f.x - prev[j].x, f.y - prev[j].y);
      worst = Math.max(worst, d);
      if (dist > 0.95) straight = Math.max(straight, d);
    }
    prev = now;
  }
  assert.ok(worst < straight * 1.5, `a foot jumped ${worst.toFixed(2)} units in a frame (walking swing ${straight.toFixed(2)})`);
});

test('a bug out in the open never backs up', () => {
  for (const id of Object.keys(SPECIES)) {
    const b = createBug(id, { width: 1600, height: 900, rng: seeded(41) });
    for (let f = 0; f < 60 * 20 && !b.done; f++) {
      const x0 = b.x, y0 = b.y;
      stepBug(b, 1 / 60, 1600, 900, [b]);
      const along = (b.x - x0) * Math.cos(b.heading) + (b.y - y0) * Math.sin(b.heading);
      assert.ok(along > -1e-6, `${id} backed up with nothing in its way`);
    }
  }
});

test('a bug whose way is blocked by another body backs up a little (ants only a shuffle), centipedes never', () => {
  for (const id of Object.keys(SPECIES)) {
    let backedMax = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const b = createBug(id, { width: 800, height: 600, rng: seeded(seed) });
      const wall = createBug('beetle', { width: 800, height: 600, rng: seeded(seed + 50) });
      Object.assign(b, { x: 300, y: 300, heading: 0, entered: true, speed: b.cruise });
      b.species = { ...b.species, pauseRate: 0, maxTurn: 0 };   // can't steer round, so it stays held up
      b.waypoints = [{ x: 700, y: 300 }, { x: 900, y: 300 }];
      Object.assign(wall, { x: 300 + (b.size + wall.size) * 0.45, y: 300, heading: Math.PI / 2, entered: true, paused: true, stateTime: 99, speed: 0 });
      wall.species = { ...wall.species, pauseRate: 0 };
      let run = 0;
      for (let f = 0; f < 60 * 4; f++) {
        const x0 = b.x, y0 = b.y;
        stepBug(b, 1 / 60, 800, 600, [b, wall]);
        wall.stateTime = 99;
        const along = (b.x - x0) * Math.cos(b.heading) + (b.y - y0) * Math.sin(b.heading);
        run = along < -1e-6 ? run - along : 0;
        backedMax = Math.max(backedMax, run / b.size);
      }
    }
    if (SPECIES[id].trail) assert.equal(backedMax, 0, `${id} backed up`);
    else {
      assert.ok(backedMax > 0, `${id} never backed away from a blocked path`);
      assert.ok(backedMax < (ANT_IDS.includes(id) ? 0.2 : 0.4), `${id} backed ${backedMax.toFixed(2)} body lengths: should be a little`);
    }
  }
});

// Body overlap between two bugs: true when any of their body discs sink well into each other.
async function deepOverlap(a, b) {
  const { bodyDiscs } = await import('../src/lib/bugs/engine.js');
  for (const m of bodyDiscs(a)) for (const t of bodyDiscs(b)) if (Math.hypot(t.x - m.x, t.y - m.y) < (m.r + t.r) * 0.6) return true;
  return false;
}

test('bugs never walk over each other: bodies stay apart in a dense crowd', async () => {
  const ids = Object.keys(SPECIES);
  let checked = 0;
  for (const seed of [3, 4]) {
    const sw = new Swarm({ species: ids, count: 80, width: 1400, height: 800, rng: seeded(seed) });
    for (let f = 0; f < 60 * 15; f++) {
      sw.update(1 / 60);
      if (f % 3) continue;
      const live = sw.bugs.filter(b => !b.done && b.delay <= 0 && b.entered && !b.species.trail);   // a centipede's body follows its head
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        checked++;
        assert.ok(!(await deepOverlap(live[i], live[j])), `${live[i].species.id} and ${live[j].species.id} overlap at frame ${f}`);
      }
    }
  }
  assert.ok(checked > 10000);
});

test('two bugs walking straight at each other stop or step round instead of passing through', async () => {
  const a = createBug('cockroach', { width: 800, height: 600, rng: seeded(51) });
  const b = createBug('beetle', { width: 800, height: 600, rng: seeded(52) });
  Object.assign(a, { x: 200, y: 300, heading: 0, entered: true });
  Object.assign(b, { x: 600, y: 300, heading: Math.PI, entered: true });
  a.waypoints = [{ x: 700, y: 300 }, { x: 900, y: 300 }];
  b.waypoints = [{ x: 100, y: 300 }, { x: -100, y: 300 }];
  for (let f = 0; f < 60 * 6; f++) {
    stepBug(a, 1 / 60, 800, 600, [a, b]);
    stepBug(b, 1 / 60, 800, 600, [a, b]);
    assert.ok(!(await deepOverlap(a, b)), `bodies overlap at frame ${f}`);
  }
  assert.ok(a.x > 450 && b.x < 350, 'both still get past each other');
});

test('a new bug waits to set off until its spawn spot is clear', async () => {
  const a = createBug('beetle', { width: 800, height: 600, rng: seeded(61) });
  const b = createBug('beetle', { width: 800, height: 600, rng: seeded(61), delay: 0.01 });
  Object.assign(a, { paused: true, stateTime: 1, speed: 0 });
  stepBug(b, 1 / 60, 800, 600, [a, b]);
  assert.ok(b.delay > 0, 'still waiting while another bug stands where it would appear');
});

test('ants sometimes follow another ant\'s scent trail to the same goal, steering along it', () => {
  let tried = 0, joined = 0, followed = 0, off = 0, adopted = 0;
  const strengths = new Set();
  for (let seed = 72; seed < 102; seed++) {
    const leader = createBug('ant', { width: 1200, height: 800, rng: seeded(71) });
    Object.assign(leader, { x: 100, y: 400, heading: 0, entered: true, affinity: 0 });
    leader.species = { ...leader.species, pauseRate: 0 };
    leader.waypoints = [{ x: 600, y: 250 }, { x: 1100, y: 500 }, { x: 1400, y: 500 }];
    for (let f = 0; f < 120; f++) stepBug(leader, 1 / 60, 1200, 800, [leader]);
    const ant = createBug('ant', { width: 1200, height: 800, rng: seeded(seed) });
    Object.assign(ant, { x: 100, y: 400 + leader.size * 0.5, heading: 0, entered: true, affinity: 1 });
    ant.species = { ...ant.species, pauseRate: 0 };
    ant.waypoints = [{ x: 900, y: 450 }, { x: 1300, y: 900 }];    // its own route runs roughly the same way
    tried++;
    let was = false;
    for (let f = 0; f < 60 * 6; f++) {
      stepBug(leader, 1 / 60, 1200, 800, [leader, ant]);
      stepBug(ant, 1 / 60, 1200, 800, [leader, ant]);
      if (!ant.follow) continue;
      if (!was) { joined++; was = true; }
      followed++;
      strengths.add(ant.follow.strength.toFixed(2));
      off += Math.min(...leader.scent.map(m => Math.hypot(m.x - ant.x, m.y - ant.y))) / ant.size;
    }
    if (was && ant.waypoints.at(-1).x === 1400) adopted++;
  }
  assert.ok(joined >= 3 && joined < tried, `${joined} of ${tried} keen ants picked up the trail: sometimes, not always`);
  assert.equal(adopted, joined, 'followers adopt the leader\'s goal');
  assert.ok(off / followed < 0.5, `strayed ${(off / followed).toFixed(2)} body lengths from the trail on average`);
  assert.ok(strengths.size > 10, 'how keenly they follow varies continuously, not on/off');
});

test('only ants lay or follow scent, and ants with no taste for it never follow', () => {
  const ids = Object.keys(SPECIES);
  const sw = new Swarm({ species: ids, count: 60, width: 1400, height: 800, rng: seeded(81) });
  for (const b of sw.bugs) if (ANT_IDS.includes(b.species.id) && b.variant < 0.3) b.affinity = 0;
  for (let f = 0; f < 60 * 20; f++) {
    sw.update(1 / 60);
    for (const b of sw.bugs) {
      if (!ANT_IDS.includes(b.species.id)) {
        assert.equal(b.scent, null, `${b.species.id} lays scent`);
        assert.equal(b.follow, null, `${b.species.id} follows a trail`);
      } else if (b.follow) {
        assert.equal(b.follow.leader.species.id, b.species.id, 'ants follow only their own kind');
        assert.ok(b.affinity > 0, 'an ant with no affinity followed a trail');
      }
    }
  }
});

test('a trail-following ant closes up behind the ant it follows instead of hanging back', () => {
  let closeFrames = 0, followFrames = 0;
  for (let seed = 72; seed < 102; seed++) {
    const leader = createBug('ant', { width: 1600, height: 800, rng: seeded(71) });
    Object.assign(leader, { x: 100, y: 400, heading: 0, entered: true, affinity: 0, cruise: 60 });
    leader.species = { ...leader.species, pauseRate: 0, greets: false };
    leader.waypoints = [{ x: 800, y: 300 }, { x: 1500, y: 450 }, { x: 1800, y: 450 }];
    for (let f = 0; f < 90; f++) stepBug(leader, 1 / 60, 1600, 800, [leader]);
    const ant = createBug('ant', { width: 1600, height: 800, rng: seeded(seed) });
    Object.assign(ant, { x: 100, y: 410, heading: 0, entered: true, affinity: 1 });
    ant.species = { ...ant.species, pauseRate: 0, greets: false };
    ant.waypoints = [{ x: 900, y: 450 }, { x: 1300, y: 900 }];
    for (let f = 0; f < 60 * 8; f++) {
      stepBug(leader, 1 / 60, 1600, 800, [leader, ant]);
      stepBug(ant, 1 / 60, 1600, 800, [leader, ant]);
      if (!ant.follow || ant.follow.time < 4) continue;
      followFrames++;
      if (Math.hypot(leader.x - ant.x, leader.y - ant.y) < ant.size * 3) closeFrames++;
    }
  }
  assert.ok(followFrames > 300, `followed for only ${followFrames} frames`);
  assert.ok(closeFrames / followFrames > 0.6, `close behind only ${(100 * closeFrames / followFrames).toFixed(0)}% of the time after catching up`);
});

test('ants can form columns several long (a follows b follows c), but never a loop', () => {
  let longest = 0;
  for (const seed of [5, 9, 13]) {
    const sw = new Swarm({ species: ['ant'], count: 25, width: 1600, height: 900, rng: seeded(seed) });
    for (let f = 0; f < 60 * 30; f++) {
      sw.update(1 / 60);
      for (const b of sw.bugs) {
        if (!b.follow) continue;
        const seen = new Set([b]);
        let n = 1;
        for (let a = b.follow.leader; a; a = a.follow?.leader) {
          assert.ok(!seen.has(a), 'a column loops back on itself');
          seen.add(a);
          n++;
        }
        longest = Math.max(longest, n);
      }
    }
  }
  assert.ok(longest >= 3, `longest column was ${longest} ants`);
});

test('ecology table: real species only, nobody hunts itself, and nothing hunts the stink bug', async () => {
  const { PREDATION, REPELLENT } = await import('../src/lib/bugs/ecology.js');
  for (const [pred, preys] of Object.entries(PREDATION)) {
    assert.ok(SPECIES[pred], `unknown predator ${pred}`);
    for (const [prey, w] of Object.entries(preys)) {
      assert.ok(SPECIES[prey], `${pred}: unknown prey ${prey}`);
      assert.notEqual(prey, pred, `${pred} hunts its own kind`);
      assert.ok(w > 0 && w <= 1, `${pred} -> ${prey}: danger ${w} out of range`);
    }
    assert.ok(!('stinkbug' in preys), `${pred} hunts stink bugs`);
  }
  for (const id of Object.keys(REPELLENT)) assert.ok(SPECIES[id]);
});

// Walks a bug of species otherId straight at a resting bug of species id; reports how alarmed the resting
// bug got and how far it moved.
function approach(id, otherId, seed = 91) {
  const b = createBug(id, { width: 1200, height: 800, rng: seeded(seed) });
  const o = createBug(otherId, { width: 1200, height: 800, rng: seeded(seed + 1) });
  Object.assign(b, { x: 600, y: 400, heading: Math.PI / 2, entered: true, paused: true, stateTime: 99, speed: 0 });
  Object.assign(o, { x: 300, y: 400, heading: 0, entered: true, speed: o.cruise, huntCooldown: 99 });
  o.species = { ...o.species, pauseRate: 0 };
  o.waypoints = [{ x: 900, y: 400 }, { x: 1300, y: 400 }];
  let alarm = 0;
  for (let f = 0; f < 60 * 4; f++) {
    stepBug(o, 1 / 60, 1200, 800, [b, o]);
    stepBug(b, 1 / 60, 1200, 800, [b, o]);
    if (!(b.alarm > 0)) b.stateTime = 99;   // stays resting unless frightened
    alarm = Math.max(alarm, b.alarm);
  }
  return { alarm, moved: Math.hypot(b.x - 600, b.y - 400) / b.size };
}

test('prey bolt from an approaching predator, but stay put for a harmless passer-by', () => {
  for (const [prey, predator, harmless] of [['silverfish', 'housecentipede', 'stinkbug'], ['spider', 'yellowjacket', 'beetle'], ['cockroach', 'centipede', 'earwig']]) {
    const fled = approach(prey, predator), stayed = approach(prey, harmless);
    assert.ok(fled.alarm > 0.15, `${prey} wasn't alarmed by an approaching ${predator} (${fled.alarm.toFixed(2)})`);
    assert.ok(fled.moved > 1, `${prey} only moved ${fled.moved.toFixed(2)} body lengths from a ${predator}`);
    assert.equal(stayed.alarm, 0, `${prey} was alarmed by a ${harmless}`);
    assert.ok(stayed.moved < 0.05, `${prey} moved ${stayed.moved.toFixed(2)} body lengths for a ${harmless}`);
  }
});

test('predators never frighten themselves: a predator approached by its own prey stays calm', () => {
  assert.equal(approach('housecentipede', 'silverfish').alarm, 0);
  assert.equal(approach('spider', 'bedbug').alarm, 0);
});

test('a frightened bug stops resting, greeting or following a trail', () => {
  const ant = createBug('ant', { width: 800, height: 600, rng: seeded(93) });
  const hc = createBug('housecentipede', { width: 800, height: 600, rng: seeded(94) });
  Object.assign(ant, { x: 400, y: 300, heading: 0, entered: true, paused: true, stateTime: 5, speed: 0 });
  Object.assign(hc, { x: 400 + ant.size * 1.2, y: 300, heading: Math.PI, entered: true, paused: true, stateTime: 99, speed: 0, huntCooldown: 99 });
  stepBug(ant, 1 / 60, 800, 600, [ant, hc]);
  assert.ok(ant.alarm > 0.15 && !ant.paused, 'startled out of its rest');
  for (let f = 0; f < 60; f++) { stepBug(ant, 1 / 60, 800, 600, [ant, hc]); hc.stateTime = 99; }
  assert.ok(Math.hypot(ant.x - hc.x, ant.y - hc.y) > ant.size * 2, 'and runs off');
});

test('predators now and then stalk prey they can see, then lose interest for a while', () => {
  let stalks = 0, gaveUp = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const spider = createBug('spider', { width: 1200, height: 800, rng: seeded(seed) });
    const prey = createBug('silverfish', { width: 1200, height: 800, rng: seeded(seed + 100) });
    Object.assign(spider, { x: 300, y: 400, heading: 0, entered: true });
    spider.species = { ...spider.species, pauseRate: 0 };
    spider.waypoints = [{ x: 600, y: 100 }, { x: 600, y: -200 }];
    Object.assign(prey, { x: 300 + spider.size * 1.5, y: 410, heading: 0, entered: true, paused: true, stateTime: 99, speed: 0 });
    let saw = false;
    for (let f = 0; f < 60 * 8; f++) {
      stepBug(spider, 1 / 60, 1200, 800, [spider, prey]);
      prey.stateTime = 99;
      if (spider.hunt) { if (!saw) stalks++; saw = true; assert.equal(spider.hunt.prey, prey); }
      else if (saw && spider.huntCooldown > 0) { gaveUp++; break; }
    }
  }
  assert.ok(stalks >= 3 && stalks < 20, `${stalks} of 20 spiders stalked a silverfish in reach: sometimes, not always`);
  assert.equal(gaveUp, stalks, 'every stalk ends with a cool-down');
});

test('everyone gives a stink bug a wider berth than an ordinary bug of the same size', async () => {
  const { avoidance } = await import('../src/lib/bugs/engine.js');
  const b = createBug('beetle', { width: 800, height: 600, rng: seeded(95) });
  Object.assign(b, { x: 400, y: 300, heading: 0, entered: true, speed: 0 });
  const push = id => {
    const o = createBug(id, { width: 800, height: 600, rng: seeded(96) });
    Object.assign(o, { x: 400 + 50, y: 320, size: 40, speed: 0, entered: true, delay: 0 });
    const a = avoidance(b, [b, o]);
    return a ? Math.hypot(a.x, a.y) : 0;
  };
  assert.ok(push('stinkbug') > push('earwig') * 1.2, 'stronger push away from the stink bug');
});

// Sets a predator stalking a prey just ahead of it in open ground; reports how the chase went.
function chase(pid, qid, seed) {
  const p = createBug(pid, { width: 2000, height: 1400, rng: seeded(seed) });
  const q = createBug(qid, { width: 2000, height: 1400, rng: seeded(seed + 500) });
  Object.assign(p, { x: 800, y: 700, heading: 0, entered: true, speed: p.cruise });
  Object.assign(q, { x: 800 + p.size * 1.8, y: 710, heading: 0, entered: true, speed: q.cruise * 0.5 });
  p.species = { ...p.species, pauseRate: 0 };
  q.species = { ...q.species, pauseRate: 0 };
  p.waypoints = [{ x: 1900, y: 700 }, { x: 2100, y: 700 }];
  q.waypoints = [{ x: 1900, y: 400 }, { x: 2100, y: 400 }];
  p.hunt = { prey: q, time: 4.5, lunge: 0, lunged: false };
  let t = 0, lungePace = 0, earlySpeed = 0, lateSpeed = 0;
  while (p.hunt && t < 10) {
    stepBug(p, 1 / 60, 2000, 1400, [p, q]);
    stepBug(q, 1 / 60, 2000, 1400, [p, q]);
    t += 1 / 60;
    if (p.hunt?.lunge > 0) lungePace = Math.max(lungePace, p.speed / p.cruise);
    if (Math.abs(t - 0.5) < 0.01) earlySpeed = q.speed;
    if (Math.abs(t - 3.5) < 0.01) lateSpeed = q.speed;
  }
  return { t, lungePace, earlySpeed, lateSpeed };
}

test('a predator that gets close strikes with a short committed lunge', () => {
  for (const [pid, qid] of [['housecentipede', 'silverfish'], ['spider', 'bedbug']]) {
    const r = chase(pid, qid, 3);
    assert.ok(r.lungePace > 1.4, `${pid} lunged at only ${r.lungePace.toFixed(2)}x its pace`);
  }
});

test('fast predators keep up a chase; slow ones soon give up on faster prey', () => {
  const med = a => a.sort((x, y) => x - y)[a.length >> 1];
  const run = (pid, qid) => med(Array.from({ length: 9 }, (_, i) => chase(pid, qid, i + 1).t));
  const fast = run('housecentipede', 'silverfish'), slow = run('centipede', 'cockroach');
  assert.ok(fast > 3, `house centipede gave up on a silverfish after ${fast.toFixed(1)}s`);
  assert.ok(slow < 2.5, `centipede kept after a cockroach for ${slow.toFixed(1)}s`);
});

test('a fleeing bug\'s burst of speed fades, so a determined predator can gain on it', () => {
  const r = chase('housecentipede', 'silverfish', 2);
  assert.ok(r.earlySpeed > 0 && r.lateSpeed > 0, 'still running at both times');
  assert.ok(r.lateSpeed < r.earlySpeed * 0.85, `sprint didn't fade: ${r.earlySpeed.toFixed(0)} -> ${r.lateSpeed.toFixed(0)} px/s`);
});

test('honey bee breeds: every breed is selectable, drawn in its own colours, and has a temperament', async () => {
  const { BEE_IDS, BEES } = await import('../src/lib/bugs/species/honeybee.js');
  assert.ok(BEE_IDS.length >= 6);
  for (const id of ['italianbee', 'carniolanbee', 'russianbee', 'caucasianbee', 'buckfastbee', 'darkbee']) assert.ok(BEE_IDS.includes(id), id);
  for (const id of BEE_IDS) assert.ok(BUG_SPECIES.some(s => s.id === id), `${id} missing from the settings list`);
  const caucasian = BEES.find(b => b.id === 'caucasianbee'), dark = BEES.find(b => b.id === 'darkbee');
  assert.ok(dark.nerves > caucasian.nerves && dark.pauseRate > caucasian.pauseRate, 'German black bees are nervier than Caucasians');
  const fills = id => {
    const seen = new Set();
    const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k.startsWith('create') ? () => ({ addColorStop: (o, c) => seen.add(c) }) : () => {}), set: (t, k, v) => { if (k === 'fillStyle' && typeof v === 'string') seen.add(v); t[k] = v; return true; } });
    const b = createBug(id, { width: 800, height: 600, rng: seeded(3) });
    SPECIES[id].draw(ctx, b);
    return [...seen].sort().join();
  };
  assert.equal(new Set(BEE_IDS.map(fills)).size, BEE_IDS.length, 'each breed looks different');
});

test('only honey bees dance; a waggle dance is a figure of eight on a fixed bearing', () => {
  assert.ok(Object.values(SPECIES).filter(s => s.dances).every(s => s.id.endsWith('bee')));
  const b = createBug('italianbee', { width: 1200, height: 800, rng: seeded(2) });
  Object.assign(b, { x: 600, y: 400, heading: 0, entered: true, speed: b.cruise });
  b.species = { ...b.species, pauseRate: 0 };
  b.waypoints = [{ x: 1100, y: 400 }, { x: 1300, y: 400 }];
  const bearing = -Math.PI / 2;
  b.dance = { stage: 'turn', angle: bearing, circuits: 4, side: 1, len: b.size, start: { x: b.x, y: b.y }, loop: [], heading: 0, pace: 0.2 };
  const { ctx } = mockCanvas();
  let t = 0, last = 'turn', runStart = null;
  const starts = [], sides = [], runs = [];
  while (b.dance && t < 30) {
    stepBug(b, 1 / 60, 1200, 800, [b]);
    SPECIES.italianbee.draw(ctx, b);
    t += 1 / 60;
    const st = b.dance?.stage;
    if (st === 'run' && last !== 'run') { runStart = { x: b.x, y: b.y }; starts.push(runStart); sides.push(b.dance.side); }
    if (st !== 'run' && last === 'run') runs.push(Math.atan2(b.y - runStart.y, b.x - runStart.x));
    last = st;
  }
  assert.equal(b.dance, null, 'the dance ends');
  assert.equal(runs.length, 4, 'one waggle run per circuit');
  for (const r of runs) assert.ok(Math.abs(Math.atan2(Math.sin(r - bearing), Math.cos(r - bearing))) < 0.15, 'every waggle run keeps the same bearing');
  assert.deepEqual(sides, [1, -1, 1, -1], 'return loops alternate sides');
  for (const p of starts) assert.ok(Math.hypot(p.x - starts[0].x, p.y - starts[0].y) < b.size * 0.6, 'each run starts back near the first');
  assert.ok(t / 4 < 4, `${(t / 4).toFixed(1)}s per circuit is too slow`);
});

test('bees sometimes dance on their own, and a yellowjacket breaks up the dance', () => {
  let danced = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const b = createBug('carniolanbee', { width: 1600, height: 900, rng: seeded(seed) });
    Object.assign(b, { x: 200, y: 450, heading: 0, entered: true });
    b.waypoints = [{ x: 1400, y: 450 }, { x: 1800, y: 450 }];
    for (let f = 0; f < 60 * 15 && !b.dance; f++) stepBug(b, 1 / 60, 1600, 900, [b]);
    if (b.dance) danced++;
  }
  assert.ok(danced >= 2 && danced < 15, `${danced} of 60 bees danced within 15 s: now and then, not often`);
  const bee = createBug('italianbee', { width: 800, height: 600, rng: seeded(5) });
  const wasp = createBug('yellowjacket', { width: 800, height: 600, rng: seeded(6) });
  Object.assign(bee, { x: 400, y: 300, heading: 0, entered: true });
  bee.dance = { stage: 'run', angle: 0, circuits: 4, side: 1, len: bee.size, start: { x: 400, y: 300 }, loop: [], heading: 0, pace: 0.5 };
  Object.assign(wasp, { x: 400 + bee.size * 1.3, y: 300, heading: Math.PI, entered: true, paused: true, stateTime: 99, speed: 0, huntCooldown: 99 });
  stepBug(bee, 1 / 60, 800, 600, [bee, wasp]);
  assert.equal(bee.dance, null, 'dance abandoned');
  assert.ok(bee.alarm > 0.15, 'and the bee takes fright');
});

test('yellowjackets and spiders hunt honey bees', async () => {
  const { danger } = await import('../src/lib/bugs/ecology.js');
  const { BEE_IDS } = await import('../src/lib/bugs/species/honeybee.js');
  for (const id of BEE_IDS) {
    const bee = { species: SPECIES[id] };
    assert.ok(danger({ species: SPECIES.yellowjacket }, bee) > 0.5, `yellowjackets ignore ${id}`);
    assert.ok(danger({ species: SPECIES.spider }, bee) > 0, `spiders ignore ${id}`);
  }
});

test('honey bees are mostly workers, with some bigger drones and the odd queen bigger still', async () => {
  const { BEE_IDS } = await import('../src/lib/bugs/species/honeybee.js');
  assert.ok(SPECIES.italianbee.size[0] >= SPECIES.yellowjacket.size[0], 'workers are about yellowjacket size');
  const crowd = new Set(), all = [];
  for (let k = 0; k < 60; k++) all.push(...new Swarm({ species: BEE_IDS, count: 20, width: 1400, height: 800, rng: seeded(k + 1), crowd }).bugs);
  const by = c => all.filter(b => (b.caste ?? 'worker') === c);
  const workers = by('worker'), drones = by('drone'), queens = by('queen');
  assert.ok(workers.length > drones.length && drones.length > queens.length && queens.length > 0, `${workers.length} workers, ${drones.length} drones, ${queens.length} queens`);
  const { beeDims, REAL_MM, ABDOMEN, WING_ROOT, wingDims } = await import('../src/lib/bugs/species/honeybee.js');
  for (const group of [workers, drones, queens]) {
    const sizes = group.map(b => b.size);
    assert.ok(Math.max(...sizes) / Math.min(...sizes) < 1.001, 'bees of one caste are all the same size');
  }
  // Every proportion matches real bees: within a caste, and between castes.
  const w = beeDims(workers[0]), wr = REAL_MM.worker;
  for (const [caste, b] of [['worker', workers[0]], ['drone', drones[0]], ['queen', queens[0]]]) {
    const d = beeDims(b), r = REAL_MM[caste];
    const near = (got, want, what) => assert.ok(Math.abs(got / want - 1) < 0.04, `${caste} ${what}: ${got.toFixed(2)} vs real ${want.toFixed(2)}`);
    near(d.length / d.thorax, r.length / r.thorax, 'length : thorax');
    near(d.abdomen / d.thorax, r.abdomen / r.thorax, 'abdomen : thorax');
    near(d.length / w.length, r.length / wr.length, 'length vs worker');
    near(d.thorax / w.thorax, r.thorax / wr.thorax, 'thorax vs worker');
  }
  const wingTip = c => WING_ROOT - wingDims(c).fore, tip = c => 4 + ABDOMEN[c].cx - ABDOMEN[c].rx;
  assert.ok(Math.abs(tip('worker') - wingTip('worker')) < 8, 'a worker\'s abdomen ends about where her wings do');
  assert.ok(wingTip('queen') - tip('queen') > 12, 'a queen\'s abdomen reaches well past her wings');
  assert.equal(ABDOMEN.drone.tip, false, 'drones have no sting');
  assert.ok(wingTip('drone') < tip('drone'), 'a drone\'s big wings reach past his abdomen');
  assert.ok(Object.keys(SPECIES).filter(id => SPECIES[id].castes).every(id => BEE_IDS.includes(id)), 'only bees have castes');
});

test('only one queen of each breed is ever about at once', async () => {
  const { BEE_IDS } = await import('../src/lib/bugs/species/honeybee.js');
  const crowd = new Set();
  for (let k = 0; k < 40; k++) new Swarm({ species: BEE_IDS, count: 20, width: 1400, height: 800, rng: seeded(k + 100), crowd });
  const queens = [...crowd].flatMap(s => s.bugs).filter(b => b.caste === 'queen').map(b => b.species.id);
  assert.ok(queens.length > 1);
  assert.equal(new Set(queens).size, queens.length, `two queens of one breed: ${queens.join(', ')}`);
});

test('drones and queens never waggle dance', async () => {
  const { waggleDance } = await import('../src/lib/bugs/engine.js');
  for (const caste of ['drone', 'queen']) {
    const b = createBug('italianbee', { width: 1600, height: 900, rng: seeded(7) });
    Object.assign(b, { x: 200, y: 450, heading: 0, entered: true, caste, rng: () => 0 });   // every chance comes up
    b.waypoints = [{ x: 1400, y: 450 }, { x: 1800, y: 450 }];
    for (let f = 0; f < 600; f++) stepBug(b, 1 / 60, 1600, 900, [b]);
    assert.equal(b.dance, null, `a ${caste} danced`);
  }
  const worker = createBug('italianbee', { width: 1600, height: 900, rng: seeded(7) });
  Object.assign(worker, { entered: true, rng: () => 0 });
  waggleDance(worker, 1 / 60, false);
  assert.ok(worker.dance, 'a worker given the same odds does dance');
});

// Two queens of different breeds walking toward each other.
function queensMeet(seed = 1) {
  const mk = (id, s) => {
    const b = createBug(id, { width: 1200, height: 800, rng: seeded(s) });
    Object.assign(b, { caste: 'queen', size: 49, entered: true });
    b.species = { ...b.species, pauseRate: 0 };
    return b;
  };
  const a = mk('italianbee', seed), b = mk('darkbee', seed + 1);
  Object.assign(a, { x: 470, y: 400, heading: 0 });   // close enough to meet before either settles to rest
  Object.assign(b, { x: 600, y: 400, heading: Math.PI });
  a.waypoints = [{ x: 1100, y: 400 }, { x: 1300, y: 400 }];
  b.waypoints = [{ x: 100, y: 400 }, { x: -200, y: 400 }];
  return [a, b];
}

test('two queens that meet fight: they grapple face to face, then one flees', async () => {
  const { bodyDiscs } = await import('../src/lib/bugs/engine.js');
  const [a, b] = queensMeet();
  let fought = false, lunges = 0, pulls = 0, overlap = false;
  for (let f = 0; f < 60 * 15; f++) {   // queens are slow and stately
    stepBug(a, 1 / 60, 1200, 800, [a, b]);
    stepBug(b, 1 / 60, 1200, 800, [a, b]);
    if (a.duel) {
      fought = true;
      assert.equal(a.duel.rival, b);
      assert.equal(b.duel.rival, a);
      assert.notEqual(a.duel.lose, b.duel.lose, 'exactly one of them will lose');
      if (a.speed > 1) lunges++;
      if (a.speed < -1) pulls++;
      for (const m of bodyDiscs(a)) for (const t of bodyDiscs(b)) if (Math.hypot(t.x - m.x, t.y - m.y) < (m.r + t.r) * 0.6) overlap = true;
    }
    if (fought && !a.duel) break;
  }
  assert.ok(fought, 'they fought');
  assert.ok(lunges > 10 && pulls > 10, `grappling back and forth (${lunges} lunging frames, ${pulls} pulling back)`);
  assert.ok(!overlap, 'bodies never overlap');
  const loser = a.alarm > b.alarm ? a : b;
  assert.ok(loser.alarm > 0.5, 'the loser bolts');
  assert.ok(a.duelCooldown > 0 && b.duelCooldown > 0, 'and neither will fight again straight away');
});

test('workers and drones never pick fights', () => {
  for (const caste of [null, 'drone']) {
    const [a, b] = queensMeet(3);
    a.caste = b.caste = caste;
    for (let f = 0; f < 60 * 6; f++) {
      stepBug(a, 1 / 60, 1200, 800, [a, b]);
      stepBug(b, 1 / 60, 1200, 800, [a, b]);
      assert.equal(a.duel, null);
    }
  }
});

test('the waggle is the abdomen swinging side to side; the wings stay folded', () => {
  const rot = [];
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : k === 'rotate' ? a => rot.push(a) : (k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  const b = createBug('italianbee', { width: 800, height: 600, rng: seeded(4) });
  Object.assign(b, { heading: 0, dance: { stage: 'run' } });
  const sways = [], wings = [];
  for (let i = 0; i < 12; i++) {
    b.t = i / 60;
    rot.length = 0;
    SPECIES.italianbee.draw(ctx, b);
    const [, sway, ...wing] = rot;   // frame heading, then the abdomen, then the two wings
    sways.push(sway);
    wings.push(wing.map(a => a.toFixed(6)).join());
  }
  assert.ok(Math.max(...sways) - Math.min(...sways) > 0.2, 'abdomen swings');
  assert.equal(new Set(wings).size, 1, 'wings hold still');
});

test('honey bees never have yellow legs (that is a wasp\'s mark): every breed\'s legs are dark', async () => {
  const { BREEDS } = await import('../src/lib/bugs/species/honeybee.js');
  for (const br of BREEDS) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(br.legs.slice(i, i + 2), 16) / 255);
    const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    assert.ok(lightness < 0.3, `${br.id} legs ${br.legs} are too light`);
    const yellowish = r > 0.45 && g > 0.35 && b < g * 0.6;
    assert.ok(!yellowish, `${br.id} legs ${br.legs} look yellow`);
  }
});

test('two bugs held up nose to nose back off and sidestep instead of standing locked together', () => {
  for (const [ida, idb] of [['italianbee', 'darkbee'], ['cockroach', 'beetle'], ['spider', 'earwig']]) {
    const a = createBug(ida, { width: 1200, height: 800, rng: seeded(11) });
    const b = createBug(idb, { width: 1200, height: 800, rng: seeded(12) });
    const gap = (a.size + b.size) * 0.47;
    Object.assign(a, { x: 600, y: 400, heading: 0, entered: true, speed: 0 });
    Object.assign(b, { x: 600 + gap, y: 400, heading: Math.PI, entered: true, speed: 0 });
    for (const q of [a, b]) q.species = { ...q.species, pauseRate: 0 };
    for (const q of [a, b]) q.huntCooldown = Infinity;   // about getting unstuck: a spider turning back to hunt the earwig isn't
    a.waypoints = [{ x: 1100, y: 400 }, { x: 1300, y: 400 }];
    b.waypoints = [{ x: 100, y: 400 }, { x: -200, y: 400 }];
    let longest = 0, run = 0;
    for (let f = 0; f < 60 * 6; f++) {
      stepBug(a, 1 / 60, 1200, 800, [a, b]);
      stepBug(b, 1 / 60, 1200, 800, [a, b]);
      run = a.hemmed > 0.7 || b.hemmed > 0.7 ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    assert.ok(longest < 90, `${ida} and ${idb} stayed locked for ${(longest / 60).toFixed(1)}s`);
    assert.ok(a.x > 700 && b.x < 500, `${ida} and ${idb} got past each other`);
  }
});

test('bugs arriving side by side from off screen steer round each other and never lock together', () => {
  const { BEE_IDS } = BEE_MODULE;
  for (let seed = 1; seed <= 15; seed++) {
    const sw = new Swarm({ species: BEE_IDS, count: 20, width: 1200, height: 700, rng: seeded(seed) });
    const held = new Map();
    for (let f = 0; f < 60 * 20; f++) {
      sw.update(1 / 60);
      for (const b of sw.bugs) {
        if (b.done || b.delay > 0 || b.duel || b.attend) { held.delete(b); continue; }   // fighting or tending: pressed close on purpose
        const n = b.hemmed > 0.7 ? (held.get(b) ?? 0) + 1 : 0;
        held.set(b, n);
        assert.ok(n < 120, `seed ${seed}: a ${b.species.id} was held up for 2s`);
      }
    }
  }
});


test('honey bee wings match real measurements for every caste, with the hindwing tucked beneath', async () => {
  const { wingDims, wingOutline, WING_MM, WING_MEAN_CHORD, REAL_MM, beeDims, CASTE_SIZE } = await import('../src/lib/bugs/species/honeybee.js');
  const near = (got, want, what) => assert.ok(Math.abs(got / want - 1) < 0.05, `${what}: ${got.toFixed(3)} vs real ${want.toFixed(3)}`);
  for (const caste of ['worker', 'drone', 'queen']) {
    const w = wingDims(caste), mm = WING_MM[caste];
    const body = (beeDims({ size: CASTE_SIZE[caste], caste: caste === 'worker' ? null : caste }).length * 100) / CASTE_SIZE[caste];
    near(w.fore / body, mm.fore / REAL_MM[caste].length, `${caste} forewing : body length`);
    near(w.foreWidth / w.fore, mm.foreWidth / mm.fore, `${caste} forewing width : length`);
    near(w.hind / w.fore, mm.hind / mm.fore, `${caste} hindwing : forewing`);
    assert.ok(w.hindWidth < w.foreWidth && w.hind < w.fore, `${caste} hindwing is smaller, so it stays mostly hidden`);
  }
  const px = c => wingDims(c).fore * CASTE_SIZE[c] / 100;
  assert.ok(px('drone') > px('queen') && px('queen') > px('worker'), 'drones have the biggest forewings, workers the smallest');
  // The outline is a wing, not an oval: widest about four fifths of the way out, rounded at the tip, with a
  // mean width near a real forewing's ~60% of its widest (1.84 of 3.07 mm), and no pinched stalk at the base.
  const w = wingDims('worker');
  const pts = wingOutline(w.fore, w.foreWidth, 1, 400), half = pts.length / 2;
  const xs = pts.slice(0, half).map(p => p[0] / w.fore);                          // 0 at the hinge .. 1 at the tip
  const chords = Array.from({ length: half }, (_, i) => pts[pts.length - 1 - i][1] - pts[i][1]);
  const at = t => chords[xs.findIndex(x => x >= t)];
  const widest = xs[chords.indexOf(Math.max(...chords))];
  assert.ok(widest > 0.6 && widest < 0.85, `widest at ${(widest * 100).toFixed(0)}% of its length`);
  near(Math.max(...chords), w.foreWidth, 'widest chord');
  let area = 0;
  for (let i = 1; i < half; i++) area += ((chords[i] + chords[i - 1]) / 2) * (xs[i] - xs[i - 1]);
  const meanChord = area / w.foreWidth;
  assert.ok(Math.abs(meanChord / WING_MEAN_CHORD - 1) < 0.12, `mean chord : widest ${meanChord.toFixed(3)} vs real ${WING_MEAN_CHORD.toFixed(3)}`);
  assert.ok(at(0.15) > w.foreWidth * 0.3, 'no thin stalk at the base');
  assert.ok(at(0.97) > w.foreWidth * 0.3, 'rounded tip, not a point');
});

test('honey bee body shape follows a real bee seen from above', async () => {
  const { abdomenOutline, ABDOMEN, WING_SPREAD } = await import('../src/lib/bugs/species/honeybee.js');
  const egg = { worker: { widest: 0.36, taper: 0.75 }, drone: { widest: 0.42, taper: 0.45 } };
  for (const caste of ['worker', 'drone']) {
    const a = ABDOMEN[caste], pts = abdomenOutline(a, egg[caste], 200);
    const half = pts.slice(0, pts.length / 2).map(([x, y]) => [x, -y]);   // the outline's left edge, front to tip
    const at = x => half.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best))[1];
    const widestX = half.reduce((best, p) => (p[1] > best[1] ? p : best))[0];
    const len = a.rx * 2, front = a.cx + a.rx;
    assert.ok((front - widestX) / len < 0.45, `${caste} abdomen is widest in its front half (egg-shaped)`);
    assert.ok(Math.max(...half.map(p => p[1])) <= a.ry + 1e-9, `${caste} abdomen keeps its real width`);
    assert.ok(at(front - 4 - 4) > a.ry * 0.5, `${caste} abdomen joins the thorax broadly (no visible waist)`);
    const nearTip = at(a.cx - a.rx + len * 0.1) / a.ry;
    if (caste === 'worker') assert.ok(nearTip < 0.45, "a worker's abdomen tapers to a point");
    else assert.ok(nearTip > 0.45, "a drone's abdomen is blunt");
  }
  assert.ok(WING_SPREAD > 0.25 && WING_SPREAD < 0.5, 'resting wings angle well out from the body, not in line with it');
});

test('pollen loads come in many flower colours, matched on both legs, and are a visible size', async () => {
  const { POLLEN_COLORS, POLLEN_SIZE, pollenColor } = await import('../src/lib/bugs/species/honeybee.js');
  assert.ok(POLLEN_COLORS.length >= 6);
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(pollenColor({ variant: (i / 400) * 0.35 }));   // the bees that carry pollen
  assert.equal(seen.size, POLLEN_COLORS.length, 'every colour turns up among pollen carriers');
  assert.ok(POLLEN_SIZE[0] >= 5 && POLLEN_SIZE[1] >= 4, 'loads are big enough to see');
  const fills = [];
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { if (k === 'fillStyle') fills.push(v); t[k] = v; return true; } });
  const b = createBug('italianbee', { width: 800, height: 600, rng: seeded(2) });
  b.variant = 0.2;
  SPECIES.italianbee.draw(ctx, b);
  assert.equal(fills.filter(f => f === pollenColor(b)).length, 2, 'one load on each hind leg, the same colour');
});

test('a pollen load stays fixed to its spot on the hind tibia while the leg walks', async () => {
  const { POLLEN_AT, POLLEN_SIZE } = await import('../src/lib/bugs/species/honeybee.js');
  const b = createBug('italianbee', { width: 800, height: 600, rng: seeded(2) });
  b.variant = 0.2;   // carries pollen
  for (let f = 0; f < 40; f++) {
    b.phaseL = b.phaseR = (f / 40) * 2 * Math.PI;   // a full stride, legs bending and swinging
    const strokes = [], loads = [];
    let tf = { x: 0, y: 0, a: 0 };
    const ctx = new Proxy({}, {
      get: (t, k) => {
        if (k in t) return t[k];
        if (k === 'moveTo') return (x, y) => strokes.push({ x0: x, y0: y });
        if (k === 'lineTo') return (x, y) => Object.assign(strokes.at(-1), { x1: x, y1: y });
        if (k === 'translate') return (x, y) => { tf = { ...tf, x, y }; };
        if (k === 'rotate') return a => { tf = { ...tf, a }; };
        if (k === 'ellipse') return (x, y, rx, ry) => { if (rx === POLLEN_SIZE[0] && ry === POLLEN_SIZE[1]) loads.push({ ...tf }); };
        if (k === 'save') return () => {};
        if (k === 'restore') return () => { tf = { x: 0, y: 0, a: 0 }; };
        return k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {};
      },
      set: (t, k, v) => { t[k] = v; return true; }
    });
    SPECIES.italianbee.draw(ctx, b);
    assert.equal(loads.length, 2);
    for (const load of loads) {
      // Find the drawn hind-tibia stroke this load sits on: the load must lie on it, POLLEN_AT along, facing along it.
      const onIt = strokes.filter(s => s.x1 !== undefined).some(s => {
        const px = s.x0 + (s.x1 - s.x0) * POLLEN_AT, py = s.y0 + (s.y1 - s.y0) * POLLEN_AT;
        const da = Math.atan2(Math.sin(Math.atan2(s.y1 - s.y0, s.x1 - s.x0) - load.a), Math.cos(Math.atan2(s.y1 - s.y0, s.x1 - s.x0) - load.a));
        return Math.hypot(px - load.x, py - load.y) < 1e-6 && Math.abs(da) < 1e-6;
      });
      assert.ok(onIt, `frame ${f}: a pollen load came off its tibia`);
    }
  }
});

test('each wing hinges on its own side of the thorax and stays on that side: they never cross', async () => {
  const { WING_ROOT, WING_SPREAD, WING_ROOT_Y, THORAX_RY, wingDims } = await import('../src/lib/bugs/species/honeybee.js');
  for (const caste of ['worker', 'drone', 'queen']) {
    const len = wingDims(caste).fore;
    for (const side of [-1, 1]) {
      const rootY = side * THORAX_RY * WING_ROOT_Y;
      assert.ok(Math.abs(rootY) > THORAX_RY * 0.5, 'root is out on the side of the thorax, not the midline');
      // Drawn as rotate(PI - side * spread): direction (cos, sin) of that angle.
      const a = Math.PI - side * WING_SPREAD;
      const tipY = rootY + Math.sin(a) * len;
      assert.ok(Math.cos(a) < 0, 'wing lies back along the body');
      assert.ok(Math.sign(tipY) === side && Math.abs(tipY) > Math.abs(rootY), `${caste} wing on side ${side} angles outward on its own side`);
    }
  }
  // And as actually drawn: the two wings' rotations are mirror images that open outward.
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : k === 'rotate' ? a => calls.push(['r', a]) : k === 'translate' ? (x, y) => calls.push(['t', x, y]) : (k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  const b = createBug('italianbee', { width: 800, height: 600, rng: seeded(4) });
  b.heading = 0;
  SPECIES.italianbee.draw(ctx, b);
  // A wing is a move to its root followed straight away by its rotation.
  const wings = calls.flatMap((c, i) => (c[0] === 't' && c[1] === WING_ROOT && calls[i + 1]?.[0] === 'r' ? [[[c[1], c[2]], calls[i + 1][1]]] : []));
  assert.equal(wings.length, 2);
  for (const [[, y], a] of wings) assert.ok(Math.sign(Math.sin(a)) === Math.sign(y), 'drawn wing opens toward its own side');
});

test('yellowjacket wings: folded lengthwise into narrow strips, real length, one along each side', async () => {
  const { WING, BODY_FRONT, BODY_TIP, foldedWingOutline } = await import('../src/lib/bugs/species/yellowjacket.js');
  const body = BODY_FRONT - BODY_TIP;
  assert.ok(Math.abs(WING.length / body - 9.25 / 13.5) < 0.04, 'forewing about 0.69 of body length, as in Vespula workers');
  assert.ok(WING.width / WING.length < 0.2, 'folded lengthwise: a narrow strip, not an open oval');
  for (const side of [-1, 1]) {
    const a = Math.PI - side * WING.spread;
    const tipX = WING.root.x + Math.cos(a) * WING.length, tipY = side * WING.root.y + Math.sin(a) * WING.length;
    assert.ok(Math.sign(tipY) === side && Math.abs(tipY) > WING.root.y, 'each wing lies along its own side, angled out: no crossing');
    assert.ok(tipX > BODY_TIP && tipX < BODY_TIP + 15, 'reaching nearly to the tip of the abdomen');
    const ys = foldedWingOutline(WING.length, WING.width, side).map(p => p[1]);
    assert.ok(Math.max(...ys) - Math.min(...ys) <= WING.width + 1e-9);
  }
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : k === 'rotate' ? a => calls.push(['r', a]) : k === 'translate' ? (x, y) => calls.push(['t', x, y]) : (k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  const b = createBug('yellowjacket', { width: 800, height: 600, rng: seeded(4) });
  b.heading = 0;
  SPECIES.yellowjacket.draw(ctx, b);
  const wings = calls.flatMap((c, i) => (c[0] === 't' && c[1] === WING.root.x && calls[i + 1]?.[0] === 'r' ? [[c[2], calls[i + 1][1]]] : []));
  assert.equal(wings.length, 2);
  for (const [y, a] of wings) assert.ok(Math.sign(Math.sin(a)) === Math.sign(y), 'drawn wing opens toward its own side');
});

test('honey bee forewings have bee venation: veins stop short of the outer part of the wing (a fly\'s run to the edge)', async () => {
  const { VEIN_REACH } = await import('../src/lib/bugs/species/honeybee.js');
  assert.ok(VEIN_REACH < 0.95 && VEIN_REACH > 0.8, `veins reach ${VEIN_REACH} of the way out`);
});

test('drones and queens are rare: only a few bees in a hundred', async () => {
  const { BEE_IDS } = BEE_MODULE;
  let n = 0, drones = 0, queens = 0;
  const crowd = new Set();   // one page: the guaranteed queen comes with the first swarm only
  for (let k = 0; k < 50; k++) {
    for (const b of new Swarm({ species: BEE_IDS, count: 20, width: 1400, height: 800, rng: seeded(k + 300), crowd }).bugs) {
      n++;
      if (b.caste === 'drone') drones++;
      if (b.caste === 'queen') queens++;
    }
  }
  assert.ok(drones / n < 0.02 && drones > 0, `${drones} drones in ${n} bees`);
  assert.ok(queens / n < 0.025, `${queens} queens in ${n} bees`);
});

test('bees step at a calm pace for their size; drones and queens stride in proportion to their bodies', async () => {
  const { strideLength } = await import('../src/lib/bugs/engine.js');
  const w = createBug('italianbee', { width: 800, height: 600, rng: seeded(1) });
  const stepsPerSecond = b => b.cruise / strideLength(b);
  for (const id of BEE_MODULE.BEE_IDS) {
    const fastest = createBug(id, { width: 800, height: 600, rng: () => 0.999 });
    assert.ok(stepsPerSecond(fastest) < 4.25, `even the quickest ${id} takes only ${stepsPerSecond(fastest).toFixed(1)} strides a second`);
  }
  const q = createBug('italianbee', { width: 800, height: 600, rng: seeded(1) });
  Object.assign(q, { caste: 'queen', size: SPECIES.italianbee.castes.queen.size[0] });
  assert.ok(strideLength(q) / strideLength(w) > 1.15, 'a queen takes longer strides');
});

test('a resting yellowjacket flicks its wings only now and then, and only slightly', async () => {
  const { WING } = await import('../src/lib/bugs/species/yellowjacket.js');
  const b = createBug('yellowjacket', { width: 800, height: 600, rng: seeded(1) });
  Object.assign(b, { paused: true, heading: 0 });
  let flicking = 0, biggest = 0;
  const n = 1800;   // 60 s, several flick cycles
  for (let i = 0; i < n; i++) {
    b.t = i / 30;
    const calls = [];
    const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : k === 'rotate' ? a => calls.push(['r', a]) : k === 'translate' ? (x, y) => calls.push(['t', x, y]) : (k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
    SPECIES.yellowjacket.draw(ctx, b);
    const i0 = calls.findIndex(c => c[0] === 't' && c[1] === WING.root.x);
    const side = Math.sign(calls[i0][2]), dev = Math.abs(calls[i0 + 1][1] - (Math.PI - side * WING.spread));
    if (dev > 1e-9) flicking++;
    biggest = Math.max(biggest, dev);
  }
  assert.ok(flicking / n < 0.2, `wings flicking ${(100 * flicking / n).toFixed(0)}% of the time`);
  assert.ok(biggest < 0.08, `flicks up to ${biggest.toFixed(3)} rad`);
});

test('a resting honey bee twitches its wings only rarely, and only slightly', async () => {
  const { WING_ROOT, WING_SPREAD } = BEE_MODULE;
  const b = createBug('italianbee', { width: 800, height: 600, rng: seeded(1) });
  Object.assign(b, { paused: true, heading: 0 });
  let twitching = 0, biggest = 0;
  const n = 1800;   // 60 s
  for (let i = 0; i < n; i++) {
    b.t = i / 30;
    const calls = [];
    const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : k === 'rotate' ? a => calls.push(['r', a]) : k === 'translate' ? (x, y) => calls.push(['t', x, y]) : (k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
    SPECIES.italianbee.draw(ctx, b);
    const i0 = calls.findIndex(c => c[0] === 't' && c[1] === WING_ROOT);
    const side = Math.sign(calls[i0][2]), dev = Math.abs(calls[i0 + 1][1] - (Math.PI - side * WING_SPREAD));
    if (dev > 1e-9) twitching++;
    biggest = Math.max(biggest, dev);
  }
  assert.ok(twitching / n < 0.15, `wings twitching ${(100 * twitching / n).toFixed(0)}% of the time`);
  assert.ok(biggest < 0.08, `twitches up to ${biggest.toFixed(3)} rad`);
});

test('a queen keeps to the edge she came in by, moving little and resting long', async () => {
  const { assignCaste } = await import('../src/lib/bugs/engine.js');
  const W = 1400, H = 800;
  for (let seed = 1; seed <= 6; seed++) {
    const sw = new Swarm({ species: ['carniolanbee'], count: 1, width: W, height: H, rng: seeded(seed) });
    const q = sw.bugs[0];
    const real = q.species;
    q.species = { ...real, castes: { ...real.castes, queen: { ...real.castes.queen, chance: 1 } } };
    assignCaste(q, () => 0, [], W, H);
    q.species = real;
    assert.equal(q.caste, 'queen');
    const edgeOf = p => (p.y < 0 ? 0 : p.x > W ? 1 : p.y > H ? 2 : p.x < 0 ? 3 : -1);
    const startEdge = edgeOf(q), exit = q.waypoints.at(-1);
    assert.equal(edgeOf(exit), startEdge, 'leaves by the edge she came in by');
    for (const w of q.waypoints.slice(0, -1)) assert.ok(Math.min(w.x, w.y, W - w.x, H - w.y) <= Math.min(W, H) * 0.15, 'every stop is near that edge');
    let onScreen = 0, near = 0, path = 0, px = q.x, py = q.y;
    for (let f = 0; f < 60 * 30 && !q.done; f++) {
      sw.update(1 / 60);
      if (!q.entered) continue;
      onScreen++;
      if (Math.min(q.x, q.y, W - q.x, H - q.y) < Math.min(W, H) * 0.18) near++;
      path += Math.hypot(q.x - px, q.y - py); px = q.x; py = q.y;
    }
    assert.ok(near / onScreen > 0.95, `seed ${seed}: near the edge only ${(100 * near / onScreen).toFixed(0)}% of the time`);
    assert.ok(path / (onScreen / 60) < 25, `seed ${seed}: queen moved ${(path / (onScreen / 60)).toFixed(1)} px/s`);
  }
});

// A resting queen with workers placed round her; returns the bugs after a few seconds of tending.
function retinue(workerId = 'italianbee', caste = null, seed = 1) {
  const q = createBug('italianbee', { width: 800, height: 600, rng: seeded(seed) });
  Object.assign(q, { caste: 'queen', size: SPECIES.italianbee.castes.queen.size[0], x: 400, y: 300, heading: 0, entered: true, fullyIn: true, paused: true, stateTime: 999, speed: 0 });
  const workers = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const w = createBug(workerId, { width: 800, height: 600, rng: seeded(seed * 10 + i) });
    Object.assign(w, { x: 400 + Math.cos(a) * 70, y: 300 + Math.sin(a) * 70, heading: a, entered: true, caste });
    w.species = { ...w.species, pauseRate: 0 };
    w.waypoints = [{ x: 400 + Math.cos(a) * 300, y: 300 + Math.sin(a) * 300 }, { x: -500, y: -500 }];
    workers.push(w);
  }
  const all = [q, ...workers];
  return { q, workers, run(seconds) { for (let f = 0; f < seconds * 60; f++) { for (const b of all) stepBug(b, 1 / 60, 800, 600, all); q.stateTime = 999; } } };
}

test('workers near their queen gather round her, heads to her body, antennae working', async () => {
  const { bodyDiscs } = await import('../src/lib/bugs/engine.js');
  let tended = 0, facing = 0, ended = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const { q, workers, run } = retinue('italianbee', null, seed);
    const seen = new Set();
    for (let s = 0; s < 12; s++) {
      run(0.5);
      for (const w of workers) {
        if (w.attend) {
          seen.add(w);
          const near = bodyDiscs(q).reduce((a, d) => (Math.hypot(d.x - w.x, d.y - w.y) < Math.hypot(a.x - w.x, a.y - w.y) ? d : a));
          const off = Math.abs(Math.atan2(Math.sin(Math.atan2(near.y - w.y, near.x - w.x) - w.heading), Math.cos(Math.atan2(near.y - w.y, near.x - w.x) - w.heading)));
          if (Math.abs(w.speed) < 3 && Math.hypot(near.x - w.x, near.y - w.y) < w.size) { tended++; if (off < 0.5) facing++; }
        } else if (seen.has(w) && w.attendCooldown > 0) ended++;
      }
    }
  }
  assert.ok(tended > 20, `workers stood tending the queen in only ${tended} checks`);
  assert.ok(facing / tended > 0.8, `only ${(100 * facing / tended).toFixed(0)}% faced her`);
  assert.ok(ended > 0, 'workers leave her after a while, with a cool-down before returning');
});

test('only her own colony\'s workers tend a queen: other breeds and drones pass her by', () => {
  for (const [id, caste] of [['darkbee', null], ['italianbee', 'drone']]) {
    const { workers, run } = retinue(id, caste, 2);
    run(8);
    assert.ok(workers.every(w => !w.attend), `${caste ?? id} tended a queen`);
  }
});

test('whenever honey bees are enabled there is always a queen: a swarm brings one if none is about', () => {
  for (let seed = 1; seed <= 20; seed++) {
    // Bees enabled but rarely picked, and swarms of one: the queen still comes, of an enabled breed.
    const sw = new Swarm({ species: ['ant', 'cockroach', 'russianbee', 'buckfastbee'], count: 1 + (seed % 3), width: 1400, height: 800,
      weights: { ant: 10, cockroach: 10, russianbee: 1, buckfastbee: 1 }, rng: seeded(seed) });
    const queens = sw.bugs.filter(b => b.caste === 'queen');
    assert.ok(queens.length >= 1, `seed ${seed}: no queen`);
    assert.ok(queens.every(q => ['russianbee', 'buckfastbee'].includes(q.species.id)), 'the queen is of an enabled breed');
    assert.equal(sw.bugs.length, 1 + (seed % 3), 'the swarm keeps its size');
  }
});

test('a swarm adds no extra queen while one is already about, and none at all without bees', () => {
  const crowd = new Set();
  const first = new Swarm({ species: ['italianbee'], count: 5, width: 1400, height: 800, rng: seeded(1), crowd });
  assert.equal(first.bugs.filter(b => b.caste === 'queen').length, 1);
  let more = 0;
  for (let k = 0; k < 10; k++) more += new Swarm({ species: ['italianbee'], count: 5, width: 1400, height: 800, rng: seeded(k + 2), crowd }).bugs.filter(b => b.caste === 'queen').length;
  assert.equal(more, 0, 'one queen of a breed is enough');
  for (let k = 0; k < 10; k++) {
    const sw = new Swarm({ species: ['ant', 'spider'], count: 5, width: 1400, height: 800, rng: seeded(k + 50) });
    assert.ok(sw.bugs.every(b => !b.caste), 'no bees enabled: no queen');
  }
});

test('a queen comes fully onto the screen before she stops, and only then do workers gather round her', async () => {
  const { assignCaste, wholeBodyOnScreen } = await import('../src/lib/bugs/engine.js');
  const W = 1400, H = 800;
  for (let seed = 1; seed <= 12; seed++) {
    const sw = new Swarm({ species: ['italianbee'], count: 12, width: W, height: H, rng: seeded(seed) });
    const q = sw.bugs.find(b => b.caste === 'queen');
    assert.ok(q, 'a queen came with the swarm');
    for (let f = 0; f < 60 * 25 && !q.done; f++) {
      sw.update(1 / 60);
      const tending = sw.bugs.some(b => b.attend?.queen === q);
      const whole = wholeBodyOnScreen(q, W, H);
      if (q.paused) assert.ok(whole, `seed ${seed}: queen stopped partly off screen`);
      if (tending) assert.ok(whole, `seed ${seed}: workers tending a queen partly off screen`);
    }
  }
});

test('centipedes and house centipedes are scarcer than other bugs at every slider setting', async () => {
  const { pickWeighted } = await import('../src/lib/bugs/engine.js');
  for (const id of ['centipede', 'housecentipede']) {
    assert.ok(SPECIES[id].abundance < 0.6, `${id} abundance`);
    for (const weight of [1, 5, 10]) {
      const rng = seeded(weight * 7);
      const counts = { [id]: 0, ant: 0 };
      for (let i = 0; i < 20000; i++) counts[pickWeighted([id, 'ant'], { [id]: weight, ant: weight }, rng)]++;
      const share = counts[id] / (counts[id] + counts.ant);
      assert.ok(share < 0.36, `${id} at the same slider as ants makes up ${(share * 100).toFixed(0)}% (would be 50% without abundance)`);
    }
  }
  assert.ok(Object.values(SPECIES).filter(s => s.abundance !== undefined).every(s => ['centipede', 'housecentipede'].includes(s.id)));
});

test('bees never get stuck walking round in circles (dances and fleeing aside)', () => {
  const { BEE_IDS } = BEE_MODULE;
  let loops = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const crowd = new Set(), swarms = [];
    for (let k = 0; k < 3; k++) swarms.push(new Swarm({ species: BEE_IDS, count: 12, width: 1400, height: 800, rng: seeded(seed * 10 + k), crowd }));
    const track = new Map();
    for (let f = 0; f < 60 * 40; f++) {
      for (const s of swarms) s.update(1 / 60);
      for (const b of swarms.flatMap(s => s.bugs)) {
        if (b.done || b.delay > 0) continue;
        let k = track.get(b);
        if (!k) track.set(b, k = { sx: b.x, sy: b.y, px: b.x, py: b.y, path: 0, turn: 0, h: b.heading, t: 0, excused: false });
        k.path += Math.hypot(b.x - k.px, b.y - k.py); k.px = b.x; k.py = b.y;
        k.turn += Math.atan2(Math.sin(b.heading - k.h), Math.cos(b.heading - k.h)); k.h = b.heading; k.t += 1 / 60;
        if (b.dance || b.alarm > 0.15 || b.attend || b.duel) k.excused = true;
        if (k.t >= 4) {
          if (!k.excused && Math.abs(k.turn) > 2 * Math.PI && k.path > b.size * 4 && Math.hypot(b.x - k.sx, b.y - k.sy) < k.path * 0.3) loops++;
          Object.assign(k, { sx: b.x, sy: b.y, path: 0, turn: 0, t: 0, excused: false });
        }
      }
    }
  }
  assert.equal(loops, 0, `${loops} bees walked round in a circle`);
});

test('several kinds of ant, from big carpenter ants down to tiny pharaoh ants, each in its own colours', () => {
  assert.ok(ANT_IDS.length >= 6 && ANT_IDS[0] === 'ant', 'the original ant id is kept (carpenter ants)');
  const sizes = ANT_BREEDS.map(b => b.size[1]);
  assert.ok(Math.max(...sizes) / Math.min(...sizes) > 3, 'sizes span the real range');
  assert.equal(new Set(ANT_BREEDS.map(b => b.front.join() + b.gaster.join())).size, ANT_BREEDS.length, 'each kind looks different');
  for (const id of ANT_IDS) assert.ok(BUG_SPECIES.some(s => s.id === id && s.group === 'Ants'), `${id} listed under Ants`);
});

test('ants greet and follow the trails of their own kind only', () => {
  const a = createBug('fireant', { width: 800, height: 600, rng: seeded(1) });
  const b = createBug('pavementant', { width: 800, height: 600, rng: seeded(2) });
  Object.assign(a, { x: 400, y: 300, heading: 0, entered: true, affinity: 1 });
  Object.assign(b, { x: 400 + a.size * 1.2, y: 300, heading: Math.PI, entered: true, affinity: 1 });
  for (let f = 0; f < 240; f++) { stepBug(a, 1 / 60, 800, 600, [a, b]); stepBug(b, 1 / 60, 800, 600, [a, b]); }
  assert.equal(a.meet, null);
  assert.ok(!a.follow || a.follow.leader.species.id === a.species.id);
});

test('bumble bees: several species, round and furry, with their own hair bands; no waggle dance', () => {
  assert.ok(BUMBLE_IDS.length >= 6);
  for (const id of BUMBLE_IDS) {
    assert.ok(BUG_SPECIES.some(s => s.id === id && s.group === 'Bumble bees'), `${id} listed under Bumble bees`);
    assert.ok(!SPECIES[id].dances && !SPECIES[id].castes, `${id} neither dances nor has honey bee castes`);
    assert.ok(SPECIES[id].discR > 0.14, 'a broad, round body');
  }
  assert.equal(new Set(BUMBLE_BREEDS.map(b => b.face + b.thorax.join() + b.abdomen.join())).size, BUMBLE_BREEDS.length, 'each species has its own banding');
  const { ctx } = mockCanvas();
  for (const id of BUMBLE_IDS) for (const variant of [0.1, 0.9]) {
    const b = createBug(id, { width: 800, height: 600, rng: seeded(3) });
    b.variant = variant;
    SPECIES[id].draw(ctx, b);
  }
});

test('bumble bee wings lie back along each side, never crossing', async () => {
  const { WING } = await import('../src/lib/bugs/species/bumblebee.js');
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : k === 'rotate' ? a => calls.push(['r', a]) : k === 'translate' ? (x, y) => calls.push(['t', x, y]) : (k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  const b = createBug('easternbumblebee', { width: 800, height: 600, rng: seeded(4) });
  b.heading = 0;
  SPECIES.easternbumblebee.draw(ctx, b);
  const wings = calls.flatMap((c, i) => (c[0] === 't' && c[1] === WING.root.x && calls[i + 1]?.[0] === 'r' ? [[c[2], calls[i + 1][1]]] : []));
  assert.equal(wings.length, 2);
  for (const [y, a] of wings) assert.ok(Math.sign(Math.sin(a)) === Math.sign(y) && Math.cos(a) < 0);
});

test('spiders and yellowjackets hunt bumble bees too; every kind of ant counts as an ant to predators', async () => {
  const { danger } = await import('../src/lib/bugs/ecology.js');
  for (const id of BUMBLE_IDS) assert.ok(danger({ species: SPECIES.spider }, { species: SPECIES[id] }) > 0);
  for (const id of ANT_IDS) {
    assert.ok(danger({ species: SPECIES.housecentipede }, { species: SPECIES[id] }) > 0, `house centipedes ignore ${id}`);
    assert.ok(danger({ species: SPECIES[id] }, { species: SPECIES.bedbug }) > 0, `${id} doesn't hunt bed bugs`);
  }
});

test('bumble bees are chubby: about twice as long as they are wide, or rounder', async () => {
  const { HEAD_FRONT, ABDOMEN, THORAX } = await import('../src/lib/bugs/species/bumblebee.js');
  const length = HEAD_FRONT - (ABDOMEN.cx - ABDOMEN.rx), width = 2 * Math.max(ABDOMEN.ry, THORAX.ry);
  assert.ok(length / width < 2, `length to width ${(length / width).toFixed(2)}`);
  assert.ok(ABDOMEN.ry / ABDOMEN.rx > 0.85, 'a big, nearly round abdomen');
});

test('life size: with a calibrated screen every bug is drawn at its real body length, walking just the same', async () => {
  const { REAL_LENGTH_MM, DRAWN_LENGTH } = await import('../src/lib/bugs/lifesize.js');
  const { strideLength } = await import('../src/lib/bugs/engine.js');
  for (const id of Object.keys(SPECIES)) assert.ok(REAL_LENGTH_MM[id] && DRAWN_LENGTH[id], `${id} has a real length and a drawn length`);
  const pxPerMm = 4;
  for (const id of Object.keys(SPECIES)) {
    const sw = new Swarm({ species: [id], count: 12, width: 1400, height: 800, rng: seeded(3), lifePxPerMm: pxPerMm });
    const normal = new Swarm({ species: [id], count: 12, width: 1400, height: 800, rng: seeded(3) });
    sw.bugs.forEach((b, i) => {
      const mm = (b.size * DRAWN_LENGTH[id]) / 100 / pxPerMm, [lo, hi] = REAL_LENGTH_MM[id];
      if (!b.caste) assert.ok(mm >= lo - 0.01 && mm <= hi + 0.01, `${id} drawn ${mm.toFixed(2)} mm long, real ${lo}-${hi} mm`);
      const n = normal.bugs[i];
      if (b.caste === n.caste) {
        const cadence = b.cruise / strideLength(b), cadence0 = n.cruise / strideLength(n);
        assert.ok(Math.abs(cadence / cadence0 - 1) < 1e-9, `${id} steps at the same rate at life size`);
      }
    });
  }
});

test('life size keeps honey bee castes in proportion, and queens stay stately after resting', () => {
  const sw = new Swarm({ species: ['italianbee'], count: 20, width: 1400, height: 800, rng: seeded(5), lifePxPerMm: 5 });
  const q = sw.bugs.find(b => b.caste === 'queen'), w = sw.bugs.find(b => !b.caste);
  assert.ok(q && w);
  assert.ok(Math.abs(q.size / w.size - SPECIES.italianbee.castes.queen.size[0] / SPECIES.italianbee.size[0]) < 1e-9, 'queen to worker size ratio kept');
  Object.assign(q, { paused: true, stateTime: 0, entered: true });
  stepBug(q, 1 / 60, 1400, 800, [q]);
  const [lo, hi] = SPECIES.italianbee.speed;
  assert.ok(q.cruise <= hi * q.scale * SPECIES.italianbee.castes.queen.pace + 1e-9 && q.cruise >= lo * q.scale * SPECIES.italianbee.castes.queen.pace - 1e-9, 'a queen resumes at her own slow pace');
});

test('a calibration is stored in device pixels, so browser zoom is allowed for', async () => {
  const { cssPxPerMm } = await import('../src/lib/bugs/lifesize.js');
  assert.equal(cssPxPerMm(8, 2), 4);
  assert.equal(cssPxPerMm(8, 1), 8, 'zoomed out: more CSS pixels per mm');
  assert.equal(cssPxPerMm(8, 0), 8);
});

test('bumble bee wings are long for the body, reaching about the tip of the abdomen', async () => {
  const { WING, DRAWN_BODY, ABDOMEN } = await import('../src/lib/bugs/species/bumblebee.js');
  const { DRAWN_LENGTH } = await import('../src/lib/bugs/lifesize.js');
  assert.equal(DRAWN_BODY, DRAWN_LENGTH.easternbumblebee);
  const ratio = WING.length / DRAWN_BODY;
  assert.ok(ratio > 0.75 && ratio < 0.95, `forewing ${ratio.toFixed(2)} of body length (real ~0.8-0.9)`);
  const tipX = WING.root.x + Math.cos(Math.PI - WING.spread) * WING.length;
  assert.ok(Math.abs(tipX - (ABDOMEN.cx - ABDOMEN.rx)) < 15, 'resting wingtips near the end of the abdomen');
  assert.ok(Math.abs(WING.width / WING.length - 15 / 46) < 0.02, 'same wing shape, just bigger');
});

test('a bug stuck against another gently buzzes loose instead of staying stuck', async () => {
  const { bodyDiscs } = await import('../src/lib/bugs/engine.js');
  const gap = (a, b) => Math.min(...bodyDiscs(a).flatMap(m => bodyDiscs(b).map(t => Math.hypot(t.x - m.x, t.y - m.y) - m.r - t.r)));
  const q = createBug('italianbee', { width: 1000, height: 700, rng: seeded(1) });
  Object.assign(q, { caste: 'queen', size: SPECIES.italianbee.castes.queen.size[0], x: 500, y: 350, heading: 0, entered: true, fullyIn: true, paused: true, stateTime: 999, speed: 0 });
  const y = createBug('yellowjacket', { width: 1000, height: 700, rng: seeded(2) });
  Object.assign(y, { x: 500, y: 350 + q.size * 0.36, heading: -Math.PI / 2, entered: true, huntCooldown: 99 });
  y.species = { ...y.species, pauseRate: 0 };
  y.waypoints = [{ x: 500, y: 0 }, { x: 500, y: -300 }];   // its way lies straight through the queen
  let loosened = false, stuckFor = 0, longest = 0;
  for (let f = 0; f < 60 * 6; f++) {
    const x0 = y.x, y0 = y.y;
    stepBug(y, 1 / 60, 1000, 700, [q, y]);
    q.stateTime = 999;
    if (y.loosen) loosened = true;
    stuckFor = Math.hypot(y.x - x0, y.y - y0) < y.size * 0.25 / 60 && gap(y, q) < y.size * 0.06 ? stuckFor + 1 / 60 : 0;
    longest = Math.max(longest, stuckFor);
    assert.ok(gap(y, q) > -q.size * 0.05, 'never pushes into the queen');
  }
  assert.ok(longest < 2, `stuck for ${longest.toFixed(1)}s`);
  assert.ok(gap(y, q) > 0 || loosened, 'got clear of her');
});

test('bugs close on purpose (tending, fighting, greeting, resting) never count as stuck', async () => {
  const { checkStuck } = await import('../src/lib/bugs/engine.js');
  const other = createBug('italianbee', { width: 800, height: 600, rng: seeded(3) });
  Object.assign(other, { x: 400, y: 300, delay: 0, entered: true });
  for (const state of [{ attend: { queen: other } }, { duel: { rival: other } }, { meet: { partner: other } }, { paused: true }, { dance: { stage: 'run' } }]) {
    const b = createBug('italianbee', { width: 800, height: 600, rng: seeded(4) });
    Object.assign(b, { x: 400 + other.size * 0.6, y: 300, entered: true, ...state });
    for (let i = 0; i < 300; i++) checkStuck(b, [other], 0, 1 / 60);
    assert.equal(b.loosen, null, `${Object.keys(state)[0]} counted as stuck`);
  }
});

test('with every bug switched on, none stays stuck against another for long', async () => {
  const { bodyDiscs } = await import('../src/lib/bugs/engine.js');
  const gap = (a, b) => Math.min(...bodyDiscs(a).flatMap(m => bodyDiscs(b).map(t => Math.hypot(t.x - m.x, t.y - m.y) - m.r - t.r)));
  let worst = 0;
  for (const seed of [1, 2]) {
    const crowd = new Set(), swarms = [];
    for (let k = 0; k < 3; k++) swarms.push(new Swarm({ species: Object.keys(SPECIES), count: 20, width: 1400, height: 800, rng: seeded(seed * 10 + k), crowd }));
    const all = swarms.flatMap(s => s.bugs), stuck = new Map();
    for (let f = 0; f < 60 * 25; f++) {
      const pos = all.map(b => [b.x, b.y]);
      for (const s of swarms) s.update(1 / 60);
      all.forEach((b, i) => {
        if (b.done || b.delay > 0 || !b.entered || b.paused || b.attend || b.duel || b.meet || b.dance) return stuck.delete(b);
        const near = all.filter(o => o !== b && !o.done && o.delay <= 0 && Math.hypot(o.x - b.x, o.y - b.y) < o.size + b.size);
        if (Math.hypot(b.x - pos[i][0], b.y - pos[i][1]) < b.size * 0.25 / 60 && near.some(o => gap(b, o) < b.size * 0.06)) {
          const t = (stuck.get(b) ?? 0) + 1 / 60;
          stuck.set(b, t);
          worst = Math.max(worst, t);
        } else stuck.delete(b);
      });
    }
  }
  assert.ok(worst < 2, `a bug stayed stuck for ${worst.toFixed(1)}s`);
});

test('bugs scatter from a nearby mouse pointer, and ignore one far away', () => {
  const near = createBug('cockroach', { width: 800, height: 600, rng: seeded(1) });
  Object.assign(near, { x: 400, y: 300, heading: 0, entered: true });
  near.species = { ...near.species, pauseRate: 0 };
  near.waypoints = [{ x: 780, y: 300 }, { x: 900, y: 300 }];
  const start = Math.hypot(near.x - 420, near.y - 300);
  for (let f = 0; f < 60; f++) stepBug(near, 1 / 60, 800, 600, [near], { x: 420, y: 300 });
  assert.ok(near.alarm > 0.15, 'frightened');
  assert.ok(Math.hypot(near.x - 420, near.y - 300) > start * 2, 'ran away from the pointer');
  const far = createBug('cockroach', { width: 800, height: 600, rng: seeded(1) });
  Object.assign(far, { x: 100, y: 100, entered: true });
  stepBug(far, 1 / 60, 800, 600, [far], { x: 700, y: 500 });
  assert.equal(far.alarm, 0);
});

// A minimal page for the overlay: records listeners, hands out mock canvases, runs frames on demand.
function fakePage(now) {
  const listeners = { win: {}, doc: {} };
  const el = () => ({ style: {}, setAttribute() {}, attachShadow: () => ({ appendChild() {} }), getContext: () => mockCanvas().ctx, remove() {} });
  const frames = [];
  const win = {
    innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, performance: { now: () => now.t },
    addEventListener: (k, f) => { listeners.win[k] = f; }, removeEventListener: k => { delete listeners.win[k]; },
    requestAnimationFrame: f => frames.push(f)
  };
  const doc = {
    createElement: el, body: { appendChild() {} },
    addEventListener: (k, f) => { listeners.doc[k] = f; }, removeEventListener: k => { delete listeners.doc[k]; }
  };
  return { win, doc, listeners, frames };
}

test('pointer scatter: the page listens only when the option is on, a still pointer stops scaring, and listeners are removed', async () => {
  const { releaseSwarm, POINTER_QUIET_MS } = await import('../src/lib/bugs/overlay.js');
  const now = { t: 0 };
  const off = fakePage(now);
  releaseSwarm({ species: ['cockroach'], count: 1, doc: off.doc, win: off.win, rng: seeded(1) });
  assert.equal(off.listeners.win.pointermove, undefined, 'option off: the pointer is never watched');
  const on = fakePage(now);
  const done = releaseSwarm({ species: ['cockroach'], count: 1, scatter: true, doc: on.doc, win: on.win, rng: seeded(1) });
  assert.equal(typeof on.listeners.win.pointermove, 'function');
  on.listeners.win.pointermove({ clientX: 10, clientY: 20 });
  const run = () => { const f = on.frames.shift(); now.t += 16; f?.(now.t); };
  run();
  now.t += POINTER_QUIET_MS + 100;
  run();
  // Let the swarm finish and check the listeners are gone.
  for (let i = 0; i < 60 * 120 && on.frames.length; i++) run();
  await done;
  assert.equal(on.listeners.win.pointermove, undefined, 'stops listening when the bugs are gone');
});

// Runs a lone male firefly's flashing for a while; returns the pulses (start times) grouped into trains.
async function flashLog(id, seconds = 60, sameBurst = 0.9) {   // pulses closer than sameBurst s belong to one burst
  const { updateFlash } = await import('../src/lib/bugs/species/firefly.js');
  const b = createBug(id, { width: 800, height: 600, rng: seeded(7) });
  b.sex = 'male';
  const pulses = [];
  let lit = false;
  for (let t = 0; t < seconds; t += 1 / 120) {
    updateFlash(b, 1 / 120, [b]);
    if (b.glow > 0.4 && !lit) pulses.push(t);
    lit = b.glow > 0.4;
  }
  const trains = [];
  for (const p of pulses) {
    const last = trains.at(-1);
    if (last && p - last.at(-1) < sameBurst) last.push(p); else trains.push([p]);
  }
  return trains.slice(0, -1);   // the last burst may be cut off when the run ends
}
const gaps = trains => trains.slice(1).map((tr, i) => tr[0] - trains[i][0]);

test('fireflies flash their own species\' patterns', async () => {
  const dipper = await flashLog('bigdipperfirefly');
  assert.ok(dipper.every(t => t.length === 1), 'Big Dipper: one long flash at a time');
  assert.ok(gaps(dipper).every(g => g >= 4.4 && g <= 7.2), `Big Dipper flashes every 4-7 s (${gaps(dipper).map(g => g.toFixed(1))})`);
  const treetop = await flashLog('treetopfirefly');
  assert.ok(treetop.every(t => t.length === 1) && gaps(treetop).every(g => g >= 1.9 && g <= 3.1), 'tree-top flasher: a short flash every 2-3 s');
  const sw = await flashLog('southwestsyncfirefly');
  const lengths = sw.map(t => t.length);
  assert.ok(lengths.every(n => n >= 2 && n <= 5) && lengths.filter(n => n === 3).length > lengths.length / 2, `Southwest synchronous: mostly triplets (${lengths})`);
  assert.ok(sw.every(t => t.at(-1) - t[0] < 2), 'each burst over in about a second');
  const loopy = await flashLog('loopyfivefirefly', 120, 3);   // its pulses loop out over ~3 s
  assert.ok(loopy.every(t => t.length >= 3 && t.length <= 7), `loopy five: 4-7 pulses (${loopy.map(t => t.length)})`);
  assert.ok(gaps(loopy).every(g => g > 12), 'with more than 10 s of darkness between');
  const smokies = await flashLog('smokiessyncfirefly');
  assert.ok(smokies.every(t => t.length >= 5 && t.length <= 8), `Smokies synchronous: bursts of 5-8 (${smokies.map(t => t.length)})`);
});

test('synchronous fireflies fall into step; female fireflies only answer males of their kind', async () => {
  const sw = new Swarm({ species: ['smokiessyncfirefly'], count: 8, width: 600, height: 400, rng: seeded(3) });
  const males = sw.bugs.filter(b => b.sex === 'male');
  assert.ok(males.length >= 4);
  for (const b of sw.bugs) Object.assign(b, { delay: 0, entered: true, x: 200 + Math.random() * 200, y: 150 + Math.random() * 100, paused: true, stateTime: 999 });
  const starts = [];
  for (let f = 0; f < 60 * 40; f++) {
    for (const b of sw.bugs) b.stateTime = 999;
    sw.update(1 / 60);
    if (f > 60 * 30) for (const m of males) if (m.flash.train && m.flash.t < 1 / 60 + 1e-9) starts.push(f / 60);
  }
  starts.sort((a, b) => a - b);
  const spread = Math.max(...starts.slice(0, males.length)) - starts[0];
  assert.ok(spread < 0.3, `males start their bursts within ${spread.toFixed(2)} s of each other`);

  const { updateFlash } = await import('../src/lib/bugs/species/firefly.js');
  const female = createBug('bigdipperfirefly', { width: 800, height: 600, rng: seeded(4) });
  female.sex = 'female';
  let flashed = false;
  for (let t = 0; t < 30; t += 1 / 60) { updateFlash(female, 1 / 60, [female]); if (female.glow > 0.4) flashed = true; }
  assert.ok(!flashed, 'a female alone never flashes');
  const male = createBug('bigdipperfirefly', { width: 800, height: 600, rng: seeded(5) });
  Object.assign(male, { sex: 'male', x: female.x + 100, y: female.y });
  male.flash = { next: 0.01, train: null, t: 0, answer: null };
  let answeredAt = null;
  for (let t = 0; t < 6; t += 1 / 60) {
    updateFlash(male, 1 / 60, [male, female]);
    updateFlash(female, 1 / 60, [male, female]);
    if (answeredAt === null && female.glow > 0.4) answeredAt = t;
  }
  assert.ok(answeredAt !== null && answeredAt > 1.8 && answeredAt < 3.5, `the female answered ${answeredAt?.toFixed(2)} s after his flash`);
  assert.equal(male.court?.female, female, 'and he heads for her');
});

test('firefly glow is drawn in its own pass, not in the shadowed body layer; Photuris hunts Photinus', async () => {
  const { danger } = await import('../src/lib/bugs/ecology.js');
  const { FIREFLY_IDS, PHOTINUS_IDS } = await import('../src/lib/bugs/species/firefly.js');
  for (const id of FIREFLY_IDS) assert.ok(BUG_SPECIES.some(s => s.id === id && s.group === 'Fireflies'), `${id} listed under Fireflies`);
  for (const id of PHOTINUS_IDS) assert.ok(danger({ species: SPECIES.loopyfivefirefly }, { species: SPECIES[id] }) > 0, `loopy five hunts ${id}`);
  const b = createBug('bigdipperfirefly', { width: 800, height: 600, rng: seeded(6) });
  b.glow = 1;
  const body = mockCanvas(), glow = mockCanvas();
  SPECIES.bigdipperfirefly.draw(body.ctx, b);
  SPECIES.bigdipperfirefly.drawGlow(glow.ctx, b);
  assert.ok(glow.calls.includes('arc') && glow.calls.includes('createRadialGradient'), 'glow pass draws a halo');
  b.glow = 0;
  const dark = mockCanvas();
  SPECIES.bigdipperfirefly.drawGlow(dark.ctx, b);
  assert.equal(dark.calls.length, 0, 'no glow while dark');
});

test('every bug shown is an adult or nearly so: sizes vary only a little within a species, on screen and at life size', async () => {
  const { REAL_LENGTH_MM } = await import('../src/lib/bugs/lifesize.js');
  for (const [id, sp] of Object.entries(SPECIES)) {
    assert.ok(sp.size[1] / sp.size[0] <= 1.16, `${id} sizes ${sp.size} vary too much`);
    const [lo, hi] = REAL_LENGTH_MM[id];
    assert.ok(hi / lo <= 1.16, `${id} real length ${lo}-${hi} mm spans more than adult variation`);
  }
});

test('each firefly species is drawn with its own markings', async () => {
  const { FIREFLY_BREEDS } = await import('../src/lib/bugs/species/firefly.js');
  const looks = FIREFLY_BREEDS.map(b => JSON.stringify(b.look));
  assert.equal(new Set(looks).size, looks.length, 'no two species look alike');
  const by = id => FIREFLY_BREEDS.find(b => b.id === id).look;
  assert.equal(by('bigdipperfirefly').mark, 'spot', 'Big Dipper: a dark spot on a pink-red shield');
  assert.ok(by('treetopfirefly').ridges, 'tree-top flasher: ridged wing covers');
  assert.ok(by('southwestsyncfirefly').edgeW > by('bigdipperfirefly').edgeW, 'Southwest synchronous: broad pale edges');
  assert.ok(by('loopyfivefirefly').stripes && by('loopyfivefirefly').legLength > 1, 'loopy five: faint stripes and long legs');
  assert.equal(by('smokiessyncfirefly').mark, 'rect', 'Smokies synchronous: a dark rectangle on a pale shield');
  const { ctx } = mockCanvas();
  for (const b of FIREFLY_BREEDS) SPECIES[b.id].draw(ctx, createBug(b.id, { width: 800, height: 600, rng: seeded(1) }));
});

test('spiders: twelve common kinds in their own group, each looking and moving like itself', async () => {
  const { SPIDER_IDS, SPIDER_BREEDS } = await import('../src/lib/bugs/species/spider.js');
  assert.equal(SPIDER_IDS.length, 12);
  assert.equal(SPIDER_IDS[0], 'spider', 'the original spider id is kept (wolf spider)');
  for (const id of SPIDER_IDS) assert.ok(BUG_SPECIES.some(s => s.id === id && s.group === 'Spiders'), `${id} listed under Spiders`);
  const looks = SPIDER_BREEDS.map(b => JSON.stringify({ body: b.body, abdomen: b.abdomen, carapace: b.carapace, legLen: b.legLen, eyes: b.eyes }));
  assert.equal(new Set(looks).size, looks.length, 'no two spiders look alike');
  const by = id => SPIDER_BREEDS.find(b => b.id === id);
  assert.ok(by('cellarspider').legLen > 2.5, 'cellar spider: very long legs');
  assert.ok(by('boldjumper').eyes === 'jumper' && by('zebrajumper').eyes === 'jumper', 'jumping spiders: big front eyes');
  assert.ok(SPECIES.boldjumper.pace.dartRate > SPECIES.spider.pace.dartRate, 'jumping spiders hop more');
  assert.equal(by('brownrecluse').carapace, 'violin');
  assert.ok(by('crabspider').crab, 'crab spider holds its front legs out');
  // Sizes follow each kind's real body length, at the same scale as everything else.
  const { REAL_LENGTH_MM, DRAWN_LENGTH } = await import('../src/lib/bugs/lifesize.js');
  const pxPerMm = id => ((SPECIES[id].size[0] + SPECIES[id].size[1]) / 2) * DRAWN_LENGTH[id] / 100 / ((REAL_LENGTH_MM[id][0] + REAL_LENGTH_MM[id][1]) / 2);
  for (const id of SPIDER_IDS) assert.ok(Math.abs(pxPerMm(id) - 2.8) < 0.1, `${id} drawn at ${pxPerMm(id).toFixed(2)} px per mm`);
  const { ctx } = mockCanvas();
  for (const id of SPIDER_IDS) SPECIES[id].draw(ctx, createBug(id, { width: 800, height: 600, rng: seeded(1) }));
});

test('every spider counts as a spider to predators, and the crab spider is a bee ambusher', async () => {
  const { danger } = await import('../src/lib/bugs/ecology.js');
  const { SPIDER_IDS } = await import('../src/lib/bugs/species/spider.js');
  for (const id of SPIDER_IDS) {
    assert.ok(danger({ species: SPECIES.yellowjacket }, { species: SPECIES[id] }) > 0, `yellowjackets ignore ${id}`);
    assert.ok(danger({ species: SPECIES[id] }, { species: SPECIES.silverfish }) > 0, `${id} doesn't hunt silverfish`);
  }
  assert.ok(danger({ species: SPECIES.crabspider }, { species: SPECIES.italianbee }) > danger({ species: SPECIES.spider }, { species: SPECIES.italianbee }));
});
