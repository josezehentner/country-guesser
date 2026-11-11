// German grammar for country names in sentences: the article ("die Schweiz"), its
// case ("in der Schweiz"), and verbs that agree with plural names ("Die
// Niederlande liegen hier"). Free of DOM and map code.
import { ARTICLES } from '../data/articles.js';
import { COUNTRY_BY_CODE } from '../data/countries.js';

const DEFINITE = {
  f: { nominative: 'die', accusative: 'die', dative: 'der' },
  m: { nominative: 'der', accusative: 'den', dative: 'dem' },
  n: { nominative: 'das', accusative: 'das', dative: 'dem' },
  pl: { nominative: 'die', accusative: 'die', dative: 'den' },
};

// The article and the name after it, kept apart so a page can set the name in
// bold: { article: 'den', name: 'Niederlanden' }, or { article: '', name: 'Polen' }.
export function countryParts(code, grammaticalCase = 'nominative') {
  const plain = COUNTRY_BY_CODE.get(code).name;
  const entry = ARTICLES[code];
  if (!entry) return { article: '', name: plain };
  const name = grammaticalCase === 'dative' ? (entry.dative ?? entry.name ?? plain) : (entry.name ?? plain);
  return { article: DEFINITE[entry.gender][grammaticalCase], name };
}

// The name with its article, e.g. "die Schweiz", "dem Iran", "Polen".
export function countryPhrase(code, grammaticalCase = 'nominative') {
  const { article, name } = countryParts(code, grammaticalCase);
  return article ? `${article} ${name}` : name;
}

export const isPlural = (code) => ARTICLES[code]?.gender === 'pl';

// The verb form that agrees with the country: verb('NL', 'liegt', 'liegen') is "liegen".
export const verb = (code, singular, plural) => (isPlural(code) ? plural : singular);

export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
