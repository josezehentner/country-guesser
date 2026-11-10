import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.v1';
// The color a CSS token draws as on a canvas, e.g. '--score-10'.
function tokenRgb(page, token) {
  return page.evaluate((t) => {
    const context = document.createElement('canvas').getContext('2d');
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(t).trim();
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  }, token);
}
const entry = (score) => ({ score, seen: 12, correct: 11, lastSeen: '2026-10-29T18:00:00Z' });

async function open(page) {
  await page.goto('/name-countries.html');
  await expect.poll(() => targetCode(page)).toBeTruthy();
}

function targetCode(page) {
  return page.evaluate(() => document.querySelector('#map').mapTestApi?.targetCode());
}

async function targetName(page) {
  const code = await targetCode(page);
  return page.evaluate(async (c) => (await import('/data/countries.js')).COUNTRY_BY_CODE.get(c).name, code);
}

function stored(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
}

async function seed(page, countries, settings = {}) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, { version: 1, countries, settings }]);
  await page.reload();
  await expect.poll(() => targetCode(page)).toBeTruthy();
}

async function seedAll(page, score) {
  const codes = await page.evaluate(async () => (await import('/data/countries.js')).COUNTRIES.map((c) => c.code));
  await seed(page, Object.fromEntries(codes.map((code) => [code, entry(score)])));
}

// Reads the color actually drawn in the middle of a country.
function fill(page, code) {
  return page.evaluate(async (c) => {
    const canvas = document.querySelector('#map');
    const api = canvas.mapTestApi;
    api.zoomTo(c);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const { x, y } = api.pointOf(c);
    const rect = canvas.getBoundingClientRect();
    const [r, g, b] = canvas.getContext('2d').getImageData(x - rect.left, y - rect.top, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  }, code);
}

// Reads the color drawn at a point on the globe, e.g. in the open ocean.
function pixelAt(page, location) {
  return page.evaluate(async (l) => {
    const canvas = document.querySelector('#map');
    const api = canvas.mapTestApi;
    api.lookAt(l, 1);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const { x, y } = api.pointAt(l);
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const [r, g, b] = canvas.getContext('2d').getImageData((x - rect.left) * scale, (y - rect.top) * scale, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  }, location);
}

const view = (page) => page.evaluate(() => document.querySelector('#map').mapTestApi.view());

// The progress actions live in the settings dialog.
async function openSettings(page) {
  await page.click('#settings-btn');
  await expect(page.locator('#settings')).toBeVisible();
}

const filter = (page, group, code) => page.locator(`#filters input[name="${group}"][value="${code}"]`);

// Leaves only the given codes of a filter group ticked.
async function keepOnly(page, group, codes) {
  for (const input of await page.locator(`#filters input[name="${group}"]`).all()) {
    if (codes.includes(await input.getAttribute('value'))) await input.check();
    else await input.uncheck();
  }
}

// Turns the country into view, zoomed in, and returns a point inside it.
function pointIn(page, code) {
  return page.evaluate(async (c) => {
    const api = document.querySelector('#map').mapTestApi;
    api.zoomTo(c);
    await new Promise(requestAnimationFrame);
    return api.pointOf(c);
  }, code);
}

test('loads without console errors or external requests', async ({ page, baseURL }) => {
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('request', (request) => {
    if (!/^(data|blob):/.test(request.url()) && !request.url().startsWith(baseURL)) problems.push(request.url());
  });
  await open(page);
  expect(await page.evaluate(() => document.querySelector('#map').mapTestApi.shapeCount())).toBe(258);
  await expect(page.locator('#stat-never')).toHaveText('250');
  expect(problems).toEqual([]);
});

test('playing a round violates no content security policy rule', async ({ page }) => {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push(event.violatedDirective));
  });
  await open(page);
  await page.fill('#answer-input', await targetName(page));
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await page.keyboard.press('Enter');
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  expect(page.url()).toMatch(/\/name-countries\.html$/);
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
});

test('first correct answer starts at 5, saves, colors the country and Enter moves on', async ({ page }) => {
  await open(page);
  const code = await targetCode(page);
  await page.fill('#answer-input', (await targetName(page)).toUpperCase());
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await expect(page.locator('#feedback')).toContainText('5/10');
  expect((await stored(page)).countries[code]).toMatchObject({ score: 5, seen: 1, correct: 1 });
  expect(await page.evaluate((c) => document.querySelector('#map').mapTestApi.colorOf(c), code)).toBe('hsl(50, 90%, 60%)');
  await expect(page.locator('#stat-started')).toHaveText('1');
  await expect(page.locator('#stat-never')).toHaveText('249');

  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveText('');
  await expect(page.locator('#answer-input')).toBeFocused();
  await expect(page.locator('#answer-input')).toHaveValue('');
  expect(await targetCode(page)).not.toBe(code);
});

test('first wrong answer starts at 3, reveals the name, and "Weiß ich nicht" counts as wrong', async ({ page }) => {
  await open(page);
  for (const answer of [() => page.fill('#answer-input', 'Atlantis').then(() => page.keyboard.press('Enter')),
    () => page.click('#dont-know-btn')]) {
    const code = await targetCode(page);
    const name = await targetName(page);
    await answer();
    await expect(page.locator('#feedback')).toHaveClass(/bad/);
    await expect(page.locator('#feedback')).toContainText(name);
    expect((await stored(page)).countries[code]).toMatchObject({ score: 3, seen: 1, correct: 0 });
    await page.keyboard.press('Enter');
  }
});

