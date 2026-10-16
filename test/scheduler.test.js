import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWindow, randInt, HOUR_MS, MIN_DELAY_MS } from '../src/lib/scheduler.js';
import { seeded } from './helpers/mocks.js';

test('randInt stays within inclusive bounds and hits both ends', () => {
  const rng = seeded(7);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const n = randInt(2, 5, rng);
    assert.ok(n >= 2 && n <= 5);
    seen.add(n);
  }
  assert.deepEqual([...seen].sort(), [2, 3, 4, 5]);
});

test('planWindow count within [min,max] and times inside the window', () => {
  const rng = seeded(3);
  const now = 1_700_000_000_000;
  for (let i = 0; i < 500; i++) {
    const times = planWindow({ min: 1, max: 6 }, now, { rng });
    assert.ok(times.length >= 1 && times.length <= 6);
    for (const t of times) {
      assert.ok(t >= now + MIN_DELAY_MS, 'respects chrome.alarms minimum delay');
      assert.ok(t <= now + HOUR_MS);
    }
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
  }
});

test('planWindow with zero max plans nothing', () => {
  assert.deepEqual(planWindow({ min: 0, max: 0 }, Date.now()), []);
});
