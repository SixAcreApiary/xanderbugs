// Captures the settings page for the README. Run `npm run screenshots` (needs the Playwright Chromium).
import { chromium } from 'playwright';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const outDir = path.join(root, 'docs', 'screenshots');
mkdirSync(outDir, { recursive: true });

const profile = mkdtempSync(path.join(tmpdir(), 'xanderbugs-shots-'));
const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1200, height: 720 },
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`]
});

try {
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/src/options/options.html`);
  await page.locator('#species .specimen').first().waitFor();
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(outDir, 'options.png'), fullPage: true });

  await page.fill('#blocklist', 'mail.example.com\n*.bank.example');
  await page.locator('section.quiet-sites').screenshot({ path: path.join(outDir, 'options-sites.png') });
  console.log(`Wrote screenshots to ${path.relative(root, outDir)}/`);
} finally {
  await ctx.close();
  rmSync(profile, { recursive: true, force: true });
}
