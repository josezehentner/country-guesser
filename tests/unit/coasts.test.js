import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { coastLines } from '../../src/coasts.js';

// A clockwise square, as d3 expects the outer ring, from its south-west corner.
const square = (west, south, size) => [[west, south], [west, south + size], [west + size, south + size], [west + size, south], [west, south]];
const feature = (id, ...rings) => ({ type: 'Feature', properties: { id }, geometry: { type: 'Polygon', coordinates: rings } });
const segments = (lines) => lines.flatMap((line) => line.slice(1).map((point, i) => `${line[i]}>${point}`));

test('an island is coast all around, as one closed line', () => {
  const ring = square(0, 0, 1);
  assert.deepEqual(coastLines([feature('A', ring)]), [[[ring]]]);
});

test('the border two neighbors share is no coast, the rest of their outlines is', () => {
  // A and B meet along the line from (1, 0) to (1, 1).
  const a = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]];
  const b = [[1, 0], [1, 1], [2, 1], [2, 0], [1, 0]];
  const [[coastA], [coastB]] = coastLines([feature('A', a), feature('B', b)]);
  // A's coast runs on past the ring's first point as one line.
  assert.deepEqual(coastA, [[[1, 0], [0, 0], [0, 1], [1, 1]]]);
  assert.deepEqual(coastB, [[[1, 1], [2, 1], [2, 0], [1, 0]]]);
  assert.ok(!segments(coastA).includes('1,1>1,0'));
});

test('a small entry that overlaps its neighbor has no coast there, and neither has the neighbor', () => {
  // Like Vatican City in Rome: enlarged, so it shares no border points with the big
  // country around it, which has a smaller hole where it lies.
  const big = feature('IT', square(0, 0, 1), [[0.48, 0.48], [0.52, 0.48], [0.52, 0.52], [0.48, 0.52], [0.48, 0.48]]);
  const small = feature('VA', square(0.47, 0.47, 0.06));
  const [[bigCoast], [smallCoast]] = coastLines([big, small]);
  assert.deepEqual(smallCoast, []);
  assert.deepEqual(bigCoast, [square(0, 0, 1)]);
});

test('a small entry keeps its coast where it meets the sea', () => {
  // Like Monaco on the coast of France: its south side is open water.
  const france = feature('FR', [[0, 0], [0, 1], [1, 1], [1, 0], [0.53, 0], [0.47, 0], [0, 0]]);
  const monaco = feature('MC', [[0.47, -0.01], [0.47, 0.04], [0.53, 0.04], [0.53, -0.01], [0.47, -0.01]]);
  const [, [monacoCoast]] = coastLines([france, monaco]);
  assert.ok(segments(monacoCoast).includes('0.53,-0.01>0.47,-0.01'));
  assert.ok(!segments(monacoCoast).includes('0.47,0.04>0.53,0.04'));
});

test('on the real map landlocked countries have no coast, and islands are all coast', () => {
  const world = JSON.parse(readFileSync(new URL('../../data/world.json', import.meta.url)));
  const coasts = coastLines(world.features);
  const coastOf = (code) => coasts[world.features.findIndex((f) => f.properties.id === code)].flat();
  for (const code of ['CH', 'AT', 'LI', 'LS', 'VA', 'SM', 'AD', 'MN', 'BO']) assert.deepEqual(coastOf(code), [], code);
  const iceland = world.features.find((f) => f.properties.id === 'IS');
  const rings = iceland.geometry.type === 'Polygon' ? [iceland.geometry.coordinates] : iceland.geometry.coordinates;
  assert.equal(coastOf('IS').length, rings.flat().length);
  for (const code of ['PT', 'DE', 'FR', 'MC', 'GI', 'MO']) assert.ok(coastOf(code).length, code);
});
