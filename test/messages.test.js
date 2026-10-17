import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidMessage } from '../src/lib/messages.js';

test('accepts well-formed messages', () => {
  assert.ok(isValidMessage({ target: 'content', type: 'spawn', species: ['ant', 'spider'], count: 3 }));
  assert.ok(isValidMessage({ target: 'sw', type: 'trigger', kind: 'bugs' }));
  assert.ok(isValidMessage({ target: 'sw', type: 'trigger', kind: 'bugs', species: 'housecentipede' }));
});

test('rejects malformed, hostile or retired (sound, clock) messages', () => {
  for (const m of [
    null, 'play', {},
    { target: 'offscreen', type: 'play', categories: ['screams'], volume: 0.5 },
    { target: 'content', type: 'queueSound', kind: 'play', categories: ['laughs'], volume: 0.5 },
    { target: 'sw', type: 'trigger', kind: 'sound', category: 'laughs' },
    { target: 'offscreen', type: 'chime', strikes: 3, volume: 0.5 },
    { target: 'sw', type: 'trigger', kind: 'chime' },
    { target: 'content', type: 'spawn', species: [], count: 1 },
    { target: 'content', type: 'spawn', species: ['ant'], count: 1000 },
    { target: 'content', type: 'spawn', species: ['ant'], count: 1.5 },
    { target: 'content', type: 'spawn', species: ['dragon'], count: 1 },
    { target: 'sw', type: 'trigger', kind: 'rm -rf' },
    { target: 'sw', type: 'trigger', kind: 'bugs', species: 'dragon' },
    { target: 'sw', type: 'eval', code: '1' }
  ]) assert.equal(isValidMessage(m), false, JSON.stringify(m));
});

test('spawn speed is optional but must be in range', () => {
  const base = { target: 'content', type: 'spawn', species: ['ant'], count: 1 };
  assert.ok(isValidMessage({ ...base, speed: 0.25 }));
  assert.ok(isValidMessage({ ...base, speed: 2.5 }));
  assert.equal(isValidMessage({ ...base, speed: 0.1 }), false);
  assert.equal(isValidMessage({ ...base, speed: 10 }), false);
  assert.equal(isValidMessage({ ...base, speed: '2' }), false);
});

test('spawn weights are optional but must be known species with whole numbers 1..10', () => {
  const base = { target: 'content', type: 'spawn', species: ['ant'], count: 1 };
  assert.ok(isValidMessage({ ...base, weights: { ant: 1, spider: 10 } }));
  assert.equal(isValidMessage({ ...base, weights: { ant: 0 } }), false);
  assert.equal(isValidMessage({ ...base, weights: { ant: 2.5 } }), false);
  assert.equal(isValidMessage({ ...base, weights: { dragon: 3 } }), false);
  assert.equal(isValidMessage({ ...base, weights: [5] }), false);
});

test('spawn messages may carry a screen calibration within range', () => {
  const base = { target: 'content', type: 'spawn', species: ['ant'], count: 1 };
  assert.ok(isValidMessage({ ...base, devicePxPerMm: 5 }));
  for (const bad of [0, 100, '5', null]) assert.ok(!isValidMessage({ ...base, devicePxPerMm: bad }), `${bad} rejected`);
});

test('spawn messages may say whether bugs scatter from the pointer', () => {
  const base = { target: 'content', type: 'spawn', species: ['ant'], count: 1 };
  assert.ok(isValidMessage({ ...base, scatter: true }));
  assert.ok(!isValidMessage({ ...base, scatter: 'yes' }));
});
