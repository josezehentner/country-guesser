// Draws the comic-style world map behind the mode menu from the real map data.
// Regenerate with `npm run build:images`.
import { readFileSync, writeFileSync } from 'node:fs';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { simplifyPolygon } from '../src/simplify.js';

const WIDTH = 1600;
const HEIGHT = 900;
const COLORS = {
  water: '#a8dcf2',
  dots: '#8ccbe8',
  waves: '#5fb0d6',
  land: '#b5e48c',
  shadow: '#6fae4f',
  ink: '#1d2b36',
};
const OUTLINE_PX = 5;
const GAP_FILL_PX = 3;
const SHADOW_OFFSET = [7, 8];
// Islands smaller than this are dropped: they would only be blobs of outline.
const MIN_AREA_PX = 40;

const world = JSON.parse(readFileSync(new URL('../data/world.json', import.meta.url)));
const projection = geoNaturalEarth1().fitExtent([[40, 40], [WIDTH - 40, HEIGHT - 40]], { type: 'Sphere' });
const path = geoPath(projection);
const tolerance = 1.5 / projection.scale();

const round = (d) => d.replace(/-?\d+\.\d+/g, (n) => Number(n).toFixed(0));

const polygons = world.features
  .filter((feature) => feature.properties.id !== 'AQ')
  .flatMap((feature) => (feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates))
  .filter((coordinates) => path.area({ type: 'Polygon', coordinates }) >= MIN_AREA_PX)
  .map((polygon) => simplifyPolygon(polygon, tolerance));
const land = round(path({ type: 'MultiPolygon', coordinates: polygons }));

// Hand-placed comic waves: [x, y, width].
const waves = [
  [150, 560, 70], [230, 300, 60], [560, 620, 80], [640, 760, 60], [1450, 640, 70],
  [1250, 760, 80], [900, 820, 60], [380, 140, 60], [1500, 260, 60], [760, 470, 50],
];
const wave = ([x, y, w]) => {
  const s = w / 4;
  return `M${x},${y}q${s / 2},-${s / 1.6} ${s},0t${s},0t${s},0t${s},0`;
};

// Land is drawn three times: the shadow, a thick ink outline, then the fill over it.
// The fill covers the inner half of every outline, so only coasts keep their ink
// and borders between countries disappear. Its thin stroke in the land color closes
// slivers between neighbors that were simplified on their own.
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid slice">`,
  '<defs>',
  `<pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="9" cy="9" r="2.6" fill="${COLORS.dots}"/></pattern>`,
  `<path id="land" d="${land}"/>`,
  '</defs>',
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.water}"/>`,
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)"/>`,
  `<g fill="none" stroke="${COLORS.waves}" stroke-width="5" stroke-linecap="round">${waves.map((w) => `<path d="${wave(w)}"/>`).join('')}</g>`,
  `<use href="#land" transform="translate(${SHADOW_OFFSET.join(' ')})" fill="${COLORS.shadow}" stroke="${COLORS.shadow}" stroke-width="${OUTLINE_PX}" stroke-linejoin="round"/>`,
  `<use href="#land" fill="none" stroke="${COLORS.ink}" stroke-width="${OUTLINE_PX * 2}" stroke-linejoin="round"/>`,
  `<use href="#land" fill="${COLORS.land}" stroke="${COLORS.land}" stroke-width="${GAP_FILL_PX}" stroke-linejoin="round"/>`,
  '</svg>',
  '',
].join('\n');

writeFileSync(new URL('../images/menu-background.svg', import.meta.url), svg);
