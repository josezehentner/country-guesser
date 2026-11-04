// "Hauptstädte lernen": a country is marked on the globe and the player types its capital.
import { CAPITALS, capitalLabel } from '../data/capitals.js';
import { COUNTRIES } from '../data/countries.js';
import { byId, startGame } from './game.js';
import { isCorrectCapital } from './quiz.js';

const form = byId('answer-form');
const input = byId('answer-input');
const submitButton = byId('submit-btn');
const dontKnowButton = byId('dont-know-btn');

const focusInput = () => input.focus({ preventScroll: true });

// The answer always names the country too, so the player learns which one was marked.
function answer(game, correct, wrongVerdict) {
  const { code, name } = game.current;
  game.finish(correct, correct ? 'Richtig!' : wrongVerdict, `${name}: ${capitalLabel(code)}`);
}

startGame({
  storageKey: 'countryquiz.capitals.v1',
  exportPrefix: 'countryquiz-capitals-progress',
  // Places without any settlement have no capital to ask for.
  countries: COUNTRIES.filter(({ code }) => Object.hasOwn(CAPITALS, code)),
  // Short, so one key press is enough to answer and move on.
  nextDelayMs: 400,

  setup(game) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (game.isAnswered) game.nextQuestion();
      else if (input.value.trim()) answer(game, isCorrectCapital(input.value, game.current.code), 'Falsch!');
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

  ask(game) {
    input.value = '';
    submitButton.textContent = 'Prüfen';
    dontKnowButton.disabled = false;
    game.map.highlight(game.current.code);
    focusInput();
  },

  answered() {
    // The field stays editable: a read-only field would close the phone keyboard.
    input.value = '';
    submitButton.textContent = 'Weiter';
    dontKnowButton.disabled = true;
    focusInput();
  },

  focus: focusInput,
});
