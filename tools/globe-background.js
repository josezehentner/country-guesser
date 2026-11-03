// Draws the comic sunburst behind the globe: rays from the center, where the globe
// sits, halftone dots that grow towards the edges, and a few comic stars.
// Regenerate with `npm run build:images`.
import { writeFileSync } from 'node:fs';

const WIDTH = 1600;
const HEIGHT = 1000;
const [CX, CY] = [WIDTH / 2, HEIGHT / 2];
const RAYS = 24;
const RAY_LENGTH = 1300;
const DOT_SPACING = 22;
// Dots start outside the globe and reach their full size at the edges.
const DOT_START = 420;
const DOT_FULL = 950;
const DOT_MAX_RADIUS = 7;
const OUTLINE_PX = 4;

const THEMES = {
  light: { base: '#fff4cf', ray: '#ffe8a8', dots: '#ffd36e', star: '#ffffff', ink: '#1d2b36' },
  dark: { base: '#13263a', ray: '#18304a', dots: '#21405f', star: '#ffe8a8', ink: '#000000' },
};

// Comic stars: [x, y, size]. Kept to the sides, away from the globe.
const STARS = [
  [150, 150, 34], [1460, 190, 28], [1390, 840, 38], [230, 820, 26],
  [90, 520, 18], [1530, 560, 20], [520, 70, 16], [1110, 940, 18],
];

const f = (n) => Number(n.toFixed(1));

function rays() {
  const step = (2 * Math.PI) / RAYS;
  const parts = [];
  for (let i = 0; i < RAYS; i++) {
    const a = i * step;
    const b = a + step / 2;
    parts.push(`M${CX},${CY}L${f(CX + RAY_LENGTH * Math.cos(a))},${f(CY + RAY_LENGTH * Math.sin(a))}L${f(CX + RAY_LENGTH * Math.cos(b))},${f(CY + RAY_LENGTH * Math.sin(b))}Z`);
  }
  return parts.join('');
}

// Every second row is shifted by half a step, like printed halftone.
function dots() {
  const parts = [];
  for (let row = 0, y = 0; y <= HEIGHT + DOT_SPACING; row++, y += DOT_SPACING * 0.87) {
    for (let x = (row % 2) * (DOT_SPACING / 2); x <= WIDTH + DOT_SPACING; x += DOT_SPACING) {
      const distance = Math.hypot((x - CX) * 0.8, y - CY);
      const share = Math.min(1, (distance - DOT_START) / (DOT_FULL - DOT_START));
      const r = share * DOT_MAX_RADIUS;
      if (r < 0.8) continue;
      // A circle as two arcs: much shorter than a <circle> element per dot.
      parts.push(`M${f(x - r)},${f(y)}a${f(r)},${f(r)} 0 1 0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1 0 ${f(-2 * r)},0`);
    }
  }
  return parts.join('');
}

// Four-pointed sparkle with curved sides.
function star([x, y, size]) {
  const s = size;
  const k = size * 0.22;
  return `M${x},${y - s}Q${x + k},${y - k} ${x + s},${y}Q${x + k},${y + k} ${x},${y + s}Q${x - k},${y + k} ${x - s},${y}Q${x - k},${y - k} ${x},${y - s}Z`;
}

function background(theme) {
  const c = THEMES[theme];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid slice">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${c.base}"/>`,
    `<path d="${rays()}" fill="${c.ray}"/>`,
    `<path d="${dots()}" fill="${c.dots}"/>`,
    `<path d="${STARS.map(star).join('')}" fill="${c.star}" stroke="${c.ink}" stroke-width="${OUTLINE_PX}" stroke-linejoin="round"/>`,
    '</svg>',
    '',
  ].join('\n');
}

for (const [theme, file] of [['light', 'globe-background.svg'], ['dark', 'globe-background-dark.svg']]) {
  writeFileSync(new URL(`../images/${file}`, import.meta.url), background(theme));
}
