import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.find.v1';
const NAME_MODE_KEY = 'countryquiz.v1';
const entry = (score) => ({ score, seen: 12, correct: 11, lastSeen: '2026-10-29T18:00:00Z' });

const mapApi = (page, method, ...args) =>
  page.evaluate(([m, a]) => document.querySelector('#map').mapTestApi[m](...a), [method, args]);

// The asked country is only named, so the tests look its code up by that name.
function askedCode(page) {
  return page.evaluate(async () => {
    const name = document.querySelector('#prompt-name').textContent;
    return (await import('/data/countries.js')).COUNTRIES.find((country) => country.name === name)?.code ?? null;
  });
}

const nameOf = (page, code) =>
  page.evaluate(async (c) => (await import('/data/countries.js')).COUNTRY_BY_CODE.get(c).name, code);

async function open(page) {
  await page.goto('/find-countries.html');
  await expect.poll(() => askedCode(page)).toBeTruthy();
}

function stored(page, key = KEY) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
}

async function seed(page, countries, settings = {}) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, { version: 1, countries, settings }]);
  await page.reload();
  await expect.poll(() => askedCode(page)).toBeTruthy();
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

// Any quizzed country other than the asked one.
async function otherCode(page) {
  const code = await askedCode(page);
  return code === 'DE' ? 'FR' : 'DE';
}

const skipQuestion = async (page) => {
  await page.click('#dont-know-btn');
  await page.click('#next-btn');
};

test('loads without console errors and names a country without marking it', async ({ page }) => {
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', (error) => problems.push(error.message));
  await open(page);
  await expect(page.locator('h1')).toHaveText('Länder finden');
  await expect(page.locator('#prompt')).toHaveText(/^Wo liegt .+\?$/);
  expect(await mapApi(page, 'targetCode')).toBeUndefined();
  await expect(page.locator('#next-btn')).toBeDisabled();
  await expect(page.locator('#stat-never')).toHaveText('250');
  expect(problems).toEqual([]);
});

test('clicking the named country is correct, saves its own progress and the next country follows on its own', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  await clickCountry(page, code);
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await expect(page.locator('#feedback')).toHaveText(`Richtig! ${await nameOf(page, code)} 5/10`);
  expect((await stored(page)).countries[code]).toMatchObject({ score: 5, seen: 1, correct: 1 });
  expect(await stored(page, NAME_MODE_KEY)).toBeNull();
  expect(await mapApi(page, 'colorOf', code)).toBe('hsl(50, 90%, 60%)');
  expect(await mapApi(page, 'targetCode')).toBe(code);
  await expect(page.locator('#stat-started')).toHaveText('1');


  await expect.poll(() => askedCode(page), { timeout: 5000 }).not.toBe(code);
  await expect(page.locator('#feedback')).toHaveText('');
  expect(await mapApi(page, 'targetCode')).toBeUndefined();
  // An Enter that came too late to skip the pause must not answer the new question.
  await expect(page.locator('#prompt')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveText('');
  expect(Object.keys((await stored(page)).countries)).toEqual([code]);
});

test('"Weiter" skips the pause after a correct answer, and only one country follows', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  await clickCountry(page, code);
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await page.click('#next-btn');
  const next = await askedCode(page);
  expect(next).not.toBe(code);
  await page.waitForTimeout(1500);
  expect(await askedCode(page)).toBe(next);
});

test('after a wrong answer the game waits for "Weiter" or Enter', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  await clickCountry(page, await otherCode(page));
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  await page.waitForTimeout(1500);
  expect(await askedCode(page)).toBe(code);
  await expect(page.locator('#next-btn')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveText('');
  expect(await askedCode(page)).not.toBe(code);
});

test('after a wrong answer a click anywhere on the globe moves on, dragging it does not', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  await clickCountry(page, await otherCode(page));
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
  await expect(page.locator('#feedback')).toHaveClass(/bad/);

  await page.mouse.click(x, y);
  await expect(page.locator('#feedback')).toHaveText('');
  const next = await askedCode(page);
  expect(next).not.toBe(code);
  // The click only moved on, it did not answer the new question.
  expect(Object.keys((await stored(page)).countries)).toEqual([code]);
  await expect(page.locator('#next-btn')).toBeDisabled();
});

