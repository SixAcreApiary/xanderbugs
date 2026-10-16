import { build } from 'esbuild';
import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const item of ['manifest.json', 'icons']) {
  await cp(path.join(root, item), path.join(dist, item), { recursive: true });
}
await cp(path.join(root, 'src'), path.join(dist, 'src'), {
  recursive: true,
  filter: src => !src.includes(`${path.sep}content`)
});

await build({
  entryPoints: [path.join(root, 'src/content/content.js')],
  outfile: path.join(dist, 'content.bundle.js'),
  bundle: true,
  format: 'iife',
  target: 'chrome116',
  legalComments: 'none',
  logLevel: 'warning'
});

const files = await readdir(dist, { recursive: true });
console.log(`Built ${files.length} entries into dist/`);
