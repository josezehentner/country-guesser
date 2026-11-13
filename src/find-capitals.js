// "Hauptstädte finden": a capital is named and the player clicks its country on the globe.
import { CAPITALS, capitalLabel } from '../data/capitals.js';
import { COUNTRIES, COUNTRY_BY_CODE } from '../data/countries.js';
import { byId, startGame } from './game.js';
import { countryPhrase, verb } from './grammar.js';
import { sharesCapital } from './quiz.js';

const prompt = byId('prompt');
const promptName = byId('prompt-name');
const nextButton = byId('next-btn');
const dontKnowButton = byId('dont-know-btn');

// Places without any settlement have no capital to ask for.
const countries = COUNTRIES.filter(({ code }) => Object.hasOwn(CAPITALS, code));

// For each code, every place with a capital of the same name, itself first: asked
// for Kingston, both Jamaica and Norfolk Island are right.
const placesByCode = new Map(
  countries.map(({ code }) => [code, [code, ...countries.map((other) => other.code).filter((other) => other !== code && sharesCapital(code, other))]]),
);

const nameOf = (code) => COUNTRY_BY_CODE.get(code).name;

// While a question is open the focus rests on the prompt, not on a button: an Enter
// meant to skip the pause must not answer the next question with "Weiß ich nicht".
const focusNext = () => (nextButton.disabled ? prompt : nextButton).focus({ preventScroll: true });

startGame({
  intro: 'find-capitals',
  storageKey: 'countryquiz.capitals-find.v1',
  exportPrefix: 'countryquiz-capitals-find-progress',
  countries,
  // Long enough to see where the found country is marked.
  nextDelayMs: 1000,

  setup(game) {
    nextButton.addEventListener('click', () => {
      if (game.isAnswered) game.nextQuestion();
    });
    dontKnowButton.addEventListener('click', () => {
      if (game.isAnswered) return;
      const { code, name } = game.current;
      game.finish(false, 'Schade!', `${CAPITALS[code].name} liegt hier: ${name}`);
      game.map.highlight(code);
    });
  },

  // The globe stays where the player left it: finding the country is the task.
  ask(game) {
    promptName.textContent = capitalLabel(game.current.code);
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
    const places = placesByCode.get(code);
    const found = places.find((place) => game.map.hits(place, event.clientX, event.clientY));
    if (found) {
      const others = places.filter((place) => place !== found).map(nameOf);
      const also = others.length ? `. Auch richtig: ${others.join(', ')}` : '';
      game.finish(true, 'Richtig!', `${nameOf(found)}: ${capitalLabel(found)}${also}`);
      game.map.highlight(found, { focus: false });
      // The flash belongs where the player clicked, even on the other place.
      if (found !== code) game.map.flash(found, true);
      return;
    }
    const clicked = game.map.codeAt(event.clientX, event.clientY);
    if (!clicked) {
      game.setFeedback('Dort ist kein Land aus dem Quiz.', 'hint');
      return;
    }
    game.finish(false, 'Falsch!', `Das ${verb(clicked, 'ist', 'sind')} ${countryPhrase(clicked)}. ${CAPITALS[code].name} liegt hier: ${name}`);
    game.map.highlight(code);
  },

  focus: focusNext,
});
