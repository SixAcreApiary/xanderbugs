import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, DEFAULTS, loadSettings, saveSettings, normalizeHostPattern, BUG_SPECIES } from '../src/lib/settings.js';
import { memoryStorage } from './helpers/mocks.js';

test('garbage input yields defaults', () => {
  for (const raw of [undefined, null, 42, 'x', [], {}]) assert.deepEqual(validate(raw), validate(DEFAULTS));
});

test('defaults: every species on, fastest crawl, no sound or clock settings', () => {
  const d = validate({});
  assert.equal('sounds' in d || 'volume' in d, false, 'sound features are gone');
  assert.equal(d.bugs.speed, 1, 'crawl speed defaults to natural (100%)');
  assert.deepEqual(d.bugs.species, BUG_SPECIES.map(s => s.id));
  assert.equal('chime' in d, false, 'the clock feature is gone');
});

test('ranges are clamped and min/max swapped when inverted', () => {
  const s = validate({ bugs: { perHourMin: '3', perHourMax: '7.6', perSwarmMin: 0, perSwarmMax: 500 } });
  assert.equal(s.bugs.perHourMin, 3);
  assert.equal(s.bugs.perHourMax, 8);
  assert.equal(s.bugs.perSwarmMin, 1);
  assert.equal(s.bugs.perSwarmMax, 20);
});

test('non-numeric ranges fall back to defaults', () => {
  const s = validate({ bugs: { perHourMin: 'abc', perHourMax: NaN } });
  assert.equal(s.bugs.perHourMin, DEFAULTS.bugs.perHourMin);
  assert.equal(s.bugs.perHourMax, DEFAULTS.bugs.perHourMax);
  const inv = validate({ bugs: { perHourMin: 99, perHourMax: -5 } });
  assert.deepEqual([inv.bugs.perHourMin, inv.bugs.perHourMax], [0, 60], 'clamped and swapped');
});

test('unknown ids and keys are dropped', () => {
  const s = validate({ evil: 1, volume: 0.5, sounds: { categories: ['screams'] }, bugs: { species: ['ant', '<img>', 'ant', 5] } });
  assert.equal('sounds' in s || 'volume' in s, false, 'old sound settings are dropped');
  assert.deepEqual(s.bugs.species, ['ant']);
  assert.equal('evil' in s, false);
});

test('empty selections are respected', () => {
  const s = validate({ bugs: { species: [] } });
  assert.deepEqual(s.bugs.species, []);
});

test('blocklist entries are normalized, deduped and invalid ones dropped', () => {
  const s = validate({ blocklist: ['https://Mail.Example.com/inbox', '*.foo.org', 'mail.example.com', 'bad host', '<script>', 7] });
  assert.deepEqual(s.blocklist, ['mail.example.com', '*.foo.org']);
});

test('normalizeHostPattern', () => {
  assert.equal(normalizeHostPattern(' example.com:8080 '), 'example.com');
  assert.equal(normalizeHostPattern('*.a.b'), '*.a.b');
  assert.equal(normalizeHostPattern('a*.b'), null);
  assert.equal(normalizeHostPattern(''), null);
});

test('save then load round-trips through storage under a single key', async () => {
  const store = memoryStorage();
  await saveSettings({ enabled: false, bugs: { species: ['spider'] } }, store);
  assert.deepEqual(Object.keys(store.data), ['settings']);
  const s = await loadSettings(store);
  assert.equal(s.enabled, false);
  assert.deepEqual(s.bugs.species, ['spider']);
});

test('crawl speed is clamped to 50%..250%', () => {
  assert.equal(validate({ bugs: { speed: 0.01 } }).bugs.speed, 0.5);
  assert.equal(validate({ bugs: { speed: 0.25 } }).bugs.speed, 0.5, 'an old quarter-speed setting is raised to half');
  assert.equal(validate({ bugs: { speed: 9 } }).bugs.speed, 2.5);
  assert.equal(validate({ bugs: { speed: '1.5' } }).bugs.speed, 1.5);
  assert.equal(validate({ bugs: { speed: 'zoom' } }).bugs.speed, 1);
});

test('a removed species left in saved settings is dropped', () => {
  assert.deepEqual(validate({ bugs: { species: ['harvestman', 'ant'] } }).bugs.species, ['ant']);
});

test('onSettingsChanged delivers validated settings only for our key in local storage', async () => {
  const { onSettingsChanged } = await import('../src/lib/settings.js');
  let listener;
  const seen = [];
  onSettingsChanged(s => seen.push(s), { addListener: fn => { listener = fn; } });
  listener({ settings: { newValue: { bugs: { species: ['ant', 'bogus'] } } } }, 'local');
  listener({ settings: { newValue: {} } }, 'sync');
  listener({ other: { newValue: 1 } }, 'local');
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].bugs.species, ['ant']);
});

test('bug weights: every species gets one, default 5, clamped to 1..10, junk dropped', () => {
  const d = validate({});
  assert.ok(BUG_SPECIES.every(s => d.bugs.weights[s.id] === 5));
  const s = validate({ bugs: { weights: { ant: 10, cockroach: 0, spider: 99, beetle: 'x', dragon: 7 } } });
  assert.equal(s.bugs.weights.ant, 10);
  assert.equal(s.bugs.weights.cockroach, 1);
  assert.equal(s.bugs.weights.spider, 10);
  assert.equal(s.bugs.weights.beetle, 5);
  assert.equal('dragon' in s.bugs.weights, false);
});

test('life size needs a valid screen calibration; without one it stays off', () => {
  assert.equal(DEFAULTS.bugs.lifeSize, false);
  assert.equal(DEFAULTS.bugs.devicePxPerMm, null);
  const ok = validate({ bugs: { lifeSize: true, devicePxPerMm: 5.25 } });
  assert.equal(ok.bugs.lifeSize, true);
  assert.equal(ok.bugs.devicePxPerMm, 5.25);
  assert.equal(validate({ bugs: { lifeSize: true } }).bugs.lifeSize, false, 'no calibration, no life size');
  for (const bad of [0, -3, 500, 'x', NaN, {}]) assert.equal(validate({ bugs: { lifeSize: true, devicePxPerMm: bad } }).bugs.devicePxPerMm, null, `${bad} rejected`);
  assert.equal(validate({ bugs: { lifeSize: false, devicePxPerMm: 6 } }).bugs.devicePxPerMm, 6, 'a calibration is kept even with life size off');
});

test('pointer scatter is on by default and saved as a true/false switch', () => {
  assert.equal(DEFAULTS.bugs.scatter, true);
  assert.equal(validate({ bugs: { scatter: false } }).bugs.scatter, false);
  assert.equal(validate({ bugs: { scatter: 'yes' } }).bugs.scatter, true, 'junk falls back to the default');
});
