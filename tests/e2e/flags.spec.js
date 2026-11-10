import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.flags.v1';
const NAME_MODE_KEY = 'countryquiz.v1';
const entry = (score) => ({ score, seen: 12, correct: 11, lastSeen: '2026-10-29T18:00:00Z' });

function targetCode(page) {
  return page.evaluate(() => document.querySelector('#map').mapTestApi?.targetCode());
}

// The country whose flag is shown, read from the picture's file name.
function flagCode(page) {
  return page.evaluate(() => {
    const flag = document.querySelector('#flag');
    return flag.hidden ? null : flag.getAttribute('src')?.match(/([a-z]{2})\.svg$/)?.[1].toUpperCase();
  });
}

async function country(page) {
  const code = await flagCode(page);
  return page.evaluate(async (c) => {
    const { COUNTRY_BY_CODE } = await import('/data/countries.js');
    return { code: c, name: COUNTRY_BY_CODE.get(c).name };
  }, code);
}

async function open(page) {
  await page.goto('/flags.html');
  await expect.poll(() => flagCode(page)).toBeTruthy();
}

function stored(page, key = KEY) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
}

async function seed(page, countries, settings = {}) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, { version: 1, countries, settings }]);
  await page.reload();
  await expect.poll(() => flagCode(page)).toBeTruthy();
}

async function keepOnly(page, group, codes) {
  for (const input of await page.locator(`#filters input[name="${group}"]`).all()) {
    if (codes.includes(await input.getAttribute('value'))) await input.check();
    else await input.uncheck();
  }
}

async function skipUntil(page, code) {
  for (let i = 0; i < 60 && (await flagCode(page)) !== code; i++) {
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
  expect(await flagCode(page)).toBe(code);
}

test('loads without console errors, external requests or policy violations', async ({ page, baseURL }) => {
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('request', (request) => {
    if (!/^(data|blob):/.test(request.url()) && !request.url().startsWith(baseURL)) problems.push(request.url());
  });
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push(event.violatedDirective));
  });
  await open(page);
  await expect(page.locator('h1')).toHaveText('Flaggen erkennen');
  await expect(page.locator('#prompt')).toHaveText('Welches Land hat diese Flagge?');
  await expect(page.locator('#flag')).toHaveAttribute('alt', 'Gesuchte Flagge');
  await page.fill('#answer-input', (await country(page)).name);
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await page.keyboard.press('Enter');
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  expect(problems).toEqual([]);
});

test('the flag is a loaded picture above the globe, and the globe marks nothing before the answer', async ({ page }) => {
  await open(page);
  const flag = page.locator('#flag');
  await expect.poll(() => flag.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  const box = await flag.boundingBox();
  const map = await page.locator('#map').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(map.y);
  expect(box.width / box.height).toBeCloseTo(4 / 3, 1);
  expect(await targetCode(page)).toBeFalsy();
});

test('only entries with a flag of their own are asked and counted', async ({ page }) => {
  await open(page);
  await expect(page.locator('#stat-never')).toHaveText('235');
  await expect(page.locator('#filter-summary')).toHaveText('235 Länder werden abgefragt.');
  const count = (code) => page.locator(`#filters label:has(input[value="${code}"]) .filter-count`);
  await expect(count('AN')).toHaveText('2');

  await keepOnly(page, 'regions', ['AN']);
  for (let i = 0; i < 6; i++) {
    expect(['GS', 'TF']).toContain(await flagCode(page));
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
});

test('a right answer starts at 5, shows the country on the globe, and the next flag follows', async ({ page }) => {
  await open(page);
  const { code, name } = await country(page);
  await page.fill('#answer-input', name.toUpperCase());
  await page.keyboard.press('Enter');
  const feedback = page.locator('#feedback');
  await expect(feedback).toHaveClass(/good/);
  await expect(feedback).toContainText('Richtig!');
  await expect(feedback).toContainText(name);
  await expect(feedback).toContainText('5/10');
  expect(await targetCode(page)).toBe(code);
  expect((await stored(page)).countries[code]).toMatchObject({ score: 5, seen: 1, correct: 1 });
  await expect(page.locator('#stat-started')).toHaveText('1');
  await expect.poll(() => flagCode(page), { timeout: 5000 }).not.toBe(code);
  expect(await targetCode(page)).toBeFalsy();
  await expect(page.locator('#answer-input')).toBeFocused();
});

test('a wrong answer or "Weiß ich nicht" starts at 3 and shows the country until the player moves on', async ({ page }) => {
  await open(page);
  for (const answer of [() => page.fill('#answer-input', 'Atlantis').then(() => page.keyboard.press('Enter')),
    () => page.click('#dont-know-btn')]) {
    const { code, name } = await country(page);
    await answer();
    await expect(page.locator('#feedback')).toHaveClass(/bad/);
    await expect(page.locator('#feedback')).toContainText(`Das ist ${name}`);
    await expect(page.locator('#submit-btn')).toHaveText('Weiter');
    expect(await targetCode(page)).toBe(code);
    expect((await stored(page)).countries[code]).toMatchObject({ score: 3, seen: 1, correct: 0 });
    await page.waitForTimeout(1300);
    expect(await flagCode(page)).toBe(code);
    await page.keyboard.press('Enter');
    expect(await flagCode(page)).not.toBe(code);
  }
});

test('for flags that look the same, either country counts and both are named', async ({ page }) => {
  await open(page);
  await keepOnly(page, 'regions', ['EU']);
  await keepOnly(page, 'levels', ['medium']);
  await skipUntil(page, 'MC');
  await page.fill('#answer-input', 'Indonesien');
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await expect(page.locator('#feedback')).toContainText('Monaco (gleiche Flagge wie Indonesien)');
});

test('keeps its own progress and filters, apart from the other modes', async ({ page }) => {
  await open(page);
  const nameMode = { version: 1, countries: { DE: entry(10) }, settings: { regions: ['AF'] } };
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [NAME_MODE_KEY, nameMode]);
  await seed(page, { FR: entry(7) });
  await expect(page.locator('#stat-mastered')).toHaveText('0');
  await expect(page.locator('#stat-started')).toHaveText('1');
  await expect(page.locator('#filters input[name="regions"][value="EU"]')).toBeChecked();

  await page.click('#dont-know-btn');
  expect(Object.keys((await stored(page)).countries)).toHaveLength(2);
  expect(Object.keys((await stored(page, NAME_MODE_KEY)).countries)).toEqual(['DE']);

  await page.click('#settings-btn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  expect(download.suggestedFilename()).toMatch(/^countryquiz-flags-progress-\d{4}-\d{2}-\d{2}\.json$/);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test('has no horizontal scrollbar, the flag fits above the globe, and one tap answers', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const caption = await page.locator('#prompt').boundingBox();
    expect(caption.x).toBeGreaterThanOrEqual(0);
    expect(caption.x + caption.width).toBeLessThanOrEqual(375);
    // About a third of the width, so most of the globe stays visible.
    const flag = await page.locator('#flag').boundingBox();
    expect(flag.width).toBeGreaterThanOrEqual(80);
    expect(flag.width).toBeLessThanOrEqual(140);
    const { code, name } = await country(page);
    await page.fill('#answer-input', name);
    await page.tap('#submit-btn');
    await expect(page.locator('#feedback')).toHaveClass(/good/);
    await expect.poll(() => flagCode(page), { timeout: 5000 }).not.toBe(code);
  });
});
