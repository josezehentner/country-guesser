import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.neighbors.v1';
const GREEN = 'var(--route-step)';
const RED = 'var(--route-detour)';
const ORANGE = 'var(--route-missing)';
const mastered = { score: 10, seen: 12, correct: 12, lastSeen: '2026-10-29T18:00:00Z' };

const mapApi = (page, method, ...args) =>
  page.evaluate(([m, a]) => document.querySelector('#map').mapTestApi[m](...a), [method, args]);

// Undefined while the map is still loading.
const askedCode = (page) => page.evaluate(() => document.querySelector('#map').mapTestApi?.targetCode());

function stored(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
}

// Every other country is mastered and above the score limit, so only `code` is asked.
async function askOnly(page, code) {
  await page.goto('/neighbors.html');
  // The page saves its progress once the map is ready: seed only after that.
  await expect.poll(() => askedCode(page)).toBeTruthy();
  await page.evaluate(async ([key, asked, entry]) => {
    const { NEIGHBOR_COUNTRIES } = await import('/src/neighbor-round.js');
    const countries = Object.fromEntries(NEIGHBOR_COUNTRIES.filter((c) => c.code !== asked).map((c) => [c.code, entry]));
    localStorage.setItem(key, JSON.stringify({ version: 1, countries, settings: { maxScore: 9 } }));
  }, [KEY, code, mastered]);
  await page.reload();
  await expect.poll(() => askedCode(page)).toBe(code);
}

// Turns the country into view, zoomed in, and clicks a point inside it.
async function clickCountry(page, code) {
  const { x, y } = await page.evaluate(async (c) => {
    const api = document.querySelector('#map').mapTestApi;
    api.zoomTo(c);
    await new Promise(requestAnimationFrame);
    return api.pointOf(c);
  }, code);
  await page.mouse.click(x, y);
}

async function clickOcean(page) {
  await mapApi(page, 'lookAt', [-30, 0], 1);
  const { x, y } = await mapApi(page, 'pointAt', [-30, 0]);
  await page.mouse.click(x, y);
}

const status = (page) => page.locator('#neighbor-status');
const feedback = (page) => page.locator('#feedback');

test('loads without console errors, marks a country with land borders and says how many neighbors it has', async ({ page }) => {
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto('/neighbors.html');
  await expect.poll(() => askedCode(page)).toBeTruthy();
  await expect(page.locator('h1')).toHaveText('Nachbarn finden');
  const code = await askedCode(page);
  const count = await page.evaluate(async (c) => (await import('/data/borders.js')).BORDERS[c].length, code);
  expect(count).toBeGreaterThan(0);
  await expect(status(page)).toHaveText(`0 von ${count} gefunden · noch 3 Fehlversuche`);
  await expect(page.locator('#stat-never')).toHaveText('164');
  await expect(page.locator('#filter-summary')).toHaveText('164 Länder werden abgefragt.');
  await expect(page.locator('#next-btn')).toBeDisabled();
  await expect(page.locator('#recenter-btn')).toBeVisible();
  expect(problems).toEqual([]);
});

test('the globe shows no borders and no score colors, even after a scored round', async ({ page }) => {
  await askOnly(page, 'PT');
  expect(await mapApi(page, 'hidesBorders')).toBe(true);
  await expect(page.locator('#map')).toHaveAttribute('aria-label', 'Globus ohne Grenzen');
  const plain = await mapApi(page, 'colorOf', 'FR');
  expect(await mapApi(page, 'colorOf', 'PT')).toBe(plain);
  await clickCountry(page, 'ES');
  await expect(feedback(page)).toHaveText('Richtig! Den einzigen Nachbarn gefunden 5/10');
  expect((await stored(page)).countries.PT.score).toBe(5);
  for (const code of ['PT', 'ES', 'DE']) expect(await mapApi(page, 'colorOf', code)).toBe(plain);
  // The legend stays for the score limit slider.
  await expect(page.locator('#legend li')).toHaveCount(11);
});

test('the question takes the article of the country', async ({ page }) => {
  await askOnly(page, 'CH');
  await expect(page.locator('#prompt p').first()).toHaveText('Welche Länder grenzen an die Schweiz?');
  await expect(page.locator('#prompt-name')).toHaveText('Schweiz');
  await askOnly(page, 'DE');
  await expect(page.locator('#prompt p').first()).toHaveText('Welche Länder grenzen an Deutschland?');
});

