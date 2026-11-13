import { expect, test } from '@playwright/test';

const KEY = 'countryquiz.borders.v1';

const mapApi = (page, method, ...args) =>
  page.evaluate(([m, a]) => document.querySelector('#map').mapTestApi[m](...a), [method, args]);
const routeApi = (page, method, ...args) =>
  page.evaluate(([m, a]) => document.querySelector('#prompt').routeTestApi[m](...a), [method, args]);

async function open(page) {
  await page.goto('/borders.html');
  await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('#prompt').routeTestApi))).toBe(true);
}

const expectCenter = (view, location) => {
  expect(view.center[0]).toBeCloseTo(location[0], 6);
  expect(view.center[1]).toBeCloseTo(location[1], 6);
};
const near = (view, location) => Math.hypot(view.center[0] - location[0], view.center[1] - location[1]) < 1e-6;

// Starts a chosen round instead of a random one.
async function play(page, start, end) {
  await routeApi(page, 'play', start, end);
  await expect(page.locator('#route-start')).not.toBeEmpty();
}

async function guess(page, name) {
  await page.fill('#answer-input', name);
  await page.press('#answer-input', 'Enter');
}

const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
const chips = (page) => page.locator('#route-guesses li');

// Whether any pixel along a line of the globe is drawn dark, like a border line.
// Land and water add up to over 600; a thin line, smoothed, to between 200 and 400.
function darkPixelAlong(page, from, to) {
  return page.evaluate(async ([a, b]) => {
    const canvas = document.querySelector('#map');
    const api = canvas.mapTestApi;
    api.lookAt([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 40);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const { x, y } = api.pointAt([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      const [r, g, bl] = context.getImageData((x - rect.left) * scale, (y - rect.top) * scale, 1, 1).data;
      if (r + g + bl < 450) return true;
    }
    return false;
  }, [from, to]);
}

test('loads without errors and asks for a route between two countries', async ({ page }) => {
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', (error) => problems.push(error.message));
  await open(page);
  await expect(page.locator('h1')).toHaveText('Grenzgänger');
  const round = await routeApi(page, 'round');
  expect(round.between).toBeGreaterThanOrEqual(3);
  expect(await mapApi(page, 'targetCodes')).toEqual([round.start, round.end]);
  expect(await mapApi(page, 'hidesBorders')).toBe(true);
  await expect(page.locator('#route-status')).toContainText(`mindestens ${round.between} Länder dazwischen`);
  await expect(page.locator('#recenter-btn')).toBeVisible();
  await expect(page.locator('#recenter-btn')).toHaveAccessibleName('Start und Ziel zeigen');
  // No legend, and only the region filter.
  await expect(page.locator('#legend')).toHaveCount(0);
  await expect(page.locator('#level-filters')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('the globe hides the borders between countries until one is named', async ({ page }) => {
  await open(page);
  await play(page, 'PT', 'PL');
  // Across the border of France and Germany near Strasbourg, and of Spain and France.
  const frDe = [[7.2, 48.6], [8.6, 48.6]];
  expect(await darkPixelAlong(page, ...frDe)).toBe(false);
  await guess(page, 'Deutschland');
  expect(await darkPixelAlong(page, ...frDe)).toBe(true);
});

test('coasts keep their line, and the small entries show no outline inside their neighbors', async ({ page }) => {
  await open(page);
  await play(page, 'PT', 'PL');
  // From the Atlantic onto France, and from the sea onto Monaco and Gibraltar.
  expect(await darkPixelAlong(page, [-2.6, 46.6], [-1.2, 46.6])).toBe(true);
  expect(await darkPixelAlong(page, [7.42, 43.70], [7.42, 43.76])).toBe(true);
  expect(await darkPixelAlong(page, [-5.40, 36.12], [-5.33, 36.12])).toBe(true);
  // Across San Marino, Vatican City and Liechtenstein, and across Lesotho.
  expect(await darkPixelAlong(page, [12.30, 43.94], [12.60, 43.94])).toBe(false);
  expect(await darkPixelAlong(page, [12.40, 41.90], [12.50, 41.90])).toBe(false);
  expect(await darkPixelAlong(page, [9.40, 47.15], [9.70, 47.15])).toBe(false);
  expect(await darkPixelAlong(page, [26.8, -29.5], [29.6, -29.5])).toBe(false);
});

// The borderless land once drew a thick ink line along every border, half hidden by
// the fill again, which made each frame three times slower than in the other modes.
test('the borderless globe draws no line thicker than the other modes do', async ({ page }) => {
  const widthsOn = async (url) => {
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('#map').mapTestApi && document.querySelector('#loading').hidden);
    return page.evaluate(async () => {
      const canvas = document.querySelector('#map');
      const context = canvas.getContext('2d');
      const widths = new Set();
      const stroke = context.stroke;
      context.stroke = function (...args) {
        widths.add(this.lineWidth);
        return stroke.apply(this, args);
      };
      canvas.mapTestApi.lookAt([10, 50], 1);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      context.stroke = stroke;
      return Math.max(...widths);
    });
  };
  const elsewhere = await widthsOn('/name-countries.html');
  expect(await widthsOn('/borders.html')).toBeLessThanOrEqual(elsewhere);
});

test('naming the countries in between in any order solves the round on the shortest way', async ({ page }) => {
  await open(page);
  await play(page, 'PT', 'PL');
  await expect(page.locator('#route-start')).toHaveText('Portugal');
  await expect(page.locator('#route-end')).toHaveText('Polen');
  await expect(page.locator('#route-status')).toHaveText('Noch 7 Versuche · mindestens 3 Länder dazwischen');
  await guess(page, 'Deutschland');
  await expect(page.locator('#feedback')).toContainText('Deutschland liegt auf einem kürzesten Weg.');
  await guess(page, 'spanien');
  await expect(chips(page)).toHaveText(['Deutschland', 'Spanien']);
  await expect(page.locator('#route-status')).toHaveText('Noch 5 Versuche · mindestens 3 Länder dazwischen');
  expect(await mapApi(page, 'colorOf', 'ES')).not.toBe(await mapApi(page, 'colorOf', 'IT'));
  await guess(page, 'Frankreich');
  await expect(page.locator('#feedback .verdict')).toHaveText('Geschafft!');
  await expect(page.locator('#feedback')).toContainText('Kürzester Weg!');
  await expect(page.locator('#submit-btn')).toHaveText('Weiter');
  await expect(page.locator('#stat-solved')).toHaveText('1');
  await expect(page.locator('#stat-perfect')).toHaveText('1');
  await expect(page.locator('#stat-streak')).toHaveText('1');
  expect((await stored(page)).rounds).toEqual({ played: 1, solved: 1, perfect: 1, streak: 1, bestStreak: 1 });
  // Enter moves on to a new round with a clean globe.
  await page.press('#answer-input', 'Enter');
  await expect(page.locator('#submit-btn')).toHaveText('Prüfen');
  await expect(chips(page)).toHaveCount(0);
  expect(await mapApi(page, 'colorOf', 'ES')).toBe(await mapApi(page, 'colorOf', 'IT'));
});

test('countries with an article keep it in the question and the hints', async ({ page }) => {
  await open(page);
  await play(page, 'CH', 'NL');
  await expect(page.locator('.route-ends')).toHaveText('Von der Schweiz in die Niederlande');
  await expect(page.locator('#route-start')).toHaveText('Schweiz');
  await expect(page.locator('#route-end')).toHaveText('Niederlande');
  const cases = [
    ['Schweiz', 'Die Schweiz ist der Start.'],
    ['Niederlande', 'Die Niederlande sind das Ziel.'],
    ['Kongo', 'Meinst du die Demokratische Republik Kongo oder die Republik Kongo?'],
  ];
  for (const [name, hint] of cases) {
    await guess(page, name);
    await expect(page.locator('#feedback')).toContainText(hint);
  }
  await play(page, 'PT', 'IR');
  await expect(page.locator('.route-ends')).toHaveText('Von Portugal in den Iran');
  await play(page, 'CH', 'UA');
  await guess(page, 'Slowakei');
  await expect(page.locator('#feedback')).toContainText('Die Slowakei liegt auf einem kürzesten Weg.');
  await guess(page, 'Slowakei');
  await expect(page.locator('#feedback')).toContainText('Die Slowakei hast du schon genannt.');
  await guess(page, 'Niederlande');
  await expect(page.locator('#feedback')).toContainText('Die Niederlande sind ein Umweg.');
});

test('a detour is gray and counts as a guess, and a longer way still solves the round', async ({ page }) => {
  await open(page);
  await play(page, 'PT', 'PL');
  await guess(page, 'Spanien');
  await guess(page, 'Italien');
  await expect(page.locator('#feedback')).toContainText('Italien ist ein Umweg.');
  await expect(chips(page).nth(1)).toHaveClass(/detour/);
  await guess(page, 'Frankreich');
  await guess(page, 'Schweiz');
  await guess(page, 'Österreich');
  await guess(page, 'Tschechien');
  await expect(page.locator('#feedback .verdict')).toHaveText('Geschafft!');
  await expect(page.locator('#feedback')).toContainText('Mit 6 Ländern, 3 hätten gereicht.');
  expect((await stored(page)).rounds).toMatchObject({ solved: 1, perfect: 0 });
});

test('unknown, ambiguous, repeated names and start or end cost no guess', async ({ page }) => {
  await open(page);
  await play(page, 'PT', 'PL');
  await guess(page, 'Spanien');
  const cases = [
    ['Atlantis', 'Kein Land mit diesem Namen.'],
    ['Kongo', 'Meinst du'],
    ['Portugal', 'Portugal ist der Start.'],
    ['Polen', 'Polen ist das Ziel.'],
    ['Spanien', 'Spanien hast du schon genannt.'],
  ];
  for (const [name, hint] of cases) {
    await guess(page, name);
    await expect(page.locator('#feedback')).toContainText(hint);
  }
  await expect(page.locator('#route-status')).toHaveText('Noch 6 Versuche · mindestens 3 Länder dazwischen');
  // The field keeps the text, selected, so it can be corrected or typed over.
  await expect(page.locator('#answer-input')).toHaveValue('Spanien');
});

test('running out of guesses ends the round and shows the missing countries', async ({ page }) => {
  await open(page);
  await play(page, 'PT', 'PL');
  await guess(page, 'Spanien');
  for (const name of ['Italien', 'Griechenland', 'Schweden', 'Norwegen', 'Finnland', 'Japan']) await guess(page, name);
  await expect(page.locator('#feedback .verdict')).toHaveText('Vorbei!');
  await expect(page.locator('#feedback')).toContainText('Gefehlt haben: Frankreich, Deutschland');
  await expect(chips(page).filter({ hasText: 'Frankreich' })).toHaveClass(/missing/);
  await expect(page.locator('#dont-know-btn')).toBeDisabled();
  expect((await stored(page)).rounds).toEqual({ played: 1, solved: 0, perfect: 0, streak: 0, bestStreak: 0 });
  // Further text does not count once the round is over.
  await guess(page, 'Frankreich');
  await expect(page.locator('#submit-btn')).toHaveText('Prüfen');
});

test('"Weiß ich nicht" gives up and ends the streak', async ({ page }) => {
  await open(page);
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
    version: 1, countries: {}, settings: {}, rounds: { played: 3, solved: 3, perfect: 1, streak: 3, bestStreak: 3 },
  })), KEY);
  await open(page);
  await expect(page.locator('#stat-streak')).toHaveText('3');
  await play(page, 'PT', 'PL');
  await page.click('#dont-know-btn');
  await expect(page.locator('#feedback .verdict')).toHaveText('Schade!');
  await expect(page.locator('#feedback')).toContainText('Gefehlt haben: Spanien, Frankreich, Deutschland');
  await expect(page.locator('#stat-streak')).toHaveText('0');
  expect((await stored(page)).rounds).toEqual({ played: 4, solved: 3, perfect: 1, streak: 0, bestStreak: 3 });
});

