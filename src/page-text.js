// The fixed text of the pages in English, and the language switch. The pages are
// written in German. On an English page every element marked with `data-i18n="key"`
// gets the English text as its content, and `data-i18n-<attribute>="key"` sets that
// attribute, e.g. `data-i18n-aria-label`. Always as plain text, never as HTML.
import { chooseLanguage, LANG } from './language.js';

export const PAGE_TEXT_EN = {
  'title.name': 'Name the Country – Country Guesser',
  'title.find': 'Find the Country – Country Guesser',
  'title.capitals': 'Learn Capitals – Country Guesser',
  'title.findCapitals': 'Find the Capital – Country Guesser',
  'title.flags': 'Guess the Flag – Country Guesser',
  'title.borders': 'Border Hopper – Country Guesser',
  'title.neighbors': 'Find the Neighbors – Country Guesser',
  'mode.name': 'Name the Country',
  'mode.find': 'Find the Country',
  'mode.capitals': 'Learn Capitals',
  'mode.findCapitals': 'Find the Capital',
  'mode.flags': 'Guess the Flag',
  'mode.borders': 'Border Hopper',
  'mode.neighbors': 'Find the Neighbors',
  'menu.name': 'Recognize and name the marked country.',
  'menu.find': 'Find the named country on the globe.',
  'menu.capitals': 'Name the capital of the marked country.',
  'menu.findCapitals': 'Find the country of the named capital.',
  'menu.flags': 'Name the country of the flag shown.',
  'menu.borders': 'Cross land borders from country to country.',
  'menu.neighbors': 'Find every neighbor of the marked country.',

  back: '← Menu',
  backLabel: 'Back to the menu',
  'stat.mastered': 'Mastered',
  'stat.started': 'Started',
  'stat.never': 'Never asked',
  'stat.solved': 'Solved',
  'stat.perfect': 'Shortest route',
  'stat.streak': 'Streak',
  'progress.total': 'Overall progress',
  'progress.rounds': 'Share of rounds solved',
  help: 'How to play',
  settings: 'Settings',

  filters: 'Filters',
  'filters.regions': 'Regions',
  'filters.levels': 'Difficulty',

  'map.globe': 'Globe',
  'map.globeNoBorders': 'Globe without borders',
  'recenter.country': 'Back to the marked country',
  'recenter.countryShort': 'To country',
  'recenter.route': 'Show end and start',
  'recenter.routeShort': 'End & Start',
  'prompt.name': 'Which country is marked?',
  'prompt.capitals': 'What is the capital of the marked country?',
  'prompt.flags': 'Which country has this flag?',
  'flag.alt': 'Flag to guess',
  'prompt.where': 'Where',
  'prompt.whereCapital': 'Where is',
  'prompt.neighbors': 'Which countries border',
  legend: 'Legend',
  'scoreLimit.label': 'Highest level still asked',
  'scoreLimit.title': 'Stop asking countries above this level',
  loading: 'Loading map …',
  'route.guesses': 'Named countries',

  'answer.name': 'Name of the marked country',
  'answer.capital': 'Capital of the marked country',
  'answer.flag': 'Country of the flag',
  'answer.route': 'Country on the way',
  'answer.neighbor': 'Neighbor of the marked country',
  'placeholder.name': 'Country name …',
  'placeholder.capital': 'Capital …',
  'placeholder.route': 'Country on the way …',
  'placeholder.neighbor': 'Neighboring country …',
  check: 'Check',
  dontKnow: 'Don’t know',
  next: 'Next',
  storageNotice: 'Note: your progress cannot be saved in this browser.',

  'settings.language': 'Language',
  'settings.progress': 'Progress',
  'settings.export': 'Export',
  'settings.import': 'Import',
  'settings.reset': 'Reset',
  'settings.done': 'Done',
};

const PREFIX = 'data-i18n';

// Translates the page into its language, then shows it: src/language-boot.js hid
// an English page until now.
export function translatePage(root = document) {
  if (LANG === 'en') {
    for (const element of root.querySelectorAll('*')) {
      for (const { name, value } of [...element.attributes]) {
        if (!name.startsWith(PREFIX) || !Object.hasOwn(PAGE_TEXT_EN, value)) continue;
        const text = PAGE_TEXT_EN[value];
        if (name === PREFIX) element.textContent = text;
        else element.setAttribute(name.slice(PREFIX.length + 1), text);
      }
    }
  }
  document.documentElement.removeAttribute('data-translating');
}

// The "DE | EN" buttons: the current language is pressed, the other one switches.
export function setupLanguageSwitch(root = document) {
  for (const button of root.querySelectorAll('[data-language]')) {
    const language = button.dataset.language;
    button.setAttribute('aria-pressed', String(language === LANG));
    button.addEventListener('click', () => chooseLanguage(language));
  }
}
