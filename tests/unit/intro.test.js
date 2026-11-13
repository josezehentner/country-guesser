import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INTROS } from '../../src/intro-content.js';

const root = new URL('../../', import.meta.url);
const css = readFileSync(new URL('style.css', root), 'utf8');
const modePages = readdirSync(root).filter((name) => name.endsWith('.html') && name !== 'index.html');

// The guide each page opens with, from the `intro` of its mode module.
function introOf(page) {
  const html = readFileSync(new URL(page, root), 'utf8');
  const script = html.match(/<script type="module" src="([^"]+)"/)[1];
  return readFileSync(new URL(script, root), 'utf8').match(/^\s*intro: '([^']+)'/m)?.[1];
}

const headings = (guide) => guide.sections.map(({ heading }) => heading);
const colorItems = (guide) => guide.sections.flatMap(({ items }) => items).filter((item) => typeof item !== 'string');
const colorsOf = (guide) => colorItems(guide).flatMap(({ swatches }) => swatches.map(({ color }) => color));
const allText = (guide) => guide.sections.flatMap(({ heading, items }) => [heading, ...items.map((item) => item.text ?? item)]).join(' ');

test('every mode page opens with a guide of its own, named like the page', () => {
  const used = modePages.map(introOf);
  assert.deepEqual([...used].sort(), Object.keys(INTROS).sort());
  for (const page of modePages) {
    const title = readFileSync(new URL(page, root), 'utf8').match(/<h1>([^<]+)<\/h1>/)[1];
    assert.equal(INTROS[introOf(page)].title, title, page);
  }
});

test('every guide explains the rules, the filters on the left, the colors and the controls', () => {
  for (const [mode, guide] of Object.entries(INTROS)) {
    for (const heading of ['Spielregeln', 'Links: Filter', 'Farben', 'Bedienung']) assert.ok(headings(guide).includes(heading), `${mode}: ${heading}`);
    assert.match(allText(guide), /„Filter“ am linken Rand/, mode);
    assert.match(allText(guide), /„Weiß ich nicht“/, mode);
    assert.match(allText(guide), /\? öffnet diese Anleitung wieder/, mode);
    for (const { items } of guide.sections) assert.ok(items.length, `${mode}: empty section`);
  }
});

test('modes with scores explain the scale and slider on the right and every score color', () => {
  for (const [mode, guide] of Object.entries(INTROS).filter(([name]) => name !== 'borders')) {
    assert.ok(headings(guide).includes('Rechts: Wissensstufen'), mode);
    assert.match(allText(guide), /Schieber/, mode);
    const colors = colorsOf(guide);
    for (const token of ['--never', '--score-zero', ...Array.from({ length: 10 }, (_, i) => `--score-${i + 1}`), '--flash-good', '--flash-bad']) {
      assert.ok(colors.includes(`var(${token})`), `${mode}: ${token}`);
    }
  }
});

test('"Grenzgänger" has no scale and explains its route colors instead', () => {
  const guide = INTROS.borders;
  assert.ok(!headings(guide).includes('Rechts: Wissensstufen'));
  assert.doesNotMatch(allText(guide), /Schwierigkeit/);
  assert.deepEqual(colorsOf(guide), ['start', 'end', 'step', 'detour', 'missing'].map((kind) => `var(--route-${kind})`));
});

test('every color in a guide is a token defined in style.css, with a text saying what it means', () => {
  for (const [mode, guide] of Object.entries(INTROS)) {
    for (const item of colorItems(guide)) {
      assert.ok(item.text, mode);
      for (const { color } of item.swatches) {
        const token = color.match(/^var\((--[\w-]+)\)$/)?.[1];
        assert.ok(token && css.includes(`${token}:`), `${mode}: ${color}`);
      }
    }
  }
});
