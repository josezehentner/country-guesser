// What every mode shares: progress, stats, legend, filters, settings and the globe.
// A mode only decides how a question is asked and answered.
import { COUNTRIES, COUNTRY_BY_CODE, CONTINENTS, LEVELS } from '../data/countries.js';
import { scoreColor } from './colors.js';
import { createMap } from './map.js';
import { filterCountries, nextScore, pickNextCountry } from './quiz.js';
import { emptyProgress, exportProgress, loadProgress, parseImport, saveProgress } from './storage.js';

export const MAX_SCORE = 10;

export const byId = (id) => document.getElementById(id);

// Same breakpoint as in style.css: there the filters cover the globe instead of
// sitting beside it.
const SMALL_SCREEN = '(max-width: 640px), (max-height: 500px)';

// The filter groups in the sidebar, each one a list of codes in the settings.
const FILTER_GROUPS = [
  { key: 'regions', boxId: 'region-filters', options: CONTINENTS, field: 'continent' },
  { key: 'levels', boxId: 'level-filters', options: LEVELS, field: 'level' },
];

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

  function setFeedback(text, kind = '') {
    feedback.textContent = text;
    feedback.className = `feedback ${kind}`;
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
    const addItem = (color, label, swatchText = '', className = '') => {
      const item = document.createElement('li');
      item.className = className;
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = color;
      swatch.textContent = swatchText;
      item.append(swatch);
      if (label) item.append(label);
      legend.append(item);
    };
    addItem(scoreColor(undefined), 'nie gefragt', '', 'gap');
    addItem(scoreColor(0), '', '0');
    for (let score = 1; score <= MAX_SCORE; score++) addItem(scoreColor(score), '', String(score));
  }

  const filteredCountries = () => filterCountries(COUNTRIES, progress.settings);

  // With nothing left to ask, every country comes up until the filters change.
  function currentPool() {
    const pool = filteredCountries();
    return pool.length ? pool : COUNTRIES;
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

  // Scores the current question and shows `message` with the new score. After a
  // correct answer the next country follows by itself; a wrong one waits for the
  // player, so the right answer can be seen.
  function finish(correct, message) {
    const score = recordAnswer(correct);
    game.isAnswered = true;
    setFeedback(`${message} (${score}/${MAX_SCORE})`, correct ? 'good' : 'bad');
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
        count.textContent = COUNTRIES.filter((country) => country[field] === code).length;
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
    const setOpen = (open) => {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };
    // On a phone the open filters cover the globe, so they always start closed there.
    setOpen(!small.matches && progress.settings.filtersOpen !== false);
    toggle.addEventListener('click', () => {
      setOpen(panel.hidden);
      if (small.matches) return;
      progress.settings.filtersOpen = !panel.hidden;
      persist();
    });
    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !small.matches) return;
      setOpen(false);
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
