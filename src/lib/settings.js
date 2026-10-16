export const BUG_SPECIES = [
  { id: 'ant', label: 'Ants' },
  { id: 'cockroach', label: 'Cockroaches' },
  { id: 'centipede', label: 'Centipedes' },
  { id: 'spider', label: 'Spiders' },
  { id: 'silverfish', label: 'Silverfish' },
  { id: 'beetle', label: 'Beetles' },
  { id: 'earwig', label: 'Earwigs' },
  { id: 'yellowjacket', label: 'Yellowjackets' },
  { id: 'stinkbug', label: 'Stink bugs' },
  { id: 'bedbug', label: 'Bedbugs' },
  { id: 'housecentipede', label: 'House centipedes' }
];

export const LIMITS = {
  perHour: { min: 0, max: 60 },
  perSwarm: { min: 1, max: 20 },
  speed: { min: 0.25, max: 2.5 },
  weight: { min: 1, max: 10, default: 5 },
  blocklistEntries: 200,
  blocklistEntryLength: 253
};

export const DEFAULTS = Object.freeze({
  enabled: true,
  bugs: { perHourMin: 2, perHourMax: 6, perSwarmMin: 1, perSwarmMax: 3, speed: 1, species: BUG_SPECIES.map(s => s.id),
    weights: Object.fromEntries(BUG_SPECIES.map(s => [s.id, LIMITS.weight.default])) },
  blocklist: []
});

const STORAGE_KEY = 'settings';

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
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
      weights: Object.fromEntries(BUG_SPECIES.map(x => [x.id, clampInt(w[x.id], LIMITS.weight.min, LIMITS.weight.max, LIMITS.weight.default)]))
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
