export const HOUR_MS = 60 * 60 * 1000;
export const MIN_DELAY_MS = 30 * 1000;

export function randInt(min, max, rng = Math.random) {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// Returns sorted absolute timestamps for `count` events randomly placed within (now, now + windowMs].
export function planWindow({ min, max }, now, { windowMs = HOUR_MS, minDelayMs = MIN_DELAY_MS, rng = Math.random } = {}) {
  const count = randInt(min, max, rng);
  const span = Math.max(0, windowMs - minDelayMs);
  const times = [];
  for (let i = 0; i < count; i++) times.push(now + minDelayMs + Math.floor(rng() * span));
  return times.sort((a, b) => a - b);
}

