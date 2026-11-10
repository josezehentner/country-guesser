// Which entries of data/countries.js the flags mode asks. The flag pictures are in
// vendor/flags/, copied from flag-icons by `npm run build:flags`.
import { COUNTRIES } from './countries.js';

// Antarctica has no official flag.
export const NO_FLAG = new Set(['AQ']);

// Entries that fly the flag of another entry, so their flag tells nothing about them.
export const SHARED_FLAGS = {
  BV: 'NO',
  SJ: 'NO',
  HM: 'AU',
  UM: 'US',
  BQ: 'NL',
  // Saint Helena, Ascension and Tristan da Cunha as a whole uses the Union Jack.
  SH: 'GB',
  BL: 'FR',
  GF: 'FR',
  GP: 'FR',
  MF: 'FR',
  PM: 'FR',
  RE: 'FR',
  WF: 'FR',
  YT: 'FR',
};

// Countries with their own flag that looks the same as another's at the 4:3 size
// shown in the game. Naming either country counts as correct.
export const LOOKALIKES = [
  ['ID', 'MC'],
  ['RO', 'TD'],
];

export const FLAG_COUNTRIES = COUNTRIES.filter(({ code }) => !NO_FLAG.has(code) && !Object.hasOwn(SHARED_FLAGS, code));

// Relative, so it also works when the site is served from a subfolder.
export const flagUrl = (code) => `vendor/flags/${code.toLowerCase()}.svg`;

// The other countries whose flag looks like the flag of `code`.
export function lookalikesOf(code) {
  return LOOKALIKES.filter((pair) => pair.includes(code)).flat().filter((other) => other !== code);
}
