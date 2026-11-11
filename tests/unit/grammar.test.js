import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARTICLES } from '../../data/articles.js';
import { COUNTRY_BY_CODE } from '../../data/countries.js';
import { capitalize, countryParts, countryPhrase, isPlural, verb } from '../../src/grammar.js';

test('every country with an article is a quizzed country with a known gender', () => {
  for (const [code, entry] of Object.entries(ARTICLES)) {
    assert.ok(COUNTRY_BY_CODE.has(code), code);
    assert.ok(['f', 'm', 'n', 'pl'].includes(entry.gender), code);
  }
});

test('a country without an article keeps its plain name in every case', () => {
  for (const grammaticalCase of ['nominative', 'accusative', 'dative']) {
    assert.deepEqual(countryParts('PL', grammaticalCase), { article: '', name: 'Polen' });
  }
  assert.equal(countryPhrase('DE', 'dative'), 'Deutschland');
});

test('feminine, masculine, neuter and plural names take their article in each case', () => {
  const cases = [
    ['CH', 'die Schweiz', 'die Schweiz', 'der Schweiz'],
    ['IR', 'der Iran', 'den Iran', 'dem Iran'],
    ['GB', 'das Vereinigte Königreich', 'das Vereinigte Königreich', 'dem Vereinigten Königreich'],
    ['NL', 'die Niederlande', 'die Niederlande', 'den Niederlanden'],
    ['US', 'die Vereinigten Staaten', 'die Vereinigten Staaten', 'den Vereinigten Staaten'],
    ['CF', 'die Zentralafrikanische Republik', 'die Zentralafrikanische Republik', 'der Zentralafrikanischen Republik'],
    ['AE', 'die Vereinigten Arabischen Emirate', 'die Vereinigten Arabischen Emirate', 'den Vereinigten Arabischen Emiraten'],
  ];
  for (const [code, nominative, accusative, dative] of cases) {
    assert.equal(countryPhrase(code), nominative, code);
    assert.equal(countryPhrase(code, 'accusative'), accusative, code);
    assert.equal(countryPhrase(code, 'dative'), dative, code);
  }
});

test('the article and the name come apart, so the name alone can be set in bold', () => {
  assert.deepEqual(countryParts('NL', 'dative'), { article: 'den', name: 'Niederlanden' });
  assert.deepEqual(countryParts('TD'), { article: 'der', name: 'Tschad' });
});

test('verbs agree with plural names', () => {
  assert.equal(isPlural('NL'), true);
  assert.equal(isPlural('CH'), false);
  assert.equal(verb('PH', 'liegt', 'liegen'), 'liegen');
  assert.equal(verb('CH', 'liegt', 'liegen'), 'liegt');
});

test('a sentence starts with a capital letter', () => {
  assert.equal(capitalize(countryPhrase('CH')), 'Die Schweiz');
  assert.equal(capitalize('Polen'), 'Polen');
});
