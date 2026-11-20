import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.silhouettes.v1';
const NAME_MODE_KEY = 'countryquiz.v1';
const entry = (score) => ({ score, seen: 12, correct: 11, lastSeen: '2026-10-29T18:00:00Z' });

function targetCode(page) {
  return page.evaluate(() => document.querySelector('#map').mapTestApi?.targetCode());
}

// The country whose outline is shown.
function shapeCode(page) {
  return page.evaluate(() => {
    const silhouette = document.querySelector('#silhouette');
    return silhouette.hasAttribute('hidden') ? null : silhouette.dataset.code;
  });
}

async function country(page) {
  const code = await shapeCode(page);
  return page.evaluate(async (c) => {
    const { COUNTRY_BY_CODE } = await import('/data/countries.js');
    const { countryPhrase, verb } = await import('/src/grammar.js');
    return { code: c, name: COUNTRY_BY_CODE.get(c).name, isThere: `Das ${verb(c, 'ist', 'sind')} ${countryPhrase(c)}` };
  }, code);
}

async function open(page) {
  await page.goto('/silhouettes.html');
  await expect.poll(() => shapeCode(page)).toBeTruthy();
}

function stored(page, key = KEY) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
}

async function seed(page, countries, settings = {}) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, { version: 1, countries, settings }]);
  await page.reload();
  await expect.poll(() => shapeCode(page)).toBeTruthy();
}

async function keepOnly(page, group, codes) {
  for (const input of await page.locator(`#filters input[name="${group}"]`).all()) {
    if (codes.includes(await input.getAttribute('value'))) await input.check();
    else await input.uncheck();
  }
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
  await expect(page.locator('h1')).toHaveText('Umrisse erkennen');
  await expect(page.locator('#prompt')).toHaveText('Welches Land hat diesen Umriss?');
  await expect(page.locator('#silhouette')).toHaveAttribute('aria-label', 'Gesuchter Umriss');
  await page.fill('#answer-input', (await country(page)).name);
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await page.keyboard.press('Enter');
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  expect(problems).toEqual([]);
});

test('the outline fills its box above the globe, and the globe marks nothing before the answer', async ({ page }) => {
  await open(page);
  const silhouette = page.locator('#silhouette');
  const box = await silhouette.boundingBox();
  const shape = await page.locator('#silhouette-path').boundingBox();
  const map = await page.locator('#map').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(map.y);
  expect(box.width).toBeGreaterThan(140);
  // The country fills the width or the height of its box, whatever its size.
  expect(Math.max(shape.width / box.width, shape.height / box.height)).toBeGreaterThan(0.85);
  expect(await targetCode(page)).toBeFalsy();
  await expect(page.locator('#recenter-btn')).toBeHidden();
});

test('each country gets its own outline', async ({ page }) => {
  await open(page);
  const first = await page.locator('#silhouette-path').getAttribute('d');
  const code = await shapeCode(page);
  await page.click('#dont-know-btn');
  await page.keyboard.press('Enter');
  await expect.poll(() => shapeCode(page)).not.toBe(code);
  expect(await page.locator('#silhouette-path').getAttribute('d')).not.toBe(first);
});

// Before the answer the button would give the country away.
test('"Zum Land" only shows after the answer', async ({ page }) => {
  await open(page);
  await expect(page.locator('#recenter-btn')).toBeHidden();
  await page.click('#dont-know-btn');
  await expect(page.locator('#recenter-btn')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#recenter-btn')).toBeHidden();
});

test('countries too small for an outline and Antarctica are not asked or counted', async ({ page }) => {
  await open(page);
  const asked = await page.evaluate(async () => (await import('/data/silhouettes.js')).SILHOUETTE_COUNTRIES.length);
  await expect(page.locator('#stat-never')).toHaveText(String(asked));
  await expect(page.locator('#filter-summary')).toHaveText(`${asked} Länder werden abgefragt.`);
  const count = (code) => page.locator(`#filters label:has(input[value="${code}"]) .filter-count`);
  // South Georgia and the French Southern Lands; Antarctica, Bouvet and Heard are left out.
  await expect(count('AN')).toHaveText('2');

  await keepOnly(page, 'regions', ['AN']);
  for (let i = 0; i < 6; i++) {
    expect(['GS', 'TF']).toContain(await shapeCode(page));
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
});

test('a right answer starts at 5, shows the country on the globe, and the next outline follows', async ({ page }) => {
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
  await expect.poll(() => shapeCode(page), { timeout: 5000 }).not.toBe(code);
  expect(await targetCode(page)).toBeFalsy();
  await expect(page.locator('#answer-input')).toBeFocused();
});

test('a wrong answer or "Weiß ich nicht" starts at 3 and shows the country until the player moves on', async ({ page }) => {
  await open(page);
  for (const answer of [() => page.fill('#answer-input', 'Atlantis').then(() => page.keyboard.press('Enter')),
    () => page.click('#dont-know-btn')]) {
    const { code, isThere } = await country(page);
    await answer();
    await expect(page.locator('#feedback')).toHaveClass(/bad/);
    await expect(page.locator('#feedback')).toContainText(isThere);
    await expect(page.locator('#submit-btn')).toHaveText('Weiter');
    expect(await targetCode(page)).toBe(code);
    expect((await stored(page)).countries[code]).toMatchObject({ score: 3, seen: 1, correct: 0 });
    await page.waitForTimeout(1300);
    expect(await shapeCode(page)).toBe(code);
    await page.keyboard.press('Enter');
    expect(await shapeCode(page)).not.toBe(code);
  }
});

test('other names of a country count, like in "Länder benennen"', async ({ page }) => {
  await open(page);
  const europe = await page.evaluate(async () => (await import('/data/countries.js')).COUNTRIES.filter((c) => c.continent === 'EU').map((c) => c.code));
  // Above the score limit every other country leaves the rotation, so Great Britain comes up at once.
  await seed(page, Object.fromEntries(europe.filter((code) => code !== 'GB').map((code) => [code, entry(10)])), { regions: ['EU'], maxScore: 9 });
  expect(await shapeCode(page)).toBe('GB');
  await page.fill('#answer-input', 'Großbritannien');
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
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
  expect(download.suggestedFilename()).toMatch(/^countryquiz-silhouettes-progress-\d{4}-\d{2}-\d{2}\.json$/);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test('has no horizontal scrollbar, the outline fits above the globe, and one tap answers', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const caption = await page.locator('#prompt').boundingBox();
    expect(caption.x).toBeGreaterThanOrEqual(0);
    expect(caption.x + caption.width).toBeLessThanOrEqual(375);
    // Under half the width, so most of the globe stays visible.
    const silhouette = await page.locator('#silhouette').boundingBox();
    expect(silhouette.width).toBeGreaterThanOrEqual(110);
    expect(silhouette.width).toBeLessThanOrEqual(190);
    const { code, name } = await country(page);
    await page.fill('#answer-input', name);
    await page.tap('#submit-btn');
    await expect(page.locator('#feedback')).toHaveClass(/good/);
    await expect.poll(() => shapeCode(page), { timeout: 5000 }).not.toBe(code);
  });
});
