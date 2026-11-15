// Grammar for country names in sentences. German: the article ("die Schweiz"), its
// case ("in der Schweiz"), and verbs that agree with plural names ("Die
// Niederlande liegen hier"). English: only "the" before some names ("the
// Netherlands"). Free of DOM and map code.
import { ARTICLES } from '../data/articles.js';
import { WITH_THE } from '../data/articles.en.js';
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { LANG } from './language.js';

const DEFINITE = {
  f: { nominative: 'die', accusative: 'die', dative: 'der' },
  m: { nominative: 'der', accusative: 'den', dative: 'dem' },
  n: { nominative: 'das', accusative: 'das', dative: 'dem' },
  pl: { nominative: 'die', accusative: 'die', dative: 'den' },
};

// The article and the name after it, kept apart so a page can set the name in
// bold: { article: 'den', name: 'Niederlanden' }, or { article: '', name: 'Polen' }.
// In English the case makes no difference: { article: 'the', name: 'Netherlands' }.
export function countryParts(code, grammaticalCase = 'nominative', language = LANG) {
  const { names } = COUNTRY_BY_CODE.get(code);
  if (language === 'en') return { article: WITH_THE.has(code) ? 'the' : '', name: names.en };
  const plain = names.de;
  const entry = ARTICLES[code];
  if (!entry) return { article: '', name: plain };
  const name = grammaticalCase === 'dative' ? (entry.dative ?? entry.name ?? plain) : (entry.name ?? plain);
  return { article: DEFINITE[entry.gender][grammaticalCase], name };
}

// The name with its article, e.g. "die Schweiz", "dem Iran", "Polen".
export function countryPhrase(code, grammaticalCase = 'nominative', language = LANG) {
  const { article, name } = countryParts(code, grammaticalCase, language);
  return article ? `${article} ${name}` : name;
}

export const isPlural = (code) => ARTICLES[code]?.gender === 'pl';

// The verb form that agrees with the country: verb('NL', 'liegt', 'liegen') is "liegen".
export const verb = (code, singular, plural) => (isPlural(code) ? plural : singular);

export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
