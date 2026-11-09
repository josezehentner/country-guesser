// Builds data/lakes.json from Natural Earth's 1:10m lakes.
//
// Download https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip, unpack
// it, then run `npm run build:lakes -- <folder with ne_10m_lakes.shp>`.
// `--list` prints the chosen lakes with their areas instead of writing the file.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { geoArea } from 'd3-geo';
import { simplifyPolygon } from '../src/simplify.js';

// Lakes at least this large are drawn. It keeps every lake a player would look for,
// e.g. Lake Nicaragua at about 8,000 km², and leaves out thousands of small ones.
export const MIN_AREA_KM2 = 1000;
const EARTH_RADIUS_KM = 6371;
// Natural Earth draws shores about six times finer than the country borders in
// data/world.json. Simplifying them to within about 1.3 km keeps them finer than
// those borders and cuts the points to a third.
const TOLERANCE_RADIANS = 2e-4;
// About 11 m on the ground.
const DECIMALS = 4;

// Attributes from the dBASE table that comes with a shapefile.
function readDbf(buffer) {
  const count = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  const fields = [];
  for (let offset = 32, start = 1; buffer[offset] !== 0x0d; offset += 32) {
    const name = buffer.toString('latin1', offset, offset + 11).replace(/\0.*$/, '');
    const length = buffer[offset + 16];
    fields.push({ name, start, length });
    start += length;
  }
  return Array.from({ length: count }, (_, i) => {
    const record = headerLength + i * recordLength;
    return Object.fromEntries(fields.map(({ name, start, length }) => [
      name,
      buffer.toString('utf8', record + start, record + start + length).trim(),
    ]));
  });
}

// Polygons from a shapefile. Its outer rings run clockwise and its holes
// counterclockwise, which is also how d3 reads rings on the sphere.
function readShp(buffer) {
  const shapes = [];
  for (let offset = 100; offset < buffer.length;) {
    const length = buffer.readInt32BE(offset + 4) * 2;
    const content = offset + 8;
    const type = buffer.readInt32LE(content);
    if (type === 5) {
      const parts = buffer.readInt32LE(content + 36);
      const points = buffer.readInt32LE(content + 40);
      const starts = Array.from({ length: parts }, (_, i) => buffer.readInt32LE(content + 44 + i * 4));
      const pointsAt = content + 44 + parts * 4;
      const rings = starts.map((start, i) => {
        const end = i + 1 < parts ? starts[i + 1] : points;
        return Array.from({ length: end - start }, (_, j) => {
          const at = pointsAt + (start + j) * 16;
          return [buffer.readDoubleLE(at), buffer.readDoubleLE(at + 8)];
        });
      });
      shapes.push(rings);
    } else {
      shapes.push([]);
    }
    offset = content + length;
  }
  return shapes;
}

// Signed area in the plane: negative for clockwise rings, i.e. outer rings.
function planarArea(ring) {
  let sum = 0;
  for (let i = 1; i < ring.length; i++) sum += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
  return sum / 2;
}

function contains(ring, [x, y]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Groups a shape's rings into polygons: each hole joins the outer ring around it.
function toPolygons(rings) {
  const polygons = rings.filter((ring) => planarArea(ring) < 0).map((ring) => [ring]);
  for (const hole of rings.filter((ring) => planarArea(ring) > 0)) {
    polygons.find(([outer]) => contains(outer, hole[0]))?.push(hole);
  }
  return polygons;
}

const round = (value) => Number(value.toFixed(DECIMALS));

export function buildLakes(folder) {
  const records = readDbf(readFileSync(join(folder, 'ne_10m_lakes.dbf')));
  const shapes = readShp(readFileSync(join(folder, 'ne_10m_lakes.shp')));
  return shapes
    .map((rings, i) => {
      const geometry = { type: 'MultiPolygon', coordinates: toPolygons(rings) };
      const areaKm2 = geoArea(geometry) * EARTH_RADIUS_KM ** 2;
      return { name: records[i].name_de || records[i].name || '', areaKm2, geometry };
    })
    .filter((lake) => lake.areaKm2 >= MIN_AREA_KM2)
    .sort((a, b) => b.areaKm2 - a.areaKm2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const folder = args.find((arg) => !arg.startsWith('--'));
  if (!folder) throw new Error('Pass the folder with ne_10m_lakes.shp, see the top of this file.');
  const lakes = buildLakes(folder);
  if (args.includes('--list')) {
    for (const { name, areaKm2 } of lakes) console.log(`${Math.round(areaKm2).toString().padStart(7)} km²  ${name}`);
  } else {
    const features = lakes.map(({ name, geometry }) => ({
      type: 'Feature',
      properties: { name },
      geometry: {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map((polygon) =>
          simplifyPolygon(polygon, TOLERANCE_RADIANS).map((ring) => ring.map((point) => point.map(round)))),
      },
    }));
    writeFileSync(new URL('../data/lakes.json', import.meta.url), JSON.stringify({ type: 'FeatureCollection', features }));
  }
  console.error(`${lakes.length} lakes of at least ${MIN_AREA_KM2} km²`);
}
