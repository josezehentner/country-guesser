import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.capitals.v1';
const NAME_MODE_KEY = 'countryquiz.v1';
const entry = (score) => ({ score, seen: 12, correct: 11, lastSeen: '2026-10-29T18:00:00Z' });

function targetCode(page) {
  return page.evaluate(() => document.querySelector('#map').mapTestApi?.targetCode());
}

async function open(page) {
  await page.goto('/capitals.html');
  await expect.poll(() => targetCode(page)).toBeTruthy();
}

// The capital of the marked country, and the label shown as the answer.
async function capital(page) {
  const code = await targetCode(page);
  return page.evaluate(async (c) => {
    const { CAPITALS, capitalLabel } = await import('/data/capitals.js');
    const { COUNTRY_BY_CODE } = await import('/data/countries.js');
    return { code: c, name: CAPITALS[c].name, label: capitalLabel(c), country: COUNTRY_BY_CODE.get(c).name };
  }, code);
}

function stored(page, key = KEY) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
}

async function seed(page, countries, settings = {}) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, { version: 1, countries, settings }]);
  await page.reload();
  await expect.poll(() => targetCode(page)).toBeTruthy();
}

const filter = (page, group, code) => page.locator(`#filters input[name="${group}"][value="${code}"]`);

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
  await expect(page.locator('h1')).toHaveText('Hauptstädte lernen');
  await expect(page.locator('#prompt')).toHaveText('Welche Hauptstadt hat das markierte Land?');
  await page.fill('#answer-input', (await capital(page)).name);
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await page.keyboard.press('Enter');
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  expect(problems).toEqual([]);
});

test('only places with a capital are asked and counted', async ({ page }) => {
  await open(page);
  await expect(page.locator('#stat-never')).toHaveText('246');
  await expect(page.locator('#filter-summary')).toHaveText('246 Länder werden abgefragt.');
  const count = (code) => page.locator(`#filters label:has(input[value="${code}"]) .filter-count`);
  await expect(count('AN')).toHaveText('2');
  await expect(count('OC')).toHaveText('25');
  await expect(count('hard')).toHaveText(String(74 - 4));

  await keepOnly(page, 'regions', ['AN']);
  await expect(page.locator('#filter-summary')).toHaveText('2 Länder werden abgefragt.');
  for (let i = 0; i < 6; i++) {
    expect(['GS', 'TF']).toContain(await targetCode(page));
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
});

test('a right capital starts at 5 and names the country, the next one follows by itself', async ({ page }) => {
  await open(page);
  const { code, name, label, country } = await capital(page);
  await page.fill('#answer-input', name.toUpperCase());
  await page.keyboard.press('Enter');
  const feedback = page.locator('#feedback');
  await expect(feedback).toHaveClass(/good/);
  await expect(feedback).toContainText('Richtig!');
  await expect(feedback).toContainText(`${country}: ${label}`);
  await expect(feedback).toContainText('5/10');
  expect((await stored(page)).countries[code]).toMatchObject({ score: 5, seen: 1, correct: 1 });
  await expect(page.locator('#stat-started')).toHaveText('1');
  await expect(page.locator('#stat-never')).toHaveText('245');
  await expect.poll(() => targetCode(page), { timeout: 5000 }).not.toBe(code);
  await expect(page.locator('#answer-input')).toBeFocused();
});

test('a wrong capital or "Weiß ich nicht" starts at 3 and shows the right one until the player moves on', async ({ page }) => {
  await open(page);
  for (const answer of [() => page.fill('#answer-input', 'Atlantis').then(() => page.keyboard.press('Enter')),
    () => page.click('#dont-know-btn')]) {
    const { code, label, country } = await capital(page);
    await answer();
    await expect(page.locator('#feedback')).toHaveClass(/bad/);
    await expect(page.locator('#feedback')).toContainText(`${country}: ${label}`);
    await expect(page.locator('#submit-btn')).toHaveText('Weiter');
    expect((await stored(page)).countries[code]).toMatchObject({ score: 3, seen: 1, correct: 0 });
    await page.waitForTimeout(600);
    expect(await targetCode(page)).toBe(code);
    await page.keyboard.press('Enter');
    expect(await targetCode(page)).not.toBe(code);
  }
});

test('the country name is no answer, and further official capitals count', async ({ page }) => {
  await open(page);
  await keepOnly(page, 'regions', ['SA']);
  await keepOnly(page, 'levels', ['medium']);
  // Bolivia has two capitals; skip until it is asked.
  for (let i = 0; i < 40 && (await targetCode(page)) !== 'BO'; i++) {
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
  expect(await targetCode(page)).toBe('BO');
  await page.fill('#answer-input', 'Bolivien');
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  await expect(page.locator('#feedback')).toContainText('Bolivien: Sucre (auch La Paz)');
  await seed(page, {}, { regions: ['SA'], levels: ['medium'] });
  for (let i = 0; i < 40 && (await targetCode(page)) !== 'BO'; i++) {
    await page.click('#dont-know-btn');
    await page.keyboard.press('Enter');
  }
  await page.fill('#answer-input', 'la paz');
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
});

test('keeps its own progress and filters, apart from the other modes', async ({ page }) => {
  await open(page);
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, countries: { DE: { score: 10, seen: 12, correct: 11, lastSeen: '2026-10-29T18:00:00Z' } }, settings: { regions: ['AF'] } })), NAME_MODE_KEY);
  await seed(page, { FR: entry(7) });
  await expect(page.locator('#stat-mastered')).toHaveText('0');
  await expect(page.locator('#stat-started')).toHaveText('1');
  await expect(filter(page, 'regions', 'EU')).toBeChecked();

  await page.click('#dont-know-btn');
  expect(Object.keys((await stored(page)).countries)).toHaveLength(2);
  expect(Object.keys((await stored(page, NAME_MODE_KEY)).countries)).toEqual(['DE']);

  await page.click('#settings-btn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  expect(download.suggestedFilename()).toMatch(/^countryquiz-capitals-progress-\d{4}-\d{2}-\d{2}\.json$/);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test('has no horizontal scrollbar, the question fits, and one tap answers', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const caption = await page.locator('#prompt').boundingBox();
    expect(caption.x).toBeGreaterThanOrEqual(0);
    expect(caption.x + caption.width).toBeLessThanOrEqual(375);
    const { code, name } = await capital(page);
    await page.fill('#answer-input', name);
    await page.tap('#submit-btn');
    await expect(page.locator('#feedback')).toHaveClass(/good/);
    await expect.poll(() => targetCode(page), { timeout: 5000 }).not.toBe(code);
  });
});
