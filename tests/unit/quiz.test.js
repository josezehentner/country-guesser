import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COUNTRIES } from '../../data/countries.js';
import { isCorrectAnswer, normalize, pickNextCountry, selectionWeight } from '../../src/quiz.js';

test('normalize ignores case, whitespace, diacritics and punctuation', () => {
  assert.equal(normalize('  ÖSTERREICH '), 'osterreich');
  assert.equal(normalize('Großbritannien'), 'grossbritannien');
  assert.equal(normalize('Guinea-Bissau'), 'guineabissau');
});

test('every country accepts its own display name', () => {
  for (const { code, name } of COUNTRIES) assert.ok(isCorrectAnswer(name, code), `${code}: ${name}`);
});

const accepted = [
  ['osterreich', 'AT'],
  ['  ÖSTERREICH ', 'AT'],
  ['USA', 'US'],
  ['Vereinigte Staaten', 'US'],
  ['Amerika', 'US'],
  ['Großbritannien', 'GB'],
  ['Vereinigtes Königreich', 'GB'],
  ['UK', 'GB'],
  ['Tschechien', 'CZ'],
  ['Tschechische Republik', 'CZ'],
  ['Elfenbeinküste', 'CI'],
  ["Côte d'Ivoire", 'CI'],
  ['Kongo', 'CD'],
  ['Kongo', 'CG'],
  ['UAE', 'AE'],
  ['Frankreih', 'FR'],
  ['Hongkong', 'HK'],
  ['Spitzbergen', 'SJ'],
  ['Färöer', 'FO'],
  ['Falkland', 'FK'],
  ['Deutschlnd', 'DE'],
];
for (const [input, code] of accepted) {
  test(`accepts "${input}" for ${code}`, () => assert.equal(isCorrectAnswer(input, code), true));
}

const rejected = [
  ['', 'DE'],
  ['   ', 'DE'],
  ['Atlantis', 'DE'],
  ['Iran', 'IQ'],
  ['Irak', 'IR'],
  ['Mali', 'MT'],
  ['Niger', 'NG'],
  ['Nigeria', 'NE'],
  ['Slowenien', 'SK'],
  ['Korea', 'KR'],
  ['Ira', 'IR'], // typo that fits Iran and Irak equally
  ['Ira', 'IQ'],
  ['Guam', 'GN'],
  ['Niue', 'NE'],
];
for (const [input, code] of rejected) {
  test(`rejects "${input}" for ${code}`, () => assert.equal(isCorrectAnswer(input, code), false));
}

test('weights favor weak and never-asked countries over mastered ones', () => {
  const mastered = selectionWeight({ score: 10 });
  assert.ok(mastered > 0, 'mastered countries still come up for review');
  assert.ok(selectionWeight(undefined) > selectionWeight({ score: 5 }));
  assert.ok(selectionWeight({ score: 0 }) > selectionWeight({ score: 9 }));
  assert.ok(selectionWeight({ score: 9 }) > mastered);
});

test('pickNextCountry never repeats the previous country', () => {
  const pool = COUNTRIES.slice(0, 3);
  for (let i = 0; i < 500; i++) {
    assert.notEqual(pickNextCountry(pool, {}, pool[0].code).code, pool[0].code);
  }
});

test('pickNextCountry follows the weights and stays inside the pool', () => {
  const [weak, strong] = COUNTRIES;
  const progress = { [weak.code]: { score: 0 }, [strong.code]: { score: 10 } };
  const counts = { [weak.code]: 0, [strong.code]: 0 };
  for (let i = 0; i < 2000; i++) counts[pickNextCountry([weak, strong], progress, null).code]++;
  assert.ok(counts[weak.code] > counts[strong.code] * 5);
  assert.ok(counts[strong.code] > 0);
});