test('clicking every neighbor outlines them green, is correct and moves on by itself', async ({ page }) => {
  await askOnly(page, 'BE');
  await clickCountry(page, 'FR');
  await expect(feedback(page)).toHaveText('Nachbar: Frankreich');
  await expect(status(page)).toHaveText('1 von 4 gefunden · noch 3 Fehlversuche');
  expect(await mapApi(page, 'flashing')).toEqual({ code: 'FR', kind: 'good' });
  for (const code of ['DE', 'NL']) await clickCountry(page, code);
  await expect(status(page)).toHaveText('3 von 4 gefunden · noch 3 Fehlversuche');
  expect(await stored(page)).not.toHaveProperty('countries.BE');

  await clickCountry(page, 'LU');
  await expect(feedback(page)).toHaveText('Richtig! Alle 4 Nachbarn gefunden 5/10');
  await expect(status(page)).toHaveText('4 von 4 gefunden');
  expect(await mapApi(page, 'targetColors')).toEqual({ BE: 'var(--target)', FR: GREEN, DE: GREEN, NL: GREEN, LU: GREEN });
  expect((await stored(page)).countries.BE).toMatchObject({ score: 5, seen: 1, correct: 1 });
  expect(await mapApi(page, 'flashing')).toEqual({ code: 'BE', kind: 'good' });

  // Belgium is now the only country left, so it comes again with fresh outlines.
  await expect(feedback(page)).toHaveText('', { timeout: 5000 });
  expect(await mapApi(page, 'targetColors')).toEqual({ BE: 'var(--target)' });
  await expect(status(page)).toHaveText('0 von 4 gefunden · noch 3 Fehlversuche');
});

test('a wrong click outlines the country red and costs a miss; water, the country itself and repeats cost nothing', async ({ page }) => {
  await askOnly(page, 'BE');
  await clickCountry(page, 'ES');
  await expect(feedback(page)).toHaveText('Kein Nachbar: Spanien');
  await expect(status(page)).toHaveText('0 von 4 gefunden · noch 2 Fehlversuche');
  expect(await mapApi(page, 'targetColors')).toMatchObject({ ES: RED });
  expect(await mapApi(page, 'flashing')).toEqual({ code: 'ES', kind: 'bad' });

  await clickCountry(page, 'ES');
  await expect(feedback(page)).toHaveText('Spanien hast du schon angeklickt.');
  await clickCountry(page, 'BE');
  await expect(feedback(page)).toHaveText('Das ist das markierte Land selbst.');
  await clickOcean(page);
  await expect(feedback(page)).toHaveText('Dort ist kein Land aus dem Quiz.');
  await expect(status(page)).toHaveText('0 von 4 gefunden · noch 2 Fehlversuche');
  expect(await stored(page)).not.toHaveProperty('countries.BE');
});

test('the third wrong click ends the round and outlines the missing neighbors orange', async ({ page }) => {
  await askOnly(page, 'BE');
  await clickCountry(page, 'NL');
  for (const code of ['ES', 'IT']) await clickCountry(page, code);
  await clickCountry(page, 'PL');
  await expect(feedback(page)).toHaveText('Vorbei! Gefehlt haben: Deutschland, Frankreich, Luxemburg 3/10');
  await expect(status(page)).toHaveText('1 von 4 gefunden');
  expect(await mapApi(page, 'targetColors')).toEqual({
    BE: 'var(--target)', NL: GREEN, ES: RED, IT: RED, PL: RED, DE: ORANGE, FR: ORANGE, LU: ORANGE,
  });
  expect((await stored(page)).countries.BE).toMatchObject({ score: 3, seen: 1, correct: 0 });

  // It waits for the player, and a click on the globe moves on without answering.
  await page.waitForTimeout(2000);
  await expect(feedback(page)).toHaveClass(/bad/);
  await expect(page.locator('#next-btn')).toBeFocused();
  await clickCountry(page, 'DE');
  await expect(feedback(page)).toHaveText('');
  expect(await mapApi(page, 'targetColors')).toEqual({ BE: 'var(--target)' });
  expect((await stored(page)).countries.BE.seen).toBe(1);
});

test('"Weiß ich nicht" shows the missing neighbors and counts as wrong', async ({ page }) => {
  await askOnly(page, 'PT');
  await page.click('#dont-know-btn');
  await expect(feedback(page)).toHaveText('Schade! Gefehlt hat: Spanien 3/10');
  expect(await mapApi(page, 'targetColors')).toEqual({ PT: 'var(--target)', ES: ORANGE });
  await expect(page.locator('#dont-know-btn')).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect(feedback(page)).toHaveText('');
});

test('a tiny neighbor counts with a click just next to it', async ({ page }) => {
  await askOnly(page, 'IT');
  const { x, y } = await page.evaluate(async () => {
    const api = document.querySelector('#map').mapTestApi;
    api.lookAt(api.centerOf('VA'), 4);
    await new Promise(requestAnimationFrame);
    return api.pointOf('VA');
  });
  await page.mouse.click(x + 6, y);
  await expect(feedback(page)).toHaveText('Nachbar: Vatikanstadt');
});

test('on an English page the question and messages are English', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('countryquiz.language', 'en'));
  await askOnly(page, 'NL');
  await expect(page.locator('h1')).toHaveText('Find the Neighbors');
  await expect(page.locator('#prompt p').first()).toHaveText('Which countries border the Netherlands?');
  await expect(status(page)).toHaveText('0 of 2 found · 3 misses left');
  await clickCountry(page, 'BE');
  await expect(feedback(page)).toHaveText('Neighbor: Belgium');
  await clickCountry(page, 'FR');
  await expect(feedback(page)).toHaveText('Not a neighbor: France');
  await expect(status(page)).toHaveText('1 of 2 found · 2 misses left');
});
