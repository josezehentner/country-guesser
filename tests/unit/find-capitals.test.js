import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAPITALS } from '../../data/capitals.js';
import { sharesCapital } from '../../src/quiz.js';

test('places with a capital of the same name share it, in both directions', () => {
  for (const [a, b] of [['JM', 'NF'], ['GP', 'KN'], ['GY', 'KY']]) {
    assert.equal(sharesCapital(a, b), true, `${a} ${b}`);
    assert.equal(sharesCapital(b, a), true, `${b} ${a}`);
  }
});

test('every place shares its capital with itself', () => {
  for (const code of Object.keys(CAPITALS)) assert.equal(sharesCapital(code, code), true, code);
});

test('only these three pairs share a capital', () => {
  const codes = Object.keys(CAPITALS);
  const pairs = codes.flatMap((a) => codes.filter((b) => a < b && sharesCapital(a, b)).map((b) => `${a}-${b}`));
  assert.deepEqual(pairs.sort(), ['GP-KN', 'GY-KY', 'JM-NF']);
});

test('other spellings and different capitals are not shared', () => {
  // Kingstown (Saint Vincent) is a different city than Kingston.
  assert.equal(sharesCapital('VC', 'JM'), false);
  assert.equal(sharesCapital('DE', 'FR'), false);
  // Places without a capital share nothing.
  assert.equal(sharesCapital('AQ', 'BV'), false);
});
