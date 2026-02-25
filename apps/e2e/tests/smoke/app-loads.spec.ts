import { test, expect } from '../../fixtures';

test.describe('Smoke — App Loading @smoke', () => {
  test('renders the app shell with sidebar and chat panel', async ({ basePage }) => {
    await basePage.goto();
    await basePage.waitForAppReady();

    await expect(basePage.page.locator('[data-testid="session-sidebar"]')).toBeVisible();
    await expect(basePage.page.locator('[data-testid="chat-panel"]')).toBeVisible();
  });

  test('displays the status line', async ({ basePage }) => {
    await basePage.goto();
    await basePage.waitForAppReady();

    await expect(basePage.page.locator('[data-testid="status-line"]')).toBeVisible();
  });
});
