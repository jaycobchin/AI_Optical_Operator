import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3101', headless: true, trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: {
    command: 'node apps/api/server.mjs',
    url: 'http://127.0.0.1:3101/api/health',
    env: { PORT: '3101', HOST: '127.0.0.1', DATABASE_PATH: ':memory:', SEED_DEMO: 'true', COOKIE_SECURE: 'false' },
    reuseExistingServer: false,
  },
});
