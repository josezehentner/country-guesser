// Logic of "Nachbarn finden": a country is marked, and the player clicks every
// country it shares a land border with. Free of DOM and map code.
import { BORDERS } from '../data/borders.js';
import { COUNTRIES } from '../data/countries.js';

// Wrong clicks a round allows: the last of them ends it.
export const MAX_MISSES = 3;

const neighborsOf = (code) => BORDERS[code] ?? [];

// Only countries with at least one land border can be asked.
export const NEIGHBOR_COUNTRIES = COUNTRIES.filter(({ code }) => neighborsOf(code).length);

export function createNeighborRound(code) {
  return { code, neighbors: [...neighborsOf(code)], found: [], misses: [] };
}

export const missingNeighbors = (round) => round.neighbors.filter((code) => !round.found.includes(code));

export const missesLeft = (round) => MAX_MISSES - round.misses.length;

// Judges a click on the country `clicked`, or on water if it is null, and adds it
// to the round. Returns { kind, code }, where kind is
//   'water'     no country there, costs nothing
//   'asked'     the marked country itself, costs nothing
//   'repeated'  clicked before, costs nothing
//   'found'     a new neighbor; 'solved' if it was the last one
//   'miss'      no neighbor, costs a miss; 'lost' if it was the last one
export function clickCountry(round, clicked) {
  if (!clicked) return { kind: 'water', code: null };
  if (clicked === round.code) return { kind: 'asked', code: clicked };
  if (round.found.includes(clicked) || round.misses.includes(clicked)) return { kind: 'repeated', code: clicked };
  if (round.neighbors.includes(clicked)) {
    round.found.push(clicked);
    return { kind: missingNeighbors(round).length ? 'found' : 'solved', code: clicked };
  }
  round.misses.push(clicked);
  return { kind: missesLeft(round) > 0 ? 'miss' : 'lost', code: clicked };
}
