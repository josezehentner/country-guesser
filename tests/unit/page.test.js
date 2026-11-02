import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');

function csp() {
  const content = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1];
  return Object.fromEntries(content.split(';').map((directive) => {
    const [name, ...values] = directive.trim().split(/\s+/);
    return [name, values];
  }));
}

test('content security policy only allows the site itself', () => {
  const policy = csp();
  assert.deepEqual(policy['default-src'], ["'self'"]);
  assert.deepEqual(policy['img-src'], ["'self'", 'data:']);
  assert.ok(!policy['script-src'], 'scripts fall back to default-src');
});

// default-src does not cover these two.
test('content security policy blocks base and form targets', () => {
  const policy = csp();
  assert.deepEqual(policy['base-uri'], ["'none'"]);
  assert.deepEqual(policy['form-action'], ["'none'"]);
});

test('github pages serves the repo without jekyll', () => {
  assert.ok(existsSync(new URL('.nojekyll', root)));
});
