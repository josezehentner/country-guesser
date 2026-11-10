import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../data/countries.js';
import { FLAG_COUNTRIES, LOOKALIKES, NO_FLAG, SHARED_FLAGS, flagUrl, lookalikesOf } from '../../data/flags.js';
import { isCorrectFlag } from '../../src/quiz.js';

const root = new URL('../../', import.meta.url);
const flagFiles = readdirSync(new URL('vendor/flags/', root)).filter((name) => name.endsWith('.svg'));

test('every entry with a flag of its own is asked, the others are not', () => {
  for (const { code } of COUNTRIES) {
    const asked = FLAG_COUNTRIES.some((country) => country.code === code);
    assert.equal(asked, !NO_FLAG.has(code) && !Object.hasOwn(SHARED_FLAGS, code), code);
  }
  assert.equal(FLAG_COUNTRIES.length, 235);
  assert.ok(NO_FLAG.has('AQ'));
});

test('territories without a flag of their own fly the flag of an asked entry', () => {
  for (const [code, owner] of Object.entries(SHARED_FLAGS)) {
    assert.ok(COUNTRY_BY_CODE.has(code), code);
    assert.ok(FLAG_COUNTRIES.some((country) => country.code === owner), `${code} -> ${owner}`);
  }
  for (const code of ['FR', 'NO', 'US', 'GB', 'NL', 'AU']) assert.ok(FLAG_COUNTRIES.some((c) => c.code === code), code);
});

test('there is exactly one flag file per asked entry, and no other', () => {
  assert.deepEqual(flagFiles.sort(), FLAG_COUNTRIES.map(({ code }) => `${code.toLowerCase()}.svg`).sort());
  for (const { code } of FLAG_COUNTRIES) assert.ok(existsSync(new URL(flagUrl(code), root)), code);
  assert.ok(existsSync(new URL('vendor/flags/LICENSE', root)));
});

test('flag urls are relative', () => {
  assert.equal(flagUrl('DE'), 'vendor/flags/de.svg');
});

// Images may only come from the site itself, and an SVG must not load or run anything.
test('flag files are self-contained SVGs that stay small', () => {
  let total = 0;
  for (const file of flagFiles) {
    const svg = readFileSync(new URL(`vendor/flags/${file}`, root), 'utf8');
    total += svg.length;
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, file);
    assert.match(svg, /viewBox="0 0 640 480"/, file);
    assert.doesNotMatch(svg, /<script|<image|<foreignObject|\son[a-z]+=|javascript:/i, file);
    const urls = svg.match(/https?:\/\/[^"')\s]+/g) ?? [];
    for (const url of urls) assert.match(url, /^http:\/\/www\.w3\.org\/(2000\/svg|1999\/xlink)$/, `${file}: ${url}`);
    assert.doesNotMatch(svg.replace(/xmlns(:xlink)?="[^"]+"/g, ''), /href="(?!#)/, file);
  }
  assert.ok(total < 2_000_000, `${total} bytes`);
});

test('look-alike flags are pairs of asked countries', () => {
  for (const pair of LOOKALIKES) {
    assert.equal(pair.length, 2);
    for (const code of pair) assert.ok(FLAG_COUNTRIES.some((country) => country.code === code), code);
  }
  assert.deepEqual(lookalikesOf('MC'), ['ID']);
  assert.deepEqual(lookalikesOf('ID'), ['MC']);
  assert.deepEqual(lookalikesOf('DE'), []);
});

test('the country of a flag counts, with the usual tolerance', () => {
  assert.ok(isCorrectFlag('Deutschland', 'DE'));
  assert.ok(isCorrectFlag('deutschlnd', 'DE'));
  assert.ok(!isCorrectFlag('Österreich', 'DE'));
  assert.ok(!isCorrectFlag('', 'DE'));
});

test('a country whose flag looks the same counts too', () => {
  assert.ok(isCorrectFlag('Indonesien', 'MC'));
  assert.ok(isCorrectFlag('Monaco', 'ID'));
  assert.ok(isCorrectFlag('Tschad', 'RO'));
  assert.ok(!isCorrectFlag('Polen', 'MC'));
});
