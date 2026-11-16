// Logic of "Nachbarn finden": a country is marked, and the player names every
// country it shares a land border with. Free of DOM and map code.
import { BORDERS } from '../data/borders.js';
import { COUNTRIES } from '../data/countries.js';
import { findCountries } from './route.js';

// Wrong names a round allows: the last of them ends it.
export const MAX_MISSES = 3;

const neighborsOf = (code) => BORDERS[code] ?? [];

// Only countries with at least one land border can be asked.
export const NEIGHBOR_COUNTRIES = COUNTRIES.filter(({ code }) => neighborsOf(code).length);

export function createNeighborRound(code) {
  return { code, neighbors: [...neighborsOf(code)], found: [], misses: [] };
}

export const missingNeighbors = (round) => round.neighbors.filter((code) => !round.found.includes(code));

export const missesLeft = (round) => MAX_MISSES - round.misses.length;

// Judges a typed answer and adds it to the round. Returns { kind, code, codes },
// where kind is
//   'unknown'    no country has that name, costs nothing
//   'ambiguous'  several do, e.g. "Kongo"; `codes` lists them, costs nothing
//   'asked'      the marked country itself, costs nothing
//   'repeated'   named before, costs nothing
//   'found'      a new neighbor; 'solved' if it was the last one
//   'miss'       no neighbor, costs a miss; 'lost' if it was the last one
// Only names in `language` count.
export function guessNeighbor(round, input, language) {
  const codes = findCountries(input, language);
  if (!codes.length) return { kind: 'unknown' };
  if (codes.length > 1) return { kind: 'ambiguous', codes };
  const [code] = codes;
  if (code === round.code) return { kind: 'asked', code };
  if (round.found.includes(code) || round.misses.includes(code)) return { kind: 'repeated', code };
  if (round.neighbors.includes(code)) {
    round.found.push(code);
    return { kind: missingNeighbors(round).length ? 'found' : 'solved', code };
  }
  round.misses.push(code);
  return { kind: missesLeft(round) > 0 ? 'miss' : 'lost', code };
}