test('start and end that fit on one side of the globe are shown together', async ({ page }) => {
  await open(page);
  await play(page, 'PT', 'PL');
  const { center } = await mapApi(page, 'routeCenter', 'PT', 'PL');
  const view = await mapApi(page, 'view');
  expect(view.center[0]).toBeCloseTo(center[0], 3);
  expect(view.center[1]).toBeCloseTo(center[1], 3);
  expect(await mapApi(page, 'touring')).toBe(false);
  for (const code of ['PT', 'PL']) expect(await mapApi(page, 'isFacing', await mapApi(page, 'centerOf', code))).toBe(true);
});

test('start and end too far apart are shown one after the other', async ({ page }) => {
  await open(page);
  await play(page, 'PT', 'CN');
  const [pt, cn] = [await mapApi(page, 'centerOf', 'PT'), await mapApi(page, 'centerOf', 'CN')];
  expectCenter(await mapApi(page, 'view'), pt);
  expect(await mapApi(page, 'touring')).toBe(true);
  await expect.poll(() => mapApi(page, 'touring'), { timeout: 5000 }).toBe(false);
  expectCenter(await mapApi(page, 'view'), cn);
  // "Start und Ziel" shows them again.
  await mapApi(page, 'lookAt', [-100, -40], 1);
  await page.click('#recenter-btn');
  expectCenter(await mapApi(page, 'view'), pt);
  await expect.poll(async () => near(await mapApi(page, 'view'), cn), { timeout: 5000 }).toBe(true);
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the flight from start to end zooms out on the way and in again', async ({ page }) => {
    await open(page);
    // Both ends are small, so the globe zooms in on each of them, and too far apart
    // to be shown together.
    await play(page, 'GM', 'KR');
    const kr = await mapApi(page, 'centerOf', 'KR');
    // Samples the zoom every frame until the globe arrives at the end.
    const zooms = await page.evaluate(async (target) => {
      const api = document.querySelector('#map').mapTestApi;
      const samples = [];
      const started = performance.now();
      while (performance.now() - started < 8000) {
        await new Promise(requestAnimationFrame);
        const { k, center } = api.view();
        samples.push(k);
        if (!api.touring() && Math.abs(center[0] - target[0]) < 1e-6 && Math.abs(center[1] - target[1]) < 1e-6) break;
      }
      return samples;
    }, kr);
    // Zoomed in on Gambia, out to the whole globe on the way, and in on Korea.
    const zoomedIn = zooms.findIndex((zoom) => zoom > 2);
    expect(zoomedIn).toBeGreaterThanOrEqual(0);
    expect(Math.min(...zooms.slice(zoomedIn))).toBeLessThan(1.2);
    expect(zooms.at(-1)).toBeGreaterThan(2);
    // Many frames, not a jump.
    expect(zooms.length).toBeGreaterThan(30);
  });

  test('the flight from start to end is quick and ends at full detail', async ({ page }) => {
    await open(page);
    await play(page, 'PT', 'CN');
    const cn = await mapApi(page, 'centerOf', 'CN');
    // Times the flight from the moment the globe leaves the start until it arrives.
    const flight = await page.evaluate(async (target) => {
      const api = document.querySelector('#map').mapTestApi;
      const started = performance.now();
      let left = null;
      let rough = false;
      while (performance.now() - started < 8000) {
        await new Promise(requestAnimationFrame);
        if (left === null && !api.touring()) left = performance.now();
        rough ||= api.roughDetail();
        const { center } = api.view();
        if (left !== null && Math.abs(center[0] - target[0]) < 1e-6 && Math.abs(center[1] - target[1]) < 1e-6) {
          return { ms: performance.now() - left, rough, roughAtEnd: api.roughDetail() };
        }
      }
      return null;
    }, cn);
    expect(flight).not.toBeNull();
    // About a second, plus frames a busy machine may drop.
    expect(flight.ms).toBeLessThan(1700);
    expect(flight.rough).toBe(true);
    expect(flight.roughAtEnd).toBe(false);
  });

  test('touching the globe during the flight stops it at full detail', async ({ page }) => {
    await open(page);
    await play(page, 'PT', 'CN');
    await expect.poll(() => mapApi(page, 'roughDetail'), { timeout: 5000 }).toBe(true);
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(600, 380, { steps: 3 });
    await page.mouse.up();
    expect(await mapApi(page, 'roughDetail')).toBe(false);
    const cn = await mapApi(page, 'centerOf', 'CN');
    expect(near(await mapApi(page, 'view'), cn)).toBe(false);
  });

  test('touching the globe during the tour stops it', async ({ page }) => {
    await open(page);
    await play(page, 'PT', 'CN');
    await page.waitForTimeout(300);
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(600, 380, { steps: 3 });
    await page.mouse.up();
    expect(await mapApi(page, 'touring')).toBe(false);
  });
});

