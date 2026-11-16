import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.neighbors.v1';
const GREEN = 'var(--route-step)';
const RED = 'var(--route-detour)';
const ORANGE = 'var(--route-missing)';

const mapApi = (page, method, ...args) =>
  page.evaluate(([m, a]) => document.querySelector('#map').mapTestApi[m](...a), [method, args]);

// Undefined while the map is still loading.
const askedCode = (page) => page.evaluate(() => document.querySelector('#map').mapTestApi?.targetCode());

function stored(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
}

// Rounds are random, so the tests start one on `code` through the page's test hook.
async function askOnly(page, code) {
  await page.goto('/neighbors.html');
  await expect.poll(() => askedCode(page)).toBeTruthy();
  await page.evaluate((c) => document.querySelector('#prompt').neighborTestApi.play(c), code);
  await expect.poll(() => askedCode(page)).toBe(code);
}

async function type(page, name) {
  await page.fill('#answer-input', name);
  await page.press('#answer-input', 'Enter');
}

const status = (page) => page.locator('#neighbor-status');
const feedback = (page) => page.locator('#feedback');
const chips = (page) => page.locator('#neighbor-guesses li');

test('loads without console errors, marks a country with land borders and asks for its neighbors in a text field', async ({ page }) => {
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
  await expect(page.locator('#stat-solved')).toHaveText('0');
  await expect(page.locator('#legend')).toHaveCount(0);
  await expect(page.locator('#score-limit')).toHaveCount(0);
  await expect(page.locator('#filter-summary')).toHaveText('164 Länder werden abgefragt.');
  await expect(page.locator('#answer-input')).toBeFocused();
  await expect(page.locator('#answer-input')).toHaveAttribute('placeholder', 'Nachbarland …');
  await expect(page.locator('#submit-btn')).toHaveText('Prüfen');
  await expect(page.locator('#recenter-btn')).toBeVisible();
  expect(problems).toEqual([]);
});

test('the globe shows no borders and no colors, even after a round', async ({ page }) => {
  await askOnly(page, 'PT');
  expect(await mapApi(page, 'hidesBorders')).toBe(true);
  await expect(page.locator('#map')).toHaveAttribute('aria-label', 'Globus ohne Grenzen');
  const plain = await mapApi(page, 'colorOf', 'FR');
  expect(await mapApi(page, 'colorOf', 'PT')).toBe(plain);
  await type(page, 'Spanien');
  await expect(feedback(page)).toHaveText('Richtig! Den einzigen Nachbarn gefunden, ohne Fehler');
  for (const code of ['PT', 'ES', 'DE']) expect(await mapApi(page, 'colorOf', code)).toBe(plain);
});

test('the question takes the article of the country', async ({ page }) => {
  await askOnly(page, 'CH');
  await expect(page.locator('#prompt p').first()).toHaveText('Welche Länder grenzen an die Schweiz?');
  await expect(page.locator('#prompt-name')).toHaveText('Schweiz');
  await askOnly(page, 'DE');
  await expect(page.locator('#prompt p').first()).toHaveText('Welche Länder grenzen an Deutschland?');
});

