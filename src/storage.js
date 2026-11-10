import { COUNTRY_BY_CODE, CONTINENTS, LEVELS } from '../data/countries.js';

// Each mode keeps its own progress under its own key.
export const STORAGE_KEY = 'countryquiz.v1';
const VERSION = 1;

export function emptyProgress() {
  return { version: VERSION, countries: {}, settings: {} };
}

function isValidEntry(entry) {
  return (
    entry !== null &&
    typeof entry === 'object' &&
    Number.isInteger(entry.score) && entry.score >= 0 && entry.score <= 10 &&
    Number.isInteger(entry.seen) && entry.seen >= 1 &&
    Number.isInteger(entry.correct) && entry.correct >= 0 && entry.correct <= entry.seen &&
    typeof entry.lastSeen === 'string' && !Number.isNaN(Date.parse(entry.lastSeen))
  );
}

// Keeps the known, distinct codes of a filter list. An empty list stays empty (the
// player unticked everything), but one with only unknown codes means no filter.
function sanitizeList(list, known) {
  if (!Array.isArray(list)) return undefined;
  const codes = [...new Set(list.filter((code) => typeof code === 'string' && Object.hasOwn(known, code)))];
  return codes.length || !list.length ? codes : undefined;
}

// Older versions kept a single `continent`; it becomes a one-region filter.
function sanitizeSettings(settings) {
  const result = {};
  if (settings === null || typeof settings !== 'object') return result;
  const regions = sanitizeList(settings.regions ?? (typeof settings.continent === 'string' ? [settings.continent] : undefined), CONTINENTS);
  const levels = sanitizeList(settings.levels, LEVELS);
  if (regions) result.regions = regions;
  if (levels) result.levels = levels;
  if (typeof settings.filtersOpen === 'boolean') result.filtersOpen = settings.filtersOpen;
  // 10, the highest score, is the same as no limit.
  if (Number.isInteger(settings.maxScore) && settings.maxScore >= 0 && settings.maxScore < 10) result.maxScore = settings.maxScore;
  return result;
}

function copyEntry({ score, seen, correct, lastSeen }) {
  return { score, seen, correct, lastSeen };
}

// Lenient: used for localStorage, drops whatever it does not recognize.
function sanitize(raw) {
  const progress = emptyProgress();
  if (raw === null || typeof raw !== 'object' || raw.version !== VERSION) return progress;
  if (raw.countries !== null && typeof raw.countries === 'object') {
    for (const [code, entry] of Object.entries(raw.countries)) {
      if (COUNTRY_BY_CODE.has(code) && isValidEntry(entry)) progress.countries[code] = copyEntry(entry);
    }
  }
  progress.settings = sanitizeSettings(raw.settings);
  return progress;
}

// Strict: used for imported files, returns null unless everything is valid.
export function parseImport(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object' || raw.version !== VERSION) return null;
  if (raw.countries === null || typeof raw.countries !== 'object' || Array.isArray(raw.countries)) return null;
  const allValid = Object.entries(raw.countries).every(
    ([code, entry]) => COUNTRY_BY_CODE.has(code) && isValidEntry(entry),
  );
  return allValid ? sanitize(raw) : null;
}

export function loadProgress(key = STORAGE_KEY) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? sanitize(JSON.parse(stored)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

// Returns false if the progress could not be persisted.
export function saveProgress(progress, key = STORAGE_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function exportProgress(progress, filePrefix = 'countryquiz-progress') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filePrefix}-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
