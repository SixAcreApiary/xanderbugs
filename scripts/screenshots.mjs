// Captures README screenshots and Chrome Web Store assets. Run `npm run screenshots` (needs the Playwright Chromium).
// Store images must be 24-bit PNG with no alpha; every PNG written here is checked for that.
// Pass --no-video to skip the demo recording.
import { chromium } from 'playwright';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, readdirSync, renameSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const docsDir = path.join(root, 'docs', 'screenshots');
const storeDir = path.join(root, 'store');
const SIZE = { width: 1280, height: 800 };
const DEMO_SPECIES = ['ant', 'cockroach', 'spider', 'centipede', 'beetle', 'yellowjacket', 'stinkbug', 'housecentipede'];
mkdirSync(docsDir, { recursive: true });

function pngIsOpaqueRgb(file) {
  const b = readFileSync(file);
  return b.toString('ascii', 12, 16) === 'IHDR' && b[24] === 8 && b[25] === 2;
}

const mock = readFileSync(path.join(storeDir, 'mock-site', 'index.html'));
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(mock); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const siteUrl = `http://127.0.0.1:${server.address().port}/`;

async function launch(extra = {}) {
  const profile = mkdtempSync(path.join(tmpdir(), 'xanderbugs-shots-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    ...extra
  });
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker');
  const close = async () => { await ctx.close(); rmSync(profile, { recursive: true, force: true }); };
  return { ctx, sw, id: new URL(sw.url()).host, close };
}

async function releaseBugs(sw, count) {
  return sw.evaluate(async ({ species, count }) => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return chrome.tabs.sendMessage(tab.id, { target: 'content', type: 'spawn', species, count });
  }, { species: DEMO_SPECIES, count });
}

async function openOptions(ctx, id) {
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/src/options/options.html`);
  await page.locator('#species .specimen').first().waitFor();
  await page.waitForTimeout(500);
  return page;
}

const written = [];
const shot = async (target, file, opts = {}) => { await target.screenshot({ path: file, ...opts }); written.push(file); };

try {
  // README screenshots
  {
    const { ctx, id, close } = await launch({ viewport: { width: 1200, height: 720 } });
    const page = await openOptions(ctx, id);
    await shot(page, path.join(docsDir, 'options.png'), { fullPage: true });
    await page.fill('#blocklist', 'mail.example.com\n*.bank.example');
    await shot(page.locator('section.quiet-sites'), path.join(docsDir, 'options-sites.png'));
    await close();
  }

  // Store screenshots: bugs on the mock site, and the settings page
  {
    const { ctx, sw, id, close } = await launch({ viewport: SIZE });
    const page = await ctx.newPage();
    await page.goto(siteUrl);
    await page.bringToFront();
    await page.waitForTimeout(500);
    const res = await releaseBugs(sw, 12);
    if (!res?.ok) throw new Error(`bugs not released: ${JSON.stringify(res)}`);
    await page.waitForTimeout(3500);
    await shot(page, path.join(storeDir, 'screenshot-1-1280x800.png'));
    const opts = await openOptions(ctx, id);
    await shot(opts, path.join(storeDir, 'screenshot-2-1280x800.png'));
    await close();
  }

  // Small promo tile
  {
    const browser = await chromium.launch({ channel: 'chromium', headless: true });
    const page = await browser.newPage({ viewport: { width: 440, height: 280 } });
    const icon = readFileSync(path.join(root, 'icons', 'icon128.png')).toString('base64');
    await page.setContent(`<body style="margin:0;width:440px;height:280px;background:#fff;display:flex;align-items:center;justify-content:center;gap:22px;font-family:Georgia,serif">
      <img src="data:image/png;base64,${icon}" width="112" height="112" style="border:1px solid #ddd;border-radius:18px">
      <div><div style="font-size:40px;font-style:italic;color:#1b1b1b">Xanderbugs</div>
      <div style="font:15px/1.4 system-ui,sans-serif;color:#555;margin-top:6px">Creepy crawlies scurrying<br>across your screen.</div></div></body>`);
    await shot(page, path.join(storeDir, 'promo-small-440x280.png'));
    await browser.close();
  }

  // Demo video: bugs crawling over the mock site
  if (!process.argv.includes('--no-video')) {
    const videoTmp = mkdtempSync(path.join(tmpdir(), 'xanderbugs-video-'));
    const { ctx, sw, close } = await launch({ viewport: SIZE, recordVideo: { dir: videoTmp, size: SIZE } });
    const page = await ctx.newPage();
    await page.goto(siteUrl);
    await page.bringToFront();
    await page.waitForTimeout(1500);
    await releaseBugs(sw, 10);
    await page.waitForTimeout(6000);
    await releaseBugs(sw, 8);
    await page.waitForTimeout(12000);
    const video = page.video();
    await close();
    const webm = path.join(storeDir, 'demo-1280x800.webm');
    renameSync(await video.path(), webm);
    rmSync(videoTmp, { recursive: true, force: true });
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', path.join(storeDir, 'demo-1280x800.mp4')]);
      rmSync(webm);
    } catch {
      console.warn('ffmpeg unavailable or failed; kept the .webm recording');
    }
  }

  const bad = written.filter(f => !pngIsOpaqueRgb(f));
  if (bad.length) throw new Error(`PNG has alpha or unexpected format: ${bad.map(f => path.relative(root, f)).join(', ')}`);
  console.log(`Wrote ${written.length} screenshots${existsSync(path.join(storeDir, 'demo-1280x800.mp4')) ? ' and store/demo-1280x800.mp4' : ''}`);
} finally {
  server.close();
}
