import { expect, test } from '@playwright/test';

test('the menu shows each mode as a card with picture, name and description', async ({ page }) => {
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Länder-Quiz');
  const card = page.locator('a.mode-card', { hasText: 'Länder benennen' });
  await expect(card.locator('h2')).toHaveText('Länder benennen');
  await expect(card.locator('p')).toHaveText('Markiertes Land erkennen und benennen.');
  expect(await card.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(problems).toEqual([]);
});

test('a card opens its mode, and the mode leads back to the menu', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Länder benennen');
  await expect(page).toHaveURL(/name-countries\.html$/);
  await expect(page.locator('h1')).toHaveText('Länder benennen');
  await page.click('text=Menü');
  await expect(page.locator('h1')).toHaveText('Länder-Quiz');
});

test('cards work with the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('a.mode-card').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/name-countries\.html$/);
});

test('modes that are not ready are not links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.mode-card.soon')).toContainText('Demnächst');
  await expect(page.locator('.mode-card.soon a, a.mode-card.soon')).toHaveCount(0);
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
