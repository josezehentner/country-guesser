import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.v1';
const DARK_RED = 'rgb(130, 23, 23)';
const DARK_GREEN = 'rgb(23, 130, 23)';
const entry = (score) => ({ score, seen: 12, correct: 11, lastSeen: '2026-10-29T18:00:00Z' });

async function open(page) {
  await page.goto('/');
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

async function clickCountry(page, code) {
  const { x, y } = await page.evaluate(async (c) => {
    const api = document.querySelector('#map').mapTestApi;
    api.zoomTo(c);
    await new Promise(requestAnimationFrame);
    return api.pointOf(c);
  }, code);
  await page.mouse.click(x, y);
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
  expect(page.url()).toMatch(/\/$/);
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
  expect(await page.evaluate((c) => document.querySelector('#map').mapTestApi.colorOf(c), code)).toBe(`hsl(${(4 / 9) * 120}, 70%, 30%)`);
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
  await seed(page, { DE: entry(10), FR: entry(1), ES: entry(0) }, { continent: 'AF' });
  await expect.poll(() => fill(page, 'DE')).toBe(DARK_GREEN);
  await expect.poll(() => fill(page, 'FR')).toBe(DARK_RED);
  const zero = await fill(page, 'ES');
  const never = await fill(page, 'PT');
  expect(zero).not.toBe(never);
  await expect(page.locator('#stat-mastered')).toHaveText('1');
  await expect(page.locator('#stat-started')).toHaveText('1');
  await expect(page.locator('#stat-never')).toHaveText('247');

  await page.reload();
  await expect.poll(() => targetCode(page)).toBeTruthy();
  await expect.poll(() => fill(page, 'DE')).toBe(DARK_GREEN);
  await expect(page.locator('#continent-filter')).toHaveValue('AF');
});

test('continent filter only asks countries from that continent', async ({ page }) => {
  await open(page);
  await page.selectOption('#continent-filter', 'SA');
  const southAmerica = ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE', 'FK', 'GF'];
  for (let i = 0; i < 15; i++) {
    expect(southAmerica).toContain(await targetCode(page));
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
  expect((await stored(page)).settings.continent).toBe('SA');
});

test('export and import round-trip, invalid files rejected, reset clears', async ({ page }, testInfo) => {
  await open(page);
  await seed(page, { DE: entry(10), FR: entry(3) });
  const before = (await stored(page)).countries;

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  expect(download.suggestedFilename()).toMatch(/^countryquiz-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const exportPath = testInfo.outputPath('export.json');
  await download.saveAs(exportPath);
  expect(JSON.parse(readFileSync(exportPath, 'utf8')).countries).toEqual(before);

  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"countries":{"ZZ":{}}}') });
  await expect(page.locator('#feedback')).toContainText('ungültig');
  expect((await stored(page)).countries).toEqual(before);

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

test('tooltip hides never-asked countries and the current question', async ({ page }) => {
  await open(page);
  await seed(page, { DE: entry(7) }, { continent: 'AF' });
  const tooltip = page.locator('#tooltip');
  await clickCountry(page, 'DE');
  await expect(tooltip).toHaveText('Deutschland: 7/10');
  await clickCountry(page, 'PT');
  await expect(tooltip).toBeHidden();

  await seedAll(page, 5);
  const code = await targetCode(page);
  await clickCountry(page, code);
  await expect(tooltip).toBeHidden();
  await page.click('#dont-know-btn');
  await clickCountry(page, code);
  await expect(tooltip).toContainText(await page.evaluate(async (c) => (await import('/data/countries.js')).COUNTRY_BY_CODE.get(c).name, code));
});

test('small countries are plain shapes and only the asked one gets a ring', async ({ page }) => {
  await open(page);
  const api = (method, ...args) => page.evaluate(([m, a]) => document.querySelector('#map').mapTestApi[m](...a), [method, args]);
  for (const code of ['VA', 'MC', 'MT', 'NR', 'GI', 'TK']) expect(await api('hasShape', code)).toBe(true);

  const oceania = await page.evaluate(async () => (await import('/data/countries.js')).COUNTRIES.filter((c) => c.continent === 'OC').map((c) => c.code));
  await seed(page, Object.fromEntries(oceania.filter((code) => code !== 'NR').map((code) => [code, entry(10)])), { continent: 'OC' });
  for (let i = 0; i < 100 && (await targetCode(page)) !== 'NR'; i++) {
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
  expect(await targetCode(page)).toBe('NR');
  expect(await api('hasTargetRing')).toBe(true);
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
  });
}

test('jumping to a new country zooms in only moderately', async ({ page }) => {
  await open(page);
  await page.selectOption('#continent-filter', 'OC');
  for (let i = 0; i < 10; i++) {
    expect((await view(page)).k).toBeLessThanOrEqual(3);
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
});

test('the globe turns the asked country to the front and center', async ({ page }) => {
  await open(page);
  await page.selectOption('#continent-filter', 'SA');
  for (let i = 0; i < 5; i++) {
    const code = await targetCode(page);
    const { point, facing, middle } = await page.evaluate((c) => {
      const canvas = document.querySelector('#map');
      const rect = canvas.getBoundingClientRect();
      const api = canvas.mapTestApi;
      return { point: api.pointOf(c), facing: api.isFacing(api.view().center), middle: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } };
    }, code);
    expect(facing).toBe(true);
    expect(Math.abs(point.x - middle.x)).toBeLessThan(2);
    expect(Math.abs(point.y - middle.y)).toBeLessThan(2);
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
});

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
  console.log(`globe draw time: median ${sorted[10]} ms, max ${sorted.at(-1)} ms`);
  // Only catches gross slowdowns: CI machines vary a lot.
  expect(sorted[10]).toBeLessThan(50);
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
});
