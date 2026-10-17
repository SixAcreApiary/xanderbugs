import { loadSettings } from '../lib/settings.js';
import { isBlocked } from '../lib/blocklist.js';
import { isValidMessage } from '../lib/messages.js';
import { releaseSwarm } from '../lib/bugs/overlay.js';

const MAX_ACTIVE_SWARMS = 3;

let activeSwarms = 0;

async function blockedHere() {
  const s = await loadSettings();
  return isBlocked(location.hostname, s.blocklist);
}

async function handle(msg) {
  if (await blockedHere()) return { ok: false, error: 'blocked' };
  if (document.visibilityState !== 'visible') return { ok: false, error: 'hidden' };
  if (activeSwarms >= MAX_ACTIVE_SWARMS) return { ok: false, error: 'busy' };
  activeSwarms++;
  releaseSwarm({ species: msg.species, count: msg.count, speed: msg.speed ?? 1, weights: msg.weights, devicePxPerMm: msg.devicePxPerMm, scatter: msg.scatter === true }).finally(() => { activeSwarms--; });
  return { ok: true, spawned: msg.count };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || msg?.target !== 'content' || !isValidMessage(msg)) return false;
  handle(msg).then(sendResponse, err => sendResponse({ ok: false, error: String(err?.message ?? err) }));
  return true;
});
