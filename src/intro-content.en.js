// The guides of src/intro-content.js in English, with the same sections, colors and
// order, so both languages explain the same game.

const SCORE_SCALE = Array.from({ length: 10 }, (_, i) => ({ color: `var(--score-${i + 1})`, label: String(i + 1) }));

const NEXT_AFTER_TYPING =
  'After a correct answer the next country comes up by itself. After a wrong one you see the answer and press Enter to go on.';
const NEXT_AFTER_CLICK =
  'If you are wrong, the globe turns to the right country. Go on with “Next”, Enter or a click on the globe.';
const DONT_KNOW = '“Don’t know” shows the answer and counts as wrong.';
const TOLERANCE = 'Upper and lower case, missing accents and small typos don’t matter.';

const FILTERS_TAB = 'The “Filters” tab on the left edge opens and closes them. With the mouse at the left edge they slide in for a moment.';

const FILTERS = {
  heading: 'Left: Filters',
  items: [
    'Choose which countries come up: by region and by difficulty. Both combine, e.g. only the easy countries of Africa.',
    'The number next to each checkbox says how many countries belong to it. Below it you see how many are in the quiz right now.',
    FILTERS_TAB,
  ],
};

const SCALE = {
  heading: 'Right: Levels',
  items: [
    'The bar from 0 to 10 shows which color belongs to which score. On a phone it sits at the bottom, above the input field.',
    'With the slider next to it you leave out countries you already know well: at 7, countries with 8, 9 or 10 points no longer come up. Countries never asked always stay in.',
  ],
};

const SCORE_COLORS = {
  heading: 'Colors',
  items: [
    { swatches: [{ color: 'var(--never)' }], text: 'Beige: never asked' },
    { swatches: [{ color: 'var(--score-zero)', label: '0' }], text: 'Gray: 0 points' },
    { swatches: SCORE_SCALE, text: 'From red over yellow to green: 1 to 10 points. Green means mastered.' },
    { swatches: [{ color: 'var(--never)', ring: true }], text: 'Light green outline: the marked country' },
    { swatches: [{ color: 'var(--flash-good)' }, { color: 'var(--flash-bad)' }], text: 'After your answer the country lights up green (correct) or flashes red (wrong).' },
    'A first correct answer gives 5 points, a wrong one 3. After that every correct answer adds a point, every wrong one or “Don’t know” takes one away. What you don’t know well yet comes up more often.',
  ],
};

const controls = (recenter) => ({
  heading: 'Controls',
  items: [
    'Drag to turn the globe, use the mouse wheel or two fingers to zoom.',
    recenter,
    'The numbers at the top show how many countries you have mastered, started and never seen. The bar shows your overall progress.',
    '⚙ saves, loads or deletes your progress. ? opens this guide again.',
  ],
});

const RECENTER_MARKED = '⌖ “To country” at the top right turns the globe back to the marked country.';
const RECENTER_AFTER = '⌖ “To country” at the top right appears after your answer and turns the globe back to the country.';

const scoreGuide = (title, rules, recenter) => ({
  title,
  sections: [{ heading: 'Rules', items: rules }, FILTERS, SCALE, SCORE_COLORS, controls(recenter)],
});

export const INTROS_EN = {
  name: scoreGuide('Name the Country', [
    'A country on the globe is marked. Type its name and press Enter.',
    `${TOLERANCE} Well-known other names like “USA” or “UK” count too.`,
    NEXT_AFTER_TYPING,
    DONT_KNOW,
  ], RECENTER_MARKED),

  find: scoreGuide('Find the Country', [
    'The game names a country. Turn the globe and click or tap it.',
    'For very small countries a click just next to them is enough. A click on the sea does not count.',
    NEXT_AFTER_CLICK,
    DONT_KNOW,
  ], RECENTER_AFTER),

  capitals: scoreGuide('Learn Capitals', [
    'A country on the globe is marked. Type its capital and press Enter.',
    `${TOLERANCE} English and local names count, e.g. “Prague” or “Praha”. If a country has several capitals, each one is correct.`,
    NEXT_AFTER_TYPING,
    DONT_KNOW,
  ], RECENTER_MARKED),

  'find-capitals': scoreGuide('Find the Capital', [
    'The game names a capital. Click or tap the country it belongs to.',
    'If two places share the name, e.g. Kingston in Jamaica and on Norfolk Island, either country is correct.',
    NEXT_AFTER_CLICK,
    DONT_KNOW,
  ], RECENTER_AFTER),

  flags: scoreGuide('Guess the Flag', [
    'You see a flag at the top. Type the country it belongs to and press Enter.',
    `${TOLERANCE} If two flags look the same, e.g. those of Monaco and Indonesia, either country is correct.`,
    'Then the globe turns to the country, so you also learn where it lies.',
    DONT_KNOW,
  ], RECENTER_AFTER),

  borders: {
    title: 'Border Hopper',
    sections: [
      {
        heading: 'Rules',
        items: [
          'You get a start and an end country on a globe without borders.',
          'Name the countries in between, in any order, until their land borders connect start and end. Bridges and tunnels don’t count.',
          'You have as many guesses as the shortest route needs countries, plus four. How many are left is shown below the question.',
          '“Don’t know” ends the round and shows which countries were missing.',
        ],
      },
      {
        heading: 'Left: Filters',
        items: [
          'Choose the regions a round lies in: start, end and a shortest route are then all inside them.',
          FILTERS_TAB,
        ],
      },
      {
        heading: 'Colors',
        items: [
          { swatches: [{ color: 'var(--route-start)' }, { color: 'var(--route-end)' }], text: 'Dark blue: start and end' },
          { swatches: [{ color: 'var(--route-step)' }], text: 'Green: on a shortest route' },
          { swatches: [{ color: 'var(--route-detour)' }], text: 'Red: a detour, still costs a guess' },
          { swatches: [{ color: 'var(--route-missing)' }], text: 'Orange: was still missing at the end' },
          'The countries you named are listed in these colors below the question.',
        ],
      },
      {
        heading: 'Controls',
        items: [
          'Drag to turn the globe, use the mouse wheel or two fingers to zoom.',
          '⌖ “End & Start” at the top right shows end and start again.',
          'The numbers at the top count your solved rounds, those solved on a shortest route, and your streak. The bar shows the share of rounds solved.',
          '⚙ saves, loads or deletes your progress. ? opens this guide again.',
        ],
      },
    ],
  },
};
