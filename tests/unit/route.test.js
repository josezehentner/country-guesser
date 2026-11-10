import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BORDERS } from '../../data/borders.js';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../data/countries.js';
import {
  addGuess, bestRoute, createRound, distancesFrom, findCountries, guessesLeft, isOnShortestRoute, isSolved, judgeGuess,
  MIN_BETWEEN, pickRound, ROUTE_COUNTRIES, SPARE_GUESSES,
} from '../../src/route.js';

const borders = (a, b) => (BORDERS[a] ?? []).includes(b);

// Deterministic stand-in for Math.random.
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

test('borders only name quizzed countries and go both ways', () => {
  for (const [code, neighbors] of Object.entries(BORDERS)) {
    assert.ok(COUNTRY_BY_CODE.has(code), code);
    assert.ok(neighbors.length, code);
    for (const neighbor of neighbors) {
      assert.ok(COUNTRY_BY_CODE.has(neighbor), `${code}-${neighbor}`);
      assert.notEqual(neighbor, code);
      assert.ok(borders(neighbor, code), `${neighbor} lacks ${code}`);
    }
  }
});

test('well-known land borders are there', () => {
  const pairs = [
    ['DE', 'FR'], ['ES', 'PT'], ['CN', 'RU'], ['CA', 'US'], ['MX', 'US'], ['BR', 'AR'], ['EG', 'IL'], ['IN', 'PK'],
    ['CN', 'PK'], ['KP', 'RU'], ['HT', 'DO'], ['GB', 'IE'], ['ZA', 'LS'], ['TR', 'AZ'], ['CO', 'PA'], ['BW', 'ZM'],
  ];
  for (const [a, b] of pairs) assert.ok(borders(a, b), `${a}-${b}`);
  assert.equal(BORDERS.RU.length, 14);
  assert.equal(BORDERS.DE.length, 9);
});

test('borders of the small, enlarged entries are added by hand', () => {
  for (const [a, b] of [['IT', 'SM'], ['IT', 'VA'], ['FR', 'MC'], ['ES', 'GI'], ['CN', 'MO'], ['MF', 'SX']]) assert.ok(borders(a, b), `${a}-${b}`);
  assert.deepEqual(BORDERS.VA, ['IT']);
});

test('exclaves and overseas parts count as the data draws them', () => {
  // Kaliningrad is Russia, Ceuta and Melilla are Spain.
  assert.ok(borders('RU', 'PL'));
  assert.ok(borders('RU', 'LT'));
  assert.ok(borders('ES', 'MA'));
  // French Guiana is its own entry, so France itself borders no country in America.
  assert.ok(borders('GF', 'BR'));
  assert.ok(borders('GF', 'SR'));
  assert.ok(!borders('FR', 'BR'));
});

test('bridges, tunnels, straits and near misses are no land border', () => {
  for (const [a, b] of [['DK', 'SE'], ['GB', 'FR'], ['MY', 'SG'], ['EG', 'SA'], ['CN', 'TW'], ['MA', 'MR'], ['NA', 'ZW'], ['AU', 'PG'], ['IT', 'MC']]) {
    assert.ok(!borders(a, b), `${a}-${b}`);
  }
});

test('islands without a land border are no route country', () => {
  const codes = new Set(ROUTE_COUNTRIES.map(({ code }) => code));
  for (const code of ['IS', 'JP', 'AU', 'NZ', 'MG', 'CU', 'AQ']) assert.ok(!codes.has(code), code);
  assert.ok(codes.has('PT'));
  assert.ok(codes.has('CN'));
});

test('distances count the borders crossed, optionally only through some countries', () => {
  const distances = distancesFrom('PT');
  assert.equal(distances.get('PT'), 0);
  assert.equal(distances.get('ES'), 1);
  assert.equal(distances.get('FR'), 2);
  assert.ok(distances.has('CN'));
  assert.ok(!distances.has('US'));
  // Without Spain, Portugal reaches nothing.
  assert.equal(distancesFrom('PT', new Set(['PT', 'FR'])).size, 1);
});

test('a round has at least three countries between start and end, and no maximum', () => {
  const random = seeded(7);
  let longest = 0;
  for (let i = 0; i < 200; i++) {
    const round = pickRound(ROUTE_COUNTRIES, random);
    assert.ok(round.between >= MIN_BETWEEN, `${round.start}-${round.end}`);
    assert.equal(distancesFrom(round.start).get(round.end), round.between + 1);
    assert.equal(round.maxGuesses, round.between + SPARE_GUESSES);
    longest = Math.max(longest, round.between);
  }
  assert.ok(longest >= 8, `longest round only had ${longest} countries between`);
  assert.equal(createRound('PT', 'CN').between, distancesFrom('PT').get('CN') - 1);
});

