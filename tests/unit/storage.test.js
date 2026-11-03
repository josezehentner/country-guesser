import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { emptyProgress, loadProgress, parseImport, saveProgress } from '../../src/storage.js';

const KEY = 'countryquiz.v1';
const entry = { score: 7, seen: 12, correct: 9, lastSeen: '2026-10-30T21:00:00Z' };

function stubLocalStorage(value) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => value });
}

function memoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, item) => items.set(key, item),
  };
}

const throwingStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
};

beforeEach(() => stubLocalStorage(memoryStorage()));

test('progress survives a save and load', () => {
  const progress = { version: 1, countries: { AT: entry }, settings: { regions: ['EU', 'ME'], levels: ['easy'], filtersOpen: false } };
  assert.equal(saveProgress(progress), true);
  assert.deepEqual(loadProgress(), progress);
});

test('each mode keeps its own progress under its own key', () => {
  const progress = { version: 1, countries: { AT: entry }, settings: {} };
  assert.equal(saveProgress(progress, 'countryquiz.find.v1'), true);
  assert.deepEqual(loadProgress('countryquiz.find.v1'), progress);
  assert.deepEqual(loadProgress(), emptyProgress());
});

test('empty storage loads as empty progress', () => {
  assert.deepEqual(loadProgress(), emptyProgress());
});

test('loading drops invalid entries but keeps valid ones', () => {
  const stored = {
    version: 1,
    countries: {
      AT: entry,
      ZZ: entry,
      FR: { ...entry, score: 11 },
      DE: { ...entry, score: 1.5 },
      IT: { ...entry, correct: 99 },
      ES: { ...entry, lastSeen: 'not a date' },
      PT: null,
    },
    settings: { continent: 'Atlantis' },
  };
  stubLocalStorage(memoryStorage({ [KEY]: JSON.stringify(stored) }));
  assert.deepEqual(loadProgress(), { version: 1, countries: { AT: entry }, settings: {} });
});

test('filters keep only known, distinct codes', () => {
  const settings = { regions: ['EU', 'EU', 'XX', 7], levels: ['hard', 'impossible'], filtersOpen: 'yes', extra: 1 };
  stubLocalStorage(memoryStorage({ [KEY]: JSON.stringify({ version: 1, countries: {}, settings }) }));
  assert.deepEqual(loadProgress().settings, { regions: ['EU'], levels: ['hard'] });
});

test('an emptied filter stays empty, one with only unknown codes means no filter', () => {
  const settings = { regions: [], levels: ['impossible'] };
  stubLocalStorage(memoryStorage({ [KEY]: JSON.stringify({ version: 1, countries: {}, settings }) }));
  assert.deepEqual(loadProgress().settings, { regions: [] });
});

test('the old single continent becomes a region filter', () => {
  stubLocalStorage(memoryStorage({ [KEY]: JSON.stringify({ version: 1, countries: {}, settings: { continent: 'AF' } }) }));
  assert.deepEqual(loadProgress().settings, { regions: ['AF'] });
  const file = { version: 1, countries: { AT: entry }, settings: { continent: 'SA' } };
  assert.deepEqual(parseImport(JSON.stringify(file)).settings, { regions: ['SA'] });
});

test('loading strips unknown fields from entries', () => {
  const stored = { version: 1, countries: { AT: { ...entry, extra: 'x' } }, settings: {} };
  stubLocalStorage(memoryStorage({ [KEY]: JSON.stringify(stored) }));
  assert.deepEqual(loadProgress().countries.AT, entry);
});

for (const [label, stored] of [['corrupt JSON', '{oops'], ['unknown version', '{"version":2}'], ['null', 'null']]) {
  test(`${label} in storage loads as empty progress`, () => {
    stubLocalStorage(memoryStorage({ [KEY]: stored }));
    assert.deepEqual(loadProgress(), emptyProgress());
  });
}

test('blocked localStorage does not throw', () => {
  stubLocalStorage(throwingStorage);
  assert.deepEqual(loadProgress(), emptyProgress());
  assert.equal(saveProgress(emptyProgress()), false);
});

test('parseImport accepts a valid file', () => {
  const file = { version: 1, countries: { AT: entry }, settings: { regions: ['AF'], levels: ['easy', 'medium'] } };
  assert.deepEqual(parseImport(JSON.stringify(file)), file);
});

const invalidFiles = {
  'broken JSON': '{oops',
  'null': 'null',
  'wrong version': '{"version":2,"countries":{}}',
  'missing countries': '{"version":1}',
  'countries as array': '{"version":1,"countries":[]}',
  'unknown country': JSON.stringify({ version: 1, countries: { ZZ: entry } }),
  'prototype key': `{"version":1,"countries":{"__proto__":${JSON.stringify(entry)}}}`,
  'score out of range': JSON.stringify({ version: 1, countries: { AT: { ...entry, score: 11 } } }),
  'score as string': JSON.stringify({ version: 1, countries: { AT: { ...entry, score: '7' } } }),
  'markup as date': JSON.stringify({ version: 1, countries: { AT: { ...entry, lastSeen: '<img>' } } }),
};
for (const [label, file] of Object.entries(invalidFiles)) {
  test(`parseImport rejects ${label}`, () => assert.equal(parseImport(file), null));
}
