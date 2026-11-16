// Everything the game writes itself, in German and English: verdicts, sentences
// with country names, and the labels of the filters. `t` holds the language of the
// page. The fixed text of the pages is translated by src/page-text.js. Free of DOM
// and map code, so both languages can be checked in Node.
import { capitalOf } from '../data/capitals.js';
import { CONTINENTS, LEVELS } from '../data/countries.js';
import { capitalize, countryParts, countryPhrase, verb } from './grammar.js';
import { LANG } from './language.js';

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const de = {
  continents: CONTINENTS,
  levels: LEVELS,

  right: 'Richtig!',
  wrong: 'Falsch!',
  dontKnow: 'Schade!',
  check: 'Prüfen',
  next: 'Weiter',

  allLevels: 'Alle Stufen',
  upToLevel: (level) => `Bis Stufe ${level}`,
  asked: (count) => `${count} ${count === 1 ? 'Land wird' : 'Länder werden'} abgefragt.`,
  noneAsked: 'Keine Länder für diese Auswahl. Bis du etwas auswählst, kommen alle dran.',
  importFailed: 'Import fehlgeschlagen: Die Datei ist ungültig.',
  confirmImport: 'Aktuellen Fortschritt ersetzen?',
  confirmReset: 'Gesamten Fortschritt wirklich löschen?',
  mapFailed: 'Die Karte konnte nicht geladen werden.',
  introKicker: 'So geht’s',
  introStart: 'Los geht’s!',

  // "Das sind die Niederlande"
  thatIs: (code) => `Das ${verb(code, 'ist', 'sind')} ${countryPhrase(code, 'nominative', 'de')}`,
  // "Die Niederlande liegen hier"
  liesHere: (code) => `${capitalize(countryPhrase(code, 'nominative', 'de'))} ${verb(code, 'liegt', 'liegen')} hier`,
  // "Wo liegen die **Niederlande**?": what comes before the name in bold.
  whereVerb: (code) => [verb(code, 'liegt', 'liegen'), countryParts(code, 'nominative', 'de').article].filter(Boolean).join(' '),
  noCountryThere: 'Dort ist kein Land aus dem Quiz.',
  // "Wien liegt hier: Österreich"
  capitalIn: (capitalCode, countryName) => `${capitalOf(capitalCode, 'de').name} liegt hier: ${countryName}`,
  alsoRight: (names) => `. Auch richtig: ${names.join(', ')}`,
  // " (gleiche Flagge wie Rumänien)", or nothing.
  sameFlag: (codes) => (codes.length ? ` (gleiche Flagge wie ${codes.map((code) => countryPhrase(code, 'nominative', 'de')).join(', ')})` : ''),

  // "Nachbarn finden"
  // "Welche Länder grenzen an die **Schweiz**?": what comes before the name in bold.
  neighborsLead: (code) => ['an', countryParts(code, 'accusative', 'de').article].filter(Boolean).join(' '),
  neighborStatus: (found, total, left) => `${found} von ${total} gefunden · noch ${plural(left, 'Fehlversuch', 'Fehlversuche')}`,
  neighborOverStatus: (found, total) => `${found} von ${total} gefunden`,
  neighborFound: (name) => `Nachbar: ${name}`,
  notNeighbor: (name) => `Kein Nachbar: ${name}`,
  askedItself: 'Das ist das markierte Land selbst.',
  allNeighbors: (count) => (count === 1 ? 'Den einzigen Nachbarn gefunden' : `Alle ${count} Nachbarn gefunden`),

  // "Grenzgänger"
  // "Von der **Schweiz** in die **Niederlande**", "Von **Polen** nach **Spanien**"
  routeFrom: (code) => {
    const { article, name } = countryParts(code, 'dative', 'de');
    return { lead: article ? `Von ${article}` : 'Von', name };
  },
  routeTo: (code) => {
    const { article, name } = countryParts(code, 'accusative', 'de');
    return { lead: article ? `in ${article}` : 'nach', name };
  },
  routeStatus: (left, between) => `Noch ${plural(left, 'Versuch', 'Versuche')} · mindestens ${plural(between, 'Land', 'Länder')} dazwischen`,
  routeOverStatus: (between) => `Mindestens ${plural(between, 'Land', 'Länder')} dazwischen`,
  missing: (names) => `Gefehlt ${names.length === 1 ? 'hat' : 'haben'}: ${names.join(', ')}`,
  unknownCountry: 'Kein Land mit diesem Namen.',
  ambiguous: (codes) => `Meinst du ${codes.map((code) => countryPhrase(code, 'accusative', 'de')).join(' oder ')}?`,
  endpoint: (code, isStart) =>
    `${capitalize(countryPhrase(code, 'nominative', 'de'))} ${verb(code, 'ist', 'sind')} ${isStart ? 'der Start' : 'das Ziel'}.`,
  repeated: (code) => `${capitalize(countryPhrase(code, 'accusative', 'de'))} hast du schon genannt.`,
  onRoute: (code) => `${capitalize(countryPhrase(code, 'nominative', 'de'))} ${verb(code, 'liegt', 'liegen')} auf einem kürzesten Weg.`,
  detour: (code) => `${capitalize(countryPhrase(code, 'nominative', 'de'))} ${verb(code, 'ist', 'sind')} ein Umweg.`,
  solved: 'Geschafft!',
  lost: 'Vorbei!',
  shortest: 'Kürzester Weg!',
  longer: (count, between) => `Mit ${plural(count, 'Land', 'Ländern')}, ${between} hätten gereicht.`,
  poolHasRoute: 'Start, Ziel und kürzester Weg liegen in dieser Auswahl.',
  poolNoRoute: 'In dieser Auswahl gibt es keinen Weg mit mindestens drei Ländern dazwischen. Bis du etwas änderst, kommen alle dran.',
};

