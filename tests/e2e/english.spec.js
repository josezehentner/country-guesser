import { expect, test } from '@playwright/test';

// An English browser: every page comes up in English.
test.use({ locale: 'en-US' });

const PAGES = ['index.html', 'name-countries.html', 'find-countries.html', 'capitals.html', 'find-capitals.html', 'flags.html', 'silhouettes.html', 'borders.html'];
const LANGUAGE_KEY = 'countryquiz.language';

function targetCode(page) {
  return page.evaluate(() => document.querySelector('#map').mapTestApi?.targetCode());
}

async function openMode(page, file) {
  await page.goto(`/${file}`);
  await expect(page.locator('#loading')).toBeHidden();
}

// Every text and every label, title, placeholder and alt text of a document.
function textsOf(doc) {
  const texts = new Set();
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.currentNode; node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) texts.add(node.textContent.trim());
    else for (const name of ['aria-label', 'title', 'placeholder', 'alt']) texts.add(node.getAttribute(name)?.trim());
  }
  texts.add(doc.title);
  return [...texts].filter((text) => text && /\p{L}{2}/u.test(text));
}

test('every page is fully in English: no German text of the page is left', async ({ page }) => {
  // Shown the same in both languages.
  const same = new Set(['Country Guesser', 'DE', 'EN', 'Deutsch', 'English']);
  for (const file of PAGES) {
    await page.goto(`/${file}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).not.toHaveAttribute('data-translating', '');
    const left = await page.evaluate(async ([texts, url, keep]) => {
      const collect = new Function(`return (${texts})`)();
      const german = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/html');
      const english = new Set(collect(document));
      return collect(german).filter((text) => english.has(text) && !keep.includes(text));
    }, [textsOf.toString(), `/${file}`, [...same]]);
    expect(left, file).toEqual([]);
  }
});

test('the menu switches to German and back, and every page keeps the choice', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h2').first()).toHaveText('Name the Country');
  await expect(page.locator('.menu-language [data-language="en"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('.menu-language [data-language="de"]');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('h2').first()).toHaveText('Länder benennen');
  await expect(page.locator('.menu-language [data-language="de"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_KEY)).toBe('de');
  await page.click('a.mode-card >> nth=0');
  await expect(page.locator('h1')).toHaveText('Länder benennen');
  await page.goto('/');
  await page.click('.menu-language [data-language="en"]');
  await expect(page.locator('h2').first()).toHaveText('Name the Country');
});

test('the settings of a mode switch the language and keep the progress', async ({ page }) => {
  await openMode(page, 'name-countries.html');
  await page.click('#dont-know-btn');
  const before = await page.evaluate(() => localStorage.getItem('countryquiz.v1'));
  await page.click('#settings-btn');
  await expect(page.locator('#settings [data-language="en"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#settings [data-language="de"]');
  await expect(page.locator('h1')).toHaveText('Länder benennen');
  await expect(page.locator('#submit-btn')).toHaveText('Prüfen');
  expect(await page.evaluate(() => localStorage.getItem('countryquiz.v1'))).toBe(before);
});

test('"Name the Country" takes English names and answers in English', async ({ page }) => {
  await openMode(page, 'name-countries.html');
  await expect(page.locator('#prompt')).toHaveText('Which country is marked?');
  await expect(page.locator('#submit-btn')).toHaveText('Check');
  const name = await page.evaluate(async (code) => (await import('/data/countries.js')).COUNTRY_BY_CODE.get(code).names.en, await targetCode(page));
  await page.fill('#answer-input', name);
  await page.press('#answer-input', 'Enter');
  await expect(page.locator('#feedback .verdict')).toHaveText('Correct!');
  await expect(page.locator('#feedback .feedback-text')).toHaveText(name);
  await expect.poll(() => page.locator('#feedback').textContent()).toBe('');
  const phrase = await page.evaluate(async (code) => (await import('/src/grammar.js')).countryPhrase(code), await targetCode(page));
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback .verdict')).toHaveText('Too bad!');
  await expect(page.locator('#feedback .feedback-text')).toHaveText(`That’s ${phrase}`);
  await expect(page.locator('#submit-btn')).toHaveText('Next');
});

test('the filters and the guide are in English', async ({ page }) => {
  await openMode(page, 'name-countries.html');
  await expect(page.locator('#region-filters .filter-option').first()).toContainText('Europe');
  await expect(page.locator('#level-filters .filter-option').first()).toContainText('Easy');
  await expect(page.locator('#filter-summary')).toHaveText(/^\d+ countries in the quiz\.$/);
  await page.click('#help-btn');
  await expect(page.locator('#intro .intro-kicker')).toHaveText('How to play');
  await expect(page.locator('#intro h2')).toHaveText('Name the Country');
  await expect(page.locator('#intro-close')).toHaveText('Let’s go!');
});

test('"Find the Country" asks in English', async ({ page }) => {
  await openMode(page, 'find-countries.html');
  await expect(page.locator('#prompt')).toHaveText(/^Where is (the )?\S.*\?$/);
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback .verdict')).toHaveText('Too bad!');
  await expect(page.locator('#feedback .feedback-text')).toHaveText(/ is here$/);
  await expect(page.locator('#next-btn')).toHaveText('Next');
});

test('"Learn Capitals" takes English capitals and shows them', async ({ page }) => {
  await openMode(page, 'capitals.html');
  const [capital, label] = await page.evaluate(async (code) => {
    const { capitalOf, capitalLabel } = await import('/data/capitals.js');
    return [capitalOf(code).name, capitalLabel(code)];
  }, await targetCode(page));
  await page.fill('#answer-input', capital);
  await page.press('#answer-input', 'Enter');
  await expect(page.locator('#feedback .verdict')).toHaveText('Correct!');
  await expect(page.locator('#feedback .feedback-text')).toContainText(label);
});

test('"Border Hopper" plays in English', async ({ page }) => {
  await page.goto('/borders.html');
  await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('#prompt').routeTestApi))).toBe(true);
  await page.evaluate(() => document.querySelector('#prompt').routeTestApi.play('NL', 'PL'));
  await expect(page.locator('.route-ends')).toHaveText('From the Netherlands to Poland');
  await expect(page.locator('#route-status')).toHaveText('5 guesses left · at least 1 country between');
  for (const [name, text] of [
    ['Deutschland', 'No country by that name.'],
    ['Poland', 'Poland is the end.'],
    ['Belgium', 'Belgium is a detour.'],
  ]) {
    await page.fill('#answer-input', name);
    await page.press('#answer-input', 'Enter');
    await expect(page.locator('#feedback')).toContainText(text);
  }
  await page.fill('#answer-input', 'Germany');
  await page.press('#answer-input', 'Enter');
  await expect(page.locator('#feedback .verdict')).toHaveText('Made it!');
  await expect(page.locator('#feedback .feedback-text')).toHaveText('With 2 countries, 1 would have done.');
  await expect(page.locator('#route-guesses li')).toHaveText(['Belgium', 'Germany']);
});
