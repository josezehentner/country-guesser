import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { ALIASES_EN } from '../../data/aliases.en.js';
import { WITH_THE } from '../../data/articles.en.js';
import { CAPITALS, capitalLabel, capitalNames } from '../../data/capitals.js';
import { CAPITALS_EN } from '../../data/capitals.en.js';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../data/countries.js';
import { countryPhrase } from '../../src/grammar.js';
import { LANG } from '../../src/language.js';
import { PAGE_TEXT_EN } from '../../src/page-text.js';
import { isCorrectAnswer, isCorrectCapital, isCorrectFlag } from '../../src/quiz.js';
import { findCountries, judgeGuess, createRound } from '../../src/route.js';
import { TEXT } from '../../src/text.js';

const root = new URL('../../', import.meta.url);
const pages = readdirSync(root).filter((name) => name.endsWith('.html'));
const boot = readFileSync(new URL('src/language-boot.js', root), 'utf8');

// Runs src/language-boot.js as a page would and returns the language it picked.
function bootLanguage({ stored = null, languages = [], storageFails = false }) {
  const attributes = new Map();
  const documentElement = { lang: 'de', setAttribute: (name) => attributes.set(name, ''), removeAttribute: (name) => attributes.delete(name) };
  const localStorage = {
    getItem: (key) => {
      if (storageFails) throw new Error('blocked');
      return key === 'countryquiz.language' ? stored : null;
    },
  };
  vm.runInNewContext(boot, { localStorage, navigator: { languages, language: languages[0] }, document: { documentElement }, setTimeout: () => {} });
  return { language: documentElement.lang, hidden: attributes.has('data-translating') };
}

test('the language is the one chosen, else the first German or English one the browser prefers, else English', () => {
  assert.equal(bootLanguage({ stored: 'en', languages: ['de-DE'] }).language, 'en');
  assert.equal(bootLanguage({ stored: 'de', languages: ['en-US'] }).language, 'de');
  assert.equal(bootLanguage({ languages: ['de-AT', 'en'] }).language, 'de');
  assert.equal(bootLanguage({ languages: ['fr-FR', 'en-GB', 'de'] }).language, 'en');
  assert.equal(bootLanguage({ languages: ['fr-FR', 'de-CH'] }).language, 'de');
  assert.equal(bootLanguage({ languages: ['fr-FR', 'es'] }).language, 'en');
  assert.equal(bootLanguage({ stored: 'xx', languages: ['de'] }).language, 'de');
  assert.equal(bootLanguage({ storageFails: true, languages: ['de-DE'] }).language, 'de');
});

test('an English page is hidden until it is translated, a German one never', () => {
  assert.equal(bootLanguage({ languages: ['en'] }).hidden, true);
  assert.equal(bootLanguage({ languages: ['de'] }).hidden, false);
});

test('without a page, e.g. in Node, the language is German', () => {
  assert.equal(LANG, 'de');
});

test('every page picks its language first, before its styles and scripts', () => {
  for (const page of pages) {
    const head = readFileSync(new URL(page, root), 'utf8').split('</head>')[0];
    const boots = head.indexOf('<script src="src/language-boot.js"></script>');
    assert.ok(boots > 0, page);
    assert.ok(boots < head.indexOf('<link rel="stylesheet"'), page);
  }
});

test('every country has an English name without abbreviations of Intl', () => {
  for (const { code, names } of COUNTRIES) {
    assert.ok(names.en && names.de, code);
    assert.doesNotMatch(names.en, /&|\bSt\.|SAR|Burma/, `${code}: ${names.en}`);
  }
  assert.equal(COUNTRY_BY_CODE.get('CI').names.en, 'Ivory Coast');
  assert.equal(COUNTRY_BY_CODE.get('DE').names.en, 'Germany');
  assert.equal(COUNTRY_BY_CODE.get('DE').names.de, 'Deutschland');
});

test('English pages accept English names only, German pages German names only', () => {
  assert.equal(isCorrectAnswer('Germany', 'DE', 'en'), true);
  assert.equal(isCorrectAnswer('germny', 'DE', 'en'), true);
  assert.equal(isCorrectAnswer('Deutschland', 'DE', 'en'), false);
  assert.equal(isCorrectAnswer('Germany', 'DE', 'de'), false);
  assert.equal(isCorrectAnswer('Deutschland', 'DE', 'de'), true);
  assert.equal(isCorrectAnswer('Switzerland', 'CH', 'en'), true);
  assert.equal(isCorrectAnswer('Schweiz', 'CH', 'en'), false);
  assert.equal(isCorrectAnswer('USA', 'US', 'en'), true);
  assert.equal(isCorrectAnswer('Côte d’Ivoire', 'CI', 'en'), true);
  assert.equal(isCorrectAnswer('Elfenbeinküste', 'CI', 'en'), false);
  assert.equal(isCorrectFlag('Indonesia', 'MC', 'en'), true);
});

test('"Border Hopper" understands English names and asks back about "Congo"', () => {
  assert.deepEqual(findCountries('Congo', 'en').sort(), ['CD', 'CG']);
  const round = createRound('PT', 'PL');
  assert.deepEqual(judgeGuess(round, 'Germany', 'en'), { kind: 'step', code: 'DE' });
  assert.deepEqual(judgeGuess(round, 'Deutschland', 'en'), { kind: 'unknown' });
});

