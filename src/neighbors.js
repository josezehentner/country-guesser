// "Nachbarn finden": a country is marked, and the player clicks every country it
// shares a land border with.
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { byId, startGame } from './game.js';
import { countryParts } from './grammar.js';
import { clickCountry, createNeighborRound, missesLeft, missingNeighbors, NEIGHBOR_COUNTRIES } from './neighbor-round.js';
import { t } from './text.js';

const prompt = byId('prompt');
const promptLead = byId('prompt-lead');
const promptName = byId('prompt-name');
const status = byId('neighbor-status');
const nextButton = byId('next-btn');
const dontKnowButton = byId('dont-know-btn');

// Outlines beside the marked country: found neighbors, wrong clicks and, at the
// end, the neighbors still missing.
const COLORS = {
  found: 'var(--route-step)',
  miss: 'var(--route-detour)',
  missing: 'var(--route-missing)',
};

const nameOf = (code) => COUNTRY_BY_CODE.get(code).name;

// The round of the asked country.
let round = null;

// While a question is open the focus rests on the prompt, not on a button: an Enter
// meant to skip the pause must not answer the next question with "Weiß ich nicht".
const focusNext = () => (nextButton.disabled ? prompt : nextButton).focus({ preventScroll: true });

function renderStatus(over = false) {
  const found = round.found.length;
  const total = round.neighbors.length;
  status.textContent = over ? t.neighborOverStatus(found, total) : t.neighborStatus(found, total, missesLeft(round));
}

// Ends the round as lost or given up: the missing neighbors get their outline.
function showMissing(game, verdict) {
  const missing = missingNeighbors(round);
  for (const code of missing) game.map.mark(code, COLORS.missing);
  game.finish(false, verdict, t.missing(missing.map(nameOf)));
  renderStatus(true);
}

// The neighbor the click is meant for, if any. Small neighbors count within a few
// pixels, like in "Länder finden", so Vatican City can be clicked inside Rome.
const neighborAt = (game, event) =>
  missingNeighbors(round).find((code) => game.map.hits(code, event.clientX, event.clientY));

startGame({
  intro: 'neighbors',
  storageKey: 'countryquiz.neighbors.v1',
  exportPrefix: 'countryquiz-neighbors-progress',
  countries: NEIGHBOR_COUNTRIES,
  // Long enough to see all neighbors outlined.
  nextDelayMs: 1500,

  setup(game) {
    nextButton.addEventListener('click', () => {
      if (game.isAnswered) game.nextQuestion();
    });
    dontKnowButton.addEventListener('click', () => {
      if (!game.isAnswered) showMissing(game, t.dontKnow);
    });
  },

  ask(game) {
    const { code } = game.current;
    round = createNeighborRound(code);
    promptLead.textContent = t.neighborsLead(code);
    promptName.textContent = countryParts(code, 'accusative').name;
    renderStatus();
    nextButton.disabled = true;
    dontKnowButton.disabled = false;
    game.map.highlight(code);
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
    const clicked = neighborAt(game, event) ?? game.map.codeAt(event.clientX, event.clientY);
    const { kind, code } = clickCountry(round, clicked);
    if (kind === 'water') {
      game.setFeedback(t.noCountryThere, 'hint');
      return;
    }
    if (kind === 'asked' || kind === 'repeated') {
      game.setFeedback(kind === 'asked' ? t.askedItself : t.clickedBefore(code), 'hint');
      return;
    }
    const isNeighbor = kind === 'found' || kind === 'solved';
    game.map.mark(code, isNeighbor ? COLORS.found : COLORS.miss);
    if (kind === 'solved') {
      game.finish(true, t.right, t.allNeighbors(round.neighbors.length));
      renderStatus(true);
      return;
    }
    if (kind === 'lost') {
      showMissing(game, t.lost);
      return;
    }
    game.map.flash(code, isNeighbor);
    game.setFeedback(isNeighbor ? t.neighborFound(nameOf(code)) : t.notNeighbor(nameOf(code)), isNeighbor ? 'good' : 'hint');
    renderStatus();
  },

  focus: focusNext,
});