test('a named country far away is turned into view', async ({ page }) => {
  await open(page);
  await play(page, 'PT', 'PL');
  await mapApi(page, 'lookAt', [-100, -40], 2);
  await guess(page, 'Deutschland');
  expect(await mapApi(page, 'isFacing', await mapApi(page, 'centerOf', 'DE'))).toBe(true);
});

test('the region filter keeps whole rounds in the region, and says so when it has none', async ({ page }) => {
  await open(page);
  const europe = await page.evaluate(async () => (await import('/data/countries.js')).COUNTRIES.filter((c) => c.continent === 'EU').map((c) => c.code));
  for (const input of await page.locator('#region-filters input:not([value="EU"])').all()) await input.uncheck();
  await expect(page.locator('#filter-summary')).toHaveText('Start, Ziel und kürzester Weg liegen in dieser Auswahl.');
  expect((await stored(page)).settings.regions).toEqual(['EU']);
  for (let i = 0; i < 5; i++) {
    const { start, end } = await routeApi(page, 'round');
    expect(europe).toContain(start);
    expect(europe).toContain(end);
    await page.click('#dont-know-btn');
    await page.press('#answer-input', 'Enter');
  }
  // Oceania alone has no route with three countries between: every country comes up.
  await page.check('#region-filters input[value="OC"]');
  await page.uncheck('#region-filters input[value="EU"]');
  await expect(page.locator('#filter-summary')).toContainText('keinen Weg mit mindestens drei Ländern dazwischen');
  await expect(page.locator('#filter-summary')).toHaveClass(/empty/);
  expect((await routeApi(page, 'round')).between).toBeGreaterThanOrEqual(3);
});