// In English a name keeps its form, and every country takes a singular verb.
const the = (code) => countryPhrase(code, 'nominative', 'en');

const en = {
  continents: {
    EU: 'Europe',
    ME: 'Middle East',
    AS: 'Asia',
    AF: 'Africa',
    NA: 'North America',
    SA: 'South America',
    OC: 'Oceania',
    AN: 'Antarctica',
  },
  levels: {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
  },

  right: 'Correct!',
  wrong: 'Wrong!',
  dontKnow: 'Too bad!',
  check: 'Check',
  next: 'Next',

  allLevels: 'All levels',
  upToLevel: (level) => `Up to level ${level}`,
  asked: (count) => `${plural(count, 'country', 'countries')} in the quiz.`,
  noneAsked: 'No countries for this selection. Until you choose some, all of them come up.',
  importFailed: 'Import failed: the file is not valid.',
  confirmImport: 'Replace your current progress?',
  confirmReset: 'Really delete all your progress?',
  mapFailed: 'The map could not be loaded.',
  introKicker: 'How to play',
  introStart: 'Let’s go!',

  thatIs: (code) => `That’s ${the(code)}`,
  liesHere: (code) => `${capitalize(the(code))} is here`,
  whereVerb: (code) => ['is', countryParts(code, 'nominative', 'en').article].filter(Boolean).join(' '),
  noCountryThere: 'There is no country from the quiz.',
  capitalIn: (capitalCode, countryName) => `${capitalOf(capitalCode, 'en').name} is here: ${countryName}`,
  alsoRight: (names) => `. Also correct: ${names.join(', ')}`,
  sameFlag: (codes) => (codes.length ? ` (same flag as ${codes.map(the).join(', ')})` : ''),

  // "Which countries border the **Netherlands**?"
  neighborsLead: (code) => countryParts(code, 'nominative', 'en').article ?? '',
  neighborStatus: (found, total, left) => `${found} of ${total} found · ${plural(left, 'wrong guess', 'wrong guesses')} left`,
  neighborOverStatus: (found, total) => `${found} of ${total} found`,
  neighborFound: (name) => `Neighbor: ${name}`,
  notNeighbor: (name) => `Not a neighbor: ${name}`,
  askedItself: 'That’s the marked country itself.',
  allNeighbors: (count) => (count === 1 ? 'Found the only neighbor' : `All ${count} neighbors found`),

  // "From **Portugal** to **China**", "From the **Netherlands** to the **United States**"
  routeFrom: (code) => {
    const { article, name } = countryParts(code, 'nominative', 'en');
    return { lead: article ? `From ${article}` : 'From', name };
  },
  routeTo: (code) => {
    const { article, name } = countryParts(code, 'nominative', 'en');
    return { lead: article ? `to ${article}` : 'to', name };
  },
  routeStatus: (left, between) => `${plural(left, 'guess', 'guesses')} left · at least ${plural(between, 'country', 'countries')} between`,
  routeOverStatus: (between) => `At least ${plural(between, 'country', 'countries')} between`,
  missing: (names) => `Missing: ${names.join(', ')}`,
  unknownCountry: 'No country by that name.',
  ambiguous: (codes) => `Do you mean ${codes.map(the).join(' or ')}?`,
  endpoint: (code, isStart) => `${capitalize(the(code))} is ${isStart ? 'the start' : 'the end'}.`,
  repeated: (code) => `You already named ${the(code)}.`,
  onRoute: (code) => `${capitalize(the(code))} is on a shortest route.`,
  detour: (code) => `${capitalize(the(code))} is a detour.`,
  solved: 'Made it!',
  lost: 'Game over!',
  shortest: 'Shortest route!',
  longer: (count, between) => `With ${plural(count, 'country', 'countries')}, ${between} would have done.`,
  poolHasRoute: 'Start, end and shortest route lie in this selection.',
  poolNoRoute: 'This selection has no route with at least three countries between. Until you change it, all of them come up.',
};

export const TEXT = { de, en };

export const t = TEXT[LANG];
