// "Grenzgänger": a start and an end country are given on a globe without borders,
// and the player names the countries in between until their land borders connect
// the two.
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { enableArrowKeys } from './answer-keys.js';
import { byId, startGame } from './game.js';
import { capitalize, countryParts, countryPhrase, verb } from './grammar.js';
import { addGuess, bestRoute, createRound, guessesLeft, judgeGuess, pickRound, ROUTE_COUNTRIES } from './route.js';

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
// At the start of a sentence, with its article: "Die Schweiz", "Polen".
const subject = (code) => capitalize(countryPhrase(code));
const focusInput = () => input.focus({ preventScroll: true });
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

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
  status.textContent = isOver
    ? `Mindestens ${plural(round.between, 'Land', 'Länder')} dazwischen`
    : `Noch ${plural(left, 'Versuch', 'Versuche')} · mindestens ${plural(round.between, 'Land', 'Länder')} dazwischen`;
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
  submitButton.textContent = 'Weiter';
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
  game.setFeedback(`Gefehlt ${missing.length === 1 ? 'hat' : 'haben'}: ${missing.map(nameOf).join(', ')}`, 'bad', { verdict });
}

const HINTS = {
  unknown: () => 'Kein Land mit diesem Namen.',
  ambiguous: ({ codes }) => `Meinst du ${codes.map((code) => countryPhrase(code, 'accusative')).join(' oder ')}?`,
  endpoint: ({ code }, round) => `${subject(code)} ${verb(code, 'ist', 'sind')} ${code === round.start ? 'der Start' : 'das Ziel'}.`,
  repeated: ({ code }) => `${capitalize(countryPhrase(code, 'accusative'))} hast du schon genannt.`,
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
    const text = result.perfect ? 'Kürzester Weg!' : `Mit ${plural(round.guesses.length, 'Land', 'Ländern')}, ${round.between} hätten gereicht.`;
    game.setFeedback(text, 'good', { verdict: 'Geschafft!' });
  } else if (result.state === 'lost') {
    giveUp(game, 'Vorbei!');
    return;
  } else {
    game.setFeedback(kind === 'step' ? `${subject(code)} ${verb(code, 'liegt', 'liegen')} auf einem kürzesten Weg.` : `${subject(code)} ${verb(code, 'ist', 'sind')} ein Umweg.`, kind === 'step' ? 'good' : 'hint');
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
  // "Von der **Schweiz** in die **Niederlande**", "Von **Polen** nach **Spanien**"
  const from = countryParts(round.start, 'dative');
  const to = countryParts(round.end, 'accusative');
  byId('route-from').textContent = from.article ? `Von ${from.article}` : 'Von';
  byId('route-start').textContent = from.name;
  byId('route-to').textContent = to.article ? `in ${to.article}` : 'nach';
  byId('route-end').textContent = to.name;
  renderGuesses(round);
  renderStatus(round);
  input.value = '';
  submitButton.textContent = 'Prüfen';
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
    if (pickRound(pool)) return { text: 'Start, Ziel und kürzester Weg liegen in dieser Auswahl.', empty: false };
    return { text: 'In dieser Auswahl gibt es keinen Weg mit mindestens drei Ländern dazwischen. Bis du etwas änderst, kommen alle dran.', empty: true };
  },

  setup(game) {
    enableArrowKeys(form);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (isOver) game.nextQuestion();
      else if (input.value.trim()) guess(game, input.value);
    });
    dontKnowButton.addEventListener('click', () => {
      if (!isOver) giveUp(game, 'Schade!');
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
