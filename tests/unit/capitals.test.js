import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAPITALS, capitalLabel, capitalNames } from '../../data/capitals.js';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../data/countries.js';
import { isCorrectCapital, normalize } from '../../src/quiz.js';

const NO_CAPITAL = ['AQ', 'BV', 'HM', 'UM'];

test('every country with a settlement has a capital, places without one have none', () => {
  for (const { code } of COUNTRIES) {
    assert.equal(Object.hasOwn(CAPITALS, code), !NO_CAPITAL.includes(code), code);
  }
  for (const code of Object.keys(CAPITALS)) assert.ok(COUNTRY_BY_CODE.has(code), `${code} is no quizzed country`);
  assert.equal(Object.keys(CAPITALS).length, COUNTRIES.length - NO_CAPITAL.length);
});

test('capital entries are well-formed', () => {
  for (const [code, entry] of Object.entries(CAPITALS)) {
    assert.deepEqual(Object.keys(entry).filter((key) => !['name', 'also', 'aliases'].includes(key)), [], code);
    assert.ok(typeof entry.name === 'string' && entry.name.trim() === entry.name && entry.name, code);
    for (const list of [entry.also, entry.aliases]) {
      if (list === undefined) continue;
      assert.ok(Array.isArray(list) && list.length && list.every((name) => typeof name === 'string' && name.trim()), code);
    }
    const names = capitalNames(code).map(normalize);
    assert.equal(new Set(names).size, names.length, `${code} lists a name twice`);
  }
});

test('the label shows further official capitals', () => {
  assert.equal(capitalLabel('AT'), 'Wien');
  assert.equal(capitalLabel('BO'), 'Sucre (auch La Paz)');
  assert.equal(capitalLabel('ZA'), 'Pretoria (auch Kapstadt, Bloemfontein)');
});

test('every capital accepts its own name, official alternatives and aliases', () => {
  for (const code of Object.keys(CAPITALS)) {
    for (const name of capitalNames(code)) assert.ok(isCorrectCapital(name, code), `${code}: ${name}`);
  }
});

const accepted = [
  ['wien', 'AT'],
  ['  WIEN ', 'AT'],
  ['Vienna', 'AT'],
  ['Brussel', 'BE'],
  ['Bruxelles', 'BE'],
  ['Chisinau', 'MD'],
  ['Reykjavik', 'IS'],
  ['Bogota', 'CO'],
  ['Sao Tome', 'ST'],
  ['Ndjamena', 'TD'],
  ['Nukualofa', 'TO'],
  ['La Paz', 'BO'],
  ['Den Haag', 'NL'],
  ['Kapstadt', 'ZA'],
  ['Abidjan', 'CI'],
  ['Washington DC', 'US'],
  ['Washington', 'US'],
  ['Peking', 'CN'],
  ['Beijing', 'CN'],
  ['Kiew', 'UA'],
  ['Kyiv', 'UA'],
  ['Mexiko-Stadt', 'MX'],
  ['Canbera', 'AU'], // a small typo
  ['Kopenhagn', 'DK'],
  ['Ouagadugu', 'BF'],
  ['Kingston', 'JM'],
  ['Kingston', 'NF'], // same name, both are right
  ['Basseterre', 'KN'],
  ['Basse-Terre', 'GP'],
  ['Georgetown', 'GY'],
  ['George Town', 'KY'],
];
for (const [input, code] of accepted) {
  test(`accepts "${input}" as the capital of ${code}`, () => assert.equal(isCorrectCapital(input, code), true));
}

const rejected = [
  ['', 'DE'],
  ['   ', 'DE'],
  ['Atlantis', 'DE'],
  ['München', 'DE'],
  ['Deutschland', 'DE'], // the country is not its capital
  ['Sydney', 'AU'],
  ['Zürich', 'CH'],
  ['Istanbul', 'TR'],
  ['Rio de Janeiro', 'BR'],
  ['Dar es Salaam', 'TZ'],
  ['Kingston', 'VC'], // that is Jamaica's; Saint Vincent has Kingstown
  ['Kingstown', 'JM'],
  ['Wien', 'DE'],
  ['Jerusalem', 'PS'],
];
for (const [input, code] of rejected) {
  test(`rejects "${input}" as the capital of ${code}`, () => assert.equal(isCorrectCapital(input, code), false));
}

test('no capital for places without one', () => {
  for (const code of NO_CAPITAL) assert.equal(isCorrectCapital('Antarktis', code), false);
});
