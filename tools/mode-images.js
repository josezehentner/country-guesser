// Draws the pictures on the mode cards from the real map data.
// Regenerate with `npm run build:images`.
import { readFileSync, writeFileSync } from 'node:fs';
import { geoOrthographic, geoPath } from 'd3-geo';
import { simplifyPolygon } from '../src/simplify.js';

const WIDTH = 320;
const HEIGHT = 200;
const RADIUS = 150;
const MIN_AREA_PX = 4;
const COLORS = { space: '#e3e8ee', ocean: '#add8e6', land: '#f5e6c8', border: '#000000', target: '#e6007e' };

const world = JSON.parse(readFileSync(new URL('../data/world.json', import.meta.url)));

function round(path) {
  return path.replace(/\d+\.\d+/g, (n) => Number(n).toFixed(1));
}

function globe({ center, highlight }) {
  const projection = geoOrthographic()
    .clipAngle(90)
    .precision(0)
    .scale(RADIUS)
    .translate([WIDTH / 2, HEIGHT * 0.62])
    .rotate([-center[0], -center[1]])
    .clipExtent([[-1, -1], [WIDTH + 1, HEIGHT + 1]]);
  const path = geoPath(projection);
  // About a pixel at the size the cards show the picture. Islands smaller than a
  // few pixels are left out: at this size they only add to the file.
  const tolerance = 1 / RADIUS;
  const simplified = (feature) => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const visible = polygons.filter((coordinates) => path.area({ type: 'Polygon', coordinates }) >= MIN_AREA_PX);
    return { type: 'MultiPolygon', coordinates: visible.map((polygon) => simplifyPolygon(polygon, tolerance)) };
  };
  const countries = world.features.map((feature) => path(simplified(feature))).filter(Boolean).map(round);
  const target = round(path(simplified(world.features.find((feature) => feature.properties.id === highlight))));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.space}"/>`,
    `<path d="${round(path({ type: 'Sphere' }))}" fill="${COLORS.ocean}" stroke="${COLORS.border}" stroke-width="0.6"/>`,
    `<path d="${countries.join('')}" fill="${COLORS.land}" stroke="${COLORS.border}" stroke-width="0.4" stroke-linejoin="round"/>`,
    `<path d="${target}" fill="none" stroke="${COLORS.target}" stroke-width="2.5" stroke-linejoin="round"/>`,
    '</svg>',
    '',
  ].join('\n');
}

writeFileSync(new URL('../images/modes/name-countries.svg', import.meta.url), globe({ center: [15, 42], highlight: 'DE' }));
