import { expect, test } from '@playwright/test';

test('the menu shows each mode as a card with picture, name and description', async ({ page }) => {
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Country Guesser');
  await expect(page).toHaveTitle('Country Guesser');
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('1em Bangers'); })).toBe(true);
  const card = page.locator('a.mode-card', { hasText: 'Länder benennen' });
  await expect(card.locator('h2')).toHaveText('Länder benennen');
  await expect(card.locator('p')).toHaveText('Markiertes Land erkennen und benennen.');
  expect(await card.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(problems).toEqual([]);
});

test('the menu has the comic world map as background', async ({ page }) => {
  const responses = [];
  page.on('response', (response) => responses.push([response.url(), response.status()]));
  await page.goto('/');
  const background = await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage);
  expect(background).toContain('images/menu-background.svg');
  await expect.poll(() => responses.find(([url]) => url.endsWith('/images/menu-background.svg'))?.[1]).toBe(200);
});

test('a card opens its mode, and the mode leads back to the menu', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Länder benennen');
  await expect(page).toHaveURL(/name-countries\.html$/);
  await expect(page.locator('h1')).toHaveText('Länder benennen');
  await page.click('text=Menü');
  await expect(page.locator('h1')).toHaveText('Country Guesser');
});

test('the "Länder finden" card opens its mode', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('a.mode-card', { hasText: 'Länder finden' });
  await expect(card.locator('p')).toHaveText('Genanntes Land auf dem Globus finden.');
  expect(await card.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await card.click();
  await expect(page).toHaveURL(/find-countries\.html$/);
  await expect(page.locator('h1')).toHaveText('Länder finden');
});

test('the "Hauptstädte lernen" card opens its mode', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('a.mode-card', { hasText: 'Hauptstädte lernen' });
  await expect(card.locator('p')).toHaveText('Hauptstadt des markierten Landes nennen.');
  expect(await card.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await card.click();
  await expect(page).toHaveURL(/capitals\.html$/);
  await expect(page.locator('h1')).toHaveText('Hauptstädte lernen');
});

test('cards work with the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('a.mode-card').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/name-countries\.html$/);
});

test('the "Hauptstädte finden" card opens its mode', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('a.mode-card', { hasText: 'Hauptstädte finden' });
  await expect(card.locator('p')).toHaveText('Land zur genannten Hauptstadt finden.');
  expect(await card.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await card.click();
  await expect(page).toHaveURL(/find-capitals\.html$/);
  await expect(page.locator('h1')).toHaveText('Hauptstädte finden');
});

test('the "Flaggen erkennen" card opens its mode', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('a.mode-card', { hasText: 'Flaggen erkennen' });
  await expect(card.locator('p')).toHaveText('Land zur gezeigten Flagge nennen.');
  expect(await card.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await card.click();
  await expect(page).toHaveURL(/flags\.html$/);
  await expect(page.locator('h1')).toHaveText('Flaggen erkennen');
});

test('the "Grenzgänger" card opens its mode', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('a.mode-card', { hasText: 'Grenzgänger' });
  await expect(card.locator('p')).toHaveText('Über Landgrenzen von Land zu Land.');
  expect(await card.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await card.click();
  await expect(page).toHaveURL(/borders\.html$/);
  await expect(page.locator('h1')).toHaveText('Grenzgänger');
});

// Every mode is ready, so no card is left as "Demnächst".
test('every card is a link to a mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.mode-card')).toHaveCount(6);
  await expect(page.locator('.mode-card.soon')).toHaveCount(0);
  await expect(page.locator('a.mode-card')).toHaveCount(6);
});

test.describe('on a desktop screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the menu shows four cards side by side', async ({ page }) => {
    await page.goto('/');
    const tops = await page.locator('.mode-card').evaluateAll(
      (cards) => cards.map((card) => Math.round(card.getBoundingClientRect().top)),
    );
    expect(new Set(tops.slice(0, 4)).size).toBe(1);
    expect(tops[4]).toBeGreaterThan(tops[0]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test('the menu has no horizontal scrollbar and cards can be tapped', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.tap('a.mode-card');
    await expect(page).toHaveURL(/name-countries\.html$/);
  });
});
