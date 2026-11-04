import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.capitals-find.v1';
const OTHER_KEYS = ['countryquiz.v1', 'countryquiz.find.v1', 'countryquiz.capitals.v1'];
// No place in these regions shares its capital's name with another one, so the
// named capital tells the tests which country is asked.
const UNAMBIGUOUS_REGIONS = ['EU', 'ME', 'AS', 'AF'];
const entry = (score) => ({ score, seen: 12, correct: 11, lastSeen: '2026-10-29T18:00:00Z' });

const mapApi = (page, method, ...args) =>
  page.evaluate(([m, a]) => document.querySelector('#map').mapTestApi[m](...a), [method, args]);

const askedLabel = (page) => page.textContent('#prompt-name');

// The asked country is only known by its capital, so the tests look it up by that.
function askedCode(page) {
  return page.evaluate(async () => {
    const label = document.querySelector('#prompt-name').textContent;
    const { CAPITALS, capitalLabel } = await import('/data/capitals.js');
    const codes = Object.keys(CAPITALS).filter((code) => capitalLabel(code) === label);
    return codes.length === 1 ? codes[0] : null;
  });
}

const nameOf = (page, code) =>
  page.evaluate(async (c) => (await import('/data/countries.js')).COUNTRY_BY_CODE.get(c).name, code);

const capitalOf = (page, code) =>
  page.evaluate(async (c) => {
    const { CAPITALS, capitalLabel } = await import('/data/capitals.js');
    return { name: CAPITALS[c].name, label: capitalLabel(c) };
  }, code);

function stored(page, key = KEY) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
}

async function seed(page, countries, settings = { regions: UNAMBIGUOUS_REGIONS }) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, { version: 1, countries, settings }]);
  await page.reload();
  await expect.poll(() => askedLabel(page)).not.toBe('…');
}

async function open(page, settings) {
  await page.goto('/find-capitals.html');
  await seed(page, {}, settings);
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

async function clickCountry(page, code) {
  const { x, y } = await pointIn(page, code);
  await page.mouse.click(x, y);
}

async function otherCode(page) {
  const code = await askedCode(page);
  return code === 'DE' ? 'FR' : 'DE';
}

const skipQuestion = async (page) => {
  await page.click('#dont-know-btn');
  await page.click('#next-btn');
};

test('loads without console errors, external requests or policy violations, and names a capital', async ({ page, baseURL }) => {
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
  await page.goto('/find-capitals.html');
  await expect(page.locator('h1')).toHaveText('Hauptstädte finden');
  await expect(page).toHaveTitle('Hauptstädte finden – Country Guesser');
  await expect(page.locator('#prompt')).toHaveText(/^Wo liegt .+\?$/);
  await expect.poll(() => page.evaluate(async () => {
    const label = document.querySelector('#prompt-name').textContent;
    const { CAPITALS, capitalLabel } = await import('/data/capitals.js');
    return Object.keys(CAPITALS).some((code) => capitalLabel(code) === label);
  })).toBe(true);
  // Nothing is marked: finding the country is the task.
  expect(await mapApi(page, 'targetCode')).toBeUndefined();
  await expect(page.locator('#next-btn')).toBeDisabled();
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  expect(problems).toEqual([]);
});

test('only places with a capital are asked and counted', async ({ page }) => {
  await open(page, {});
  await expect(page.locator('#stat-never')).toHaveText('246');
  await expect(page.locator('#filter-summary')).toHaveText('246 Länder werden abgefragt.');
  const count = (code) => page.locator(`#filters label:has(input[value="${code}"]) .filter-count`);
  await expect(count('AN')).toHaveText('2');
  await seed(page, {}, { regions: ['AN'] });
  await expect(page.locator('#filter-summary')).toHaveText('2 Länder werden abgefragt.');
  for (let i = 0; i < 6; i++) {
    expect(['GS', 'TF']).toContain(await askedCode(page));
    await skipQuestion(page);
  }
});

test('clicking the country of the capital is correct, names both and the next one follows on its own', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  const { label } = await capitalOf(page, code);
  await clickCountry(page, code);
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await expect(page.locator('#feedback')).toHaveText(`Richtig! ${await nameOf(page, code)}: ${label} 5/10`);
  expect((await stored(page)).countries[code]).toMatchObject({ score: 5, seen: 1, correct: 1 });
  for (const key of OTHER_KEYS) expect(await stored(page, key)).toBeNull();
  expect(await mapApi(page, 'colorOf', code)).toBe('hsl(50, 90%, 60%)');
  expect(await mapApi(page, 'targetCode')).toBe(code);
  expect(await mapApi(page, 'flashing')).toEqual({ code, kind: 'good' });
  await expect(page.locator('#stat-started')).toHaveText('1');
  await expect(page.locator('#stat-never')).toHaveText('245');

  await expect(page.locator('#feedback')).toHaveText('', { timeout: 5000 });
  expect(await askedCode(page)).not.toBe(code);
  expect(await mapApi(page, 'targetCode')).toBeUndefined();
  // An Enter that came too late to skip the pause must not answer the new question.
  await expect(page.locator('#prompt')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveText('');
  expect(Object.keys((await stored(page)).countries)).toEqual([code]);
});

test('a click on another country is wrong, shows the right one and waits for the player', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  const other = await otherCode(page);
  await clickCountry(page, other);
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  const { name } = await capitalOf(page, code);
  await expect(page.locator('#feedback')).toHaveText(`Falsch! Das ist ${await nameOf(page, other)}. ${name} liegt hier: ${await nameOf(page, code)} 3/10`);
  expect((await stored(page)).countries).toEqual({ [code]: expect.objectContaining({ score: 3, seen: 1, correct: 0 }) });
  expect(await mapApi(page, 'targetCode')).toBe(code);
  expect(await mapApi(page, 'flashing')).toEqual({ code, kind: 'bad' });
  await page.waitForTimeout(1500);
  expect(await askedCode(page)).toBe(code);
  await expect(page.locator('#next-btn')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveText('');
  expect(await askedCode(page)).not.toBe(code);
});

test('after an answer a click on the globe moves on, dragging it does not', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  const box = await page.locator('#map').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const before = await mapApi(page, 'view');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y - 40, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => mapApi(page, 'view')).not.toEqual(before);
  await page.waitForTimeout(100);
  expect(await askedCode(page)).toBe(code);

  await page.mouse.click(x, y);
  await expect(page.locator('#feedback')).toHaveText('');
  expect(await askedCode(page)).not.toBe(code);
  // The click only moved on, it did not answer the new question.
  expect(Object.keys((await stored(page)).countries)).toEqual([code]);
});