test('one Enter checks the answer, and the next country follows by itself', async ({ page }) => {
  await open(page);
  const code = await targetCode(page);
  await page.fill('#answer-input', await targetName(page));
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await expect(page.locator('#answer-input')).toBeEditable();
  await expect.poll(() => targetCode(page), { timeout: 5000 }).not.toBe(code);
  await expect(page.locator('#feedback')).toHaveText('');
  await expect(page.locator('#answer-input')).toBeFocused();
});

test('a wrong answer keeps the right name until the player moves on', async ({ page }) => {
  await open(page);
  const code = await targetCode(page);
  const name = await targetName(page);
  await page.click('#dont-know-btn');
  await page.waitForTimeout(1500);
  expect(await targetCode(page)).toBe(code);
  await expect(page.locator('#feedback')).toContainText(name);
  await page.keyboard.press('Enter');
  expect(await targetCode(page)).not.toBe(code);
});

test('Enter or typing during the pause moves on at once', async ({ page }) => {
  await open(page);
  let code = await targetCode(page);
  await page.click('#dont-know-btn');
  await page.keyboard.press('Enter');
  expect(await targetCode(page)).not.toBe(code);

  code = await targetCode(page);
  await page.click('#dont-know-btn');
  await page.keyboard.type('Fr');
  expect(await targetCode(page)).not.toBe(code);
  await expect(page.locator('#answer-input')).toHaveValue('Fr');
  await expect(page.locator('#feedback')).toHaveText('');
});

test('empty input is ignored', async ({ page }) => {
  await open(page);
  await page.fill('#answer-input', '   ');
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveText('');
  expect((await stored(page)).countries).toEqual({});
});

test('score stays within 0 and 10', async ({ page }) => {
  await open(page);
  await seedAll(page, 10);
  let code = await targetCode(page);
  await page.fill('#answer-input', await targetName(page));
  await page.keyboard.press('Enter');
  expect((await stored(page)).countries[code].score).toBe(10);

  await seedAll(page, 0);
  code = await targetCode(page);
  await page.click('#dont-know-btn');
  expect((await stored(page)).countries[code].score).toBe(0);
});

test('colors match the progress table and survive a reload', async ({ page }) => {
  await open(page);
  await seed(page, { DE: entry(10), FR: entry(1), ES: entry(0) }, { regions: ['AF'] });
  await expect.poll(() => fill(page, 'DE')).toBe(await tokenRgb(page, '--score-10'));
  await expect.poll(() => fill(page, 'FR')).toBe(await tokenRgb(page, '--score-1'));
  const zero = await fill(page, 'ES');
  const never = await fill(page, 'PT');
  expect(zero).not.toBe(never);
  await expect(page.locator('#stat-mastered')).toHaveText('1');
  await expect(page.locator('#stat-started')).toHaveText('1');
  await expect(page.locator('#stat-never')).toHaveText('247');

  await page.reload();
  await expect.poll(() => targetCode(page)).toBeTruthy();
  await expect.poll(() => fill(page, 'DE')).toBe(await tokenRgb(page, '--score-10'));
  await expect(filter(page, 'regions', 'AF')).toBeChecked();
  await expect(filter(page, 'regions', 'EU')).not.toBeChecked();
});

