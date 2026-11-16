import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BORDERS } from '../../data/borders.js';
import { COUNTRIES } from '../../data/countries.js';
import { createNeighborRound, guessNeighbor, MAX_MISSES, missesLeft, missingNeighbors, NEIGHBOR_COUNTRIES } from '../../src/neighbor-round.js';

test('only countries with a land border are asked', () => {
  const codes = NEIGHBOR_COUNTRIES.map(({ code }) => code);
  assert.ok(codes.includes('DE'));
  assert.ok(codes.includes('VA'));
  assert.ok(!codes.includes('IS'));
  assert.ok(!codes.includes('JP'));
  assert.equal(codes.length, COUNTRIES.filter(({ code }) => BORDERS[code]?.length).length);
});

test('a round knows every neighbor of the asked country', () => {
  const round = createNeighborRound('PT');
  assert.deepEqual(round.neighbors, ['ES']);
  assert.deepEqual(missingNeighbors(round), ['ES']);
  assert.equal(missesLeft(round), MAX_MISSES);
});

test('the round is solved once every neighbor is named, with the usual tolerance', () => {
  const round = createNeighborRound('BE');
  assert.deepEqual(guessNeighbor(round, 'Frankreich', 'de'), { kind: 'found', code: 'FR' });
  assert.deepEqual(guessNeighbor(round, 'deutschland', 'de'), { kind: 'found', code: 'DE' });
  assert.deepEqual(guessNeighbor(round, 'Holland', 'de'), { kind: 'found', code: 'NL' });
  assert.deepEqual(missingNeighbors(round), ['LU']);
  assert.deepEqual(guessNeighbor(round, 'Luxenburg', 'de'), { kind: 'solved', code: 'LU' });
  assert.deepEqual(missingNeighbors(round), []);
});

test('only names in the language of the page count', () => {
  const round = createNeighborRound('BE');
  assert.deepEqual(guessNeighbor(round, 'Germany', 'en'), { kind: 'found', code: 'DE' });
  assert.equal(guessNeighbor(round, 'Frankreich', 'en').kind, 'unknown');
});

test('unknown, ambiguous, repeated names and the country itself cost nothing', () => {
  const round = createNeighborRound('AO');
  assert.deepEqual(guessNeighbor(round, 'Atlantis', 'de'), { kind: 'unknown' });
  assert.deepEqual(guessNeighbor(round, 'Kongo', 'de').kind, 'ambiguous');
  assert.equal(guessNeighbor(round, 'Angola', 'de').kind, 'asked');
  guessNeighbor(round, 'Sambia', 'de');
  assert.equal(guessNeighbor(round, 'Sambia', 'de').kind, 'repeated');
  guessNeighbor(round, 'Kenia', 'de');
  assert.equal(guessNeighbor(round, 'Kenia', 'de').kind, 'repeated');
  assert.deepEqual(round.found, ['ZM']);
  assert.deepEqual(round.misses, ['KE']);
  assert.equal(missesLeft(round), MAX_MISSES - 1);
});

test('the last allowed miss ends the round', () => {
  const round = createNeighborRound('BE');
  assert.equal(guessNeighbor(round, 'Spanien', 'de').kind, 'miss');
  assert.equal(guessNeighbor(round, 'Italien', 'de').kind, 'miss');
  assert.equal(guessNeighbor(round, 'Polen', 'de').kind, 'lost');
  assert.equal(missesLeft(round), 0);
  assert.deepEqual(missingNeighbors(round), ['DE', 'FR', 'LU', 'NL']);
});