test('typing every neighbor outlines them green, lists them, is correct and moves on by itself', async ({ page }) => {
  await askOnly(page, 'BE');
  await type(page, 'Frankreich');
  await expect(feedback(page)).toHaveText('Nachbar: Frankreich');
  await expect(status(page)).toHaveText('1 von 4 gefunden · noch 3 Fehlversuche');
  await expect(page.locator('#answer-input')).toHaveValue('');
  await expect(page.locator('#answer-input')).toBeFocused();
  expect(await mapApi(page, 'flashing')).toEqual({ code: 'FR', kind: 'good' });
  // The usual tolerance: other names and small typos count.
  await type(page, 'deutschland');
  await type(page, 'Holland');
  await expect(status(page)).toHaveText('3 von 4 gefunden · noch 3 Fehlversuche');
  await expect(chips(page)).toHaveText(['Frankreich', 'Deutschland', 'Niederlande']);
  await expect(chips(page).first()).toHaveClass(/step/);
  expect(await stored(page)).not.toHaveProperty('rounds');

  await type(page, 'Luxenburg');
  await expect(feedback(page)).toHaveText('Richtig! Alle 4 Nachbarn gefunden, ohne Fehler');
  await expect(status(page)).toHaveText('4 von 4 gefunden');
  expect(await mapApi(page, 'targetColors')).toEqual({ BE: 'var(--target)', FR: GREEN, DE: GREEN, NL: GREEN, LU: GREEN });
  expect((await stored(page)).rounds).toEqual({ played: 1, solved: 1, perfect: 1, streak: 1, bestStreak: 1 });
  expect((await stored(page)).countries).toEqual({});
  await expect(page.locator('#stat-solved')).toHaveText('1');
  await expect(page.locator('#stat-perfect')).toHaveText('1');
  await expect(page.locator('#stat-streak')).toHaveText('1');
  expect(await mapApi(page, 'flashing')).toEqual({ code: 'BE', kind: 'good' });

  // Another country follows, with fresh outlines.
  await expect(feedback(page)).toHaveText('', { timeout: 5000 });
  expect(await mapApi(page, 'targetCodes')).toHaveLength(1);
  expect(await askedCode(page)).not.toBe('BE');
  await expect(status(page)).toHaveText(/^0 von \d+ gefunden · noch 3 Fehlversuche$/);
  await expect(chips(page)).toHaveCount(0);
  await expect(page.locator('#submit-btn')).toHaveText('Prüfen');
});

test('a round with a wrong guess is solved, but not without mistakes; Enter skips the pause', async ({ page }) => {
  await askOnly(page, 'PT');
  await type(page, 'Frankreich');
  await type(page, 'Spanien');
  await expect(feedback(page)).toHaveText('Richtig! Den einzigen Nachbarn gefunden');
  expect((await stored(page)).rounds).toEqual({ played: 1, solved: 1, perfect: 0, streak: 1, bestStreak: 1 });
  expect(await mapApi(page, 'flashing')).toEqual({ code: 'PT', kind: 'good' });
  await expect(page.locator('#submit-btn')).toHaveText('Weiter');
  await page.press('#answer-input', 'Enter');
  await expect(feedback(page)).toHaveText('');
  expect(await askedCode(page)).not.toBe('PT');
  await expect(page.locator('#submit-btn')).toHaveText('Prüfen');
});

test('the round statistics survive a reload', async ({ page }) => {
  await askOnly(page, 'PT');
  await type(page, 'Spanien');
  await expect(page.locator('#stat-solved')).toHaveText('1');
  await page.reload();
  await expect.poll(() => askedCode(page)).toBeTruthy();
  await expect(page.locator('#stat-solved')).toHaveText('1');
  await expect(page.locator('#stat-perfect')).toHaveText('1');
  await expect(page.locator('#stat-streak')).toHaveText('1');
  await expect(page.locator('#progress')).toHaveAttribute('aria-valuenow', '100');
});

test('a wrong country outlines it red and costs a guess; unknown, ambiguous, repeated names and the country itself cost nothing', async ({ page }) => {
  await askOnly(page, 'AO');
  await type(page, 'Kenia');
  await expect(feedback(page)).toHaveText('Kein Nachbar: Kenia');
  await expect(status(page)).toHaveText('0 von 4 gefunden · noch 2 Fehlversuche');
  expect(await mapApi(page, 'targetColors')).toMatchObject({ KE: RED });
  expect(await mapApi(page, 'flashing')).toEqual({ code: 'KE', kind: 'bad' });
  await expect(chips(page)).toHaveText(['Kenia']);
  await expect(chips(page).first()).toHaveClass(/detour/);

  await type(page, 'Kenia');
  await expect(feedback(page)).toHaveText('Kenia hast du schon genannt.');
  await type(page, 'Angola');
  await expect(feedback(page)).toHaveText('Das ist das markierte Land selbst.');
  await type(page, 'Atlantis');
  await expect(feedback(page)).toHaveText('Kein Land mit diesem Namen.');
  // An unclear name stays in the field, so it can be corrected.
  await expect(page.locator('#answer-input')).toHaveValue('Atlantis');
  await type(page, 'Kongo');
  await expect(feedback(page)).toHaveText(/^Meinst du /);
  await expect(status(page)).toHaveText('0 von 4 gefunden · noch 2 Fehlversuche');
  expect(await stored(page)).not.toHaveProperty('rounds');
});

