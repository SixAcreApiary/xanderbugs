// Guards the Chrome Web Store submission: listing text limits, asset formats, versions and packaging.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = f => readFileSync(path.join(root, f), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const listing = read('docs/web-store-listing.md');

function pngInfo(file) {
  const b = readFileSync(path.join(root, file));
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bitDepth: b[24], colorType: b[25] };
}

test('manifest and package.json versions match', () => {
  assert.equal(JSON.parse(read('package.json')).version, manifest.version);
});

test('listing summary matches the manifest description and fits 132 chars', () => {
  assert.ok(manifest.description.length <= 132);
  assert.ok(listing.includes(`\n${manifest.description}\n`), 'summary in listing differs from manifest description');
});

test('test instructions fit the 500 char limit', () => {
  const start = listing.indexOf('```\n', listing.indexOf('## Test instructions')) + 4;
  const text = listing.slice(start, listing.indexOf('```', start)).trimEnd();
  assert.ok(text.length <= 500, `${text.length} chars`);
});

test('store images exist at required sizes as 24-bit PNG with no alpha', () => {
  const expected = {
    'store/screenshot-1-1280x800.png': [1280, 800],
    'store/screenshot-2-1280x800.png': [1280, 800],
    'store/screenshot-3-1280x800.png': [1280, 800],
    'store/promo-small-440x280.png': [440, 280],
    'icons/icon128.png': [128, 128]
  };
  for (const [file, [w, h]] of Object.entries(expected)) {
    assert.ok(listing.includes(file), `${file} not referenced in listing`);
    const info = pngInfo(file);
    assert.deepEqual([info.width, info.height], [w, h], file);
    if (file.startsWith('store/')) assert.deepEqual([info.bitDepth, info.colorType], [8, 2], `${file} must be 8-bit RGB`);
  }
});

test('mock site loads no remote, image or font assets', () => {
  const html = read('store/mock-site/index.html');
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /<img|<link|<script|@import|@font-face|url\(/i);
});

test('privacy policy and listing point at this repo', () => {
  const privacyUrl = 'https://github.com/SixAcreApiary/xanderbugs/blob/master/PRIVACY.md';
  assert.ok(listing.includes(privacyUrl));
  assert.ok(existsSync(path.join(root, 'PRIVACY.md')));
  assert.match(read('PRIVACY.md'), /github\.com\/SixAcreApiary\/xanderbugs\/issues/);
  assert.match(read('LICENSE'), /^MIT License/);
});

test('package script rejects a tag that does not match the manifest version', () => {
  const r = spawnSync('python3', [path.join(root, 'scripts/package.py'), 'v0.0.0-mismatch'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /does not match manifest version/);
});

test('package zip puts the extension and docs inside a xanderbugs/ folder', { skip: !existsSync(path.join(root, 'dist/manifest.json')) && 'run npm run build first' }, () => {
  const r = spawnSync('python3', [path.join(root, 'scripts/package.py')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const zip = path.join(root, r.stdout.trim());
  const list = spawnSync('python3', ['-c', 'import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zip], { encoding: 'utf8' });
  const names = list.stdout.trim().split('\n');
  assert.ok(names.every(n => n.startsWith('xanderbugs/')), 'every entry is under xanderbugs/');
  for (const f of ['manifest.json', 'content.bundle.js', 'README.md', 'LICENSE', 'PRIVACY.md']) assert.ok(names.includes(`xanderbugs/${f}`), f);
});
