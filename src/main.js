import { COUNTRIES, COUNTRY_BY_CODE, CONTINENTS } from '../data/countries.js';
import { scoreColor } from './colors.js';
import { createMap } from './map.js';
import { isCorrectAnswer, nextScore, pickNextCountry } from './quiz.js';
import { emptyProgress, exportProgress, loadProgress, parseImport, saveProgress } from './storage.js';

const MAX_SCORE = 10;
// After an answer the next country follows by itself, so one key press is enough.
const NEXT_DELAY_MS = 400;

const byId = (id) => document.getElementById(id);
const form = byId('answer-form');
const input = byId('answer-input');
const submitButton = byId('submit-btn');
const dontKnowButton = byId('dont-know-btn');
const feedback = byId('feedback');
const continentFilter = byId('continent-filter');
const importFile = byId('import-file');

let progress = loadProgress();
let map = null;
let current = null;
let previousCode = null;
let answered = false;
let nextTimer = null;

function setFeedback(text, kind = '') {
  feedback.textContent = text;
  feedback.className = `feedback ${kind}`;
}

function persist() {
  byId('storage-notice').hidden = saveProgress(progress);
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
  map.setColor(code, scoreColor(progress.countries[code]?.score));
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

function currentPool() {
  const continent = progress.settings.continent;
  return continent ? COUNTRIES.filter((country) => country.continent === continent) : COUNTRIES;
}

function nextQuestion() {
  current = pickNextCountry(currentPool(), progress.countries, previousCode);
  previousCode = current.code;
  clearTimeout(nextTimer);
  answered = false;
  input.value = '';
  submitButton.textContent = 'Prüfen';
  dontKnowButton.disabled = false;
  setFeedback('');
  map.hideTooltip();
  map.highlight(current.code);
  input.focus({ preventScroll: true });
}

function recordAnswer(correct) {
  const previous = progress.countries[current.code];
  const entry = previous ?? { score: 0, seen: 0, correct: 0, lastSeen: '' };
  entry.score = nextScore(previous, correct);
  entry.seen += 1;
  if (correct) entry.correct += 1;
  entry.lastSeen = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  progress.countries[current.code] = entry;
  persist();
  renderCountry(current.code);
  renderStats();
  return entry.score;
}

function finishQuestion(correct, wrongPrefix) {
  const score = recordAnswer(correct);
  answered = true;
  // The field stays editable: a read-only field would close the phone keyboard.
  input.value = '';
  submitButton.textContent = 'Weiter';
  dontKnowButton.disabled = true;
  if (correct) setFeedback(`Richtig: ${current.name} (${score}/${MAX_SCORE})`, 'good');
  else setFeedback(`${wrongPrefix} Das ist ${current.name} (${score}/${MAX_SCORE})`, 'bad');
  input.focus({ preventScroll: true });
  nextTimer = setTimeout(nextQuestion, NEXT_DELAY_MS);
}

function tooltipText(code) {
  // The country being asked must not give away its own name.
  if (code === current?.code && !answered) return null;
  const entry = progress.countries[code];
  return entry ? `${COUNTRY_BY_CODE.get(code).name}: ${entry.score}/${MAX_SCORE}` : null;
}

function setupControls() {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (answered) {
      nextQuestion();
    } else if (input.value.trim()) {
      finishQuestion(isCorrectAnswer(input.value, current.code), 'Falsch.');
    }
  });

  // Typing the next answer during the pause moves on at once and keeps the letters.
  input.addEventListener('input', () => {
    if (!answered) return;
    const typed = input.value;
    nextQuestion();
    input.value = typed;
  });

  dontKnowButton.addEventListener('click', () => {
    if (!answered) finishQuestion(false, 'Schade.');
  });

  const settings = byId('settings');
  byId('settings-btn').addEventListener('click', () => settings.showModal());
  byId('settings-close').addEventListener('click', () => settings.close());
  settings.addEventListener('close', () => input.focus({ preventScroll: true }));
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

  byId('export-btn').addEventListener('click', () => exportProgress(progress));

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

async function start() {
  try {
    const response = await fetch('data/world.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const world = await response.json();
    map = createMap(byId('map'), byId('map-target'), byId('tooltip'), world, tooltipText);
  } catch (error) {
    console.error(error);
    byId('loading').textContent = 'Die Karte konnte nicht geladen werden.';
    return;
  }
  byId('loading').hidden = true;
  byId('storage-notice').hidden = saveProgress(progress);
  renderLegend();
  renderAll();
  setupControls();
  input.disabled = false;
  submitButton.disabled = false;
  nextQuestion();
}

fitToVisibleArea();
start();
