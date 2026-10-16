import { normalizeHostPattern } from './settings.js';

export function parseBlocklist(text) {
  return [...new Set(String(text ?? '').split(/[\s,]+/).map(normalizeHostPattern).filter(Boolean))];
}

// "example.com" blocks example.com and its subdomains; "*.example.com" blocks only subdomains.
export function isBlocked(hostname, list) {
  const host = String(hostname ?? '').toLowerCase().replace(/\.$/, '');
  if (!host || !Array.isArray(list)) return false;
  return list.some(p => {
    if (p.startsWith('*.')) return host.endsWith(p.slice(1));
    return host === p || host.endsWith('.' + p);
  });
}
