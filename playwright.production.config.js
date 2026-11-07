import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'production.spec.js',
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true, serviceWorkers: 'block' },
  projects: [
    { name: 'Chrome-production', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'Edge-production', use: { browserName: 'chromium', channel: 'msedge' } },
  ],
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173' },
});