test('a click on the globe skips the pause after a correct answer', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  const { x, y } = await pointIn(page, code);
  await page.mouse.click(x, y);
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  // The click is handled at once, long before the pause of a second is over.
  await page.mouse.click(x, y);
  expect(await page.textContent('#feedback')).toBe('');
  const next = await askedCode(page);
  expect(next).not.toBe(code);
  await page.waitForTimeout(1500);
  expect(await askedCode(page)).toBe(next);
});

test('the asked country lights up green when found, red when another one was clicked', async ({ page }) => {
  await open(page);
  let code = await askedCode(page);
  await clickCountry(page, code);
  expect(await mapApi(page, 'flashing')).toEqual({ code, kind: 'good' });
  await page.click('#next-btn');

  code = await askedCode(page);
  await clickCountry(page, await otherCode(page));
  // The asked country flashes, not the clicked one.
  expect(await mapApi(page, 'flashing')).toEqual({ code, kind: 'bad' });
});

test('a correct click leaves the view where the player found the country', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  const { x, y } = await pointIn(page, code);
  const before = await mapApi(page, 'view');
  await page.mouse.click(x, y);
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  await page.waitForTimeout(100);
  expect(await mapApi(page, 'view')).toEqual(before);
});

test('clicking another country is wrong, names both and turns to the right one', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  const other = await otherCode(page);
  await clickCountry(page, other);
  await expect(page.locator('#feedback')).toHaveClass(/bad/);
  await expect(page.locator('#feedback')).toHaveText(`Falsch! Das ist ${await nameOf(page, other)}. ${await nameOf(page, code)} liegt hier 3/10`);
  expect((await stored(page)).countries).toEqual({ [code]: expect.objectContaining({ score: 3, seen: 1, correct: 0 }) });
  expect(await mapApi(page, 'targetCode')).toBe(code);
  expect((await mapApi(page, 'view')).k).toBeLessThanOrEqual(3);
  // Measured at the country's own center: a safe point to click inside a curved
  // country like Norway or Vietnam can lie far from it.
  const { point, middle } = await page.evaluate((c) => {
    const canvas = document.querySelector('#map');
    const rect = canvas.getBoundingClientRect();
    const api = canvas.mapTestApi;
    return { point: api.pointAt(api.centerOf(c)), middle: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } };
  }, code);
  expect(Math.abs(point.x - middle.x)).toBeLessThan(2);
  expect(Math.abs(point.y - middle.y)).toBeLessThan(2);
});

test('"Weiß ich nicht" counts as wrong and shows the country', async ({ page }) => {
  await open(page);
  const code = await askedCode(page);
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback')).toHaveText(`Schade! ${await nameOf(page, code)} liegt hier 3/10`);
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
  expect(await stored(page)).toMatchObject({ countries: {} });
  await expect(page.locator('#next-btn')).toBeDisabled();
});

test('hovering an asked country never names it, not even after the answer', async ({ page }) => {
  await open(page);
  await seed(page, { DE: entry(7), FR: entry(7) });
  const other = await otherCode(page);
  const name = await nameOf(page, other);
  for (const answered of [false, true]) {
    if (answered) await page.click('#dont-know-btn');
    const { x, y } = await pointIn(page, other);
    await page.mouse.move(x, y);
    await page.mouse.move(x + 1, y);
    await page.waitForTimeout(200);
    await expect(page.getByText(`${name}: 7/10`)).toHaveCount(0);
    await expect(page.locator('#map-wrap')).not.toContainText(`${name}:`);
  }
});

