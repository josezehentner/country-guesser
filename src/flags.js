// "Flaggen erkennen": a flag is shown above the globe and the player types its
// country. The globe shows where the country lies once the question is answered.
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { FLAG_COUNTRIES, flagUrl, lookalikesOf } from '../data/flags.js';
import { enableArrowKeys } from './answer-keys.js';
import { byId, startGame } from './game.js';
import { isCorrectFlag } from './quiz.js';
import { t } from './text.js';

const form = byId('answer-form');
const input = byId('answer-input');
const submitButton = byId('submit-btn');
const dontKnowButton = byId('dont-know-btn');
const flag = byId('flag');

const focusInput = () => input.focus({ preventScroll: true });

// Names the country, and any country whose flag looks the same. In a sentence the
// country takes its article: "Das ist der Tschad (gleiche Flagge wie Rumänien)".
function answer(game, correct, wrongVerdict) {
  const { code } = game.current;
  const name = correct ? COUNTRY_BY_CODE.get(code).name : t.thatIs(code);
  game.finish(correct, correct ? t.right : wrongVerdict, `${name}${t.sameFlag(lookalikesOf(code))}`);
}

startGame({
  intro: 'flags',
  storageKey: 'countryquiz.flags.v1',
  exportPrefix: 'countryquiz-flags-progress',
  // Territories that fly another entry's flag, and Antarctica, are not asked.
  countries: FLAG_COUNTRIES,
  // Long enough to see where the country lies. Typing the next answer skips it.
  nextDelayMs: 1000,

  setup(game) {
    enableArrowKeys(form);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (game.isAnswered) game.nextQuestion();
      else if (input.value.trim()) answer(game, isCorrectFlag(input.value, game.current.code), t.wrong);
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
    flag.src = flagUrl(game.current.code);
    flag.hidden = false;
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
