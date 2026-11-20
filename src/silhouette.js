// The outline of one country for "Umrisse erkennen", free of DOM and page code.
// A country is drawn on its own, centered and filling the box, so its shape is all
// the player sees.
import { geoArea, geoCentroid, geoOrthographic, geoPath } from '../vendor/d3.bundle.js';

const EARTH_RADIUS_KM = 6371;

// Parts of a country closer than this to the parts already kept belong to its
// shape: the islands of Indonesia or Japan, Kaliningrad. Farther ones, like French
// Guiana, Hawaii or the Canary Islands, would shrink the main shape to a dot.
export const MAX_GAP_KM = 500;

// Below this area a country's largest part has only a few points on the map, so
// Monaco, Malta or Nauru would only be a blob. Those countries are not asked.
export const MIN_AREA_KM2 = 2000;

const areaKm2 = (geometry) => geoArea(geometry) * EARTH_RADIUS_KM ** 2;

const polygonsOf = (geometry) => {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
};

const RADIANS = Math.PI / 180;

// A point on the unit sphere, so distances are a dot product instead of trigonometry.
function toVector([longitude, latitude]) {
  const cosLatitude = Math.cos(latitude * RADIANS);
  return [cosLatitude * Math.cos(longitude * RADIANS), cosLatitude * Math.sin(longitude * RADIANS), Math.sin(latitude * RADIANS)];
}

// The angle between two points on the unit sphere, in radians.
const angle = (a, b) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));

// A part of a country with a circle around it, to skip parts that are far apart
// without comparing all their corners.
function partOf(coordinates) {
  const polygon = { type: 'Polygon', coordinates };
  const center = toVector(geoCentroid(polygon));
  const corners = coordinates[0].map(toVector);
  const radius = Math.max(...corners.map((corner) => angle(center, corner)));
  return { coordinates, corners, center, radius, area: areaKm2(polygon) };
}

// Whether two parts come closer than MAX_GAP_KM, comparing the corners of their
// outer rings. Corners are enough: coastlines have a point every few kilometers.
function isNear(a, b) {
  const limit = MAX_GAP_KM / EARTH_RADIUS_KM;
  if (angle(a.center, b.center) - a.radius - b.radius > limit) return false;
  // Only the corners of the larger part within reach of the smaller one's circle
  // can be close to one of its corners.
  const [small, large] = a.radius < b.radius ? [a, b] : [b, a];
  const reach = small.radius + limit;
  const candidates = large.corners.filter((q) => angle(small.center, q) < reach);
  return small.corners.some((p) => candidates.some((q) => angle(p, q) < limit));
}

// The part of a country that makes its shape: its largest polygon and every part
// that can be reached from it in steps of less than MAX_GAP_KM.
export function mainShape(geometry) {
  const parts = polygonsOf(geometry).map(partOf);
  if (!parts.length) return null;
  parts.sort((a, b) => b.area - a.area);
  const kept = [parts[0]];
  let rest = parts.slice(1);
  let grew = true;
  while (grew && rest.length) {
    grew = false;
    rest = rest.filter((part) => {
      const near = kept.some((other) => isNear(part, other));
      if (near) {
        kept.push(part);
        grew = true;
      }
      return !near;
    });
  }
  return { type: 'MultiPolygon', coordinates: kept.map((part) => part.coordinates) };
}

// Whether a country's largest part is big enough on the map to be recognized.
export const hasSilhouette = (geometry) =>
  polygonsOf(geometry).some((coordinates) => areaKm2({ type: 'Polygon', coordinates }) >= MIN_AREA_KM2);

// The SVG path of a country's main shape, seen from straight above its center and
// scaled to fill a `width` × `height` box with `padding` on every side.
export function silhouettePath(geometry, width, height, padding = 0) {
  const shape = mainShape(geometry);
  if (!shape) return '';
  const [longitude, latitude] = geoCentroid(shape);
  const projection = geoOrthographic()
    .rotate([-longitude, -latitude])
    .fitExtent([[padding, padding], [width - padding, height - padding]], shape);
  // Two decimals are far below a pixel and keep the path short.
  return geoPath(projection).digits(2)(shape) ?? '';
}
