// "Grenzgänger": a start and an end country are given on a globe without borders,
// and the player names the countries in between until their land borders connect
// the two.
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { enableArrowKeys } from './answer-keys.js';
import { byId, startGame } from './game.js';
import { addGuess, bestRoute, createRound, guessesLeft, judgeGuess, pickRound, ROUTE_COUNTRIES } from './route.js';
import { t } from './text.js';

const form = byId('answer-form');
const input = byId('answer-input');
const submitButton = byId('submit-btn');
const dontKnowButton = byId('dont-know-btn');
const guessList = byId('route-guesses');
const status = byId('route-status');

const COLORS = {
  start: 'var(--route-start)',
  end: 'var(--route-end)',
  step: 'var(--route-step)',
  detour: 'var(--route-detour)',
  missing: 'var(--route-missing)',
};
const NEVER = 'var(--never)';
const EMPTY_ROUNDS = { played: 0, solved: 0, perfect: 0, streak: 0, bestStreak: 0 };

const nameOf = (code) => COUNTRY_BY_CODE.get(code).name;
const focusInput = () => input.focus({ preventScroll: true });

// Every country colored in this round, so the next one can clear them.
let colored = [];
// How each named or revealed country is shown: 'step', 'detour' or 'missing'.
let kinds = new Map();
let isOver = false;

function paint(game, code, kind) {
  game.map.setColor(code, COLORS[kind]);
  colored.push(code);
}

function renderGuesses(round) {
  const items = [...kinds].map(([code, kind]) => {
    const item = document.createElement('li');
    item.className = `route-guess ${kind}`;
    item.textContent = nameOf(code);
    return item;
  });
  guessList.replaceChildren(...items);
}

function renderStatus(round) {
  const left = guessesLeft(round);
  status.textContent = isOver ? t.routeOverStatus(round.between) : t.routeStatus(left, round.between);
}

function endRound(game, solved, perfect = false) {
  isOver = true;
  const rounds = { ...EMPTY_ROUNDS, ...game.progress.rounds };
  rounds.played += 1;
  if (solved) rounds.solved += 1;
  if (perfect) rounds.perfect += 1;
  rounds.streak = solved ? rounds.streak + 1 : 0;
  rounds.bestStreak = Math.max(rounds.bestStreak, rounds.streak);
  game.progress.rounds = rounds;
  game.persist();
  renderStats(game);
  submitButton.textContent = t.next;
  dontKnowButton.disabled = true;
  input.value = '';
  focusInput();
}

// Colors the countries the player missed and lists them.
function showMissing(game, round) {
  const route = bestRoute(round);
  const missing = route.filter((code) => code !== round.start && code !== round.end && !round.guesses.includes(code));
  for (const code of missing) {
    kinds.set(code, 'missing');
    paint(game, code, 'missing');
  }
  return missing;
}

function giveUp(game, verdict) {
  const round = game.current;
  const missing = showMissing(game, round);
  endRound(game, false);
  renderGuesses(round);
  renderStatus(round);
  game.setFeedback(t.missing(missing.map(nameOf)), 'bad', { verdict });
}

const HINTS = {
  unknown: () => t.unknownCountry,
  ambiguous: ({ codes }) => t.ambiguous(codes),
  endpoint: ({ code }, round) => t.endpoint(code, code === round.start),
  repeated: ({ code }) => t.repeated(code),
};

function guess(game, text) {
  const round = game.current;
  const verdict = judgeGuess(round, text);
  if (HINTS[verdict.kind]) {
    game.setFeedback(HINTS[verdict.kind](verdict, round), 'hint');
    input.select();
    return;
  }
  const { code, kind } = verdict;
  kinds.set(code, kind);
  paint(game, code, kind);
  game.map.flash(code, kind === 'step');
  game.map.reveal(code);
  input.value = '';
  const result = addGuess(round, code);
  if (result.state === 'solved') {
    endRound(game, true, result.perfect);
    const text = result.perfect ? t.shortest : t.longer(round.guesses.length, round.between);
    game.setFeedback(text, 'good', { verdict: t.solved });
  } else if (result.state === 'lost') {
    giveUp(game, t.lost);
    return;
  } else {
    game.setFeedback(kind === 'step' ? t.onRoute(code) : t.detour(code), kind === 'step' ? 'good' : 'hint');
  }
  renderGuesses(round);
  renderStatus(round);
}

function ask(game) {
  const round = game.current;
  for (const code of colored) game.map.setColor(code, NEVER);
  colored = [];
  kinds = new Map();
  isOver = false;
  paint(game, round.start, 'start');
  paint(game, round.end, 'end');
  game.map.setRoute(round.start, round.end);
  const from = t.routeFrom(round.start);
  const to = t.routeTo(round.end);
  byId('route-from').textContent = from.lead;
  byId('route-start').textContent = from.name;
  byId('route-to').textContent = to.lead;
  byId('route-end').textContent = to.name;
  renderGuesses(round);
  renderStatus(round);
  input.value = '';
  submitButton.textContent = t.check;
  dontKnowButton.disabled = false;
  focusInput();
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

startGame({
  intro: 'borders',
  storageKey: 'countryquiz.borders.v1',
  exportPrefix: 'countryquiz-borders-progress',
  // Only countries with a land border can be on a route.
  countries: ROUTE_COUNTRIES,
  scores: false,
  filters: ['regions'],
  mapOptions: { hideBorders: true },
  renderStats,

  // A region without a long enough route gives a round from everywhere.
  next: (game, pool) => pickRound(pool) ?? pickRound(ROUTE_COUNTRIES),

  poolSummary(pool) {
    if (pickRound(pool)) return { text: t.poolHasRoute, empty: false };
    return { text: t.poolNoRoute, empty: true };
  },

  setup(game) {
    enableArrowKeys(form);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (isOver) game.nextQuestion();
      else if (input.value.trim()) guess(game, input.value);
    });
    dontKnowButton.addEventListener('click', () => {
      if (!isOver) giveUp(game, t.dontKnow);
    });
    input.disabled = false;
    submitButton.disabled = false;
    // Rounds are random, so the browser tests set one up through this.
    byId('prompt').routeTestApi = {
      round: () => ({ start: game.current.start, end: game.current.end, between: game.current.between, guesses: [...game.current.guesses] }),
      play: (start, end) => {
        game.current = createRound(start, end);
        game.setFeedback('');
        ask(game);
      },
    };
  },

  ask,

  answered() {},

  focus: focusInput,
});
