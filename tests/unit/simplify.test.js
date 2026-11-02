import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { geoArea, geoDistance } from '../../vendor/d3.bundle.js';
import { boundingCap, simplifyPolygon, simplifyRing } from '../../src/simplify.js';

const world = JSON.parse(readFileSync(new URL('../../data/world.json', import.meta.url)));
const polygonsOf = ({ geometry }) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);
const feature = (code) => world.features.find((f) => f.properties.id === code);
const RADIANS = Math.PI / 180;

function toVector([lon, lat]) {
  const cosLat = Math.cos(lat * RADIANS);
  return [cosLat * Math.cos(lon * RADIANS), cosLat * Math.sin(lon * RADIANS), Math.sin(lat * RADIANS)];
}

// Largest 3D distance from a dropped point to the simplified ring's segments.
function maxError(ring, simplified) {
  const kept = simplified.map(toVector);
  const segmentDistance = (p, a, b) => {
    const ab = a.map((v, i) => b[i] - v);
    const ap = a.map((v, i) => p[i] - v);
    const length2 = ab.reduce((sum, v) => sum + v * v, 0);
    const t = length2 ? Math.max(0, Math.min(1, ap.reduce((sum, v, i) => sum + v * ab[i], 0) / length2)) : 0;
    return Math.hypot(...ap.map((v, i) => v - t * ab[i]));
  };
  // Kept points are the same array objects as in the ring, in the same order.
  let worst = 0;
  let segment = 0;
  for (const point of ring.slice(1, -1)) {
    if (point === simplified[segment + 1]) segment++;
    else worst = Math.max(worst, segmentDistance(toVector(point), kept[segment], kept[segment + 1]));
  }
  return worst;
}

test('simplified rings stay within the tolerance and drop points', () => {
  const tolerance = 0.5 / 400;
  for (const code of ['NO', 'CA', 'HR', 'GR']) {
    for (const polygon of polygonsOf(feature(code))) {
      for (const ring of polygon) {
        const simplified = simplifyRing(ring, tolerance);
        assert.ok(maxError(ring, simplified) <= tolerance, `${code} error`);
      }
    }
  }
  const norway = polygonsOf(feature('NO')).flat();
  const before = norway.reduce((sum, ring) => sum + ring.length, 0);
  const after = norway.reduce((sum, ring) => sum + simplifyRing(ring, tolerance).length, 0);
  assert.ok(after < before / 2, `${after} of ${before} points kept`);
});

test('simplified rings stay closed with at least 4 points', () => {
  for (const { geometry } of world.features.slice(0, 60)) {
    for (const polygon of polygonsOf({ geometry })) {
      for (const ring of simplifyPolygon(polygon, 0.01)) {
        assert.ok(ring.length >= 4);
        assert.deepEqual(ring[0], ring.at(-1));
      }
    }
  }
});

test('zero tolerance keeps every point', () => {
  const ring = polygonsOf(feature('DE'))[0][0];
  assert.equal(simplifyRing(ring, 0), ring);
});

test('simplifying never turns a ring inside out', () => {
  for (const tolerance of [0.5 / 255, 0.5 / 510, 0.01]) {
    for (const f of world.features) {
      for (const polygon of polygonsOf(f)) {
        const area = geoArea({ type: 'Polygon', coordinates: simplifyPolygon(polygon, tolerance) });
        assert.ok(area < 2 * Math.PI, `${f.properties.id} covers the globe at tolerance ${tolerance}`);
      }
    }
  }
});

test('a polygon lies inside its bounding cap', () => {
  for (const code of ['DE', 'CL', 'RU', 'AQ', 'VA']) {
    for (const polygon of polygonsOf(feature(code))) {
      const cap = boundingCap(polygon);
      for (const point of polygon[0]) assert.ok(geoDistance(cap.center, point) <= cap.radius + 1e-12);
    }
  }
});
