// Loads the built extension into Chromium and exercises the real event paths.
// Run with `npm run test:e2e` (requires `npx playwright install chromium` once).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dist = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'dist');
let context, sw, server, pageUrl, profile, extId;
const offDevice = [];

before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><title>test page</title><body style="height:2000px"><h1>Hello</h1></body>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  pageUrl = `http://127.0.0.1:${server.address().port}/`;
  ({ context, sw, profile } = await launch());
  extId = new URL(sw.url()).host;
});

after(async () => {
  await context?.close();
  server?.close();
  if (profile) rmSync(profile, { recursive: true, force: true });
});

async function launch(extraArgs = []) {
  const dir = mkdtempSync(path.join(tmpdir(), 'xanderbugs-e2e-'));
  const ctx = await chromium.launchPersistentContext(dir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, ...extraArgs]
  });
  ctx.on('request', req => {
    const u = req.url();
    if (!u.startsWith('chrome-extension://') && !u.startsWith(pageUrl) && !u.startsWith('data:')) offDevice.push(u);
  });
  const worker = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker');
  return { context: ctx, sw: worker, profile: dir };
}

// Extension pages forbid eval, so poll text from the test side instead of page.waitForFunction.
async function waitForStatus(page, re, timeout = 10_000) {
  const end = Date.now() + timeout;
  let text = '';
  while (Date.now() < end) {
    text = await page.locator('#status').textContent();
    if (re.test(text)) return text;
    await page.waitForTimeout(100);
  }
  throw new Error(`status never matched ${re}; last: "${text}"`);
}

async function openTestPage() {
  const page = await context.newPage();
  await page.goto(pageUrl);
  await page.bringToFront();
  await page.waitForTimeout(500);
  return page;
}

test('bugs appear on a page and clean themselves up', { timeout: 90_000 }, async () => {
  const page = await openTestPage();
  const res = await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return chrome.tabs.sendMessage(tab.id, { target: 'content', type: 'spawn', species: ['cockroach'], count: 2 });
  });
  assert.deepEqual(res, { ok: true, spawned: 2 });
  await page.waitForSelector('[data-xanderbugs-overlay]', { state: 'attached', timeout: 5000 });
  await page.waitForSelector('[data-xanderbugs-overlay]', { state: 'detached', timeout: 80_000 });
  const pointerEvents = await page.evaluate(() => getComputedStyle(document.body).pointerEvents);
  assert.notEqual(pointerEvents, 'none');
  await page.close();
});

test('blocklisted sites get no bugs', async () => {
  const page = await openTestPage();
  const res = await sw.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...(settings ?? {}), blocklist: ['127.0.0.1'] } });
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const r = await chrome.tabs.sendMessage(tab.id, { target: 'content', type: 'spawn', species: ['ant'], count: 1 });
    await chrome.storage.local.set({ settings: { ...(settings ?? {}), blocklist: [] } });
    return r;
  });
  assert.deepEqual(res, { ok: false, error: 'blocked' });
  await page.close();
});

test('content script rejects malformed messages', async () => {
  const page = await openTestPage();
  const res = await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return chrome.tabs.sendMessage(tab.id, { target: 'content', type: 'spawn', species: ['dragon'], count: 999 }).catch(e => 'error: ' + e.message);
  });
  assert.match(String(res), /error|undefined/);
  await page.close();
});

