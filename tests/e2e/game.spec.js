import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.v1';
const DARK_RED = 'rgb(130, 23, 23)';
const DARK_GREEN = 'rgb(23, 130, 23)';
const entry = (score) => ({ score, seen: 12, correct: 11, lastSeen: '2026-10-29T18:00:00Z' });

async function open(page) {
  await page.goto('/');
  await expect(page.locator('.target-outline')).toBeAttached();
}

function targetCode(page) {
  return page.evaluate(() => {
    const d = document.querySelector('.target-outline').getAttribute('d');
    return document.querySelector(`path.country[d="${d}"]`).dataset.code;
  });
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
  await expect(page.locator('.target-outline')).toBeAttached();
}

async function seedAll(page, score) {
  const codes = await page.evaluate(async () => (await import('/data/countries.js')).COUNTRIES.map((c) => c.code));
  await seed(page, Object.fromEntries(codes.map((code) => [code, entry(score)])));
}

function fill(page, code) {
  return page.locator(`path[data-code="${code}"]`).evaluate((element) => getComputedStyle(element).fill);
}

test('loads without console errors or external requests', async ({ page, baseURL }) => {
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('request', (request) => {
    if (!/^(data|blob):/.test(request.url()) && !request.url().startsWith(baseURL)) problems.push(request.url());
  });
  await open(page);
  await expect(page.locator('path.country')).toHaveCount(252);
  await expect(page.locator('#stat-never')).toHaveText('250');
  expect(problems).toEqual([]);
});

test('correct answer scores +1, saves, colors the country and Enter moves on', async ({ page }) => {
  await open(page);
  const code = await targetCode(page);
  await page.fill('#answer-input', (await targetName(page)).toUpperCase());
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await expect(page.locator('#feedback')).toContainText('1/10');
  expect((await stored(page)).countries[code]).toMatchObject({ score: 1, seen: 1, correct: 1 });
  await expect.poll(() => fill(page, code)).toBe(DARK_RED);
  await expect(page.locator('#stat-started')).toHaveText('1');
  await expect(page.locator('#stat-never')).toHaveText('249');

  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveText('');
  await expect(page.locator('#answer-input')).toBeFocused();
  await expect(page.locator('#answer-input')).toHaveValue('');
  expect(await targetCode(page)).not.toBe(code);
});

test('wrong answer reveals the name and "Weiß ich nicht" counts as wrong', async ({ page }) => {
  await open(page);
  for (const answer of [() => page.fill('#answer-input', 'Atlantis').then(() => page.keyboard.press('Enter')),
    () => page.click('#dont-know-btn')]) {
    const code = await targetCode(page);
    const name = await targetName(page);
    await answer();
    await expect(page.locator('#feedback')).toHaveClass(/bad/);
    await expect(page.locator('#feedback')).toContainText(name);
    expect((await stored(page)).countries[code]).toMatchObject({ score: 0, seen: 1, correct: 0 });
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
  await page.locator('path[data-code="DE"]').dispatchEvent('click');
  await expect(tooltip).toHaveText('Deutschland: 7/10');
  await page.locator('path[data-code="PT"]').dispatchEvent('click');
  await expect(tooltip).toBeHidden();

  await seedAll(page, 5);
  const code = await targetCode(page);
  await page.locator(`path[data-code="${code}"]`).dispatchEvent('click');
  await expect(tooltip).toBeHidden();
  await page.click('#dont-know-btn');
  await page.locator(`path[data-code="${code}"]`).dispatchEvent('click');
  await expect(tooltip).toContainText(await page.evaluate(async (c) => (await import('/data/countries.js')).COUNTRY_BY_CODE.get(c).name, code));
});

test('small countries have markers, and the map zooms and pans', async ({ page }) => {
  await open(page);
  for (const code of ['VA', 'MC', 'MT', 'NR', 'GI', 'TK']) await expect(page.locator(`circle.marker[data-code="${code}"]`)).toBeAttached();
  await expect(page.locator('circle.marker[data-code="DE"]')).toHaveCount(0);

  const transform = () => page.locator('#map > g').getAttribute('transform');
  await expect.poll(transform).toMatch(/scale/);
  await page.waitForTimeout(900);
  const initial = await transform();
  await page.mouse.move(600, 300);
  await page.mouse.wheel(0, -300);
  await expect.poll(transform).not.toBe(initial);
  await page.waitForTimeout(200);
  const zoomed = await transform();
  await page.mouse.down();
  await page.mouse.move(500, 250, { steps: 5 });
  await page.mouse.up();
  await expect.poll(transform).not.toBe(zoomed);
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
