import { defineConfig } from '@playwright/test';

const PORT = 4173;

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
    reuseExistingServer: true,
    stderr: 'ignore',
  },
});