test('"Weiß ich nicht" counts as wrong and shows the country', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  const { name } = await capitalOf(page, code);
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback')).toHaveText(`Schade! ${name} liegt hier: ${await nameOf(page, code)} 3/10`);
  expect((await stored(page)).countries[code]).toMatchObject({ score: 3, correct: 0 });
  expect(await mapApi(page, 'targetCode')).toBe(code);
  await expect(page.locator('#dont-know-btn')).toBeDisabled();
  await page.click('#next-btn');
  await expect(page.locator('#feedback')).toHaveText('');
});

test('clicking the ocean is not an answer', async ({ page }) => {
  await open(page);
  await mapApi(page, 'lookAt', [-30, 0], 1);
  const { x, y } = await mapApi(page, 'pointAt', [-30, 0]);
  await page.mouse.click(x, y);
  await expect(page.locator('#feedback')).toHaveText('Dort ist kein Land aus dem Quiz.');
  await expect(page.locator('#feedback .verdict, #feedback .score-chip')).toHaveCount(0);
  expect(await stored(page)).toMatchObject({ countries: {} });
  await expect(page.locator('#next-btn')).toBeDisabled();
});

test('further official capitals are named with the main one', async ({ page }) => {
  await open(page, { regions: ['SA'], levels: ['medium'] });
  for (let i = 0; i < 60 && (await askedCode(page)) !== 'BO'; i++) await skipQuestion(page);
  await expect(page.locator('#prompt')).toHaveText('Wo liegt Sucre (auch La Paz)?');
  await clickCountry(page, 'BO');
  await expect(page.locator('#feedback')).toHaveText('Richtig! Bolivien: Sucre (auch La Paz) 5/10');
});

