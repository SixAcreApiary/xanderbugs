// Rasterises icons/icon.svg (black ant on white) to the PNG sizes Chrome needs; extension icons can't be SVG.
// Uses the Playwright Chromium already installed for the e2e tests.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const iconDir = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'icons');
const svg = await readFile(path.join(iconDir, 'icon.svg'), 'utf8');
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<body style="margin:0;background:transparent"><img src="${src}" width="${size}" height="${size}" style="display:block">`);
    await page.locator('img').evaluate(img => img.decode());
    await page.screenshot({ path: path.join(iconDir, `icon${size}.png`), omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('Wrote icon16/32/48/128.png from icon.svg');
