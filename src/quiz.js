import { COUNTRIES } from '../data/countries.js';
import { ALIASES } from '../data/aliases.js';

const MIN_FUZZY_LENGTH = 4;
const LONG_NAME_LENGTH = 8;

// Lowercases and strips diacritics, whitespace and punctuation.
export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

const namesByCode = new Map(
  COUNTRIES.map(({ code, name, intlName }) => [
    code,
    [...new Set([name, intlName, ...(ALIASES[code] ?? [])].map(normalize))],
  ]),
);

function levenshtein(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

function typoTolerance(name) {
  if (name.length < MIN_FUZZY_LENGTH) return 0;
  return name.length < LONG_NAME_LENGTH ? 1 : 2;
}

function isWithinTolerance(input, name) {
  return levenshtein(input, name) <= typoTolerance(name);
}

// Exact matches always win; a typo only counts if the input is not also close
// to the name of a different country (e.g. "Ira" could be Irak or Iran).
export function isCorrectAnswer(input, code) {
  const answer = normalize(input);
  if (!answer) return false;

  const targetNames = namesByCode.get(code);
  if (targetNames.includes(answer)) return true;
  if (!targetNames.some((name) => isWithinTolerance(answer, name))) return false;

  for (const [otherCode, names] of namesByCode) {
    if (otherCode !== code && names.some((name) => isWithinTolerance(answer, name))) return false;
  }
  return true;
}

// Weaker and never-asked countries come up more often; mastered ones rarely.
export function selectionWeight(entry) {
  if (!entry) return 8;
  if (entry.score >= 10) return 0.25;
  return 10 - entry.score;
}

export function pickNextCountry(pool, progress, previousCode, random = Math.random) {
  const candidates = pool.filter((country) => country.code !== previousCode);
  const weights = candidates.map((country) => selectionWeight(progress[country.code]));
  let remaining = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < candidates.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