test('with a region filter the whole shortest route stays in the region', () => {
  const europe = COUNTRIES.filter(({ continent }) => continent === 'EU');
  const inEurope = new Set(europe.map(({ code }) => code));
  const random = seeded(3);
  for (let i = 0; i < 100; i++) {
    const round = pickRound(europe, random);
    assert.ok(inEurope.has(round.start) && inEurope.has(round.end), `${round.start}-${round.end}`);
    assert.equal(distancesFrom(round.start, inEurope).get(round.end), round.between + 1);
  }
});

test('a pool without such a pair gives no round', () => {
  const oceania = COUNTRIES.filter(({ continent }) => continent === 'OC');
  assert.equal(pickRound(oceania, seeded(1)), null);
  assert.equal(pickRound(COUNTRIES.filter(({ code }) => ['DE', 'FR', 'PL', 'CZ'].includes(code)), seeded(1)), null);
  assert.equal(pickRound([], seeded(1)), null);
});

test('typed names are found with the usual tolerance, and ambiguous names say so', () => {
  assert.deepEqual(findCountries('Deutschland'), ['DE']);
  assert.deepEqual(findCountries('  frankreich '), ['FR']);
  assert.deepEqual(findCountries('Österreih'), ['AT']);
  assert.deepEqual(findCountries('Kongo').sort(), ['CD', 'CG']);
  assert.deepEqual(findCountries('Atlantis'), []);
});

test('a guess is judged as a step on a shortest route, a detour, or no guess at all', () => {
  const round = createRound('PT', 'PL');
  assert.equal(round.between, 3);
  assert.deepEqual(judgeGuess(round, 'Spanien'), { kind: 'step', code: 'ES' });
  assert.deepEqual(judgeGuess(round, 'Italien'), { kind: 'detour', code: 'IT' });
  assert.deepEqual(judgeGuess(round, 'Japan'), { kind: 'detour', code: 'JP' });
  assert.deepEqual(judgeGuess(round, 'Portugal'), { kind: 'endpoint', code: 'PT' });
  assert.deepEqual(judgeGuess(round, 'Xyzland'), { kind: 'unknown' });
  assert.equal(judgeGuess(round, 'Kongo').kind, 'ambiguous');
  addGuess(round, 'ES');
  assert.deepEqual(judgeGuess(round, 'spanien'), { kind: 'repeated', code: 'ES' });
  assert.ok(isOnShortestRoute(round, 'FR'));
  assert.ok(isOnShortestRoute(round, 'DE'));
  assert.ok(!isOnShortestRoute(round, 'CH'));
});

test('the round is solved once the named countries connect start and end, in any order', () => {
  const round = createRound('PT', 'PL');
  assert.deepEqual(addGuess(round, 'DE'), { state: 'open' });
  assert.deepEqual(addGuess(round, 'ES'), { state: 'open' });
  assert.ok(!isSolved(round));
  assert.deepEqual(addGuess(round, 'FR'), { state: 'solved', perfect: true });
});

test('detours count as guesses, and a longer route that connects still solves the round', () => {
  const round = createRound('PT', 'PL');
  addGuess(round, 'ES');
  addGuess(round, 'FR');
  addGuess(round, 'CH');
  assert.equal(guessesLeft(round), round.maxGuesses - 3);
  assert.deepEqual(addGuess(round, 'AT'), { state: 'open' });
  // Austria borders the Czech Republic, not Poland.
  assert.deepEqual(addGuess(round, 'CZ'), { state: 'solved', perfect: false });
});

test('the round is lost when the guesses run out', () => {
  const round = createRound('PT', 'PL');
  const detours = ['IT', 'GR', 'SE', 'NO', 'FI', 'JP', 'IS'].slice(0, round.maxGuesses);
  const results = detours.map((code) => addGuess(round, code));
  assert.equal(results.at(-1).state, 'lost');
  assert.ok(results.slice(0, -1).every(({ state }) => state === 'open'));
});

test('the best route builds on the named countries and shows what was missing', () => {
  const round = createRound('PT', 'PL');
  assert.equal(bestRoute(round).length, round.between + 2);
  addGuess(round, 'ES');
  addGuess(round, 'IT');
  addGuess(round, 'AT');
  const route = bestRoute(round);
  assert.equal(route[0], 'PT');
  assert.equal(route.at(-1), 'PL');
  // Spain, then France, then a way through Italy and Austria, or a shorter one via
  // Germany: both need two more countries.
  const missing = route.filter((code) => !['PT', 'PL', ...round.guesses].includes(code));
  assert.equal(missing.length, 2);
  for (let i = 1; i < route.length; i++) assert.ok(borders(route[i - 1], route[i]), `${route[i - 1]}-${route[i]}`);
  assert.equal(bestRoute(createRound('PT', 'US')), null);
});
