// What every mode shares: progress, stats, legend, settings and the globe.
// A mode only decides how a question is asked and answered.
import { COUNTRIES, COUNTRY_BY_CODE, CONTINENTS } from '../data/countries.js';
import { scoreColor } from './colors.js';
import { createMap } from './map.js';
import { nextScore, pickNextCountry } from './quiz.js';
import { emptyProgress, exportProgress, loadProgress, parseImport, saveProgress } from './storage.js';

export const MAX_SCORE = 10;

export const byId = (id) => document.getElementById(id);

// `mode` provides:
//   storageKey, exportPrefix  where its progress is kept and how exports are named
//   nextDelayMs               pause after a correct answer before the next country
//   setup(game)               wires up its own controls once the map is ready
//   ask(game)                 shows the new question in game.current
//   answered(game, correct)   updates its controls after an answer
//   canShowName(game, code)   whether the tooltip may name a country
//   onSelect(game, event)     optional: a click on the globe, true if used
//   focus()                   puts the keyboard focus where the player continues
export function startGame(mode) {
  const feedback = byId('feedback');
  const continentFilter = byId('continent-filter');
  const importFile = byId('import-file');

  let progress = loadProgress(mode.storageKey);
  let previousCode = null;
  let nextTimer = null;

  const game = {
    map: null,
    current: null,
    isAnswered: false,
    setFeedback,
    nextQuestion,
    finish,
  };

  // Shows the result over the globe: a comic burst with the verdict ("Richtig!"),
  // a line of text and, after an answer, the country's new score as a badge in its
  // color. Without arguments it clears the result.
  function setFeedback(text = '', kind = '', { verdict = '', score } = {}) {
    const parts = [];
    const part = (className, content) => {
      const element = document.createElement('span');
      element.className = className;
      element.textContent = content;
      parts.push(element);
      return element;
    };
    if (verdict) part('verdict', verdict);
    if (text) part('feedback-text', text);
    if (score !== undefined) part('score-chip', `${score}/${MAX_SCORE}`).style.background = scoreColor(score);
    // Spaces between the parts, so the text reads well, also to screen readers.
    feedback.replaceChildren(...parts.flatMap((element, i) => (i ? [' ', element] : [element])));
    feedback.className = `feedback ${kind}`;
    // The result pops in like a comic sound word. `scale` leaves the phone
    // layout's centering transform alone.
    if (kind && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      feedback.animate([{ scale: 0.6 }, { scale: 1.12 }, { scale: 1 }], { duration: 260, easing: 'ease-out' });
    }
  }

  function persist() {
    byId('storage-notice').hidden = saveProgress(progress, mode.storageKey);
  }

  function renderStats() {
    const entries = Object.values(progress.countries);
    const mastered = entries.filter((entry) => entry.score >= MAX_SCORE).length;
    const started = entries.filter((entry) => entry.score >= 1 && entry.score < MAX_SCORE).length;
    const totalScore = entries.reduce((sum, entry) => sum + entry.score, 0);
    const percent = Math.round((totalScore / (COUNTRIES.length * MAX_SCORE)) * 100);
    byId('stat-mastered').textContent = mastered;
    byId('stat-started').textContent = started;
    byId('stat-never').textContent = COUNTRIES.length - entries.length;
    byId('progress-fill').style.width = `${percent}%`;
    byId('progress').setAttribute('aria-valuenow', percent);
  }

  function renderCountry(code) {
    game.map.setColor(code, scoreColor(progress.countries[code]?.score));
  }

  function renderAll() {
    for (const { code } of COUNTRIES) renderCountry(code);
    renderStats();
  }

  function renderLegend() {
    const legend = byId('legend');
    // Scores 0 to 10; never-asked countries need no swatch, they are plain land.
    for (let score = 0; score <= MAX_SCORE; score++) {
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = scoreColor(score);
      swatch.textContent = String(score);
      item.append(swatch);
      legend.append(item);
    }
  }

  function currentPool() {
    const continent = progress.settings.continent;
    return continent ? COUNTRIES.filter((country) => country.continent === continent) : COUNTRIES;
  }

  function nextQuestion() {
    clearTimeout(nextTimer);
    game.current = pickNextCountry(currentPool(), progress.countries, previousCode);
    previousCode = game.current.code;
    game.isAnswered = false;
    setFeedback('');
    game.map.hideTooltip();
    mode.ask(game);
  }

  function recordAnswer(correct) {
    const { code } = game.current;
    const previous = progress.countries[code];
    const entry = previous ?? { score: 0, seen: 0, correct: 0, lastSeen: '' };
    entry.score = nextScore(previous, correct);
    entry.seen += 1;
    if (correct) entry.correct += 1;
    entry.lastSeen = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    progress.countries[code] = entry;
    persist();
    renderCountry(code);
    renderStats();
    return entry.score;
  }

  // Scores the current question and shows the verdict and `text` with the new
  // score. After a correct answer the next country follows by itself; a wrong one
  // waits for the player, so the right answer can be seen.
  function finish(correct, verdict, text) {
    const score = recordAnswer(correct);
    game.isAnswered = true;
    setFeedback(text, correct ? 'good' : 'bad', { verdict, score });
    game.map.flash(game.current.code, correct);
    mode.answered(game, correct);
    if (correct) nextTimer = setTimeout(nextQuestion, mode.nextDelayMs);
  }

  function tooltipText(code) {
    if (!mode.canShowName(game, code)) return null;
    const entry = progress.countries[code];
    return entry ? `${COUNTRY_BY_CODE.get(code).name}: ${entry.score}/${MAX_SCORE}` : null;
  }

  function setupSettings() {
    const settings = byId('settings');
    byId('settings-btn').addEventListener('click', () => settings.showModal());
    byId('settings-close').addEventListener('click', () => settings.close());
    settings.addEventListener('close', () => mode.focus());
    // Messages and confirmations of these actions would be hidden behind the dialog.
    for (const id of ['export-btn', 'import-btn', 'reset-btn']) byId(id).addEventListener('click', () => settings.close());

    for (const [code, name] of Object.entries(CONTINENTS)) {
      continentFilter.add(new Option(name, code));
    }
    continentFilter.value = progress.settings.continent ?? '';
    continentFilter.addEventListener('change', () => {
      if (continentFilter.value) progress.settings.continent = continentFilter.value;
      else delete progress.settings.continent;
      persist();
      nextQuestion();
    });

    byId('export-btn').addEventListener('click', () => exportProgress(progress, mode.exportPrefix));

    byId('import-btn').addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async () => {
      const [file] = importFile.files;
      importFile.value = '';
      if (!file) return;
      const imported = parseImport(await file.text());
      if (!imported) {
        setFeedback('Import fehlgeschlagen: Die Datei ist ungültig.', 'bad');
        return;
      }
      if (window.confirm('Aktuellen Fortschritt ersetzen?')) replaceProgress(imported);
    });

    byId('reset-btn').addEventListener('click', () => {
      if (window.confirm('Gesamten Fortschritt wirklich löschen?')) replaceProgress(emptyProgress());
    });
  }

  function replaceProgress(next) {
    progress = next;
    continentFilter.value = progress.settings.continent ?? '';
    persist();
    renderAll();
    nextQuestion();
  }

  async function start() {
    try {
      const response = await fetch('data/world.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const world = await response.json();
      const onSelect = (event) => Boolean(mode.onSelect?.(game, event));
      game.map = createMap(byId('map'), byId('map-target'), byId('tooltip'), world, tooltipText, onSelect);
    } catch (error) {
      console.error(error);
      byId('loading').textContent = 'Die Karte konnte nicht geladen werden.';
      return;
    }
    byId('loading').hidden = true;
    persist();
    renderLegend();
    renderAll();
    setupSettings();
    mode.setup(game);
    nextQuestion();
  }

  fitToVisibleArea();
  start();
}

// An on-screen keyboard covers the bottom of the page, and some browsers do not
// shrink the page for it. Sizing the page to the visible area keeps the answer row
// above the keyboard and gives the globe the rest. Without a keyboard nothing changes.
function fitToVisibleArea() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const update = () => {
    // Pinch-zooming the page also shrinks the visible area: keep the layout then.
    if (Math.abs(viewport.scale - 1) > 0.01) return;
    document.documentElement.style.setProperty('--visible-height', `${viewport.height}px`);
    window.scrollTo(0, 0);
  };
  viewport.addEventListener('resize', update);
  update();
}
