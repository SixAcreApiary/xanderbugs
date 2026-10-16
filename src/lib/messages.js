import { BUG_SPECIES, LIMITS } from './settings.js';

const SPECIES = new Set(BUG_SPECIES.map(s => s.id));

const isIdList = (l, allowed) => Array.isArray(l) && l.length <= 64 && l.every(x => allowed.has(x));
const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const isWeights = w => w && typeof w === 'object' && !Array.isArray(w)
  && Object.entries(w).every(([k, v]) => SPECIES.has(k) && isInt(v, LIMITS.weight.min, LIMITS.weight.max));

// Strict shape checks for every message the extension exchanges internally.
export function isValidMessage(m) {
  if (!m || typeof m !== 'object') return false;
  switch (`${m.target}:${m.type}`) {
    case 'content:spawn':
      return isIdList(m.species, SPECIES) && m.species.length > 0 && isInt(m.count, 1, LIMITS.perSwarm.max)
        && (m.speed === undefined || (typeof m.speed === 'number' && m.speed >= LIMITS.speed.min && m.speed <= LIMITS.speed.max))
        && (m.weights === undefined || isWeights(m.weights))
        && (m.devicePxPerMm === undefined || (typeof m.devicePxPerMm === 'number' && m.devicePxPerMm >= LIMITS.devicePxPerMm.min && m.devicePxPerMm <= LIMITS.devicePxPerMm.max));
    case 'sw:trigger':
      return m.kind === 'bugs' && (m.species === undefined || SPECIES.has(m.species));
    default:
      return false;
  }
}
