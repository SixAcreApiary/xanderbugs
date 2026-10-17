import { ANT_BREEDS, antLength } from './species/ant.js';
import { BEE_IDS } from './species/honeybee.js';
import { BUMBLE_IDS } from './species/bumblebee.js';
import { FIREFLY_IDS } from './species/firefly.js';
import { FLY_BREEDS, flyPlan } from './species/flies.js';
import { LADYBUG_BREEDS, ladybugPlan } from './species/ladybugs.js';
import { CATERPILLAR_BREEDS } from './species/caterpillars.js';
import { SPIDER_BREEDS, bodyPlan } from './species/spider.js';

// "Life size": with a calibrated screen (pixels per millimetre), every bug is drawn at its real body length.
// REAL_LENGTH_MM is an adult body length range (head to tail, no legs or antennae); DRAWN_LENGTH is how
// long each species' drawing is, head to tail, in body units (a bug's size is 100 units). Both together give the
// size a bug needs to be drawn at to come out at its real length.
const range = (ids, mm) => Object.fromEntries(ids.map(id => [id, mm]));
// Typical adult length, give or take 7%: the bugs shown are adults or nearly so, not the full range from young to
// old or across every population.
const adult = mm => [Math.round(mm * 0.93 * 100) / 100, Math.round(mm * 1.07 * 100) / 100];
export const REAL_LENGTH_MM = {
  ant: adult(11), fireant: adult(4), argentineant: adult(2.6), pharaohant: adult(1.8),
  ...Object.fromEntries(ANT_BREEDS.filter(b => b.mm).map(b => [b.id, adult(b.mm)])),
  cockroach: adult(38),         // American cockroach
  centipede: adult(45),
  ...Object.fromEntries(SPIDER_BREEDS.map(b => [b.id, adult(b.mm)])),   // spiders: body only, legs not counted
  silverfish: adult(15), beetle: adult(15), earwig: adult(14), yellowjacket: adult(13.5), stinkbug: adult(15.5), bedbug: adult(5),
  housecentipede: adult(30),    // body only; its legs are far longer
  ...Object.fromEntries(FLY_BREEDS.map(b => [b.id, adult(b.mm)])),
  ...Object.fromEntries(LADYBUG_BREEDS.map(b => [b.id, adult(b.mm)])),
  ...Object.fromEntries(CATERPILLAR_BREEDS.map(b => [b.id, adult(b.mm)])),   // full grown   // flies: typical adults, the house fly a female
  ...range(BEE_IDS, adult(13.5)), // workers; drones and queens keep their real proportions to workers
  ...range(BUMBLE_IDS, adult(15)),
  bigdipperfirefly: adult(12), treetopfirefly: adult(17), southwestsyncfirefly: adult(6.5), loopyfivefirefly: adult(11.5), smokiessyncfirefly: adult(13)
};
export const DRAWN_LENGTH = {
  ...Object.fromEntries(ANT_BREEDS.map(b => [b.id, antLength(b)])), cockroach: 101, centipede: 106.5, silverfish: 102, beetle: 102, earwig: 106.5,
  yellowjacket: 93.5, stinkbug: 93, bedbug: 89, housecentipede: 96.5, ...range(BEE_IDS, 79), ...range(BUMBLE_IDS, 82),
  ...range(FIREFLY_IDS, 80.5),
  ...Object.fromEntries(SPIDER_BREEDS.map(b => { const p = bodyPlan(b); return [b.id, p.front - p.back]; })),
  ...Object.fromEntries(FLY_BREEDS.map(b => [b.id, flyPlan(b).length])),
  ...Object.fromEntries(LADYBUG_BREEDS.map(b => [b.id, ladybugPlan(b).length])),
  ...Object.fromEntries(CATERPILLAR_BREEDS.map(b => [b.id, 100]))   // the body is 100 units long
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
