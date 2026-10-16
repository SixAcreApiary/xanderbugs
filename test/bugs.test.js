import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Swarm, SPECIES, createBug, stepBug } from '../src/lib/bugs/engine.js';
import { sampleTrail } from '../src/lib/bugs/species/centipede.js';
import { BUG_SPECIES } from '../src/lib/settings.js';
import { seeded, mockCanvas } from './helpers/mocks.js';

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

test('turning on the spot steps the legs: the two sides move in opposite directions', async () => {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const b = createBug('cockroach', { width: 800, height: 600, rng: seeded(2) });
  const l0 = b.phaseL, r0 = b.phaseR;
  advanceGait(b, 0, 0.3);
  assert.ok(b.phaseL > l0, 'outer (left) side steps forward on a clockwise turn');
  assert.ok(b.phaseR < r0, 'inner (right) side steps backward');
  assert.ok(b.phase > 0, 'overall gait advances, so antennae/body flex animate too');
});

test('walking straight keeps both sides in step and re-syncs them after a turn', async () => {
  const { advanceGait } = await import('../src/lib/bugs/engine.js');
  const b = createBug('ant', { width: 800, height: 600, rng: seeded(4) });
  assert.equal(b.phaseL, b.phaseR, 'start in a coordinated tripod gait');
  advanceGait(b, 0, 0.5);
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
    b.waypoints = [{ x: 400, y: 0 }, { x: 400, y: -500 }];
    b.heading = 0;
    for (let i = 0; i < 60; i++) stepBug(b, 1 / 60, 800, 600);
    assert.ok(Math.abs(b.heading) < SPECIES[id].maxTurn * 0.15, `${id} turned ${b.heading.toFixed(3)} rad in 1 s while stopped`);
    assert.notEqual(b.phaseL, b.phaseR, `${id} legs stepped while turning`);
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

test('spiders use an alternating tetrapod: L1+R2+L3+R4 vs R1+L2+R3+L4', () => {
  const bug = { speedScale: 1 };
  const o = (leg, side) => gaitLib.tetrapodGait(bug, leg, side).offset;
  const groupA = [o(0, -1), o(1, 1), o(2, -1), o(3, 1)];
  const groupB = [o(0, 1), o(1, -1), o(2, 1), o(3, -1)];
  assert.ok(groupA.every(v => v === groupA[0]) && groupB.every(v => v === groupB[0]));
  assert.equal(Math.abs(groupA[0] - groupB[0]), 0.5);
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
    assert.equal(hips.length, { spider: 4, housecentipede: 15 }[id] ?? 3, `${id} leg pairs`);
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
// uninterrupted walking (pauses and grooming reset the window).
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
      if (b.paused) k.clean = false;
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

test('housefly has been removed and old saved settings that pick it are cleaned up', async () => {
  assert.equal(SPECIES.housefly, undefined);
  assert.ok(!BUG_SPECIES.some(s => s.id === 'housefly'));
  const { validate } = await import('../src/lib/settings.js');
  const v = validate({ bugs: { species: ['housefly', 'ant'], weights: { housefly: 9, ant: 3 } } });
  assert.deepEqual(v.bugs.species, ['ant']);
  assert.equal(v.bugs.weights.housefly, undefined);
});

test('only ants greet each other; other bugs just give way', () => {
  assert.ok(SPECIES.ant.greets);
  assert.ok(Object.values(SPECIES).filter(s => s.greets).every(s => s.id === 'ant'));
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

test('every species tells its walking legs where the body edge is', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const dir = new URL('../src/lib/bugs/species/', import.meta.url);
  for (const f of await readdir(dir)) {
    const src = await readFile(new URL(f, dir), 'utf8');
    for (const call of src.match(/walkLeg\(ctx, bug, \{[^}]*/g) ?? []) assert.match(call, /\bedge:/, `${f}: ${call.slice(0, 60)}`);
  }
});
