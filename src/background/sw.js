import { loadSettings, saveSettings, onSettingsChanged, STORAGE_KEY } from '../lib/settings.js';
import { planWindow, randInt, HOUR_MS } from '../lib/scheduler.js';
import { isValidMessage } from '../lib/messages.js';

const PLAN_ALARM = 'plan';
const MENU_ENABLED = 'enabled';
const EVENT_LATE_TOLERANCE_MS = 5 * 60 * 1000;

async function replan() {
  const s = await loadSettings();
  await chrome.alarms.clearAll();
  if (!s.enabled) return;
  const now = Date.now();
  const jobs = [];
  if (s.bugs.species.length) {
    planWindow({ min: s.bugs.perHourMin, max: s.bugs.perHourMax }, now)
      .forEach((t, i) => jobs.push(chrome.alarms.create(`bug:${t}:${i}`, { when: t })));
  }
  jobs.push(chrome.alarms.create(PLAN_ALARM, { when: now + HOUR_MS }));
  await Promise.all(jobs);
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

async function sendToActiveTab(msg) {
  const id = await activeTabId();
  if (id == null) return { ok: false, error: 'no-tab' };
  try {
    return (await chrome.tabs.sendMessage(id, { target: 'content', ...msg })) ?? { ok: false, error: 'no-response' };
  } catch {
    return { ok: false, error: 'no-content-script' };
  }
}

async function releaseBugs(s, onlySpecies) {
  const species = onlySpecies ? [onlySpecies] : s.bugs.species;
  if (!species.length) return { ok: false, error: 'no-species' };
  return sendToActiveTab({ type: 'spawn', species, count: randInt(s.bugs.perSwarmMin, s.bugs.perSwarmMax), speed: s.bugs.speed, weights: s.bugs.weights, scatter: s.bugs.scatter,
    ...(s.bugs.lifeSize && s.bugs.devicePxPerMm ? { devicePxPerMm: s.bugs.devicePxPerMm } : {}) });
}

chrome.alarms.onAlarm.addListener(async alarm => {
  const s = await loadSettings();
  const late = Date.now() - alarm.scheduledTime;
  if (alarm.name === PLAN_ALARM) return replan();
  if (!s.enabled) return;
  if (late > EVENT_LATE_TOLERANCE_MS) return;
  if (alarm.name.startsWith('bug:')) await releaseBugs(s);
});

// Clicking the toolbar icon releases a wave on the current tab (there is no popup). If bugs can't go
// there, the icon shows a brief "!" and its tooltip says why.
const CLICK_ERRORS = {
  'no-content-script': "Bugs can't visit this page (browser pages, the web store, or a tab opened before install that needs a reload).",
  blocked: 'This site is on your list of sites without bugs.',
  hidden: "This page isn't visible.",
  busy: 'Plenty of bugs here already.',
  'no-species': 'No bugs are selected in settings.'
};
const DEFAULT_TITLE = 'Xanderbugs: click to release bugs';

async function releaseFromIcon(tab) {
  const res = await releaseBugs(await loadSettings());
  if (res?.ok || tab?.id == null) return res;
  const tabId = tab.id;
  await chrome.action.setBadgeText({ tabId, text: '!' });
  await chrome.action.setTitle({ tabId, title: CLICK_ERRORS[res?.error] ?? `Couldn't release bugs (${res?.error ?? 'no response'}).` });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    chrome.action.setTitle({ tabId, title: DEFAULT_TITLE }).catch(() => {});
  }, 4000);
  return res;
}
chrome.action.onClicked.addListener(releaseFromIcon);

// Right-clicking the icon offers the on/off switch; Chrome adds "Options" to that menu itself.
async function setupMenu() {
  const s = await loadSettings();
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: MENU_ENABLED, title: 'Active Infestation', type: 'checkbox', checked: s.enabled, contexts: ['action'] });
}
chrome.contextMenus.onClicked.addListener(async info => {
  if (info.menuItemId !== MENU_ENABLED) return;
  await saveSettings({ ...(await loadSettings()), enabled: info.checked });
});
onSettingsChanged(s => chrome.contextMenus.update(MENU_ENABLED, { checked: s.enabled }).catch(() => {}));

chrome.runtime.onInstalled.addListener(details => {
  replan();
  setupMenu();
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(() => { replan(); setupMenu(); });

let replanTimer = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;
  clearTimeout(replanTimer);
  replanTimer = setTimeout(replan, 500);
});

// Test hook: lets the settings page release bugs on demand.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target !== 'sw') return false;
  const fromExtensionPage = sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(''));
  if (!fromExtensionPage || !isValidMessage(msg)) {
    sendResponse({ ok: false, error: 'rejected' });
    return false;
  }
  (async () => {
    const s = await loadSettings();
    return releaseBugs(s, msg.species);
  })().then(sendResponse, err => sendResponse({ ok: false, error: String(err?.message ?? err) }));
  return true;
});
