// Seeded PRNG so tests are deterministic.
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Records canvas calls and asserts every numeric argument is finite.
export function mockCanvas() {
  const calls = [];
  const gradient = { addColorStop() {} };
  const target = {};
  return {
    calls,
    ctx: new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop];
        return (...args) => {
          for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`non-finite arg to ${String(prop)}: ${args}`);
          calls.push(prop);
          return prop.startsWith('create') ? gradient : undefined;
        };
      },
      set(t, prop, v) { t[prop] = v; return true; }
    })
  };
}

// Minimal in-memory chrome.storage.local.
export function memoryStorage(initial = {}) {
  const data = structuredClone(initial);
  return {
    data,
    async get(key) { return key == null ? structuredClone(data) : { [key]: structuredClone(data[key]) }; },
    async set(obj) { Object.assign(data, structuredClone(obj)); }
  };
}
