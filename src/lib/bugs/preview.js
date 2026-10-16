import { createBug, advanceGait } from './engine.js';

// Walking in place with nothing passing by makes a natural pace look hurried, so specimens stroll.
export const PREVIEW_PACE = 0.2;    // fraction of the species' slowest natural speed (about 1.3 steps a second)

// Settings-page specimen: strolls in place at its true size, whatever the crawl speed setting, and is
// drawn magnified to the species' previewSize with its stride scaled to match.
export function createPreviewBug(id) {
  const bug = createBug(id, { width: 160, height: 118, speed: 1 });
  bug.cruise = bug.species.speed[0] * PREVIEW_PACE;
  return bug;
}

export function drawPreview(ctx, bug, dt, w, h) {
  const view = bug.species.previewSize, real = bug.size, realStride = bug.stridePx;
  const cx = w / 2 + (bug.species.previewShift ?? 0) * view;
  // Straight-ahead walking only. Running the full steering step here would let the bug's wander turn it
  // every frame and snap it back, so its legs kept acting out turns on the spot and thrashed.
  bug.t += dt;
  bug.speed = bug.cruise;
  bug.moving = 1;
  advanceGait(bug, bug.speed * dt, 0, dt);
  Object.assign(bug, { x: cx, y: h / 2, heading: 0, light: { x: -0.45, y: -0.65 } });
  if (bug.trail) bug.trail.length = 0;
  Object.assign(bug, { size: view, stridePx: realStride * view / real });
  bug.species.draw(ctx, bug);
  Object.assign(bug, { size: real, stridePx: realStride });
}
