import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { COUNTRIES } from '../../data/countries.js';
import { NO_SILHOUETTE, SILHOUETTE_COUNTRIES, WARPED_SILHOUETTE } from '../../data/silhouettes.js';
import { hasSilhouette, mainShape, silhouettePath } from '../../src/silhouette.js';

const world = JSON.parse(readFileSync(new URL('../../data/world.json', import.meta.url)));
const geometryOf = new Map(world.features.map((feature) => [feature.properties.id, feature.geometry]));

// Clockwise, as d3 and data/world.json expect outer rings.
const square = (longitude, latitude, size) => [[
  [longitude, latitude], [longitude, latitude + size], [longitude + size, latitude + size],
  [longitude + size, latitude], [longitude, latitude],
]];

// Every corner of a path, as [x, y].
const corners = (path) => [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)]);

test('the list of countries without a shape matches the map', () => {
  for (const { code } of COUNTRIES) {
    if (WARPED_SILHOUETTE.has(code)) continue;
    assert.equal(NO_SILHOUETTE.has(code), !hasSilhouette(geometryOf.get(code)), code);
  }
});

test('large and well-known countries are asked, tiny ones and Antarctica are not', () => {
  const asked = new Set(SILHOUETTE_COUNTRIES.map(({ code }) => code));
  for (const code of ['DE', 'IT', 'FR', 'US', 'JP', 'ID', 'CL', 'LU', 'CY', 'JM', 'FJ']) assert.ok(asked.has(code), code);
  for (const code of ['VA', 'MC', 'NR', 'MT', 'SG', 'AQ']) assert.ok(!asked.has(code), code);
  assert.equal(SILHOUETTE_COUNTRIES.length, COUNTRIES.length - NO_SILHOUETTE.size - WARPED_SILHOUETTE.size);
});

test('a part close to the largest one belongs to the shape, a far one does not', () => {
  const geometry = {
    type: 'MultiPolygon',
    // A large square, an island 2° (about 220 km) east of it and one 30° away.
    coordinates: [square(0, 0, 5), square(7, 0, 1), square(35, 0, 1)],
  };
  assert.deepEqual(mainShape(geometry).coordinates, [square(0, 0, 5), square(7, 0, 1)]);
});

test('parts reachable in short steps all belong to the shape, like an island chain', () => {
  // Each island is 3° (about 330 km) from the one before, 12° from the first.
  const islands = [0, 4, 8, 12].map((longitude) => square(longitude, 0, longitude ? 1 : 2));
  assert.equal(mainShape({ type: 'MultiPolygon', coordinates: islands }).coordinates.length, 4);
});

test('real countries keep their islands but not their faraway territories', () => {
  const kept = (code) => mainShape(geometryOf.get(code)).coordinates.length;
  const parts = (code) => geometryOf.get(code).coordinates.length;
  // Hawaii and the Aleutians are dropped, the islands off the coast are not.
  assert.ok(kept('US') < parts('US') && kept('US') > 1);
  // Indonesia stays whole; Spain loses the Canary Islands but keeps the Balearics.
  assert.equal(kept('ID'), parts('ID'));
  assert.ok(kept('ES') < parts('ES') && kept('ES') > 1);
  // Ecuador without the Galápagos.
  assert.ok(kept('EC') < parts('EC'));
});

test('every asked country has an outline that fills its box', () => {
  for (const { code } of SILHOUETTE_COUNTRIES) {
    const path = silhouettePath(geometryOf.get(code), 300, 200, 10);
    assert.match(path, /^M/, code);
    const points = corners(path);
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    // The shape stays inside the padding, and touches it on two sides at least.
    assert.ok(Math.min(...xs) >= 9.9 && Math.max(...xs) <= 290.1, code);
    assert.ok(Math.min(...ys) >= 9.9 && Math.max(...ys) <= 190.1, code);
    const fillsWidth = Math.max(...xs) - Math.min(...xs) > 279;
    const fillsHeight = Math.max(...ys) - Math.min(...ys) > 179;
    assert.ok(fillsWidth || fillsHeight, code);
  }
});

test('a country without a shape gives an empty path', () => {
  assert.equal(silhouettePath({ type: 'GeometryCollection', geometries: [] }, 100, 100), '');
});
