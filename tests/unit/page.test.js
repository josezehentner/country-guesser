import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const pages = readdirSync(root).filter((name) => name.endsWith('.html'));

function csp(page) {
  const html = readFileSync(new URL(page, root), 'utf8');
  const content = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1];
  return Object.fromEntries(content.split(';').map((directive) => {
    const [name, ...values] = directive.trim().split(/\s+/);
    return [name, values];
  }));
}

test('the menu and every mode are pages of their own', () => {
  assert.ok(pages.includes('index.html'));
  assert.ok(pages.includes('name-countries.html'));
  assert.ok(pages.includes('find-countries.html'));
  assert.ok(pages.includes('capitals.html'));
  assert.ok(pages.includes('find-capitals.html'));
  assert.ok(pages.includes('flags.html'));
  assert.ok(pages.includes('borders.html'));
});

test('content security policy only allows the site itself', () => {
  for (const page of pages) {
    const policy = csp(page);
    assert.deepEqual(policy['default-src'], ["'self'"], page);
    assert.deepEqual(policy['img-src'], ["'self'", 'data:'], page);
    assert.ok(!policy['script-src'], `${page}: scripts fall back to default-src`);
  }
});

// default-src does not cover these two.
test('content security policy blocks base and form targets', () => {
  for (const page of pages) {
    const policy = csp(page);
    assert.deepEqual(policy['base-uri'], ["'none'"], page);
    assert.deepEqual(policy['form-action'], ["'none'"], page);
  }
});

test('github pages serves the repo without jekyll', () => {
  assert.ok(existsSync(new URL('.nojekyll', root)));
});

test('every mode has the button that turns the globe back to the marked country, hidden at first', () => {
  for (const page of pages.filter((name) => name !== 'index.html')) {
    const html = readFileSync(new URL(page, root), 'utf8');
    const button = html.match(/<button[^>]*id="recenter-btn"[^>]*>/)?.[0];
    assert.ok(button, page);
    assert.match(button, /type="button"/, page);
    // In "Grenzgänger" it shows start and end of the route again.
    const label = page === 'borders.html' ? 'Start und Ziel zeigen' : 'Zum markierten Land';
    assert.match(button, new RegExp(`aria-label="${label}"`), page);
    assert.match(button, /\shidden[\s>]/, page);
  }
});
