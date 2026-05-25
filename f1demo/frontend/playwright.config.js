import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for F1 Demo end-to-end tests.
 *
 * Runs against the Vite dev server. CI installs only chromium via
 * `npx playwright install chromium`, which keeps the cold-cache install
 * under ~170 MB — much smaller than the full browser matrix.
 *
 * The webServer block reuses an already-running dev server on :5173 if
 * one exists (faster local loop) and otherwise spawns one for the run.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
