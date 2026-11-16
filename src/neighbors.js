// "Nachbarn finden": a country is marked on a globe without borders, and the player
// types every country it shares a land border with.
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { enableArrowKeys } from './answer-keys.js';
import { byId, startGame } from './game.js';
import { countryParts } from './grammar.js';
import { createNeighborRound, guessNeighbor, missesLeft, missingNeighbors, NEIGHBOR_COUNTRIES, pickNeighborRound } from './neighbor-round.js';
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

const EMPTY_ROUNDS = { played: 0, solved: 0, perfect: 0, streak: 0, bestStreak: 0 };
// Long enough to see all neighbors outlined.
const NEXT_DELAY_MS = 1500;

const nameOf = (code) => COUNTRY_BY_CODE.get(code).name;
const focusInput = () => input.focus({ preventScroll: true });

// The round of the asked country, and how each named or revealed country is shown.
let round = null;
let kinds = new Map();
let isOver = false;
let nextTimer = null;

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

function renderStats(game) {
  const rounds = { ...EMPTY_ROUNDS, ...game.progress.rounds };
  byId('stat-solved').textContent = rounds.solved;
  byId('stat-perfect').textContent = rounds.perfect;
  byId('stat-streak').textContent = rounds.streak;
  const percent = rounds.played ? Math.round((rounds.solved / rounds.played) * 100) : 0;
  byId('progress-fill').style.width = `${percent}%`;
  byId('progress').setAttribute('aria-valuenow', percent);
}

// Counts the round, shows the result and waits for the player; a solved round
// moves on by itself after a moment. A round without a wrong guess is perfect.
function endRound(game, solved, verdict, text) {
  isOver = true;
  const perfect = solved && round.misses.length === 0;
  const rounds = { ...EMPTY_ROUNDS, ...game.progress.rounds };
  rounds.played += 1;
  if (solved) rounds.solved += 1;
  if (perfect) rounds.perfect += 1;
  rounds.streak = solved ? rounds.streak + 1 : 0;
  rounds.bestStreak = Math.max(rounds.bestStreak, rounds.streak);
  game.progress.rounds = rounds;
  game.persist();
  renderStats(game);
  game.setFeedback(text, solved ? 'good' : 'bad', { verdict });
  game.map.flash(round.code, solved);
  renderGuesses();
  renderStatus(true);
  input.value = '';
  submitButton.textContent = t.next;
  dontKnowButton.disabled = true;
  focusInput();
  if (solved) nextTimer = setTimeout(() => game.nextQuestion(), NEXT_DELAY_MS);
}

// Ends the round as lost or given up: the missing neighbors get their outline.
function showMissing(game, verdict) {
  const missing = missingNeighbors(round);
  for (const code of missing) show(game, code, 'missing');
  endRound(game, false, verdict, t.missing(missing.map(nameOf)));
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
    const text = round.misses.length ? t.allNeighbors(round.neighbors.length) : `${t.allNeighbors(round.neighbors.length)}, ${t.flawless}`;
    endRound(game, true, t.right, text);
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

function ask(game) {
  clearTimeout(nextTimer);
  round = game.current;
  const { code } = round;
  kinds = new Map();
  isOver = false;
  promptLead.textContent = t.neighborsLead(code);
  promptName.textContent = countryParts(code, 'accusative').name;
  renderGuesses();
  renderStatus();
  input.value = '';
  submitButton.textContent = t.check;
  dontKnowButton.disabled = false;
  game.map.highlight(code);
  focusInput();
}

startGame({
  intro: 'neighbors',
  storageKey: 'countryquiz.neighbors.v1',
  exportPrefix: 'countryquiz-neighbors-progress',
  countries: NEIGHBOR_COUNTRIES,
  // Rounds count instead of per-country scores, so the globe stays uncolored:
  // borders and filled countries would give the neighbors away.
  scores: false,
  mapOptions: { hideBorders: true },
  renderStats,

  // With nothing left in the filters, every country comes up.
  next: (game, pool) => pickNeighborRound(pool.length ? pool : NEIGHBOR_COUNTRIES, round?.code),

  setup(game) {
    enableArrowKeys(form);
    // Once the round is over, Enter or "Weiter" moves on, also during the pause
    // after a correct answer.
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (isOver) game.nextQuestion();
      else if (input.value.trim()) guess(game, input.value);
    });
    dontKnowButton.addEventListener('click', () => {
      if (!isOver) showMissing(game, t.dontKnow);
    });
    input.disabled = false;
    submitButton.disabled = false;
    // Rounds are random, so the browser tests set one up through this.
    byId('prompt').neighborTestApi = {
      play: (code) => {
        game.current = createNeighborRound(code);
        game.setFeedback('');
        ask(game);
      },
    };
  },

  ask,

  answered() {},

  focus: focusInput,
});
