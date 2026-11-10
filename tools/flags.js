// Copies the flags the flags mode asks from the flag-icons package to vendor/flags/,
// in the 4:3 version. Regenerate with `npm run build:flags`.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { FLAG_COUNTRIES } from '../data/flags.js';

const source = new URL('../node_modules/flag-icons/flags/4x3/', import.meta.url);
const target = new URL('../vendor/flags/', import.meta.url);

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
copyFileSync(new URL('../node_modules/flag-icons/LICENSE', import.meta.url), new URL('LICENSE', target));
for (const { code } of FLAG_COUNTRIES) {
  const file = `${code.toLowerCase()}.svg`;
  copyFileSync(new URL(file, source), new URL(file, target));
}
console.log(`${readdirSync(target).length - 1} flags in vendor/flags/`);
