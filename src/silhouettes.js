// "Umrisse erkennen": the outline of a country is shown above the globe and the
// player types its name. The globe shows where the country lies once the question
// is answered.
import { SILHOUETTE_COUNTRIES } from '../data/silhouettes.js';
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { enableArrowKeys } from './answer-keys.js';
import { byId, startGame } from './game.js';
import { isCorrectAnswer } from './quiz.js';
import { silhouettePath } from './silhouette.js';
import { t } from './text.js';

const form = byId('answer-form');
const input = byId('answer-input');
const submitButton = byId('submit-btn');
const dontKnowButton = byId('dont-know-btn');
const silhouette = byId('silhouette');
const path = byId('silhouette-path');

// The box of the outline in the page's viewBox, and the room left for its ink.
const [, , WIDTH, HEIGHT] = silhouette.getAttribute('viewBox').split(' ').map(Number);
const PADDING = 6;

const focusInput = () => input.focus({ preventScroll: true });

function answer(game, correct, wrongVerdict) {
  const { code } = game.current;
  game.finish(correct, correct ? t.right : wrongVerdict, correct ? COUNTRY_BY_CODE.get(code).name : t.thatIs(code));
}

startGame({
  intro: 'silhouettes',
  storageKey: 'countryquiz.silhouettes.v1',
  exportPrefix: 'countryquiz-silhouettes-progress',
  // Countries too small on the map for a recognizable outline are not asked.
  countries: SILHOUETTE_COUNTRIES,
  // Long enough to see where the country lies. Typing the next answer skips it.
  nextDelayMs: 1000,

  setup(game) {
    enableArrowKeys(form);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (game.isAnswered) game.nextQuestion();
      else if (input.value.trim()) answer(game, isCorrectAnswer(input.value, game.current.code), t.wrong);
    });
    // Typing the next answer during the pause moves on at once and keeps the letters.
    input.addEventListener('input', () => {
      if (!game.isAnswered) return;
      const typed = input.value;
      game.nextQuestion();
      input.value = typed;
    });
    dontKnowButton.addEventListener('click', () => {
      if (!game.isAnswered) answer(game, false, t.dontKnow);
    });
    input.disabled = false;
    submitButton.disabled = false;
  },

  // The globe gives nothing away: no country is marked until the answer.
  ask(game) {
    const { code } = game.current;
    path.setAttribute('d', silhouettePath(game.map.geometryOf(code), WIDTH, HEIGHT, PADDING));
    silhouette.dataset.code = code;
    silhouette.removeAttribute('hidden');
    input.value = '';
    submitButton.textContent = t.check;
    dontKnowButton.disabled = false;
    game.map.clearHighlight();
    focusInput();
  },

  answered(game) {
    game.map.highlight(game.current.code);
    // The field stays editable: a read-only field would close the phone keyboard.
    input.value = '';
    submitButton.textContent = t.next;
    dontKnowButton.disabled = true;
    focusInput();
  },

  focus: focusInput,
});
