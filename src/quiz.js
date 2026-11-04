import { COUNTRIES } from '../data/countries.js';
import { ALIASES } from '../data/aliases.js';
import { CAPITALS, capitalNames } from '../data/capitals.js';

const MAX_SCORE = 10;
const FIRST_CORRECT_SCORE = 5;
const FIRST_WRONG_SCORE = 3;
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

const uniqueNormalized = (names) => [...new Set(names.map(normalize))];

const namesByCode = new Map(
  COUNTRIES.map(({ code, name, intlName }) => [code, uniqueNormalized([name, intlName, ...(ALIASES[code] ?? [])])]),
);

const capitalsByCode = new Map(Object.keys(CAPITALS).map((code) => [code, uniqueNormalized(capitalNames(code))]));

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
// to an answer for a different code (e.g. "Ira" could be Irak or Iran).
function matches(answersByCode, input, code) {
  const answer = normalize(input);
  if (!answer) return false;

  const targetNames = answersByCode.get(code);
  if (!targetNames) return false;
  if (targetNames.includes(answer)) return true;
  if (!targetNames.some((name) => isWithinTolerance(answer, name))) return false;

  for (const [otherCode, names] of answersByCode) {
    if (otherCode !== code && names.some((name) => isWithinTolerance(answer, name))) return false;
  }
  return true;
}

// Whether `input` names the country `code`.
export const isCorrectAnswer = (input, code) => matches(namesByCode, input, code);

// Whether `input` names the capital of `code`, or one of its official capitals.
export const isCorrectCapital = (input, code) => matches(capitalsByCode, input, code);

const officialCapitalsByCode = new Map(
  Object.entries(CAPITALS).map(([code, { name, also = [] }]) => [code, uniqueNormalized([name, ...also])]),
);

// Whether two codes have an official capital of the same name, apart from spaces and
// hyphens (Kingston: Jamaica and Norfolk Island; Basseterre and Basse-Terre). Asked
// for that capital, either place is a right answer.
export function sharesCapital(code, otherCode) {
  if (code === otherCode) return true;
  const names = officialCapitalsByCode.get(code);
  const otherNames = officialCapitalsByCode.get(otherCode);
  return Boolean(names && otherNames && names.some((name) => otherNames.includes(name)));
}

// The first answer sets a starting score; later answers move it by one.
export function nextScore(entry, correct) {
  if (!entry) return correct ? FIRST_CORRECT_SCORE : FIRST_WRONG_SCORE;
  return Math.max(0, Math.min(MAX_SCORE, entry.score + (correct ? 1 : -1)));
}

// Weaker and never-asked countries come up more often; mastered ones rarely.
export function selectionWeight(entry) {
  if (!entry) return 8;
  if (entry.score >= 10) return 0.25;
  return 10 - entry.score;
}

// The countries the filters let through. A missing group means all of it.
export function filterCountries(countries, { regions, levels } = {}) {
  return countries.filter(
    (country) => (!regions || regions.includes(country.continent)) && (!levels || levels.includes(country.level)),
  );
}

// Avoids asking the same country twice in a row, unless it is the only one left.
export function pickNextCountry(pool, progress, previousCode, random = Math.random) {
  const others = pool.filter((country) => country.code !== previousCode);
  const candidates = others.length ? others : pool;
  const weights = candidates.map((country) => selectionWeight(progress[country.code]));
  let remaining = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < candidates.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
