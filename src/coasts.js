// The coastlines of the map: the parts of country outlines where land meets water,
// for a globe that hides the borders ("Grenzgänger"). Free of DOM and canvas code.
import { geoArea, geoContains } from '../vendor/d3.bundle.js';

const EARTH_RADIUS_KM = 6371;
// Entries this small kept full detail and were enlarged (see vendor/NOTICE.md), so
// they share no border points with their neighbors but overlap them instead.
const SMALL_AREA_KM2 = 100;
// Their outlines and those of their neighbors were simplified on their own, so they
// miss each other by up to about OFFSET_KM. Within NEAR_SMALL_KM of a small entry a
// piece of outline is only coast if there is no land OFFSET_KM beyond it.
const OFFSET_KM = 2;
const NEAR_SMALL_KM = 5;
const KM_PER_DEGREE = (Math.PI / 180) * EARTH_RADIUS_KM;

const polygonsOf = (geometry) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);
const key = ([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`;

function boundsOf(polygon) {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of polygon[0]) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return { west, south, east, north };
}

// Bounds grown by `margin` degrees of latitude, and as many kilometers in longitude.
const inBounds = ({ west, south, east, north }, [lon, lat], margin = 0) => {
  const lonMargin = margin / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  return lon >= west - lonMargin && lon <= east + lonMargin && lat >= south - margin && lat <= north + margin;
};

// The point OFFSET_KM beyond the middle of the segment a–b, on the side away from
// the country. d3 has the inside of every ring, outer or hole, on the right.
function beyond(a, b) {
  const [lon, lat] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const scale = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const [dx, dy] = [(b[0] - a[0]) * scale, b[1] - a[1]];
  const length = Math.hypot(dx, dy) || 1;
  const step = OFFSET_KM / KM_PER_DEGREE / length;
  return [lon - (dy * step) / scale, lat + dx * step];
}

// For each feature, for each of its polygons, the stretches of coast as open lines.
// Neighbors share the points of their common border exactly, so a segment both of
// whose ends belong to another feature too is a border, not a coast. Around the
// enlarged small entries, a segment with land on it or just beyond is none either.
export function coastLines(features) {
  const ownersByPoint = new Map();
  features.forEach((feature, index) => {
    for (const ring of polygonsOf(feature.geometry).flat()) {
      for (const point of ring) {
        const owners = ownersByPoint.get(key(point));
        if (!owners) ownersByPoint.set(key(point), [index]);
        else if (!owners.includes(index)) owners.push(index);
      }
    }
  });

  const parts = features.flatMap((feature, index) => polygonsOf(feature.geometry).map((polygon) => ({ index, polygon, bounds: boundsOf(polygon) })));
  const isSmall = features.map((feature) => geoArea(feature) * EARTH_RADIUS_KM ** 2 < SMALL_AREA_KM2);
  const smallParts = parts.filter(({ index }) => isSmall[index]);

  const isLandAt = (index, point) => parts.some((part) =>
    part.index !== index && inBounds(part.bounds, point) && geoContains({ type: 'Polygon', coordinates: part.polygon }, point));
  const nearSmall = (point) => smallParts.some((part) => inBounds(part.bounds, point, NEAR_SMALL_KM / KM_PER_DEGREE));

  const isBorder = (index, a, b) => {
    const ownersA = ownersByPoint.get(key(a));
    const ownersB = ownersByPoint.get(key(b));
    return ownersA.some((owner) => owner !== index && ownersB.includes(owner));
  };

  // Around a small entry its outline and its neighbors' overlap or miss each other
  // a little: there a piece is no coast if it lies on land or has land just beyond.
  const isCoast = (index, a, b) => {
    if (isBorder(index, a, b)) return false;
    const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (!nearSmall(middle)) return true;
    return !isLandAt(index, middle) && !isLandAt(index, beyond(a, b));
  };

  return features.map((feature, index) => polygonsOf(feature.geometry).map((polygon) => polygon.flatMap((ring) => coastRuns(ring, (a, b) => isCoast(index, a, b)))));
}

// The runs of consecutive coast segments of a closed ring, as open lines. A run
// may go on past the ring's first point.
function coastRuns(ring, isCoast) {
  const count = ring.length - 1;
  const coast = Array.from({ length: count }, (_, i) => isCoast(ring[i], ring[i + 1]));
  const firstBorder = coast.indexOf(false);
  if (firstBorder < 0) return [ring];
  const runs = [];
  let run = null;
  for (let step = 1; step <= count; step++) {
    const i = (firstBorder + step) % count;
    if (coast[i]) {
      run ??= [ring[i]];
      run.push(ring[i + 1]);
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs;
}
