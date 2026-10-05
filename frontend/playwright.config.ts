import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  workers: 1,
  timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:5175', viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.5, channel: 'msedge', headless: true, screenshot: 'only-on-failure' },
  webServer: { command: process.env.RUN_SCENE_PRODUCTION === '1'
      ? 'npm exec vite preview -- --host 127.0.0.1 --port 5175 --strictPort'
      : 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175', reuseExistingServer: true,
    env: { VITE_API_PROXY_TARGET: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8081' } },
});
