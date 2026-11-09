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

test('only large lakes are drawn, and each one is a small part of the globe', () => {
  assert.ok(lakes.length > 100 && lakes.length < 300, `${lakes.length} lakes`);
  for (const lake of lakes) {
    const area = areaKm2(lake);
    // A little below the limit: simplifying the shore may shrink a lake slightly.
    assert.ok(area >= MIN_AREA_KM2 * 0.95, `${lake.properties.name}: ${area} km²`);
    // A ring wound the wrong way would cover the whole globe instead of the lake.
    assert.ok(area < 100_000, `${lake.properties.name}: ${area} km²`);
  }
});

test('lake data stays small', () => {
  assert.ok(readFileSync(file).length < 600_000);
});
