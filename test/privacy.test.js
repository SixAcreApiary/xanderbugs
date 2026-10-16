// Guards the privacy promise: no network APIs, no remote URLs, nothing stored but settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const walk = dir => readdirSync(dir).flatMap(f => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const shipped = walk(path.join(root, 'src')).filter(f => /\.(js|html|css)$/.test(f));
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));

const NETWORK = [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/, /importScripts/, /RTCPeerConnection/, /\bnavigator\.(?:geolocation|connection)/];

test('shipped code uses no network APIs', () => {
  for (const f of shipped) {
    const src = readFileSync(f, 'utf8');
    for (const re of NETWORK) assert.doesNotMatch(src, re, `${path.relative(root, f)} matches ${re}`);
  }
});

// The one allowed web address: the settings page's "Buy me a coffee" link. It is a plain link that opens
// in a new tab only when clicked; nothing is loaded from or sent to that site otherwise.
const SUPPORT_LINK = '<a class="support" href="https://buymeacoffee.com/xanderphillips" target="_blank" rel="noopener noreferrer">';

test('shipped code references no remote URLs (except the clicked-only support link)', () => {
  for (const f of [...shipped, path.join(root, 'manifest.json')]) {
    const src = readFileSync(f, 'utf8').replace(SUPPORT_LINK, '');
    assert.doesNotMatch(src, /(?:https?:|wss?:)?\/\/[a-z0-9-]+\.[a-z]/i, path.relative(root, f));
  }
  const options = readFileSync(path.join(root, 'src/options/options.html'), 'utf8');
  assert.equal(options.split(SUPPORT_LINK).length, 2, 'support link appears exactly once, as a new-tab link with no referrer');
});

test('only chrome.storage.local is used, and only by the settings module', () => {
  for (const f of shipped) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /storage\.(sync|session|managed)/, path.relative(root, f));
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|document\.cookie/, path.relative(root, f));
    if (!f.endsWith(path.join('lib', 'settings.js'))) assert.doesNotMatch(src, /storage\.local/, path.relative(root, f));
  }
});

test('content script never reads page content', () => {
  const src = readFileSync(path.join(root, 'src/content/content.js'), 'utf8');
  for (const re of [/innerHTML|innerText|textContent|querySelector|document\.title|location\.href|document\.cookie|\.value\b/]) {
    assert.doesNotMatch(src, re);
  }
});

test('manifest requests minimal permissions and locks down CSP', () => {
  assert.deepEqual([...manifest.permissions].sort(), ['alarms', 'contextMenus', 'storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.externally_connectable, undefined);
  const csp = manifest.content_security_policy.extension_pages;
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'Xanderbugs');
  assert.equal(manifest.short_name, 'Xanderbugs');
});

test('no extension files are exposed to web pages', () => {
  assert.equal(manifest.web_accessible_resources, undefined);
});

test('manifest files exist', () => {
  const refs = [manifest.background.service_worker, manifest.options_page,
    ...Object.values(manifest.icons), 'src/content/content.js'];
  for (const r of refs) assert.ok(statSync(path.join(root, r)).isFile(), r);
});