test('the third wrong country ends the round and shows the missing neighbors in orange', async ({ page }) => {
  await askOnly(page, 'BE');
  await type(page, 'Niederlande');
  for (const name of ['Spanien', 'Italien']) await type(page, name);
  await type(page, 'Polen');
  await expect(feedback(page)).toHaveText('Vorbei! Gefehlt haben: Deutschland, Frankreich, Luxemburg');
  await expect(status(page)).toHaveText('1 von 4 gefunden');
  expect(await mapApi(page, 'targetColors')).toEqual({
    BE: 'var(--target)', NL: GREEN, ES: RED, IT: RED, PL: RED, DE: ORANGE, FR: ORANGE, LU: ORANGE,
  });
  await expect(chips(page)).toHaveText(['Niederlande', 'Spanien', 'Italien', 'Polen', 'Deutschland', 'Frankreich', 'Luxemburg']);
  await expect(chips(page).last()).toHaveClass(/missing/);
  expect((await stored(page)).rounds).toEqual({ played: 1, solved: 0, perfect: 0, streak: 0, bestStreak: 0 });
  expect(await mapApi(page, 'flashing')).toEqual({ code: 'BE', kind: 'bad' });

  // It waits for the player.
  await page.waitForTimeout(2000);
  await expect(feedback(page)).toHaveClass(/bad/);
  await expect(page.locator('#submit-btn')).toHaveText('Weiter');
  await expect(page.locator('#dont-know-btn')).toBeDisabled();
  await page.press('#answer-input', 'Enter');
  await expect(feedback(page)).toHaveText('');
  expect(await askedCode(page)).not.toBe('BE');
  expect(await mapApi(page, 'targetCodes')).toHaveLength(1);
  expect((await stored(page)).rounds.played).toBe(1);
});

test('"Weiß ich nicht" shows the missing neighbors and counts as wrong', async ({ page }) => {
  await askOnly(page, 'PT');
  await page.click('#dont-know-btn');
  await expect(feedback(page)).toHaveText('Schade! Gefehlt hat: Spanien');
  expect(await mapApi(page, 'targetColors')).toEqual({ PT: 'var(--target)', ES: ORANGE });
  await expect(page.locator('#dont-know-btn')).toBeDisabled();
  await expect(page.locator('#answer-input')).toBeFocused();
  await page.click('#submit-btn');
  await expect(feedback(page)).toHaveText('');
});

test('a click on the globe answers nothing', async ({ page }) => {
  await askOnly(page, 'BE');
  const { x, y } = await page.evaluate(async () => {
    const api = document.querySelector('#map').mapTestApi;
    api.zoomTo('FR');
    await new Promise(requestAnimationFrame);
    return api.pointOf('FR');
  });
  await page.mouse.click(x, y);
  await expect(feedback(page)).toHaveText('');
  await expect(status(page)).toHaveText('0 von 4 gefunden · noch 3 Fehlversuche');
});

test('on an English page the question and messages are English, and only English names count', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('countryquiz.language', 'en'));
  await askOnly(page, 'NL');
  await expect(page.locator('h1')).toHaveText('Find the Neighbors');
  await expect(page.locator('#prompt p').first()).toHaveText('Which countries border the Netherlands?');
  await expect(page.locator('#answer-input')).toHaveAttribute('placeholder', 'Neighboring country …');
  await expect(status(page)).toHaveText('0 of 2 found · 3 wrong guesses left');
  await type(page, 'Belgium');
  await expect(feedback(page)).toHaveText('Neighbor: Belgium');
  await type(page, 'Frankreich');
  await expect(feedback(page)).toHaveText('No country by that name.');
  await type(page, 'France');
  await expect(feedback(page)).toHaveText('Not a neighbor: France');
  await expect(status(page)).toHaveText('1 of 2 found · 2 wrong guesses left');
});
