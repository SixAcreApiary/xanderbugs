// Every selectable bug. Kinds we have several of are grouped (the options page shows each group under its own
// heading, groups and the bugs in them sorted alphabetically); ids are kept in step with the species files (the
// tests check).
export const BUG_SPECIES = [
  { id: 'cockroach', label: 'Cockroaches' },
  { id: 'centipede', label: 'Centipedes' },
  { id: 'silverfish', label: 'Silverfish' },
  { id: 'beetle', label: 'Beetles' },
  { id: 'earwig', label: 'Earwigs' },
  { id: 'yellowjacket', label: 'Yellowjackets' },
  { id: 'stinkbug', label: 'Stink bugs' },
  { id: 'bedbug', label: 'Bedbugs' },
  { id: 'housecentipede', label: 'House centipedes' },
  { id: 'ant', label: 'Carpenter', group: 'Ants' },
  { id: 'fieldant', label: 'Field', group: 'Ants' },
  { id: 'fireant', label: 'Fire', group: 'Ants' },
  { id: 'pavementant', label: 'Pavement', group: 'Ants' },
  { id: 'odoroushouseant', label: 'Odorous house', group: 'Ants' },
  { id: 'argentineant', label: 'Argentine', group: 'Ants' },
  { id: 'pharaohant', label: 'Pharaoh', group: 'Ants' },
  { id: 'italianbee', label: 'Italian', group: 'Honey bees' },
  { id: 'cordovanbee', label: 'Cordovan', group: 'Honey bees' },
  { id: 'buckfastbee', label: 'Buckfast', group: 'Honey bees' },
  { id: 'carniolanbee', label: 'Carniolan', group: 'Honey bees' },
  { id: 'caucasianbee', label: 'Caucasian', group: 'Honey bees' },
  { id: 'russianbee', label: 'Russian', group: 'Honey bees' },
  { id: 'darkbee', label: 'German black', group: 'Honey bees' },
  { id: 'easternbumblebee', label: 'Common eastern', group: 'Bumble bees' },
  { id: 'bufftailedbumblebee', label: 'Buff-tailed', group: 'Bumble bees' },
  { id: 'redtailedbumblebee', label: 'Red-tailed', group: 'Bumble bees' },
  { id: 'carderbumblebee', label: 'Common carder', group: 'Bumble bees' },
  { id: 'gardenbumblebee', label: 'Garden', group: 'Bumble bees' },
  { id: 'americanbumblebee', label: 'American', group: 'Bumble bees' },
  { id: 'yellowfacedbumblebee', label: 'Yellow-faced', group: 'Bumble bees' },
  { id: 'bigdipperfirefly', label: 'Big Dipper', group: 'Fireflies' },
  { id: 'treetopfirefly', label: 'Spring tree-top flasher', group: 'Fireflies' },
  { id: 'southwestsyncfirefly', label: 'Southwest synchronous', group: 'Fireflies' },
  { id: 'loopyfivefirefly', label: 'Loopy five', group: 'Fireflies' },
  { id: 'smokiessyncfirefly', label: 'Smokies synchronous', group: 'Fireflies' },
  { id: 'spider', label: 'Wolf spider', group: 'Spiders' },
  { id: 'housespider', label: 'American house spider', group: 'Spiders' },
  { id: 'blackwidow', label: 'Black widow', group: 'Spiders' },
  { id: 'boldjumper', label: 'Bold jumping spider', group: 'Spiders' },
  { id: 'brownrecluse', label: 'Brown recluse', group: 'Spiders' },
  { id: 'cellarspider', label: 'Cellar spider', group: 'Spiders' },
  { id: 'gardenspider', label: 'European garden spider', group: 'Spiders' },
  { id: 'yellowgardenspider', label: 'Yellow garden spider', group: 'Spiders' },
  { id: 'crabspider', label: 'Goldenrod crab spider', group: 'Spiders' },
  { id: 'giantspider', label: 'Giant house spider', group: 'Spiders' },
  { id: 'zebrajumper', label: 'Zebra jumping spider', group: 'Spiders' },
  { id: 'sacspider', label: 'Yellow sac spider', group: 'Spiders' }
];
export const OTHER_GROUP = 'Other bugs';

export const LIMITS = {
  perHour: { min: 0, max: 60 },
  perSwarm: { min: 1, max: 20 },
  speed: { min: 0.25, max: 2.5 },
  weight: { min: 1, max: 10, default: 5 },
  devicePxPerMm: { min: 1, max: 40 },   // a screen calibration: physical pixels per millimetre
  blocklistEntries: 200,
  blocklistEntryLength: 253
};

