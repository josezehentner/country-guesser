import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { geoArea } from '../../vendor/d3.bundle.js';
import { MIN_AREA_KM2 } from '../../tools/lakes.js';

const file = new URL('../../data/lakes.json', import.meta.url);
const lakes = JSON.parse(readFileSync(file)).features;
const areaKm2 = (feature) => geoArea(feature) * 6371 ** 2;

test('the lakes players look for are on the map', () => {
  const names = lakes.map((lake) => lake.properties.name);
  for (const name of ['Victoriasee', 'Michigansee', 'Nicaraguasee', 'Oberer', 'Baikalsee', 'Titicacasee', 'Tanganjikasee']) {
    assert.ok(names.includes(name), name);
  }
});

// The corners of a lake's bounding box, slightly widened, in degrees.
function box(lake) {
  const points = lake.geometry.coordinates.flat(2);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [Math.min(...xs) - 0.05, Math.min(...ys) - 0.05, Math.max(...xs) + 0.05, Math.max(...ys) + 0.05];
}
const touch = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

test('only large lakes are drawn, and each one is a small part of the globe', () => {
  assert.ok(lakes.length > 25 && lakes.length < 60, `${lakes.length} lakes`);
  for (const lake of lakes) {
    // A ring wound the wrong way would cover the whole globe instead of the lake.
    assert.ok(areaKm2(lake) < 100_000, `${lake.properties.name}: ${areaKm2(lake)} km²`);
  }
  const names = lakes.map((lake) => lake.properties.name);
  for (const small of ['Vättern', 'Tonle Sap', 'Peipussee', 'Tanasee']) assert.ok(!names.includes(small), small);
});

// Natural Earth cuts some lakes into pieces, e.g. Lake Huron and the North Channel.
test('a lake below the limit is only there as a piece of a large one', () => {
  // A little below the limit: simplifying the shore may shrink a lake slightly.
  const large = lakes.filter((lake) => areaKm2(lake) >= MIN_AREA_KM2 * 0.95);
  for (const piece of lakes.filter((lake) => !large.includes(lake))) {
    assert.ok(large.some((lake) => touch(box(lake), box(piece))), piece.properties.name);
  }
  assert.ok(lakes.some((lake) => lake.properties.name === 'North Channel'));
});

test('lake data stays small', () => {
  assert.ok(readFileSync(file).length < 600_000);
});
