import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: 'production.spec.js',
  timeout: 120000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, screenshot: 'only-on-failure', serviceWorkers: 'block' },
  projects: [
    { name: 'Chrome-Windows', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'Edge-Windows', use: { browserName: 'chromium', channel: 'msedge' } },
  ],
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
