import { expect, test } from '@playwright/test';

// A new player: no guide read yet (playwright.config.js marks them read for the
// other tests).
test.use({ storageState: { cookies: [], origins: [] } });

const MODES = [
  { path: 'name-countries.html', title: 'Länder benennen', focus: '#answer-input' },
  { path: 'find-countries.html', title: 'Länder finden', focus: '#prompt' },
  { path: 'capitals.html', title: 'Hauptstädte lernen', focus: '#answer-input' },
  { path: 'find-capitals.html', title: 'Hauptstädte finden', focus: '#prompt' },
  { path: 'flags.html', title: 'Flaggen erkennen', focus: '#answer-input' },
  { path: 'borders.html', title: 'Grenzgänger', focus: '#answer-input' },
];

const intro = (page) => page.locator('#intro');
const mapReady = (page) => expect(page.locator('#loading')).toBeHidden();

for (const { path, title, focus } of MODES) {
  test(`${title}: the guide opens on the first visit, closes into the game and opens again with "?"`, async ({ page }) => {
    await page.goto(`/${path}`);
    await expect(intro(page)).toBeVisible();
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    await expect(page.locator('#intro-close')).toBeFocused();
    await mapReady(page);

    await page.click('#intro-close');
    await expect(intro(page)).toBeHidden();
    await expect(page.locator(focus)).toBeFocused();

    // Read once, it does not come back by itself.
    await page.reload();
    await mapReady(page);
    await expect(intro(page)).toBeHidden();

    await page.click('#help-btn');
    await expect(intro(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(intro(page)).toBeHidden();
  });
}

test('the guide explains the filters, the scale with its slider, and every score color', async ({ page }) => {
  await page.goto('/name-countries.html');
  const dialog = intro(page);
  for (const heading of ['Spielregeln', 'Links: Filter', 'Rechts: Wissensstufen', 'Farben', 'Bedienung']) {
    await expect(dialog.getByRole('heading', { name: heading, level: 3 })).toBeVisible();
  }
  await expect(dialog).toContainText('Schieber');
  // Never asked, 0, 1 to 10, the highlight and the two flashes.
  await expect(dialog.locator('.swatch')).toHaveCount(1 + 1 + 10 + 1 + 2);
  const scoreColor = (score) => page.evaluate((token) => {
    const probe = document.createElement('span');
    probe.style.background = `var(${token})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, `--score-${score}`);
  await expect(dialog.locator('.swatch', { hasText: /^7$/ })).toHaveCSS('background-color', await scoreColor(7));
});

test('"Grenzgänger" explains its route colors and has no score scale', async ({ page }) => {
  await page.goto('/borders.html');
  const dialog = intro(page);
  await expect(dialog.getByRole('heading', { name: 'Rechts: Wissensstufen' })).toHaveCount(0);
  for (const text of ['Dunkelblau: Start und Ziel', 'Grün: liegt auf einem kürzesten Weg', 'Rot: ein Umweg', 'Orange: hat am Ende noch gefehlt']) {
    await expect(dialog).toContainText(text);
  }
  await expect(dialog.locator('.swatch')).toHaveCount(5);
});

test('a click on the backdrop closes the guide, a click inside it does not', async ({ page }) => {
  await page.goto('/name-countries.html');
  await page.locator('#intro .intro-body').click();
  await expect(intro(page)).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(intro(page)).toBeHidden();
});

test('each mode remembers its own guide', async ({ page }) => {
  await page.goto('/name-countries.html');
  await page.click('#intro-close');
  await page.goto('/find-countries.html');
  await expect(intro(page)).toBeVisible();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test('the guide fits the screen and its button stays in reach', async ({ page }) => {
    await page.goto('/name-countries.html');
    const box = await intro(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.y + box.height).toBeLessThanOrEqual(667);
    await expect(page.locator('#intro-close')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.tap('#intro-close');
    await expect(intro(page)).toBeHidden();
  });
});