test('region filter only asks countries from that region', async ({ page }) => {
  await open(page);
  await keepOnly(page, 'regions', ['SA']);
  const southAmerica = ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE', 'FK', 'GF'];
  for (let i = 0; i < 15; i++) {
    expect(southAmerica).toContain(await targetCode(page));
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
  expect((await stored(page)).settings.regions).toEqual(['SA']);
});

test('the slider beside the legend stops asking countries above a score', async ({ page }) => {
  await open(page);
  // South America: everything well known except Brazil (3) and Peru (never asked)
  const southAmerica = ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE', 'FK', 'GF'];
  const scores = Object.fromEntries(southAmerica.filter((code) => code !== 'PE').map((code) => [code, entry(code === 'BR' ? 3 : 8)]));
  await seed(page, scores, { regions: ['SA'] });
  const slider = page.locator('#score-limit');
  await expect(slider).toHaveValue('10');
  await expect(page.locator('#legend li.excluded')).toHaveCount(0);

  await slider.fill('7');
  await expect(page.locator('#legend li.excluded')).toHaveText(['8', '9', '10']);
  // The slider always takes the color of the highest score still asked.
  // Pixels from a screenshot of the slider at rest, at a value between 0 and 10 along its rail.
  const KNOB_PX = 13;
  const sliderRgbAt = async (value) => {
    const box = await slider.boundingBox();
    const png = (await slider.screenshot()).toString('base64');
    const fromBottom = KNOB_PX / 2 + (box.height - KNOB_PX) * (value / 10);
    return page.evaluate(async ({ png, x, y }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const context = document.createElement('canvas').getContext('2d');
      context.canvas.width = image.width;
      context.canvas.height = image.height;
      context.drawImage(image, 0, 0);
      const [r, g, b] = context.getImageData(x, y, 1, 1).data;
      return `rgb(${r}, ${g}, ${b})`;
    }, { png, x: Math.floor(box.width / 2), y: Math.round(box.height - fromBottom) });
  };
  const color7 = await tokenRgb(page, '--score-7');
  expect(await sliderRgbAt(3)).toBe(color7);
  expect(await sliderRgbAt(7)).toBe(color7);
  expect(await sliderRgbAt(9)).toBe(await tokenRgb(page, '--surface'));
  await expect(page.locator('#filter-summary')).toHaveText('2 Länder werden abgefragt.');
  await expect.poll(async () => (await stored(page)).settings.maxScore).toBe(7);
  for (let i = 0; i < 10; i++) {
    expect(['BR', 'PE']).toContain(await targetCode(page));
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }

  await page.reload();
  await expect.poll(() => targetCode(page)).toBeTruthy();
  await expect(slider).toHaveValue('7');
  expect(['BR', 'PE']).toContain(await targetCode(page));
  await slider.fill('10');
  await expect(page.locator('#filter-summary')).toHaveText('14 Länder werden abgefragt.');
  await expect.poll(async () => (await stored(page)).settings.maxScore).toBeUndefined();
});

test('regions and difficulty combine, and the choice survives a reload', async ({ page }) => {
  await open(page);
  await expect(page.locator('#filters')).toBeVisible();
  await expect(page.locator('#filters input:checked')).toHaveCount(11);
  await expect(page.locator('#filter-summary')).toHaveText('250 Länder werden abgefragt.');
  await expect(page.locator('#filters label', { hasText: 'Naher Osten' })).toContainText('16');

  await keepOnly(page, 'regions', ['SA']);
  await keepOnly(page, 'levels', ['easy']);
  await expect(page.locator('#filter-summary')).toHaveText('6 Länder werden abgefragt.');
  expect((await stored(page)).settings).toMatchObject({ regions: ['SA'], levels: ['easy'] });
  const easySouthAmerica = ['AR', 'BR', 'CL', 'CO', 'PE', 'VE'];
  for (let i = 0; i < 10; i++) {
    expect(easySouthAmerica).toContain(await targetCode(page));
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }

  await page.reload();
  await expect.poll(() => targetCode(page)).toBeTruthy();
  expect(easySouthAmerica).toContain(await targetCode(page));
  await expect(filter(page, 'levels', 'easy')).toBeChecked();
  await expect(filter(page, 'levels', 'hard')).not.toBeChecked();
});

test('a choice without countries says so and keeps the question', async ({ page }) => {
  await open(page);
  await keepOnly(page, 'regions', ['AN']);
  const code = await targetCode(page);
  expect(['AQ', 'BV', 'GS', 'HM', 'TF']).toContain(code);
  await filter(page, 'levels', 'hard').uncheck();
  await expect(page.locator('#filter-summary')).toHaveText(/^Keine Länder für diese Auswahl/);
  expect(await targetCode(page)).toBe(code);
  // Every country comes up until the filters change.
  await page.click('#dont-know-btn');
  await page.keyboard.press('Enter');
  expect(await targetCode(page)).toBeTruthy();
});

test('the filters sit on the left and fold away by the tab at their edge', async ({ page }) => {
  await open(page);
  const toggle = page.locator('#filters-btn');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const panel = await page.locator('#filters').boundingBox();
  const globe = await page.locator('#map').boundingBox();
  expect(panel.x).toBe(0);
  expect(globe.x).toBeGreaterThanOrEqual(panel.x + panel.width);
  // The tab hangs at the middle of the filters' outer edge, then of the screen's.
  const middleOf = (box) => box.y + box.height / 2;
  let tab = await toggle.boundingBox();
  expect(tab.x).toBeCloseTo(panel.x + panel.width, -1);
  expect(Math.abs(middleOf(tab) - middleOf(panel))).toBeLessThan(2);

  const narrow = globe.width;
  await toggle.click();
  await expect(page.locator('#filters')).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  tab = await toggle.boundingBox();
  expect(tab.x).toBe(0);
  await expect.poll(async () => (await page.locator('#map').boundingBox()).width).toBeGreaterThan(narrow + 200);
  await expect.poll(() => page.evaluate(() => document.querySelector('#map').width)).toBeGreaterThan(narrow + 200);

  await page.reload();
  await expect.poll(() => targetCode(page)).toBeTruthy();
  await expect(page.locator('#filters')).toBeHidden();
  await toggle.click();
  await expect(page.locator('#filters')).toBeVisible();
});

test('hovering the tab opens the filters over the globe, leaving closes them, a click keeps them', async ({ page }) => {
  await open(page);
  const toggle = page.locator('#filters-btn');
  const filters = page.locator('#filters');
  await toggle.click();
  await expect(filters).toBeHidden();
  await page.mouse.move(640, 400);
  const globe = await page.locator('#map').boundingBox();

  await toggle.hover();
  await expect(filters).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  // Peeking lies over the globe instead of taking its room.
  expect(await page.locator('#map').boundingBox()).toEqual(globe);
  // The mouse may move from the tab into the filters and use them.
  const box = await filters.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await expect(filters).toBeVisible();
  await page.mouse.move(box.x + box.width + 200, box.y + box.height / 2, { steps: 5 });
  await expect(filters).toBeHidden();
  expect((await stored(page)).settings.filtersOpen).toBe(false);

  await toggle.hover();
  await expect(filters).toBeVisible();
  await toggle.click();
  await page.mouse.move(box.x + box.width + 200, box.y + box.height / 2, { steps: 5 });
  await expect(filters).toBeVisible();
  await expect.poll(async () => (await page.locator('#map').boundingBox()).width).toBeLessThan(globe.width - 200);
  expect((await stored(page)).settings.filtersOpen).toBe(true);
});

test('the mouse at the left edge opens the filters, and running off the window keeps them', async ({ page }) => {
  await open(page);
  const filters = page.locator('#filters');
  await page.locator('#filters-btn').click();
  await page.mouse.move(640, 400);
  await expect(filters).toBeHidden();

  // Far from the tab, right at the edge of the globe's area
  const area = await page.locator('.play-area').boundingBox();
  await page.mouse.move(area.x + 10, area.y + 40, { steps: 5 });
  await expect(filters).toBeVisible();
  await page.mouse.move(0, area.y + 40);
  await page.mouse.move(-20, area.y + 40);
  await page.waitForTimeout(600);
  await expect(filters).toBeVisible();

  // In the top bar the edge does not count.
  await page.mouse.move(640, 400, { steps: 5 });
  await expect(filters).toBeHidden();
  await page.mouse.move(5, 20, { steps: 5 });
  await page.waitForTimeout(300);
  await expect(filters).toBeHidden();
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the filters slide in and out', async ({ page }) => {
    await open(page);
    const filters = page.locator('#filters');
    await page.locator('#filters-btn').click();
    await page.mouse.move(640, 400);
    await expect(filters).toBeHidden();
    await page.mouse.move(5, 400);
    // Halfway in, the filters are still partly off screen.
    await expect.poll(async () => (await filters.boundingBox()).x).toBeLessThan(-10);
    await expect.poll(async () => (await filters.boundingBox()).x).toBe(0);
    await page.mouse.move(640, 400);
    await expect.poll(async () => (await filters.boundingBox())?.x ?? -Infinity).toBeLessThan(-10);
    await expect(filters).toBeHidden();
  });
});

