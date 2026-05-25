import { test, expect } from '@playwright/test';

/**
 * Smoke tests — confirm the app boots, the sidebar is keyboard-navigable,
 * and there are no uncaught JS errors on the dashboard.
 */

test.describe('smoke', () => {
  test('dashboard renders and the F1 logo + skip-link are present', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });

    await page.goto('/');
    await expect(page.locator('.sidebar-logo')).toHaveText(/F1/);

    // First Tab should land on the skip-link.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /skip to content/i })).toBeFocused();

    // Filter known noisy network failures (no live session, OpenF1 outside windows).
    const meaningful = errors.filter(
      (e) => !/Failed to load resource|404|HTTP 404/.test(e),
    );
    expect(meaningful, meaningful.join('\n')).toEqual([]);
  });

  test('sidebar exposes every primary route', async ({ page }) => {
    await page.goto('/');
    for (const label of ['Dashboard', 'Drivers', 'Constructors', 'Calendar', 'Analysis', 'Telemetry', 'News Feed']) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('navigates to Calendar without crashing', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Calendar' }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    // Page header / hero must render
    await expect(page.locator('main#main')).toBeVisible();
  });
});
