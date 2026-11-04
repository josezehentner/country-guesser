import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { networkInterfaces } from 'node:os';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../tools/serve.py', import.meta.url));

// This computer's address in the local network, if it has one.
const lanAddress = Object.values(networkInterfaces()).flat()
  .find((address) => address.family === 'IPv4' && !address.internal)?.address;

// Starts tools/serve.py on a free port and resolves once it says where it serves.
async function serve(t, ...args) {
  const server = spawn('python3', [script, ...args], { env: { ...process.env, PORT: '0' } });
  t.after(() => server.kill());
  let output = '';
  server.stdout.setEncoding('utf8');
  while (!output.includes('\n') || (args.includes('--lan') && output.split('\n').length < 3)) {
    const [chunk] = await once(server.stdout, 'data');
    output += chunk;
  }
  const port = Number(output.match(/localhost:(\d+)/)[1]);
  return { port, output };
}

async function reachable(host, port) {
  try {
    await fetch(`http://${host}:${port}/`);
    return true;
  } catch {
    return false;
  }
}

test('the dev server tells browsers not to cache anything', { timeout: 10_000 }, async (t) => {
  const { port } = await serve(t);
  const response = await fetch(`http://127.0.0.1:${port}/index.html`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('hidden files and folders are never served', { timeout: 10_000 }, async (t) => {
  const { port } = await serve(t);
  for (const path of ['/.gitignore', '/%2Egitignore', '/.github/workflows/', '/data/../.gitignore']) {
    assert.equal((await fetch(`http://127.0.0.1:${port}${path}`)).status, 404, path);
  }
});

test('by default only this computer reaches the dev server', { timeout: 10_000 }, async (t) => {
  const { port, output } = await serve(t);
  assert.doesNotMatch(output, /Wi-Fi/);
  assert.equal(await reachable('127.0.0.1', port), true);
  if (lanAddress) assert.equal(await reachable(lanAddress, port), false);
});

test('with --lan, phones in the same network reach it at the address it prints', { timeout: 10_000 }, async (t) => {
  const { port, output } = await serve(t, '--lan');
  const printed = output.match(/Wi-Fi: http:\/\/([\d.]+):(\d+)/);
  assert.ok(printed, output);
  assert.equal(Number(printed[2]), port);
  const response = await fetch(`http://127.0.0.1:${port}/index.html`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  if (lanAddress) assert.equal(await reachable(lanAddress, port), true);
});