test('options page saves settings with validation', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/src/options/options.html`);
  await page.fill('#bug-min', '9');
  await page.fill('#bug-max', '2');
  await page.locator('#bug-max').dispatchEvent('change');
  await waitForStatus(page, /^Saved/);
  const s = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.bugs);
  assert.equal(s.perHourMin, 2, 'min/max swapped when entered backwards');
  assert.equal(s.perHourMax, 9);
  assert.equal(await page.locator('#volume, #snd-min, #sound-cats').count(), 0, 'sound and volume controls are gone');
  await page.locator('#bug-speed').fill('50');
  await waitForStatus(page, /^Saved/);
  await page.waitForTimeout(400);
  const bugs = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.bugs);
  assert.equal(bugs.speed, 0.5);
  assert.match(await page.locator('#bug-speed-out').textContent(), /Creeping \(50%\)/);
  await page.fill('#bug-max', '6');
  await page.locator('#bug-max').dispatchEvent('change');
  await page.click('button[data-set="max"][data-for="bug-min"]');
  await page.waitForTimeout(500);
  let b = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.bugs);
  assert.equal(b.perHourMin, 60, 'Max sets at-least to its limit');
  assert.equal(b.perHourMax, 60, 'and raises at-most to match');
  await page.click('button[data-set="min"][data-for="swarm-max"]');
  await page.waitForTimeout(500);
  b = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.bugs);
  assert.equal(b.perSwarmMax, 1, 'Min sets at-most to its limit');
  assert.equal(b.perSwarmMin, 1, 'and lowers at-least to match');
  await page.click('#reset');
  await page.close();
});

test('bug frequency sliders save without toggling the bug on or off', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/src/options/options.html`);
  await page.locator('#weight-spider').waitFor();
  await page.locator('#weight-spider').fill('9');
  await page.locator('#weight-spider').dispatchEvent('input');
  await page.locator('#weight-ant').click();
  await page.waitForTimeout(600);
  const bugs = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.bugs);
  assert.equal(bugs.weights.spider, 9);
  assert.ok(bugs.species.includes('ant') && bugs.species.includes('spider'), 'checkboxes unchanged by slider use');
  assert.equal(await page.locator('#weight-spider + output').textContent(), 'Constantly');
  await page.click('#reset');
  await page.close();
});

test('two settings tabs and the right-click switch never undo each other\'s choices', async () => {
  const base = `chrome-extension://${extId}/src`;
  const A = await context.newPage();
  await A.goto(`${base}/options/options.html`);
  const B = await context.newPage();
  await B.goto(`${base}/options/options.html`);
  await A.waitForTimeout(500);
  const stored = () => sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  await A.locator('#species input[value=ant]').uncheck();
  await A.waitForTimeout(700);
  assert.equal(await B.locator('#species input[value=ant]').isChecked(), false, 'other tab updates live');
  await B.locator('#bug-speed').fill('200');
  await B.locator('#bug-speed').dispatchEvent('input');
  await B.waitForTimeout(700);
  assert.ok(!(await stored()).bugs.species.includes('ant'), 'saving in tab B keeps tab A\'s change');
  await B.click('#speed-natural');
  await B.waitForTimeout(700);
  assert.equal((await stored()).bugs.speed, 1, 'the 100% button sets natural speed');
  assert.match(await A.locator('#bug-speed-out').textContent(), /100%/, 'and the other tab shows it');
  // The right-click "Active Infestation" switch saves through the same settings module (read, then write).
  await sw.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, enabled: false } });
  });
  await A.waitForTimeout(500);
  assert.equal(await A.locator('#enabled').isChecked(), false, 'switching off elsewhere reaches the settings page');
  assert.ok(!(await stored()).bugs.species.includes('ant'), 'and keeps earlier choices');
  await A.click('#reset');
  await A.waitForTimeout(500);
  assert.equal(await B.locator('#species input[value=ant]').isChecked(), true, 'reset reaches the other tab');
  for (const p of [A, B]) await p.close();
});

test('clicking the toolbar icon releases bugs (no popup), right-click menu has the switch', async () => {
  const info = await sw.evaluate(async () => ({
    popup: await chrome.action.getPopup({}),
    clickHandled: chrome.action.onClicked.hasListeners(),
    menuHandled: chrome.contextMenus.onClicked.hasListeners(),
    title: await chrome.action.getTitle({})
  }));
  assert.equal(info.popup, '', 'no popup, so a click reaches the extension');
  assert.ok(info.clickHandled && info.menuHandled);
  assert.match(info.title, /click to release bugs/);
});

test('only bug and replanning alarms are scheduled, and no audio page exists', async () => {
  const names = await sw.evaluate(async () => (await chrome.alarms.getAll()).map(a => a.name));
  assert.ok(names.includes('plan'));
  assert.ok(names.some(n => n.startsWith('bug:')));
  assert.deepEqual(names.filter(n => n !== 'plan' && !n.startsWith('bug:')), [], 'no sound or clock alarms');
  const hasOffscreenApi = await sw.evaluate(() => typeof chrome.offscreen !== 'undefined');
  assert.equal(hasOffscreenApi, false, 'offscreen permission is no longer requested');
});

test('only the settings object is stored', async () => {
  const keys = await sw.evaluate(async () => Object.keys(await chrome.storage.local.get(null)));
  assert.deepEqual(keys.filter(k => k !== 'settings'), []);
});

test('no requests left the device', () => {
  assert.deepEqual(offDevice, []);
});