test('a capital two places share counts on either of them', async ({ page }) => {
  await page.goto('/find-capitals.html');
  const oceania = await page.evaluate(async () => (await import('/data/countries.js')).COUNTRIES.filter((c) => c.continent === 'OC').map((c) => c.code));
  await seed(page, Object.fromEntries(oceania.filter((code) => code !== 'NF').map((code) => [code, entry(10)])), { regions: ['OC'] });
  for (let i = 0; i < 100 && (await askedLabel(page)) !== 'Kingston'; i++) await skipQuestion(page);
  // In Oceania only Norfolk Island has Kingston as its capital.
  await expect(page.locator('#prompt')).toHaveText('Wo liegt Kingston?');

  // Jamaica's capital is Kingston too, so a click on it is right, for Norfolk Island.
  await clickCountry(page, 'JM');
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await expect(page.locator('#feedback')).toHaveText('Richtig! Jamaika: Kingston. Auch richtig: Norfolkinsel 5/10');
  expect((await stored(page)).countries.NF).toMatchObject({ score: 5, correct: 1 });
  expect((await stored(page)).countries.JM).toBeUndefined();
  expect(await mapApi(page, 'targetCode')).toBe('JM');
  expect(await mapApi(page, 'flashing')).toEqual({ code: 'JM', kind: 'good' });
});

test('Saint Vincent\'s Kingstown is not Jamaica\'s Kingston', async ({ page }) => {
  await page.goto('/find-capitals.html');
  const caribbean = ['JM', 'VC'];
  const northAmerica = await page.evaluate(async () => (await import('/data/countries.js')).COUNTRIES.filter((c) => c.continent === 'NA').map((c) => c.code));
  await seed(page, Object.fromEntries(northAmerica.filter((code) => !caribbean.includes(code)).map((code) => [code, entry(10)])), { regions: ['NA'] });
  for (let i = 0; i < 100 && (await askedCode(page)) !== 'VC'; i++) await skipQuestion(page);
  expect(await askedCode(page)).toBe('VC');
  await clickCountry(page, 'JM');
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
});

test('settings export this mode\'s progress under its own name', async ({ page }) => {
  await open(page);
  await page.click('#settings-btn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  expect(download.suggestedFilename()).toMatch(/^countryquiz-capitals-find-progress-\d{4}-\d{2}-\d{2}\.json$/);
});

test('the filter sidebar works here too and keeps this mode\'s own choice', async ({ page }) => {
  await open(page);
  await expect(page.locator('#filters')).toBeVisible();
  for (const input of await page.locator('#filters input[name="levels"]').all()) {
    if ((await input.getAttribute('value')) !== 'easy') await input.uncheck();
  }
  expect((await stored(page)).settings.levels).toEqual(['easy']);
  for (const key of OTHER_KEYS) expect(await stored(page, key)).toBeNull();
  await page.reload();
  await expect(page.locator('#filters input[name="levels"][value="easy"]')).toBeChecked();
  await expect(page.locator('#filters input[name="levels"][value="hard"]')).not.toBeChecked();
  await expect.poll(() => askedCode(page)).toBeTruthy();
  const level = await page.evaluate(async (c) => (await import('/data/countries.js')).COUNTRY_BY_CODE.get(c).level, await askedCode(page));
  expect(level).toBe('easy');
});

test('the menu link leads back to the menu', async ({ page }) => {
  await open(page);
  await page.click('text=Menü');
  await expect(page.locator('h1')).toHaveText('Country Guesser');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test('even the longest capital fits the question box on screen', async ({ page }) => {
    await open(page);
    const boxes = await page.evaluate(async () => {
      const { CAPITALS, capitalLabel } = await import('/data/capitals.js');
      const name = document.querySelector('#prompt-name');
      const caption = document.querySelector('#prompt');
      return Object.keys(CAPITALS).map((code) => {
        name.textContent = capitalLabel(code);
        const { left, right, height } = caption.getBoundingClientRect();
        return { code, left, right, height };
      });
    });
    for (const { code, left, right, height } of boxes) {
      expect(left, code).toBeGreaterThanOrEqual(0);
      expect(right, code).toBeLessThanOrEqual(375);
      expect(height, code).toBeLessThan(110);
    }
  });

  test('a tap on the country answers, in one row below the globe, and a tap moves on', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect((await page.locator('.panel').boundingBox()).height).toBeLessThan(65);
    const code = await askedCode(page);
    const other = await pointIn(page, await otherCode(page));
    await page.touchscreen.tap(other.x, other.y);
    await expect(page.locator('#feedback')).toHaveClass(/bad/);
    const box = await page.locator('#map').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('#feedback')).toHaveText('');
    const next = await askedCode(page);
    expect(next).not.toBe(code);
    const { x, y } = await pointIn(page, next);
    await page.touchscreen.tap(x, y);
    await expect(page.locator('#feedback')).toHaveClass(/good/);
  });
});