test('the globe does not blink empty when the filters open or close', async ({ page }) => {
  await open(page);
  const alpha = await page.evaluate(async () => {
    const canvas = document.querySelector('#map');
    // Observed after the map's own observer, so this runs right after its resize.
    const resized = new Promise((resolve) => new ResizeObserver((_, observer) => {
      observer.disconnect();
      resolve();
    }).observe(canvas));
    document.querySelector('#filters-btn').click();
    await resized;
    return canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[3];
  });
  expect(alpha).toBe(255);
});

test('export and import round-trip, invalid files rejected, reset clears', async ({ page }, testInfo) => {
  await open(page);
  await seed(page, { DE: entry(10), FR: entry(3) });
  const before = (await stored(page)).countries;

  await openSettings(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  expect(download.suggestedFilename()).toMatch(/^countryquiz-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const exportPath = testInfo.outputPath('export.json');
  await download.saveAs(exportPath);
  expect(JSON.parse(readFileSync(exportPath, 'utf8')).countries).toEqual(before);

  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"countries":{"ZZ":{}}}') });
  await expect(page.locator('#feedback')).toContainText('ungültig');
  expect((await stored(page)).countries).toEqual(before);

  await openSettings(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#reset-btn');
  await expect(page.locator('#stat-never')).toHaveText('250');
  expect((await stored(page)).countries).toEqual({});

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.setInputFiles('#import-file', exportPath);
  await page.waitForTimeout(200);
  expect((await stored(page)).countries).toEqual({});

  page.once('dialog', (dialog) => dialog.accept());
  await page.setInputFiles('#import-file', exportPath);
  await expect(page.locator('#stat-mastered')).toHaveText('1');
  expect((await stored(page)).countries).toEqual(before);
});

test('hovering or clicking an asked country never shows its name', async ({ page }) => {
  await open(page);
  await seed(page, { DE: entry(7) }, { regions: ['AF'] });
  const { x, y } = await pointIn(page, 'DE');
  await page.mouse.move(x, y);
  await page.mouse.move(x + 1, y);
  await page.mouse.click(x, y);
  await page.waitForTimeout(200);
  await expect(page.locator('#map-wrap')).not.toContainText('Deutschland');
  await expect(page.getByText(/7\/10/)).toHaveCount(0);
});

// Their centroids lie outside their own shapes.
test('countries with a curved shape are found where they are drawn', async ({ page }) => {
  const codes = ['IL', 'SO', 'VN', 'BM', 'CC', 'IO'];
  await open(page);
  for (const code of codes) {
    const { x, y } = await pointIn(page, code);
    expect(await page.evaluate(([px, py]) => document.querySelector('#map').mapTestApi.codeAt(px, py), [x, y])).toBe(code);
  }
});

test('small countries are plain shapes and, when asked, only get the outline, no ring', async ({ page }) => {
  await open(page);
  const api = (method, ...args) => page.evaluate(([m, a]) => document.querySelector('#map').mapTestApi[m](...a), [method, args]);
  for (const code of ['VA', 'MC', 'MT', 'NR', 'GI', 'TK']) expect(await api('hasShape', code)).toBe(true);

  const oceania = await page.evaluate(async () => (await import('/data/countries.js')).COUNTRIES.filter((c) => c.continent === 'OC').map((c) => c.code));
  await seed(page, Object.fromEntries(oceania.filter((code) => code !== 'NR').map((code) => [code, entry(10)])), { regions: ['OC'] });
  for (let i = 0; i < 100 && (await targetCode(page)) !== 'NR'; i++) {
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
  expect(await targetCode(page)).toBe('NR');
  // Where the ring used to be, 11 pixels around Nauru, the highlight layer is empty,
  // while the outline right at the island is drawn.
  const drawn = await page.evaluate(async () => {
    const canvas = document.querySelector('#map');
    const target = document.querySelector('#map-target');
    canvas.mapTestApi.lookAt([166.93, -0.53], 1);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const { x, y } = canvas.mapTestApi.pointAt([166.93, -0.53]);
    const rect = canvas.getBoundingClientRect();
    const scale = target.width / rect.width;
    const alpha = (dx, dy) => target.getContext('2d').getImageData((x - rect.left + dx) * scale, (y - rect.top + dy) * scale, 1, 1).data[3];
    return { center: alpha(0, 0), ring: [alpha(11, 0), alpha(-11, 0), alpha(0, 11), alpha(0, -11)] };
  });
  expect(drawn.center).toBeGreaterThan(0);
  expect(drawn.ring).toEqual([0, 0, 0, 0]);

  // Without the ring, the flash after an answer outlines a small country thickly,
  // so it shows as more than a dot.
  const flashed = await page.evaluate(async () => {
    const canvas = document.querySelector('#map');
    document.querySelector('#dont-know-btn').click();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const layer = document.querySelector('.map-flash');
    const { x, y } = canvas.mapTestApi.pointAt([166.93, -0.53]);
    const rect = canvas.getBoundingClientRect();
    const scale = layer.width / rect.width;
    return layer.getContext('2d').getImageData((x - rect.left + 3) * scale, (y - rect.top) * scale, 1, 1).data[3];
  });
  expect(flashed).toBeGreaterThan(0);
});

for (const colorScheme of ['light', 'dark']) {
  test.describe(`in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('land is beige, water light blue and borders black', async ({ page }) => {
      await open(page);
      await expect.poll(() => fill(page, 'PT')).toBe('rgb(245, 230, 200)');
      await expect.poll(() => pixelAt(page, [-30, 0])).toBe('rgb(173, 216, 230)');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--country-stroke').trim())).toBe('#000000');
    });

    test('large lakes are water on the globe', async ({ page }) => {
      await open(page);
      // Lake Victoria, Lake Michigan and Lake Superior, then land next to them. Lake
      // Nicaragua is only a few pixels wide at this zoom.
      for (const lake of [[33, -1], [-87, 43.5], [-87.5, 47.7]]) {
        await expect.poll(() => pixelAt(page, lake), { message: String(lake) }).toBe('rgb(173, 216, 230)');
      }
      for (const land of [[32.6, 0.6], [-88.5, 42.5]]) {
        await expect.poll(() => pixelAt(page, land), { message: String(land) }).not.toBe('rgb(173, 216, 230)');
      }
    });

    test('the globe sits on the comic sunburst', async ({ page }) => {
      const file = colorScheme === 'dark' ? 'globe-background-dark.svg' : 'globe-background.svg';
      const loaded = page.waitForResponse((response) => response.url().endsWith(`/images/${file}`) && response.ok());
      await open(page);
      await loaded;
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('#map-wrap')).backgroundImage)).toContain(`images/${file}`);
    });
  });
}

test('jumping to a new country zooms in only moderately', async ({ page }) => {
  await open(page);
  await keepOnly(page, 'regions', ['OC']);
  for (let i = 0; i < 10; i++) {
    expect((await view(page)).k).toBeLessThanOrEqual(3);
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
});

test('the globe turns the asked country to the front and center', async ({ page }) => {
  await open(page);
  await keepOnly(page, 'regions', ['SA']);
  for (let i = 0; i < 5; i++) {
    const code = await targetCode(page);
    const { point, facing, middle } = await page.evaluate((c) => {
      const canvas = document.querySelector('#map');
      const rect = canvas.getBoundingClientRect();
      const api = canvas.mapTestApi;
      return { point: api.pointOf(c), facing: api.isFacing(api.view().center), middle: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } };
    }, code);
    expect(facing).toBe(true);
    // pointOf may move off the centroid by a few pixels to land safely inside.
    expect(Math.abs(point.x - middle.x)).toBeLessThan(10);
    expect(Math.abs(point.y - middle.y)).toBeLessThan(10);
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
});

test('"Zum Land" turns the globe back to the marked country and keeps the focus in the field', async ({ page }) => {
  await open(page);
  const code = await targetCode(page);
  const asked = await view(page);
  const button = page.locator('#recenter-btn');
  await expect(button).toBeVisible();
  await expect(button).toHaveAccessibleName('Zum markierten Land');
  await page.evaluate(() => document.querySelector('#map').mapTestApi.lookAt([-150, -60], 7));
  await page.click('#answer-input');
  await page.keyboard.type('ab');
  await button.click();
  const back = await view(page);
  const center = await page.evaluate((c) => document.querySelector('#map').mapTestApi.centerOf(c), code);
  expect(back.k).toBeCloseTo(asked.k, 5);
  expect(back.center[0]).toBeCloseTo(center[0], 5);
  expect(back.center[1]).toBeCloseTo(center[1], 5);
  await expect(page.locator('#answer-input')).toBeFocused();
  await expect(page.locator('#answer-input')).toHaveValue('ab');
});

for (const width of [800, 1280]) {
  test(`"Zum Land" and the caption stay apart beside pinned filters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    await expect(page.locator('#filters')).toHaveClass(/pinned/);
    const button = await page.locator('#recenter-btn').boundingBox();
    const caption = await page.locator('#prompt').boundingBox();
    expect(caption.x + caption.width).toBeLessThanOrEqual(button.x);
    // Room for the full label only on a wide window.
    await expect(page.locator('.recenter-label')).toBeVisible({ visible: width > 1100 });
  });
}

test('the globe zooms and rotates', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.querySelector('#map').mapTestApi.lookAt([0, 0], 1));
  await page.mouse.move(600, 300);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await view(page)).k).toBeGreaterThan(1);
  await page.waitForTimeout(200);
  const before = await view(page);
  await page.mouse.down();
  await page.mouse.move(500, 250, { steps: 5 });
  await page.mouse.up();
  const after = await view(page);
  expect(after.k).toBe(before.k);
  expect(after.center[0]).toBeGreaterThan(before.center[0]);
  expect(after.center[1]).toBeLessThan(before.center[1]);
});

