import { expect, test } from '@playwright/test';

// The modes where the player types the answer.
const PAGES = ['name-countries.html', 'capitals.html', 'flags.html'];

const caret = (page) => page.locator('#answer-input').evaluate((input) => [input.selectionStart, input.selectionEnd]);

for (const path of PAGES) {
  test.describe(path, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/${path}`);
      await expect(page.locator('#answer-input')).toBeEnabled();
      await expect(page.locator('#answer-input')).toBeFocused();
    });

    test('the arrow keys move between the field and the buttons, and back with the text kept', async ({ page }) => {
      const input = page.locator('#answer-input');
      await page.keyboard.type('Atlan');
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#submit-btn')).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#dont-know-btn')).toBeFocused();
      // The last button is the end of the row.
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#dont-know-btn')).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#submit-btn')).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(input).toBeFocused();
      await expect(input).toHaveValue('Atlan');
      expect(await caret(page)).toEqual([5, 5]);
      // The field is the start of the row.
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowLeft');
      await expect(input).toBeFocused();
    });

    test('inside the text the arrow keys still move the cursor, and Shift still selects', async ({ page }) => {
      const input = page.locator('#answer-input');
      await page.keyboard.type('Atlan');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      expect(await caret(page)).toEqual([3, 3]);
      await page.keyboard.press('ArrowRight');
      await expect(input).toBeFocused();
      expect(await caret(page)).toEqual([4, 4]);
      await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('Shift+ArrowRight');
      await expect(input).toBeFocused();
      expect(await caret(page)).toEqual([4, 5]);
      // With text selected, the arrow only ends the selection.
      await page.keyboard.press('ArrowRight');
      await expect(input).toBeFocused();
    });

    test('an empty field leaves at once, and Enter on a button presses it', async ({ page }) => {
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#dont-know-btn')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#feedback')).toHaveClass(/bad/);
      // The player continues in the field, and the disabled button is skipped.
      await expect(page.locator('#answer-input')).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#submit-btn')).toHaveText('Weiter');
      await expect(page.locator('#submit-btn')).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#submit-btn')).toBeFocused();
    });
  });
}
