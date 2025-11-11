import { defineConfig } from '@playwright/test';

const baseURL = process.env.PREVIEW_URL || 'http://localhost:5173';

export default defineConfig({
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 800 }
  },
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']]
});
