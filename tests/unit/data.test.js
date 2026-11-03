import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { geoArea } from '../../vendor/d3.bundle.js';
import { ALIASES } from '../../data/aliases.js';
import { CONTINENTS, COUNTRIES, COUNTRY_BY_CODE, LEVELS, NOT_UN_MEMBERS } from '../../data/countries.js';
import { scoreColor } from '../../src/colors.js';

const world = JSON.parse(readFileSync(new URL('../../data/world.json', import.meta.url)));
const mapIds = world.features.map((feature) => feature.properties.id);

test('quiz scope is all 249 ISO 3166-1 entries plus Kosovo', () => {
  assert.equal(COUNTRIES.length, 250);
  assert.equal(COUNTRY_BY_CODE.size, 250);
  const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK'.split(' ');
  assert.deepEqual([...COUNTRY_BY_CODE.keys()].sort(), codes.sort());
});

test('map regions outside ISO 3166-1 are not quizzed', () => {
  for (const code of ['KAS', 'BRT']) {
    assert.ok(mapIds.includes(code), code);
    assert.ok(!COUNTRY_BY_CODE.has(code), code);
  }
});

test('every quizzed country has a name, a continent and a map shape', () => {
  const ids = new Set(mapIds);
  for (const { code, name, continent } of COUNTRIES) {
    assert.ok(name && name !== code, `${code} has no German name`);
    assert.ok(Object.hasOwn(CONTINENTS, continent), `${code} continent`);
    assert.ok(ids.has(code), `${code} is missing from the map`);
  }
});

test('every country has a difficulty level, and the 193 UN members are not all hard', () => {
  for (const { code, level } of COUNTRIES) assert.ok(Object.hasOwn(LEVELS, level), `${code} level`);
  for (const code of NOT_UN_MEMBERS) {
    assert.ok(COUNTRY_BY_CODE.has(code), code);
    assert.equal(COUNTRY_BY_CODE.get(code).level, 'hard', code);
  }
  assert.equal(COUNTRIES.length - NOT_UN_MEMBERS.size, 193);
  const level = (code) => COUNTRY_BY_CODE.get(code).level;
  for (const code of ['DE', 'US', 'BR', 'CN', 'EG']) assert.equal(level(code), 'easy', code);
  for (const code of ['SK', 'MT', 'SG', 'BO']) assert.equal(level(code), 'medium', code);
  for (const code of ['NR', 'TV', 'GL', 'XK', 'TW', 'EH']) assert.equal(level(code), 'hard', code);
});

test('the Middle East is its own region', () => {
  for (const code of ['EG', 'TR', 'SA', 'IR', 'IL', 'PS']) assert.equal(COUNTRY_BY_CODE.get(code).continent, 'ME', code);
  for (const code of ['CY', 'GE', 'AM', 'AZ', 'LY']) assert.notEqual(COUNTRY_BY_CODE.get(code).continent, 'ME', code);
});

test('map features have unique ids and map data stays under 3 MB', () => {
  assert.equal(new Set(mapIds).size, mapIds.length);
  assert.ok(readFileSync(new URL('../../data/world.json', import.meta.url)).length < 3_000_000);
});

test('map data keeps enough detail to stay sharp when zoomed in', () => {
  let points = 0;
  const count = (value) => (typeof value[0] === 'number' ? points++ : value.forEach(count));
  for (const feature of world.features) count(feature.geometry.coordinates);
  assert.ok(points > 130_000, `only ${points} points`);
});

test('the smallest countries are enlarged to a visible minimum size', () => {
  for (const code of ['VA', 'GI', 'TK']) {
    const feature = world.features.find((candidate) => candidate.properties.id === code);
    const area = geoArea(feature) * 6371 ** 2;
    assert.ok(area > 39 && area < 41, `${code} is ${area} km²`);
  }
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
