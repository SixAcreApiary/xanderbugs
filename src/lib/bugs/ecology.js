import { BEE_IDS } from './species/honeybee.js';
import { ANT_IDS } from './species/ant.js';
import { BUMBLE_IDS } from './species/bumblebee.js';
import { PHOTINUS_IDS } from './species/firefly.js';
import { SPIDER_IDS, SPIDER_BREEDS } from './species/spider.js';
import { FLY_IDS } from './species/flies.js';
import { LADYBUG_IDS } from './species/ladybugs.js';
import { CATERPILLAR_BREEDS } from './species/caterpillars.js';

const all = ids => w => Object.fromEntries(ids.map(id => [id, w]));
const bees = all(BEE_IDS), ants = all(ANT_IDS), bumbles = all(BUMBLE_IDS), spiders = all(SPIDER_IDS), flies = all(FLY_IDS), ladybugs = all(LADYBUG_IDS);
// How readily each caterpillar is taken (stinging and hairy ones are mostly left alone), scaled per hunter.
const caterpillars = w => Object.fromEntries(CATERPILLAR_BREEDS.map(b => [b.id, w * b.prey]));
const otherFlies = all(FLY_IDS.filter(id => id !== 'robberfly'));

// Who hunts whom, roughly as in nature. PREDATION[predator][prey] is how dangerous the predator is to that
// prey (0..1): it sets how hard the prey flees and how keenly the predator stalks it.
//  - House centipedes are notorious hunters of silverfish, bed bugs, cockroaches, spiders, earwigs and ants.
//  - Scolopendrid centipedes take cockroaches, silverfish, earwigs, spiders, bed bugs, beetles and ants.
//  - Spiders catch silverfish, bed bugs, earwigs and the occasional small cockroach or ant.
//  - Yellowjackets hunt spiders (and pick off soft prey like bed bugs and silverfish).
//  - Ants and ground beetles overwhelm small prey such as bed bugs and silverfish.
//  - Yellowjackets are notorious honey bee hunters; crab and orb spiders also take bees, bumble bees included.
//  - Photuris fireflies (the loopy five) are "femme fatales" that lure and eat Photinus fireflies.
//  - Every kind of spider counts as a spider, as hunter and as prey; the goldenrod crab spider is a specialist bee
//    ambusher.
//  - Every kind of ant counts as an ant (prey for the same hunters, and a nibbler of small prey itself).
//  - Flies are prey to spiders, centipedes and yellowjackets; robber flies hunt other flies and bees on the wing.
//  - Lady beetles taste bad: only spiders bother them, and not much.
//  - Caterpillars are prey to yellowjackets above all, and to spiders and centipedes; the stinging and hairy ones
//    much less.
// Stink bugs are left alone: nobody hunts them, and their smell makes everyone keep a wider berth.
export const PREDATION = {
  housecentipede: { ...caterpillars(0.5), silverfish: 1, bedbug: 1, ...flies(0.8), cockroach: 0.8, ...spiders(0.7), earwig: 0.6, ...ants(0.5) },
  centipede: { ...caterpillars(0.8), cockroach: 0.9, silverfish: 0.9, earwig: 0.7, ...spiders(0.6), bedbug: 0.6, ...flies(0.4), beetle: 0.4, ...ants(0.4) },
  ...Object.fromEntries(SPIDER_IDS.map(id => [id, { ...flies(0.9), ...ladybugs(0.2), ...caterpillars(0.6), silverfish: 0.8, bedbug: 0.7, earwig: 0.5, cockroach: 0.4, ...ants(0.3), ...bees(0.4), ...bumbles(0.3) }])),
  crabspider: { ...flies(0.9), silverfish: 0.8, bedbug: 0.7, earwig: 0.5, cockroach: 0.4, ...ants(0.3), ...bees(0.7), ...bumbles(0.6) },
  yellowjacket: { ...spiders(0.8), ...flies(0.6), ...caterpillars(1), bedbug: 0.3, silverfish: 0.3, ...bees(0.9), ...bumbles(0.25) },
  ...Object.fromEntries(ANT_IDS.map(id => [id, { bedbug: 0.4, silverfish: 0.3 }])),
  beetle: { ...ants(0.3), silverfish: 0.3, bedbug: 0.3 },
  loopyfivefirefly: all(PHOTINUS_IDS)(0.6),
  robberfly: { ...otherFlies(0.7), ...bees(0.5), ...bumbles(0.4) }
};

// How much wider a berth other bugs give each species (added to the avoidance range, as a fraction).
export const REPELLENT = { stinkbug: 0.6 };

// How far a predator looms, as a multiple of its body length: long legs make it noticeable from further away.
// Spiders loom larger the longer their legs (the cellar spider's reach far beyond its tiny body).
export const LOOM = { housecentipede: 2, ...Object.fromEntries(SPIDER_BREEDS.map(b => [b.id, 1 + 0.4 * (b.legLen ?? 1)])) };

export function danger(predator, prey) {
  return PREDATION[predator.species.id]?.[prey.species.id] ?? 0;
}