export const DEFAULTS = Object.freeze({
  enabled: true,
  bugs: { perHourMin: 2, perHourMax: 6, perSwarmMin: 1, perSwarmMax: 3, speed: 1, species: BUG_SPECIES.map(s => s.id),
    weights: Object.fromEntries(BUG_SPECIES.map(s => [s.id, LIMITS.weight.default])), lifeSize: false, devicePxPerMm: null, scatter: true },
  blocklist: []
});

const STORAGE_KEY = 'settings';

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function calibration(v) {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n >= LIMITS.devicePxPerMm.min && n <= LIMITS.devicePxPerMm.max ? Math.round(n * 1000) / 1000 : null;
}

function bool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback;
}

function pickIds(list, allowed, fallback) {
  if (!Array.isArray(list)) return [...fallback];
  const ok = new Set(allowed);
  return [...new Set(list.filter(x => typeof x === 'string' && ok.has(x)))];
}

function range(minV, maxV, limits, dMin, dMax) {
  let lo = clampInt(minV, limits.min, limits.max, dMin);
  let hi = clampInt(maxV, limits.min, limits.max, dMax);
  if (lo > hi) [lo, hi] = [hi, lo];
  return [lo, hi];
}

export function normalizeHostPattern(s) {
  if (typeof s !== 'string') return null;
  let p = s.trim().toLowerCase();
  if (!p) return null;
  p = p.replace(/^[a-z]+:\/\//, '').split('/')[0].split(':')[0];
  if (!/^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(p)) return null;
  return p.length <= LIMITS.blocklistEntryLength ? p : null;
}

export function validate(raw) {
  const d = DEFAULTS;
  const r = raw && typeof raw === 'object' ? raw : {};
  const b = r.bugs && typeof r.bugs === 'object' ? r.bugs : {};

  const [bMin, bMax] = range(b.perHourMin, b.perHourMax, LIMITS.perHour, d.bugs.perHourMin, d.bugs.perHourMax);
  const [wMin, wMax] = range(b.perSwarmMin, b.perSwarmMax, LIMITS.perSwarm, d.bugs.perSwarmMin, d.bugs.perSwarmMax);

  const speed = Number(b.speed);
  const w = b.weights && typeof b.weights === 'object' ? b.weights : {};
  const blocklist = Array.isArray(r.blocklist)
    ? [...new Set(r.blocklist.map(normalizeHostPattern).filter(Boolean))].slice(0, LIMITS.blocklistEntries)
    : [];

  return {
    enabled: bool(r.enabled, d.enabled),
    bugs: {
      perHourMin: bMin,
      perHourMax: bMax,
      perSwarmMin: wMin,
      perSwarmMax: wMax,
      speed: Number.isFinite(speed) ? Math.min(LIMITS.speed.max, Math.max(LIMITS.speed.min, Math.round(speed * 100) / 100)) : d.bugs.speed,
      species: pickIds(b.species, BUG_SPECIES.map(x => x.id), d.bugs.species),
      // How likely each species is to be picked for a swarm, relative to the others (1 rarely .. 10 constantly).
      weights: Object.fromEntries(BUG_SPECIES.map(x => [x.id, clampInt(w[x.id], LIMITS.weight.min, LIMITS.weight.max, LIMITS.weight.default)])),
      // Life size needs a credit-card calibration of the screen; without one it stays off.
      devicePxPerMm: calibration(b.devicePxPerMm),
      lifeSize: bool(b.lifeSize, d.bugs.lifeSize) && calibration(b.devicePxPerMm) !== null,
      // Bugs run from the mouse pointer.
      scatter: bool(b.scatter, d.bugs.scatter)
    },
    blocklist
  };
}

export async function loadSettings(storage = globalThis.chrome?.storage?.local) {
  const got = await storage.get(STORAGE_KEY);
  return validate(got?.[STORAGE_KEY]);
}

export async function saveSettings(settings, storage = globalThis.chrome?.storage?.local) {
  const clean = validate(settings);
  await storage.set({ [STORAGE_KEY]: clean });
  return clean;
}

// Calls fn(validatedSettings) whenever the stored settings change, from any page or tab.
export function onSettingsChanged(fn, events = globalThis.chrome?.storage?.onChanged) {
  events.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) fn(validate(changes[STORAGE_KEY].newValue));
  });
}

export { STORAGE_KEY };
