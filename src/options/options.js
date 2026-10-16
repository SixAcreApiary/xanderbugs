import { loadSettings, saveSettings, onSettingsChanged, DEFAULTS, LIMITS, BUG_SPECIES } from '../lib/settings.js';
import { parseBlocklist } from '../lib/blocklist.js';
import { createPreviewBug, drawPreview } from '../lib/bugs/preview.js';
import { releaseSwarm } from '../lib/bugs/overlay.js';
import { compositeWithShadow } from '../lib/bugs/shadow.js';

const $ = id => document.getElementById(id);
const statusEl = $('status');
let settings = null;
let saveTimer = null;

function speedLabel(pct) {
  const word = pct < 60 ? 'Creeping' : pct < 90 ? 'Slow' : pct <= 115 ? 'Natural' : pct <= 170 ? 'Quick' : 'Scurrying';
  return `${word} (${pct}%)`;
}

// The reset link only appears when the speed isn't already normal (100%).
function showSpeed() {
  const pct = Number($('bug-speed').value);
  $('bug-speed-out').textContent = speedLabel(pct);
  $('speed-natural').hidden = pct === 100;
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function el(tag, props = {}, children = []) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children);
  return n;
}

// Each specimen cell shows its bug walking in place.
const previews = [];
const WEIGHT_WORDS = ['Rarely', 'Rarely', 'Sometimes', 'Sometimes', 'Often', 'Often', 'Frequently', 'Frequently', 'Constantly', 'Constantly'];
const weightLabel = v => WEIGHT_WORDS[Math.min(9, Math.max(0, v - 1))];

// Each cell: a label (picture + checkbox + name) that toggles the bug, and, outside that label so
// dragging it can never toggle the checkbox, a slider for how often this bug is picked.
function renderSpecies() {
  const box = $('species');
  box.replaceChildren(...BUG_SPECIES.map(s => {
    const input = el('input', { type: 'checkbox', value: s.id, checked: settings.bugs.species.includes(s.id) });
    input.addEventListener('change', collectAndSave);
    const canvas = el('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    previews.push({ canvas, id: s.id });
    const weightId = `weight-${s.id}`;
    const slider = el('input', { type: 'range', id: weightId, min: LIMITS.weight.min, max: LIMITS.weight.max, step: 1, value: settings.bugs.weights[s.id] });
    slider.dataset.species = s.id;
    const out = el('output', { textContent: weightLabel(settings.bugs.weights[s.id]) });
    out.htmlFor = weightId;
    slider.addEventListener('input', () => { out.textContent = weightLabel(Number(slider.value)); collectAndSave(); });
    return el('div', { className: 'specimen' }, [
      el('label', { className: 'pick' }, [canvas, el('span', { className: 'tag' }, [input, el('b', { textContent: s.label })])]),
      el('div', { className: 'weight' }, [el('label', { htmlFor: weightId, textContent: 'How often' }), slider, out])
    ]);
  }));
  startPreviews();
}

let previewItems = [];
let previewLoop = false;
function startPreviews() {
  previewItems = previews.map(p => {
    const bug = createPreviewBug(p.id);
    const layer = document.createElement('canvas');
    return { ...p, bug, ctx: p.canvas.getContext('2d'), layer, lctx: layer.getContext('2d') };
  });
  if (previewLoop) return;
  previewLoop = true;
  let last = performance.now();
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const it of previewItems) {
      const { canvas, ctx, bug, layer, lctx } = it;
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = layer.width = Math.round(w * dpr);
        canvas.height = layer.height = Math.round(h * dpr);
      }
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.clearRect(0, 0, w, h);
      drawPreview(lctx, bug, dt, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      compositeWithShadow(ctx, layer, dpr);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Puts the stored settings into the form. Used on load and whenever settings change elsewhere
// (another settings tab, the right-click switch), so this page never holds a stale copy that a later save
// would write back over newer choices. The field being edited right now is left alone.
function syncForm() {
  const set = (id, prop, value) => { if (document.activeElement !== $(id)) $(id)[prop] = value; };
  set('enabled', 'checked', settings.enabled);
  set('bug-min', 'value', settings.bugs.perHourMin);
  set('bug-max', 'value', settings.bugs.perHourMax);
  set('swarm-min', 'value', settings.bugs.perSwarmMin);
  set('swarm-max', 'value', settings.bugs.perSwarmMax);
  set('bug-speed', 'value', Math.round(settings.bugs.speed * 100));
  showSpeed();
  set('blocklist', 'value', settings.blocklist.join('\n'));
  for (const input of $('species').querySelectorAll('input[type=checkbox]')) input.checked = settings.bugs.species.includes(input.value);
  for (const r of $('species').querySelectorAll('input[type=range]')) {
    if (document.activeElement !== r) r.value = settings.bugs.weights[r.dataset.species];
    r.nextElementSibling.textContent = weightLabel(Number(r.value));
  }
}

function checked(boxId) {
  return [...$(boxId).querySelectorAll('input[type=checkbox]:checked')].map(i => i.value);
}

function collect() {
  const lines = $('blocklist').value.split('\n').map(l => l.trim()).filter(Boolean);
  const parsed = parseBlocklist(lines.join('\n'));
  const note = $('blocklist-note');
  note.hidden = parsed.length === lines.length;
  note.textContent = note.hidden ? '' : `${lines.length - parsed.length} line(s) aren't valid site names and will be ignored.`;
  return {
    enabled: $('enabled').checked,
    bugs: {
      perHourMin: $('bug-min').value, perHourMax: $('bug-max').value,
      perSwarmMin: $('swarm-min').value, perSwarmMax: $('swarm-max').value,
      speed: Number($('bug-speed').value) / 100,
      species: checked('species'),
      weights: Object.fromEntries([...$('species').querySelectorAll('input[type=range]')].map(r => [r.dataset.species, Number(r.value)]))
    },
    blocklist: parsed
  };
}

function collectAndSave() {
  showSpeed();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      settings = await saveSettings(collect());
      reflectClamped();
      const warn = !settings.bugs.species.length ? 'Saved. No bugs are selected, so none will appear.' : 'Saved.';
      setStatus(warn);
    } catch (e) {
      setStatus(`Couldn't save settings: ${e.message}`, true);
    }
  }, 300);
}