test('the cursor is a hand only while the globe is dragged', async ({ page }) => {
  await open(page);
  const cursor = () => page.evaluate(() => getComputedStyle(document.querySelector('#map')).cursor);
  await page.mouse.move(600, 300);
  expect(await cursor()).toBe('auto');
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(100);
  expect(await cursor()).toBe('auto');
  await page.mouse.down();
  expect(await cursor()).toBe('auto');
  await page.mouse.move(500, 250, { steps: 5 });
  expect(await cursor()).toBe('grabbing');
  await page.mouse.up();
  expect(await cursor()).toBe('auto');
});

test('dragging past a pole stops at the pole', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.querySelector('#map').mapTestApi.lookAt([0, 60], 1));
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(600, 150);
    await page.mouse.down();
    await page.mouse.move(600, 650, { steps: 10 });
    await page.mouse.up();
  }
  expect((await view(page)).center[1]).toBe(90);
});

// The other tests run with reduced motion, which turns momentum off.
test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  // Fires the drag inside the page in one go: mouse steps sent one by one from the
  // test arrive late on a busy machine, which then reads as a drag that stopped.
  function drag(page, { release }) {
    return page.evaluate((letGo) => {
      const canvas = document.querySelector('#map');
      const rect = canvas.getBoundingClientRect();
      const fire = (target, type, x) => target.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window, clientX: rect.left + x, clientY: rect.top + 250, buttons: type === 'mouseup' ? 0 : 1,
      }));
      if (letGo === 'only') return fire(window, 'mouseup', 540);
      fire(canvas, 'mousedown', 400);
      for (let x = 420; x <= 540; x += 20) fire(window, 'mousemove', x);
      if (letGo) fire(window, 'mouseup', 540);
    }, release);
  }

  async function flick(page, { pauseBeforeRelease = 0 } = {}) {
    await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelector('#map').mapTestApi.lookAt([0, 0], 1));
    if (pauseBeforeRelease) {
      await drag(page, { release: false });
      await page.waitForTimeout(pauseBeforeRelease);
      await drag(page, { release: 'only' });
    } else {
      await drag(page, { release: true });
    }
    return (await view(page)).center[0];
  }

  // True once the globe stopped turning for a moment.
  async function settled(page) {
    const before = (await view(page)).center[0];
    await page.waitForTimeout(300);
    return (await view(page)).center[0] === before;
  }

  test('a quick drag gives the globe momentum that dies down', async ({ page }) => {
    await open(page);
    const released = await flick(page);
    // Dragging to the right turns the globe westward and keeps doing so.
    await expect.poll(async () => (await view(page)).center[0]).toBeLessThan(released - 1);
    await expect.poll(() => settled(page), { timeout: 5000 }).toBe(true);
  });

  test('a drag that stops before letting go has no momentum', async ({ page }) => {
    await open(page);
    const released = await flick(page, { pauseBeforeRelease: 300 });
    await page.waitForTimeout(200);
    expect((await view(page)).center[0]).toBe(released);
  });

  test('touching the globe again stops the momentum', async ({ page }) => {
    await open(page);
    await flick(page);
    await page.mouse.move(600, 300);
    await page.mouse.down();
    const held = (await view(page)).center[0];
    await page.waitForTimeout(200);
    expect((await view(page)).center[0]).toBe(held);
    await page.mouse.up();
  });
});