test('the English aliases name real countries and each one is accepted', () => {
  for (const [code, aliases] of Object.entries(ALIASES_EN)) {
    assert.ok(COUNTRY_BY_CODE.has(code), code);
    for (const alias of aliases) assert.ok(isCorrectAnswer(alias, code, 'en'), `${code}: ${alias}`);
  }
  for (const code of WITH_THE) assert.ok(COUNTRY_BY_CODE.has(code), code);
});

test('every capital has an English entry for the same place, with English names only', () => {
  assert.deepEqual(Object.keys(CAPITALS_EN).sort(), Object.keys(CAPITALS).sort());
  for (const [code, { name, also = [] }] of Object.entries(CAPITALS_EN)) {
    assert.ok(name, code);
    assert.equal(also.length, (CAPITALS[code].also ?? []).length, code);
  }
  assert.equal(capitalLabel('NL', 'en'), 'Amsterdam (also The Hague)');
  assert.equal(capitalLabel('NL', 'de'), 'Amsterdam (auch Den Haag)');
  assert.equal(isCorrectCapital('Vienna', 'AT', 'en'), true);
  assert.equal(isCorrectCapital('Wien', 'AT', 'en'), false);
  assert.equal(isCorrectCapital('Beijing', 'CN', 'en'), true);
  assert.equal(isCorrectCapital('Cape Town', 'ZA', 'en'), true);
  assert.ok(!capitalNames('ZA', 'en').includes('Kapstadt'));
});

test('English names take "the" where English does, in every case', () => {
  assert.equal(countryPhrase('NL', 'nominative', 'en'), 'the Netherlands');
  assert.equal(countryPhrase('NL', 'dative', 'en'), 'the Netherlands');
  assert.equal(countryPhrase('US', 'nominative', 'en'), 'the United States');
  assert.equal(countryPhrase('DE', 'nominative', 'en'), 'Germany');
  assert.equal(countryPhrase('NL', 'dative'), 'den Niederlanden');
});

test('the game writes the same messages in both languages', () => {
  const { de, en } = TEXT;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort());
  for (const key of Object.keys(de)) assert.equal(typeof en[key], typeof de[key], key);
  assert.deepEqual(Object.keys(en.continents), Object.keys(de.continents));
  assert.deepEqual(Object.keys(en.levels), Object.keys(de.levels));
});

test('English sentences name countries with their article and a singular verb', () => {
  const { en } = TEXT;
  assert.equal(en.thatIs('NL'), 'That’s the Netherlands');
  assert.equal(en.liesHere('NL'), 'The Netherlands is here');
  assert.equal(en.whereVerb('NL'), 'is the');
  assert.equal(en.whereVerb('DE'), 'is');
  assert.equal(en.sameFlag(['RO']), ' (same flag as Romania)');
  assert.equal(en.sameFlag([]), '');
  assert.equal(en.capitalIn('AT', 'Austria'), 'Vienna is here: Austria');
  assert.deepEqual(en.routeFrom('NL'), { lead: 'From the', name: 'Netherlands' });
  assert.deepEqual(en.routeTo('PL'), { lead: 'to', name: 'Poland' });
  assert.equal(en.routeStatus(1, 3), '1 guess left · at least 3 countries between');
  assert.equal(en.routeStatus(5, 1), '5 guesses left · at least 1 country between');
  assert.equal(en.ambiguous(['CD', 'CG']), 'Do you mean the Democratic Republic of the Congo or the Republic of the Congo?');
  assert.equal(en.endpoint('US', false), 'The United States is the end.');
  assert.equal(en.longer(6, 3), 'With 6 countries, 3 would have done.');
});

test('German sentences stay as they were', () => {
  const { de } = TEXT;
  assert.equal(de.thatIs('NL'), 'Das sind die Niederlande');
  assert.equal(de.liesHere('CH'), 'Die Schweiz liegt hier');
  assert.equal(de.whereVerb('NL'), 'liegen die');
  assert.equal(de.sameFlag(['RO']), ' (gleiche Flagge wie Rumänien)');
  assert.equal(de.capitalIn('AT', 'Österreich'), 'Wien liegt hier: Österreich');
  assert.deepEqual(de.routeFrom('CH'), { lead: 'Von der', name: 'Schweiz' });
  assert.deepEqual(de.routeTo('NL'), { lead: 'in die', name: 'Niederlande' });
  assert.deepEqual(de.routeTo('PL'), { lead: 'nach', name: 'Polen' });
});

test('every marked text of the pages has an English translation, and every translation is used', () => {
  const used = new Set();
  for (const page of pages) {
    const html = readFileSync(new URL(page, root), 'utf8');
    for (const [, key] of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) {
      assert.ok(Object.hasOwn(PAGE_TEXT_EN, key), `${page}: ${key}`);
      used.add(key);
    }
  }
  for (const key of Object.keys(PAGE_TEXT_EN)) assert.ok(used.has(key), `unused: ${key}`);
});