test('a click right next to a small country counts as a hit', async ({ page }) => {
  await open(page);
  const oceania = await page.evaluate(async () => (await import('/data/countries.js')).COUNTRIES.filter((c) => c.continent === 'OC').map((c) => c.code));
  await seed(page, Object.fromEntries(oceania.filter((code) => code !== 'NR').map((code) => [code, entry(10)])), { regions: ['OC'] });
  for (let i = 0; i < 100 && (await askedCode(page)) !== 'NR'; i++) await skipQuestion(page);
  expect(await askedCode(page)).toBe('NR');

  // At zoom 1 Nauru is far smaller than a pixel: 8 pixels beside it is open sea.
  const nauru = [166.93, -0.53];
  await mapApi(page, 'lookAt', nauru, 1);
  const { x, y } = await mapApi(page, 'pointAt', nauru);
  await page.mouse.click(x + 30, y);
  await expect(page.locator('#feedback')).toHaveText('Dort ist kein Land aus dem Quiz.');
  await page.mouse.click(x + 8, y);
  await expect(page.locator('#feedback')).toHaveClass(/good/);
  expect(await mapApi(page, 'targetCode')).toBe('NR');
});

test('the question box sits on the globe and lets clicks through', async ({ page }) => {
  await open(page);
  const [caption, map] = await Promise.all(['#prompt', '#map-wrap'].map((s) => page.locator(s).boundingBox()));
  expect(caption.y).toBeGreaterThanOrEqual(map.y);
  await expect(page.locator('#prompt')).toHaveCSS('pointer-events', 'none');
});

test('the result shows a verdict burst and the new score in its color', async ({ page }) => {
  await open(page);
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback .verdict')).toHaveText('Schade!');
  const chip = page.locator('#feedback .score-chip');
  await expect(chip).toHaveText('3/10');
  const [chipColor, scoreColor] = await chip.evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.background = 'var(--score-3)';
    document.body.append(probe);
    const colors = [getComputedStyle(element).backgroundColor, getComputedStyle(probe).backgroundColor];
    probe.remove();
    return colors;
  });
  expect(chipColor).toBe(scoreColor);
});

test('a miss on the ocean shows only a hint, without verdict or score', async ({ page }) => {
  await open(page);
  await mapApi(page, 'lookAt', [-30, 0], 1);
  const { x, y } = await mapApi(page, 'pointAt', [-30, 0]);
  await page.mouse.click(x, y);
  await expect(page.locator('#feedback')).toHaveClass(/hint/);
  await expect(page.locator('#feedback .verdict, #feedback .score-chip')).toHaveCount(0);
});

test('settings export this mode\'s progress under its own name', async ({ page }) => {
  await open(page);
  await page.click('#settings-btn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  expect(download.suggestedFilename()).toMatch(/^countryquiz-find-progress-\d{4}-\d{2}-\d{2}\.json$/);
});

test('the filter sidebar works here too and keeps this mode\'s own choice', async ({ page }) => {
  await open(page);
  await expect(page.locator('#filters')).toBeVisible();
  for (const input of await page.locator('#filters input[name="levels"]').all()) {
    if ((await input.getAttribute('value')) !== 'easy') await input.uncheck();
  }
  await expect(page.locator('#filter-summary')).toHaveText('58 Länder werden abgefragt.');
  expect((await stored(page)).settings.levels).toEqual(['easy']);
  expect(await stored(page, NAME_MODE_KEY)).toBeNull();
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

  test('even the longest country name fits the question box on screen', async ({ page }) => {
    await open(page);
    const boxes = await page.evaluate(async () => {
      const { COUNTRIES } = await import('/data/countries.js');
      const name = document.querySelector('#prompt-name');
      const caption = document.querySelector('#prompt');
      return COUNTRIES.map((country) => {
        name.textContent = country.name;
        const { left, right, height } = caption.getBoundingClientRect();
        return { left, right, height };
      });
    });
    for (const { left, right, height } of boxes) {
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(375);
      expect(height).toBeLessThan(110);
    }
  });

  test('a tap on the country answers, in one row below the globe', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect((await page.locator('.panel').boundingBox()).height).toBeLessThan(65);
    const { x, y } = await pointIn(page, await askedCode(page));
    await page.touchscreen.tap(x, y);
    await expect(page.locator('#feedback')).toHaveClass(/good/);
  });

  test('after a wrong answer a tap on the globe moves on', async ({ page }) => {
    await open(page);
    const code = await askedCode(page);
    await page.click('#dont-know-btn');
    await expect(page.locator('#feedback')).toHaveClass(/bad/);
    const box = await page.locator('#map').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('#feedback')).toHaveText('');
    expect(await askedCode(page)).not.toBe(code);
  });
});
