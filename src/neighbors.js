// "Nachbarn finden": a country is marked on a globe without borders, and the player
// types every country it shares a land border with.
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { enableArrowKeys } from './answer-keys.js';
import { byId, startGame } from './game.js';
import { countryParts } from './grammar.js';
import { createNeighborRound, guessNeighbor, missesLeft, missingNeighbors, NEIGHBOR_COUNTRIES } from './neighbor-round.js';
import { t } from './text.js';

const form = byId('answer-form');
const input = byId('answer-input');
const submitButton = byId('submit-btn');
const dontKnowButton = byId('dont-know-btn');
const promptLead = byId('prompt-lead');
const promptName = byId('prompt-name');
const status = byId('neighbor-status');
const guessList = byId('neighbor-guesses');

// Outlines beside the marked country, and the chips below the question in the
// same colors: found neighbors, wrong names and, at the end, the missing neighbors.
const COLORS = {
  found: 'var(--route-step)',
  miss: 'var(--route-detour)',
  missing: 'var(--route-missing)',
};
// The chips share their look with "Grenzgänger".
const CHIP_CLASS = { found: 'step', miss: 'detour', missing: 'missing' };

const nameOf = (code) => COUNTRY_BY_CODE.get(code).name;
const focusInput = () => input.focus({ preventScroll: true });

// The round of the asked country, and how each named or revealed country is shown.
let round = null;
let kinds = new Map();

function show(game, code, kind) {
  kinds.set(code, kind);
  game.map.mark(code, COLORS[kind]);
}

function renderGuesses() {
  guessList.replaceChildren(...[...kinds].map(([code, kind]) => {
    const item = document.createElement('li');
    item.className = `route-guess ${CHIP_CLASS[kind]}`;
    item.textContent = nameOf(code);
    return item;
  }));
}

function renderStatus(over = false) {
  const found = round.found.length;
  const total = round.neighbors.length;
  status.textContent = over ? t.neighborOverStatus(found, total) : t.neighborStatus(found, total, missesLeft(round));
}

// Ends the round as lost or given up: the missing neighbors get their outline.
function showMissing(game, verdict) {
  const missing = missingNeighbors(round);
  for (const code of missing) show(game, code, 'missing');
  game.finish(false, verdict, t.missing(missing.map(nameOf)));
  renderGuesses();
  renderStatus(true);
}

const HINTS = {
  unknown: () => t.unknownCountry,
  ambiguous: ({ codes }) => t.ambiguous(codes),
  asked: () => t.askedItself,
  repeated: ({ code }) => t.repeated(code),
};

function guess(game, text) {
  const verdict = guessNeighbor(round, text);
  if (HINTS[verdict.kind]) {
    game.setFeedback(HINTS[verdict.kind](verdict), 'hint');
    input.select();
    return;
  }
  const { kind, code } = verdict;
  const isNeighbor = kind === 'found' || kind === 'solved';
  show(game, code, isNeighbor ? 'found' : 'miss');
  input.value = '';
  if (kind === 'solved') {
    game.finish(true, t.right, t.allNeighbors(round.neighbors.length));
    renderGuesses();
    renderStatus(true);
    return;
  }
  if (kind === 'lost') {
    showMissing(game, t.lost);
    return;
  }
  game.map.flash(code, isNeighbor);
  game.setFeedback(isNeighbor ? t.neighborFound(nameOf(code)) : t.notNeighbor(nameOf(code)), isNeighbor ? 'good' : 'hint');
  renderGuesses();
  renderStatus();
}

startGame({
  intro: 'neighbors',
  storageKey: 'countryquiz.neighbors.v1',
  exportPrefix: 'countryquiz-neighbors-progress',
  countries: NEIGHBOR_COUNTRIES,
  // Borders would give the neighbors away. Score colors would too, since a filled
  // country shows its outline, so the globe stays uncolored.
  mapOptions: { hideBorders: true },
  colorByScore: false,
  // Long enough to see all neighbors outlined.
  nextDelayMs: 1500,

  setup(game) {
    enableArrowKeys(form);
    // Once the round is over, Enter or "Weiter" moves on, also during the pause
    // after a correct answer.
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (game.isAnswered) game.nextQuestion();
      else if (input.value.trim()) guess(game, input.value);
    });
    dontKnowButton.addEventListener('click', () => {
      if (!game.isAnswered) showMissing(game, t.dontKnow);
    });
    input.disabled = false;
    submitButton.disabled = false;
  },

  ask(game) {
    const { code } = game.current;
    round = createNeighborRound(code);
    kinds = new Map();
    promptLead.textContent = t.neighborsLead(code);
    promptName.textContent = countryParts(code, 'accusative').name;
    renderGuesses();
    renderStatus();
    input.value = '';
    submitButton.textContent = t.check;
    dontKnowButton.disabled = false;
    game.map.highlight(code);
    focusInput();
  },

  answered() {
    input.value = '';
    submitButton.textContent = t.next;
    dontKnowButton.disabled = true;
    focusInput();
  },

  focus: focusInput,
});