test('with reduced motion the globe stops when let go', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.querySelector('#map').mapTestApi.lookAt([0, 0], 1));
  await page.mouse.move(500, 300);
  await page.mouse.down();
  await page.mouse.move(640, 300, { steps: 7 });
  await page.mouse.up();
  const released = (await view(page)).center[0];
  await page.waitForTimeout(200);
  expect((await view(page)).center[0]).toBe(released);
});

test('the back of the globe is not drawn and drawing stays fast', async ({ page }) => {
  await open(page);
  const times = await page.evaluate(async () => {
    const api = document.querySelector('#map').mapTestApi;
    const result = [];
    for (let i = 0; i < 20; i++) {
      api.lookAt([i * 18, 20], 1);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      result.push({ ms: api.lastDrawMs(), drawn: api.drawnShapes(), total: api.shapeCount() });
    }
    return result;
  });
  for (const { drawn, total } of times) expect(drawn).toBeLessThan(total);
  const sorted = times.map((t) => t.ms).sort((a, b) => a - b);
  console.log(`globe draw time: fastest quarter ${sorted[5]} ms, median ${sorted[10]} ms, max ${sorted.at(-1)} ms`);
  // Only catches gross slowdowns, which make every frame slower. A busy machine,
  // e.g. other test runs in parallel, slows only some frames, so the faster ones count.
  expect(sorted[5]).toBeLessThan(50);
});

