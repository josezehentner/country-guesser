// What every mode shares: progress, stats, legend, filters, settings and the globe.
// A mode only decides how a question is asked and answered.
import { COUNTRIES, CONTINENTS, LEVELS } from '../data/countries.js';
import { scoreColor } from './colors.js';
import { createMap } from './map.js';
import { filterCountries, nextScore, pickNextCountry } from './quiz.js';
import { emptyProgress, exportProgress, loadProgress, parseImport, saveProgress } from './storage.js';

export const MAX_SCORE = 10;

export const byId = (id) => document.getElementById(id);

// Same breakpoint as in style.css: there the filters cover the globe instead of
// sitting beside it.
const SMALL_SCREEN = '(max-width: 640px), (max-height: 500px)';

// How close to the left edge the mouse opens the filters, and how long they stay
// after it left them.
const EDGE_ZONE_PX = 24;
const PEEK_CLOSE_DELAY_MS = 300;

// The filter groups in the sidebar, each one a list of codes in the settings.
const FILTER_GROUPS = [
  { key: 'regions', boxId: 'region-filters', options: CONTINENTS, field: 'continent' },
  { key: 'levels', boxId: 'level-filters', options: LEVELS, field: 'level' },
];

// `mode` provides:
//   storageKey, exportPrefix  where its progress is kept and how exports are named
//   countries                 optional: the countries it asks, all of them if missing
//   nextDelayMs               pause after a correct answer before the next country
//   setup(game)               wires up its own controls once the map is ready
//   ask(game)                 shows the new question in game.current
//   answered(game, correct)   updates its controls after an answer
//   onSelect(game, event)     optional: a click on the globe
//   focus()                   puts the keyboard focus where the player continues
export function startGame(mode) {
  const countries = mode.countries ?? COUNTRIES;
  const feedback = byId('feedback');
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
    const entries = countries.map(({ code }) => progress.countries[code]).filter(Boolean);
    const mastered = entries.filter((entry) => entry.score >= MAX_SCORE).length;
    const started = entries.filter((entry) => entry.score >= 1 && entry.score < MAX_SCORE).length;
    const totalScore = entries.reduce((sum, entry) => sum + entry.score, 0);
    const percent = Math.round((totalScore / (countries.length * MAX_SCORE)) * 100);
    byId('stat-mastered').textContent = mastered;
    byId('stat-started').textContent = started;
    byId('stat-never').textContent = countries.length - entries.length;
    byId('progress-fill').style.width = `${percent}%`;
    byId('progress').setAttribute('aria-valuenow', percent);
  }

  function renderCountry(code) {
    game.map.setColor(code, scoreColor(progress.countries[code]?.score));
  }

  function renderAll() {
    for (const { code } of countries) renderCountry(code);
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

  const filteredCountries = () => filterCountries(countries, progress.settings);

  // With nothing left to ask, every country comes up until the filters change.
  function currentPool() {
    const pool = filteredCountries();
    return pool.length ? pool : countries;
  }

  function nextQuestion() {
    clearTimeout(nextTimer);
    game.current = pickNextCountry(currentPool(), progress.countries, previousCode);
    previousCode = game.current.code;
    game.isAnswered = false;
    setFeedback('');
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

  function setupSettings() {
    const settings = byId('settings');
    byId('settings-btn').addEventListener('click', () => settings.showModal());
    byId('settings-close').addEventListener('click', () => settings.close());
    settings.addEventListener('close', () => mode.focus());
    // Messages and confirmations of these actions would be hidden behind the dialog.
    for (const id of ['export-btn', 'import-btn', 'reset-btn']) byId(id).addEventListener('click', () => settings.close());

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

  function setupFilters() {
    for (const { key, boxId, options, field } of FILTER_GROUPS) {
      const box = byId(boxId);
      for (const [code, label] of Object.entries(options)) {
        const option = document.createElement('label');
        option.className = 'filter-option';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = key;
        input.value = code;
        const count = document.createElement('span');
        count.className = 'filter-count';
        count.textContent = countries.filter((country) => country[field] === code).length;
        option.append(input, label, count);
        box.append(option);
      }
      // All ticked is the same as no filter, so later additions to the data show up.
      box.addEventListener('change', () => {
        const inputs = [...box.querySelectorAll('input')];
        if (inputs.every((input) => input.checked)) delete progress.settings[key];
        else progress.settings[key] = inputs.filter((input) => input.checked).map((input) => input.value);
        persist();
        renderFilters();
        if (game.map && filteredCountries().length) nextQuestion();
      });
    }

    const panel = byId('filters');
    const toggle = byId('filters-btn');
    const small = window.matchMedia(SMALL_SCREEN);
    // Pinned filters stay open beside the globe. Like the Mac dock, a mouse at the
    // left edge or on the tab only peeks: they slide in over the globe and slide out
    // a moment after the mouse leaves them. Running off the edge of the window
    // keeps them open. On a phone the open filters cover the globe, so they always
    // start closed there.
    let pinned = !small.matches && progress.settings.filtersOpen !== false;
    let peeking = false;
    // After closing them with a click, the mouse is still on the tab: no peek then
    // until it has left.
    let suppressed = false;
    let closeTimer = null;
    const isOpen = () => pinned || peeking;
    const render = () => {
      const column = pinned && !small.matches;
      panel.classList.toggle('pinned', column);
      panel.classList.toggle('open', isOpen() && !column);
      toggle.setAttribute('aria-expanded', String(isOpen()));
    };
    const cancelClose = () => {
      clearTimeout(closeTimer);
      closeTimer = null;
    };
    const setPeeking = (open) => {
      cancelClose();
      peeking = open;
      render();
    };
    const setPinned = (open) => {
      pinned = open;
      suppressed = !open;
      setPeeking(false);
      if (small.matches) return;
      progress.settings.filtersOpen = pinned;
      persist();
    };
    render();
    small.addEventListener('change', render);
    // A click while peeking keeps the filters open.
    toggle.addEventListener('click', () => setPinned(peeking || !pinned));
    document.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || pinned || small.matches) return;
      const area = panel.parentElement.getBoundingClientRect();
      const atEdge = event.clientX - area.left <= EDGE_ZONE_PX && event.clientY >= area.top && event.clientY <= area.bottom;
      if (atEdge || panel.contains(event.target) || toggle.contains(event.target)) {
        cancelClose();
        if (!peeking && !suppressed) setPeeking(true);
        return;
      }
      suppressed = false;
      if (peeking && !closeTimer) closeTimer = setTimeout(() => setPeeking(false), PEEK_CLOSE_DELAY_MS);
    });
    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !isOpen() || (pinned && !small.matches)) return;
      if (peeking) {
        suppressed = true;
        setPeeking(false);
      } else {
        setPinned(false);
      }
      toggle.focus();
    });
    renderFilters();
  }

  function renderFilters() {
    for (const { key, boxId } of FILTER_GROUPS) {
      const selected = progress.settings[key];
      for (const input of byId(boxId).querySelectorAll('input')) input.checked = !selected || selected.includes(input.value);
    }
    const count = filteredCountries().length;
    const summary = byId('filter-summary');
    summary.textContent = count
      ? `${count} ${count === 1 ? 'Land wird' : 'Länder werden'} abgefragt.`
      : 'Keine Länder für diese Auswahl. Bis du etwas auswählst, kommen alle dran.';
    summary.classList.toggle('empty', !count);
  }

  function replaceProgress(next) {
    progress = next;
    renderFilters();
    persist();
    renderAll();
    nextQuestion();
  }

  async function start() {
    try {
      const [world, lakes] = await Promise.all(['data/world.json', 'data/lakes.json'].map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return response.json();
      }));
      const onSelect = (event) => mode.onSelect?.(game, event);
      game.map = createMap(byId('map'), byId('map-target'), world, onSelect, lakes);
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
  // The filters do not need the map, so they are ready while it loads.
  setupFilters();
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
