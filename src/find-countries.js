// "Länder finden": a country is named and the player clicks it on the globe.
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { byId, startGame } from './game.js';

const prompt = byId('prompt');
const promptName = byId('prompt-name');
const nextButton = byId('next-btn');
const dontKnowButton = byId('dont-know-btn');

// After a correct answer the next country follows on its own after this pause.
const AUTO_NEXT_MS = 1000;
let autoNext = null;

// While a question is open the focus rests on the prompt, not on a button: an Enter
// meant to skip the pause must not answer the next question with "Weiß ich nicht".
const focusNext = () => (nextButton.disabled ? prompt : nextButton).focus({ preventScroll: true });

startGame({
  storageKey: 'countryquiz.find.v1',
  exportPrefix: 'countryquiz-find-progress',

  setup(game) {
    nextButton.addEventListener('click', () => {
      if (game.isAnswered) game.nextQuestion();
    });
    dontKnowButton.addEventListener('click', () => {
      if (game.isAnswered) return;
      game.finish(false, `Schade. Hier liegt ${game.current.name}`);
      game.map.highlight(game.current.code);
    });
  },

  // The globe stays where the player left it: finding the country is the task.
  ask(game) {
    clearTimeout(autoNext);
    promptName.textContent = game.current.name;
    nextButton.disabled = true;
    dontKnowButton.disabled = false;
    game.map.clearHighlight();
    focusNext();
  },

  answered() {
    nextButton.disabled = false;
    dontKnowButton.disabled = true;
    focusNext();
  },

  onSelect(game, event) {
    if (game.isAnswered) return false;
    const { code, name } = game.current;
    if (game.map.hits(code, event.clientX, event.clientY)) {
      game.finish(true, `Richtig: ${name}`);
      game.map.highlight(code, { focus: false });
      autoNext = setTimeout(() => game.nextQuestion(), AUTO_NEXT_MS);
      return true;
    }
    const clicked = game.map.codeAt(event.clientX, event.clientY);
    if (!clicked) {
      game.setFeedback('Dort ist kein Land aus dem Quiz.');
      return true;
    }
    game.finish(false, `Falsch, das ist ${COUNTRY_BY_CODE.get(clicked).name}. Hier liegt ${name}`);
    game.map.highlight(code);
    return true;
  },

  // Names on the globe would give the answer away until it is given.
  canShowName: (game) => game.isAnswered,

  focus: focusNext,
});
