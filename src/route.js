// Logic of "Grenzgänger": a start and an end country are given, and the player names
// countries until their land borders connect the two. Free of DOM and map code.
import { BORDERS } from '../data/borders.js';
import { COUNTRIES } from '../data/countries.js';
import { isCorrectAnswer } from './quiz.js';

// At least three countries lie between start and end, so a round needs a little
// thought. There is no maximum: Portugal to China is a fine round.
export const MIN_BETWEEN = 3;
// The shortest route plus a few detours.
export const SPARE_GUESSES = 4;

const neighborsOf = (code) => BORDERS[code] ?? [];

// Countries with at least one land border: only they can be part of a route.
export const ROUTE_COUNTRIES = COUNTRIES.filter(({ code }) => neighborsOf(code).length);

// Number of borders crossed from `from` to every country reachable over land, going
// only through `allowed` codes if given.
export function distancesFrom(from, allowed) {
  const distances = new Map([[from, 0]]);
  let frontier = [from];
  while (frontier.length) {
    const next = [];
    for (const code of frontier) {
      for (const neighbor of neighborsOf(code)) {
        if (distances.has(neighbor) || (allowed && !allowed.has(neighbor))) continue;
        distances.set(neighbor, distances.get(code) + 1);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return distances;
}

// Picks a start and an end from `pool`, with at least MIN_BETWEEN countries between
// them on the shortest route, and at least one shortest route inside the pool, so a
// region filter keeps the whole round in its region. Returns null if the pool has
// no such pair.
export function pickRound(pool, random = Math.random) {
  const allowed = new Set(pool.map(({ code }) => code));
  const starts = pool.map(({ code }) => code).filter((code) => neighborsOf(code).some((neighbor) => allowed.has(neighbor)));
  // Shuffled, so a start without a far enough end only costs one more try.
  for (let i = starts.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [starts[i], starts[j]] = [starts[j], starts[i]];
  }
  for (const start of starts) {
    const everywhere = distancesFrom(start);
    const inside = distancesFrom(start, allowed);
    const ends = [...inside].filter(([code, steps]) => steps > MIN_BETWEEN && everywhere.get(code) === steps).map(([code]) => code);
    if (ends.length) return createRound(start, ends[Math.floor(random() * ends.length)]);
  }
  return null;
}

export function createRound(start, end) {
  const fromStart = distancesFrom(start);
  const fromEnd = distancesFrom(end);
  const between = fromStart.get(end) - 1;
  return {
    start,
    end,
    // Fewest countries that connect start and end.
    between,
    maxGuesses: between + SPARE_GUESSES,
    // Named countries in the order they were named.
    guesses: [],
    fromStart,
    fromEnd,
  };
}

// True if the country lies on at least one shortest route.
export const isOnShortestRoute = (round, code) =>
  round.fromStart.has(code) && round.fromStart.get(code) + round.fromEnd.get(code) === round.between + 1;

// The countries whose names `input` matches, without typos where an exact match
// exists. "Kongo" matches both Kongos.
export function findCountries(input) {
  const matches = COUNTRIES.filter(({ code }) => isCorrectAnswer(input, code));
  return matches.map(({ code }) => code);
}

// Fewest countries that connect start and end through the named ones, as a list
// from start to end. Named countries cost nothing, so the list shows what was
// missing. Returns null if start and end are not connected at all.
export function bestRoute(round, known = round.guesses) {
  const free = new Set([round.start, round.end, ...known]);
  const cost = new Map([[round.start, 0]]);
  const previous = new Map();
  // 0-1 breadth-first search: free countries go to the front of the queue.
  const queue = [round.start];
  while (queue.length) {
    const code = queue.shift();
    for (const neighbor of neighborsOf(code)) {
      const step = free.has(neighbor) ? 0 : 1;
      const total = cost.get(code) + step;
      if (cost.has(neighbor) && cost.get(neighbor) <= total) continue;
      cost.set(neighbor, total);
      previous.set(neighbor, code);
      if (step) queue.push(neighbor);
      else queue.unshift(neighbor);
    }
  }
  if (!cost.has(round.end)) return null;
  const route = [round.end];
  while (route[0] !== round.start) route.unshift(previous.get(route[0]));
  return route;
}

// True once the named countries connect start and end over land.
export function isSolved(round) {
  const route = bestRoute(round);
  return Boolean(route) && route.every((code) => code === round.start || code === round.end || round.guesses.includes(code));
}

export const guessesLeft = (round) => round.maxGuesses - round.guesses.length;

// What a typed answer means for the round, without changing it:
//   { kind: 'unknown' }                   no country has that name
//   { kind: 'ambiguous', codes }          several do, e.g. "Kongo"
//   { kind: 'endpoint', code }            the start or the end
//   { kind: 'repeated', code }            named before
//   { kind: 'step', code } / 'detour'     a new country on a shortest route, or not
export function judgeGuess(round, input) {
  const codes = findCountries(input);
  if (!codes.length) return { kind: 'unknown' };
  if (codes.length > 1) return { kind: 'ambiguous', codes };
  const [code] = codes;
  if (code === round.start || code === round.end) return { kind: 'endpoint', code };
  if (round.guesses.includes(code)) return { kind: 'repeated', code };
  return { kind: isOnShortestRoute(round, code) ? 'step' : 'detour', code };
}

// Adds a new country to the round and tells how it stands afterwards: 'solved',
// 'lost' once no guess is left, else 'open'. A round solved with exactly the
// fewest countries is `perfect`.
export function addGuess(round, code) {
  round.guesses.push(code);
  if (isSolved(round)) return { state: 'solved', perfect: round.guesses.length === round.between };
  return { state: guessesLeft(round) > 0 ? 'open' : 'lost' };
}
