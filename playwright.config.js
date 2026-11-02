import { createHash } from 'node:crypto';
import { defineConfig } from '@playwright/test';

// Each worktree gets its own port, derived from its folder, so test runs in parallel
// sessions never meet. TEST_PORT overrides it.
const folderHash = parseInt(createHash('sha1').update(process.cwd()).digest('hex').slice(0, 8), 16);
const PORT = Number(process.env.TEST_PORT) || 4200 + (folderHash % 800);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    browserName: 'firefox',
    colorScheme: 'light',
    acceptDownloads: true,
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    // A server already on this port belongs to something else: fail instead of
    // silently testing its code.
    reuseExistingServer: false,
    stderr: 'ignore',
  },
});