test('resetting the progress clears the round statistics and starts a new round', async ({ page }) => {
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await open(page);
  await play(page, 'PT', 'PL');
  for (const name of ['Spanien', 'Frankreich', 'Deutschland']) await guess(page, name);
  await expect(page.locator('#stat-solved')).toHaveText('1');
  await page.click('#settings-btn');
  await page.click('#reset-btn');
  await expect(page.locator('#stat-solved')).toHaveText('0');
  await expect(page.locator('#submit-btn')).toHaveText('Prüfen');
  expect((await stored(page)).rounds).toBeUndefined();
  expect(problems).toEqual([]);
});

test('the round statistics survive a reload', async ({ page }) => {
  await open(page);
  await play(page, 'PT', 'PL');
  for (const name of ['Spanien', 'Frankreich', 'Deutschland']) await guess(page, name);
  await expect(page.locator('#stat-solved')).toHaveText('1');
  await page.reload();
  await expect(page.locator('#stat-solved')).toHaveText('1');
  await expect(page.locator('#stat-perfect')).toHaveText('1');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test('has no horizontal scrollbar, and the caption, chips and buttons stay apart', async ({ page }) => {
    await open(page);
    await play(page, 'PT', 'PL');
    for (const name of ['Italien', 'Schweiz', 'Österreich', 'Griechenland']) await guess(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const boxes = {};
    for (const selector of ['#prompt', '#route-guesses', '#recenter-btn', '.panel']) boxes[selector] = await page.locator(selector).boundingBox();
    const apart = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
    expect(apart(boxes['#prompt'], boxes['#route-guesses'])).toBe(true);
    expect(apart(boxes['#route-guesses'], boxes['#recenter-btn'])).toBe(true);
    expect(apart(boxes['#recenter-btn'], boxes['.panel'])).toBe(true);
    await page.tap('#dont-know-btn');
    await expect(page.locator('#feedback .verdict')).toHaveText('Schade!');
  });
});
