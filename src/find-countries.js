// "Länder finden": a country is named and the player clicks it on the globe.
import { byId, startGame } from './game.js';
import { countryParts } from './grammar.js';
import { t } from './text.js';

const prompt = byId('prompt');
const promptName = byId('prompt-name');
const promptVerb = byId('prompt-verb');
const nextButton = byId('next-btn');
const dontKnowButton = byId('dont-know-btn');

// While a question is open the focus rests on the prompt, not on a button: an Enter
// meant to skip the pause must not answer the next question with "Weiß ich nicht".
const focusNext = () => (nextButton.disabled ? prompt : nextButton).focus({ preventScroll: true });

startGame({
  intro: 'find',
  storageKey: 'countryquiz.find.v1',
  exportPrefix: 'countryquiz-find-progress',
  // Long enough to see where the found country is marked.
  nextDelayMs: 1000,

  setup(game) {
    nextButton.addEventListener('click', () => {
      if (game.isAnswered) game.nextQuestion();
    });
    dontKnowButton.addEventListener('click', () => {
      if (game.isAnswered) return;
      game.finish(false, t.dontKnow, t.liesHere(game.current.code));
      game.map.highlight(game.current.code);
    });
  },

  // The globe stays where the player left it: finding the country is the task.
  ask(game) {
    // "Wo liegen die **Niederlande**?": the name in bold, the article before it.
    const { code } = game.current;
    promptVerb.textContent = t.whereVerb(code);
    promptName.textContent = countryParts(code).name;
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

  // Once answered, a click anywhere on the globe moves on, like "Weiter". Dragging
  // the globe is no click, so the player can still look around first.
  onSelect(game, event) {
    if (game.isAnswered) {
      game.nextQuestion();
      return;
    }
    const { code, name } = game.current;
    if (game.map.hits(code, event.clientX, event.clientY)) {
      game.finish(true, t.right, name);
      game.map.highlight(code, { focus: false });
      return;
    }
    const clicked = game.map.codeAt(event.clientX, event.clientY);
    if (!clicked) {
      game.setFeedback(t.noCountryThere, 'hint');
      return;
    }
    game.finish(false, t.wrong, `${t.thatIs(clicked)}. ${t.liesHere(code)}`);
    game.map.highlight(code);
  },

  focus: focusNext,
});
