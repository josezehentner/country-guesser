// "Flaggen erkennen": a flag is shown above the globe and the player types its
// country. The globe shows where the country lies once the question is answered.
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { FLAG_COUNTRIES, flagUrl, lookalikesOf } from '../data/flags.js';
import { byId, startGame } from './game.js';
import { isCorrectFlag } from './quiz.js';

const form = byId('answer-form');
const input = byId('answer-input');
const submitButton = byId('submit-btn');
const dontKnowButton = byId('dont-know-btn');
const flag = byId('flag');

const focusInput = () => input.focus({ preventScroll: true });

// Names the country, and any country whose flag looks the same.
function solution(code) {
  const { name } = COUNTRY_BY_CODE.get(code);
  const others = lookalikesOf(code).map((other) => COUNTRY_BY_CODE.get(other).name);
  return others.length ? `${name} (gleiche Flagge wie ${others.join(', ')})` : name;
}

function answer(game, correct, wrongVerdict) {
  const text = solution(game.current.code);
  game.finish(correct, correct ? 'Richtig!' : wrongVerdict, correct ? text : `Das ist ${text}`);
}

startGame({
  storageKey: 'countryquiz.flags.v1',
  exportPrefix: 'countryquiz-flags-progress',
  // Territories that fly another entry's flag, and Antarctica, are not asked.
  countries: FLAG_COUNTRIES,
  // Long enough to see where the country lies. Typing the next answer skips it.
  nextDelayMs: 1000,

  setup(game) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (game.isAnswered) game.nextQuestion();
      else if (input.value.trim()) answer(game, isCorrectFlag(input.value, game.current.code), 'Falsch!');
    });
    // Typing the next answer during the pause moves on at once and keeps the letters.
    input.addEventListener('input', () => {
      if (!game.isAnswered) return;
      const typed = input.value;
      game.nextQuestion();
      input.value = typed;
    });
    dontKnowButton.addEventListener('click', () => {
      if (!game.isAnswered) answer(game, false, 'Schade!');
    });
    input.disabled = false;
    submitButton.disabled = false;
  },

  // The globe gives nothing away: no country is marked until the answer.
  ask(game) {
    flag.src = flagUrl(game.current.code);
    flag.hidden = false;
    input.value = '';
    submitButton.textContent = 'Prüfen';
    dontKnowButton.disabled = false;
    game.map.clearHighlight();
    focusInput();
  },

  answered(game) {
    game.map.highlight(game.current.code);
    // The field stays editable: a read-only field would close the phone keyboard.
    input.value = '';
    submitButton.textContent = 'Weiter';
    dontKnowButton.disabled = true;
    focusInput();
  },

  focus: focusInput,
});
