import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ALIASES } from '../../data/aliases.js';
import { CONTINENTS, COUNTRIES, COUNTRY_BY_CODE } from '../../data/countries.js';
import { scoreColor } from '../../src/colors.js';

const world = JSON.parse(readFileSync(new URL('../../data/world.json', import.meta.url)));
const mapIds = world.features.map((feature) => feature.properties.id);

test('quiz scope is 193 UN members plus XK, TW, PS and VA', () => {
  assert.equal(COUNTRIES.length, 197);
  assert.equal(COUNTRY_BY_CODE.size, 197);
  for (const code of ['XK', 'TW', 'PS', 'VA']) assert.ok(COUNTRY_BY_CODE.has(code), code);
});

test('dependent territories are not quizzed', () => {
  for (const code of ['GL', 'PR', 'NC', 'HK', 'FR-OVERSEAS']) assert.ok(!COUNTRY_BY_CODE.has(code), code);
});

test('every quizzed country has a name, a continent and a map shape', () => {
  const ids = new Set(mapIds);
  for (const { code, name, continent } of COUNTRIES) {
    assert.ok(name && name !== code, `${code} has no German name`);
    assert.ok(Object.hasOwn(CONTINENTS, continent), `${code} continent`);
    assert.ok(ids.has(code), `${code} is missing from the map`);
  }
});

test('map features have unique ids and map data stays under 1 MB', () => {
  assert.equal(new Set(mapIds).size, mapIds.length);
  assert.ok(readFileSync(new URL('../../data/world.json', import.meta.url)).length < 1_000_000);
});

test('aliases only refer to quizzed countries', () => {
  for (const code of Object.keys(ALIASES)) assert.ok(COUNTRY_BY_CODE.has(code), code);
});

test('scoreColor follows the progress table', () => {
  assert.equal(scoreColor(undefined), 'var(--never)');
  assert.equal(scoreColor(0), 'var(--score-zero)');
  assert.notEqual(scoreColor(undefined), scoreColor(0));
  assert.equal(scoreColor(1), 'hsl(0, 70%, var(--score-lightness))');
  assert.equal(scoreColor(10), 'hsl(120, 70%, var(--score-lightness))');
});