test('the highlight is on its own layer and the map keeps drawing while zooming', async ({ page }) => {
  await open(page);
  await expect(page.locator('#map-target')).toHaveCSS('pointer-events', 'none');
  const draws = () => page.evaluate(() => document.querySelector('#map').mapTestApi.drawCount());
  await page.waitForTimeout(300);
  const idle = await draws();
  await page.waitForTimeout(500);
  expect(await draws()).toBe(idle);
  await page.mouse.move(600, 300);
  await page.mouse.wheel(0, -100);
  await expect.poll(draws).toBeGreaterThan(idle);
});

test('game works with a notice when localStorage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  await open(page);
  await expect(page.locator('#storage-notice')).toBeVisible();
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  await expect(page.locator('#stat-never')).toHaveText('249');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test('has no horizontal scrollbar and can answer', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.tap('#dont-know-btn');
    await expect(page.locator('#feedback')).toHaveClass(/bad/);
  });

  test('"Zum Land" is an icon at the right edge that covers neither caption nor legend', async ({ page }) => {
    await open(page);
    const box = await page.locator('#recenter-btn').boundingBox();
    const viewport = page.viewportSize();
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.recenter-label')).toBeHidden();
    for (const selector of ['#prompt', '#legend', '.panel']) {
      const other = await page.locator(selector).boundingBox();
      const apart = box.x + box.width <= other.x || other.x + other.width <= box.x
        || box.y + box.height <= other.y || other.y + other.height <= box.y;
      expect(apart, selector).toBe(true);
    }
    const asked = await view(page);
    await page.evaluate(() => document.querySelector('#map').mapTestApi.lookAt([-150, -60], 7));
    await page.tap('#recenter-btn');
    expect((await view(page)).k).toBeCloseTo(asked.k, 5);
  });

  test('the filters start closed and slide over the globe', async ({ page }) => {
    await open(page);
    await expect(page.locator('#filters')).toBeHidden();
    const globe = await page.locator('#map').boundingBox();
    await page.tap('#filters-btn');
    await expect(page.locator('#filters')).toBeVisible();
    expect(await page.locator('#map').boundingBox()).toEqual(globe);
    const panel = await page.locator('#filters').boundingBox();
    expect(panel.x + panel.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.locator('#filters input[value="EU"]').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#filters')).toBeHidden();
    await expect(page.locator('#filters-btn')).toBeFocused();
  });

  test('one tap on Prüfen moves on after a right answer, Weiter after a wrong one', async ({ page }) => {
    await open(page);
    const code = await targetCode(page);
    await page.fill('#answer-input', await targetName(page));
    await page.tap('#submit-btn');
    await expect(page.locator('#feedback')).toHaveClass(/good/);
    await expect.poll(() => targetCode(page), { timeout: 5000 }).not.toBe(code);
    await expect(page.locator('#answer-input')).toBeFocused();

    const next = await targetCode(page);
    await page.tap('#dont-know-btn');
    await expect(page.locator('#submit-btn')).toHaveText('Weiter');
    await page.tap('#submit-btn');
    expect(await targetCode(page)).not.toBe(next);
  });

  test('keeps everything but the globe to one row above and one below', async ({ page }) => {
    await open(page);
    const box = (selector) => page.locator(selector).boundingBox();
    expect((await box('.topbar')).height).toBeLessThan(50);
    expect((await box('.panel')).height).toBeLessThan(65);
    const [input, submit, dontKnow] = await Promise.all(['#answer-input', '#submit-btn', '#dont-know-btn'].map(box));
    expect(Math.abs(submit.y - input.y)).toBeLessThan(5);
    expect(Math.abs(dontKnow.y - input.y)).toBeLessThan(5);
    expect(dontKnow.width).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#dont-know-btn')).toHaveAccessibleName('Weiß ich nicht');
    await expect(page.locator('.stats')).toContainText('Gemeistert');
    expect((await box('#map-wrap')).height).toBeGreaterThan(500);
  });

  test('shows the result over the globe instead of in its own row', async ({ page }) => {
    await open(page);
    const panelHeight = (await page.locator('.panel').boundingBox()).height;
    await page.tap('#dont-know-btn');
    const [feedback, map] = await Promise.all(['#feedback', '#map-wrap'].map((s) => page.locator(s).boundingBox()));
    expect(feedback.y + feedback.height).toBeLessThanOrEqual(map.y + map.height);
    expect((await page.locator('.panel').boundingBox()).height).toBe(panelHeight);
  });

  // An open on-screen keyboard leaves less room: the page fits the visible area,
  // which the test simulates by shrinking the viewport.
  test('keeps the answer row and a large globe above the keyboard', async ({ page }) => {
    await open(page);
    await page.setViewportSize({ width: 375, height: 400 });
    await expect.poll(() => page.evaluate(() => document.body.getBoundingClientRect().height)).toBe(400);
    const panel = await page.locator('.panel').boundingBox();
    expect(panel.y + panel.height).toBeLessThanOrEqual(400);
    expect((await page.locator('#map-wrap').boundingBox()).height).toBeGreaterThan(250);
  });
});

