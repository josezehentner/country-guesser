import { geoArea, geoCentroid, geoDistance } from '../vendor/d3.bundle.js';

const RADIANS = Math.PI / 180;

function toVector([lon, lat]) {
  const cosLat = Math.cos(lat * RADIANS);
  return [cosLat * Math.cos(lon * RADIANS), cosLat * Math.sin(lon * RADIANS), Math.sin(lat * RADIANS)];
}

// Distance from p to the straight segment a–b, all points on the unit sphere.
function segmentDistance(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const length2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = length2 ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / length2)) : 0;
  return Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]);
}

// Douglas-Peucker on the unit sphere in 3D. An orthographic globe projects 3D in
// parallel onto the screen, so on screen no dropped point is further than
// tolerance × projection scale from the drawn line. Rings keep at least 4 points.
export function simplifyRing(ring, tolerance) {
  const simplified = douglasPeucker(ring, tolerance);
  // d3 reads a ring's winding as which side is inside. A tiny ring squashed flat can
  // flip it and would then fill the whole globe, so such rings stay as they are.
  return isInverted(simplified) === isInverted(ring) ? simplified : ring;
}

const isInverted = (ring) => geoArea({ type: 'Polygon', coordinates: [ring] }) > 2 * Math.PI;

// Keeps the first and last point and at least `minPoints` points.
function douglasPeucker(ring, tolerance, minPoints = 4) {
  if (ring.length <= minPoints || tolerance <= 0) return ring;
  const vectors = ring.map(toVector);
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = segmentDistance(vectors[i], vectors[first], vectors[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const simplified = ring.filter((_, i) => keep[i]);
  return simplified.length >= minPoints ? simplified : ring;
}

// An open line, such as a stretch of coast. Its ends stay where they are, so it
// still meets the borders it runs between.
export const simplifyLine = (line, tolerance) => douglasPeucker(line, tolerance, 2);

export function simplifyPolygon(polygon, tolerance) {
  return polygon.map((ring) => simplifyRing(ring, tolerance));
}

// Smallest circle around the polygon's centroid that holds all of it: cheap culling.
// Center in degrees, radius in radians.
export function boundingCap(polygon) {
  const center = geoCentroid({ type: 'Polygon', coordinates: polygon });
  let radius = 0;
  for (const point of polygon[0]) radius = Math.max(radius, geoDistance(center, point));
  return { center, radius };
}
