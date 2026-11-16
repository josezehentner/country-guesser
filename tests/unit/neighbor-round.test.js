import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BORDERS } from '../../data/borders.js';
import { COUNTRIES } from '../../data/countries.js';
import { clickCountry, createNeighborRound, MAX_MISSES, missesLeft, missingNeighbors, NEIGHBOR_COUNTRIES } from '../../src/neighbor-round.js';

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

test('the round is solved once every neighbor is clicked', () => {
  const round = createNeighborRound('BE');
  assert.deepEqual(clickCountry(round, 'FR'), { kind: 'found', code: 'FR' });
  assert.deepEqual(clickCountry(round, 'DE'), { kind: 'found', code: 'DE' });
  assert.deepEqual(clickCountry(round, 'NL'), { kind: 'found', code: 'NL' });
  assert.deepEqual(missingNeighbors(round), ['LU']);
  assert.deepEqual(clickCountry(round, 'LU'), { kind: 'solved', code: 'LU' });
  assert.deepEqual(missingNeighbors(round), []);
});

test('water, the asked country and repeated clicks cost nothing', () => {
  const round = createNeighborRound('BE');
  assert.equal(clickCountry(round, null).kind, 'water');
  assert.equal(clickCountry(round, 'BE').kind, 'asked');
  clickCountry(round, 'FR');
  assert.equal(clickCountry(round, 'FR').kind, 'repeated');
  clickCountry(round, 'ES');
  assert.equal(clickCountry(round, 'ES').kind, 'repeated');
  assert.deepEqual(round.found, ['FR']);
  assert.deepEqual(round.misses, ['ES']);
  assert.equal(missesLeft(round), MAX_MISSES - 1);
});

test('the last allowed miss ends the round', () => {
  const round = createNeighborRound('BE');
  assert.equal(clickCountry(round, 'ES').kind, 'miss');
  assert.equal(clickCountry(round, 'IT').kind, 'miss');
  assert.equal(clickCountry(round, 'PL').kind, 'lost');
  assert.equal(missesLeft(round), 0);
  assert.deepEqual(missingNeighbors(round), ['DE', 'FR', 'LU', 'NL']);
});