// Show the values actually stored (e.g. min/max swapped or clamped) without re-rendering the previews.
function reflectClamped() {
  const map = {
    'bug-min': settings.bugs.perHourMin, 'bug-max': settings.bugs.perHourMax,
    'swarm-min': settings.bugs.perSwarmMin, 'swarm-max': settings.bugs.perSwarmMax
  };
  for (const [id, v] of Object.entries(map)) if (document.activeElement !== $(id)) $(id).value = v;
}

$('release').addEventListener('click', () => {
  const species = settings.bugs.species.length ? settings.bugs.species : DEFAULTS.bugs.species;
  const count = Math.max(settings.bugs.perSwarmMax, 3);
  releaseSwarm({ species, count, speed: settings.bugs.speed, weights: settings.bugs.weights });
  setStatus(`Released ${count} bug${count === 1 ? '' : 's'}.`);
});
$('reset').addEventListener('click', async () => {
  clearTimeout(saveTimer);
  saveTimer = null;
  settings = await saveSettings(DEFAULTS);
  syncForm();
  setStatus('Settings reset to defaults.');
});

// Min/Max buttons snap a field to its limit, nudging its partner so "at least" never exceeds "at most".
const PAIRS = { 'bug-min': 'bug-max', 'bug-max': 'bug-min', 'swarm-min': 'swarm-max', 'swarm-max': 'swarm-min' };
document.addEventListener('click', e => {
  const btn = e.target.closest('button[data-set]');
  if (!btn) return;
  const input = $(btn.dataset.for);
  input.value = btn.dataset.set === 'min' ? input.min : input.max;
  const partner = $(PAIRS[input.id]);
  const isLow = input.id.endsWith('-min');
  const v = Number(input.value), pv = Number(partner.value);
  if (isLow ? v > pv : v < pv) partner.value = input.value;
  collectAndSave();
});
for (const btn of document.querySelectorAll('button[data-set]')) {
  const input = $(btn.dataset.for);
  const what = btn.closest('.range-row').querySelector('.range-label').textContent.toLowerCase();
  const which = input.id.endsWith('-min') ? 'at least' : 'at most';
  const limit = btn.dataset.set === 'min' ? input.min : input.max;
  btn.setAttribute('aria-label', `Set ${what}, ${which}, to ${btn.dataset.set === 'min' ? 'minimum' : 'maximum'} (${limit})`);
}

$('speed-natural').addEventListener('click', () => {
  $('bug-speed').value = 100;
  $('bug-speed').dispatchEvent(new Event('input'));
});

for (const id of ['enabled', 'bug-min', 'bug-max', 'swarm-min', 'swarm-max', 'bug-speed', 'blocklist']) {
  $(id).addEventListener(['bug-speed', 'blocklist'].includes(id) ? 'input' : 'change', collectAndSave);
}

settings = await loadSettings();
renderSpecies();
syncForm();
onSettingsChanged(next => {
  settings = next;
  if (!saveTimer) syncForm();   // a local edit is about to be saved; it re-syncs after saving
});
