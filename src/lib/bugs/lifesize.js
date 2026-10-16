import { ANT_IDS } from './species/ant.js';
import { BEE_IDS } from './species/honeybee.js';
import { BUMBLE_IDS } from './species/bumblebee.js';

// "Life size": with a calibrated screen (pixels per millimetre), every bug is drawn at its real body length.
// REAL_LENGTH_MM is a typical adult body length range (head to tail, no legs or antennae); DRAWN_LENGTH is how
// long each species' drawing is, head to tail, in body units (a bug's size is 100 units). Both together give the
// size a bug needs to be drawn at to come out at its real length.
const range = (ids, mm) => Object.fromEntries(ids.map(id => [id, mm]));
export const REAL_LENGTH_MM = {
  ant: [7, 13], fieldant: [4, 8], fireant: [2, 6], pavementant: [2.5, 3], odoroushouseant: [2.4, 3.3], argentineant: [2.2, 2.8], pharaohant: [1.5, 2],
  cockroach: [35, 40],          // American cockroach
  centipede: [30, 60],          // stone to small giant centipedes
  spider: [6, 10],              // body only
  silverfish: [12, 19], beetle: [10, 20], earwig: [12, 15], yellowjacket: [12, 15], stinkbug: [14, 17], bedbug: [4, 5],
  housecentipede: [25, 35],     // body only; its legs are far longer
  ...range(BEE_IDS, [12, 15]),  // workers; drones and queens keep their real proportions to workers
  ...range(BUMBLE_IDS, [10, 17])
};
export const DRAWN_LENGTH = {
  ...range(ANT_IDS, 94), cockroach: 101, centipede: 106.5, spider: 74, silverfish: 102, beetle: 102, earwig: 106.5,
  yellowjacket: 93.5, stinkbug: 93, bedbug: 89, housecentipede: 96.5, ...range(BEE_IDS, 79), ...range(BUMBLE_IDS, 82)
};

// How much to scale a bug (size, pace and stride) so it comes out at life size at pxPerMm CSS pixels per mm. A bug
// small for its species stays small: its place in the species' size range maps onto the real range.
export function lifeScale(sp, size, pxPerMm) {
  const mm = REAL_LENGTH_MM[sp.id], units = DRAWN_LENGTH[sp.id];
  if (!mm || !units || !(pxPerMm > 0)) return 1;
  const [lo, hi] = sp.size, f = hi > lo ? (size - lo) / (hi - lo) : 0.5;
  return ((mm[0] + (mm[1] - mm[0]) * f) * pxPerMm * 100) / units / size;
}

// A calibration is stored as device pixels per mm, so the CSS pixels per mm for drawing follow the browser's
// current zoom (which changes the device pixel ratio) automatically.
export const cssPxPerMm = (devicePxPerMm, devicePixelRatio) => devicePxPerMm / (devicePixelRatio || 1);
