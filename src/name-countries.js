// "Länder benennen": a country is marked on the globe and the player types its name.
import { byId, startGame } from './game.js';
import { isCorrectAnswer } from './quiz.js';

const form = byId('answer-form');
const input = byId('answer-input');
const submitButton = byId('submit-btn');
const dontKnowButton = byId('dont-know-btn');

const focusInput = () => input.focus({ preventScroll: true });

function answer(game, correct, wrongPrefix) {
  const { name } = game.current;
  game.finish(correct, correct ? `Richtig: ${name}` : `${wrongPrefix} Das ist ${name}`);
}

startGame({
  storageKey: 'countryquiz.v1',
  exportPrefix: 'countryquiz-progress',

  setup(game) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (game.isAnswered) game.nextQuestion();
      else if (input.value.trim()) answer(game, isCorrectAnswer(input.value, game.current.code), 'Falsch.');
    });
    dontKnowButton.addEventListener('click', () => {
      if (!game.isAnswered) answer(game, false, 'Schade.');
    });
    input.disabled = false;
    submitButton.disabled = false;
  },

  ask(game) {
    input.value = '';
    input.readOnly = false;
    submitButton.textContent = 'Prüfen';
    dontKnowButton.disabled = false;
    game.map.highlight(game.current.code);
    focusInput();
  },

  answered() {
    input.readOnly = true;
    submitButton.textContent = 'Weiter';
    dontKnowButton.disabled = true;
    focusInput();
  },

  // The country being asked must not give away its own name.
  canShowName: (game, code) => game.isAnswered || code !== game.current?.code,

  focus: focusInput,
});