test('settings hold the progress actions', async ({ page }) => {
  await open(page);
  await expect(page.locator('#export-btn')).toBeHidden();
  await openSettings(page);
  await expect(page.locator('#export-btn')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
  await expect(page.locator('#answer-input')).toBeFocused();

  await openSettings(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.click('#reset-btn');
  // Closed first, so the confirmation and messages are not hidden behind it.
  await expect(page.locator('#settings')).toBeHidden();
});

test('the controls float in a dock over the globe, which reaches the bottom', async ({ page }) => {
  await open(page);
  const [panel, map] = await Promise.all(['.panel', '#map-wrap'].map((s) => page.locator(s).boundingBox()));
  const viewport = page.viewportSize();
  expect(map.y + map.height).toBe(viewport.height);
  expect(panel.y).toBeGreaterThan(map.y);
  expect(panel.y + panel.height).toBeLessThan(viewport.height);
  expect(panel.width).toBeLessThan(viewport.width / 2);
  await expect(page.locator('#prompt')).toHaveText('Welches Land ist markiert?');
});

test('the legend shows the scores 0 to 10 and nothing for never-asked countries', async ({ page }) => {
  await open(page);
  await expect(page.locator('#legend li')).toHaveText(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  await expect(page.locator('#legend')).not.toContainText('nie gefragt');
});

test('on a wide screen the buttons keep their full labels', async ({ page }) => {
  await open(page);
  expect(await page.locator('#dont-know-btn').innerText()).toBe('Weiß ich nicht');
  await expect(page.locator('.stats')).toContainText('Gemeistert');
  await expect(page.locator('h1')).toBeVisible();
});

// How often the country lights up during the flash layer's animation.
function flashPulses(page) {
  return page.evaluate(() => {
    const [animation] = document.querySelector('.map-flash').getAnimations();
    const frames = animation?.effect.getKeyframes() ?? [];
    return frames.filter((frame, i) => Number(frame.opacity) > 0 && Number(frames[i - 1]?.opacity ?? 0) === 0).length;
  });
}

const flashing = (page) => page.evaluate(() => document.querySelector('#map').mapTestApi.flashing());

test.describe('answer flash', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a right answer lights the country up once in green', async ({ page }) => {
    await open(page);
    const code = await targetCode(page);
    await page.fill('#answer-input', await targetName(page));
    await page.keyboard.press('Enter');
    expect(await flashing(page)).toEqual({ code, kind: 'good' });
    expect(await flashPulses(page)).toBe(1);
    await expect.poll(() => flashing(page), { timeout: 3000 }).toBeNull();
  });

  test('a wrong answer pulses the country twice in red', async ({ page }) => {
    await open(page);
    const code = await targetCode(page);
    // Let the globe settle on the country before reading pixels.
    await page.waitForTimeout(900);
    await page.click('#dont-know-btn');
    expect(await flashing(page)).toEqual({ code, kind: 'bad' });
    expect(await flashPulses(page)).toBe(2);
    const color = await page.evaluate(async (c) => {
      const layer = document.querySelector('.map-flash');
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const { x, y } = document.querySelector('#map').mapTestApi.pointOf(c);
      const rect = layer.getBoundingClientRect();
      const scale = layer.width / rect.width;
      const [r, g, b] = layer.getContext('2d').getImageData((x - rect.left) * scale, (y - rect.top) * scale, 1, 1).data;
      return `rgb(${r}, ${g}, ${b})`;
    }, code);
    expect(color).toBe('rgb(239, 68, 68)');
    await expect.poll(() => flashing(page), { timeout: 3000 }).toBeNull();
    // A wrong answer still waits for the player.
    expect(await targetCode(page)).toBe(code);
  });
});

test('with reduced motion the flash shows its color without pulsing', async ({ page }) => {
  await open(page);
  await page.click('#dont-know-btn');
  expect((await flashing(page)).kind).toBe('bad');
  const opacities = await page.evaluate(() =>
    document.querySelector('.map-flash').getAnimations()[0].effect.getKeyframes().map((frame) => Number(frame.opacity)));
  expect(new Set(opacities).size).toBe(1);
  await expect.poll(() => flashing(page), { timeout: 3000 }).toBeNull();
});
