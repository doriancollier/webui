import { test, expect } from '../../fixtures';

test.describe('Relay — Messaging Panel @smoke', () => {
  test.beforeEach(async ({ basePage }) => {
    await basePage.goto();
    await basePage.waitForAppReady();
  });

  test('opens and closes the Relay dialog', async ({ relayPage }) => {
    await relayPage.open();
    await expect(relayPage.heading).toBeVisible();
    await expect(relayPage.description).toBeVisible();

    await relayPage.close();
    await expect(relayPage.dialog).toBeHidden();
  });

  test('has Activity, Endpoints, and Adapters tabs', async ({ relayPage }) => {
    await relayPage.open();

    const tabs = ['Activity', 'Endpoints', 'Adapters'];
    for (const tabName of tabs) {
      await expect(relayPage.tab(tabName)).toBeVisible();
    }
  });

  test('Activity tab shows empty state with filter', async ({ relayPage }) => {
    await relayPage.open();

    // Activity is default tab
    await expect(relayPage.activityFilter).toBeVisible();
    await expect(relayPage.noMessagesText).toBeVisible();
  });

  test('Endpoints tab shows registered system console endpoint', async ({ relayPage }) => {
    await relayPage.open();
    await relayPage.tab('Endpoints').click();

    await expect(relayPage.endpoint('relay.system.console')).toBeVisible();
  });

  test('Adapters tab shows claude-code adapter with toggle', async ({ relayPage }) => {
    await relayPage.open();
    await relayPage.tab('Adapters').click();

    // "claude-code" appears as both a name span and a badge — use the span
    await expect(relayPage.activePanel.locator('span', { hasText: 'claude-code' })).toBeVisible();
    await expect(relayPage.activePanel.getByRole('switch')).toBeVisible();
    await expect(relayPage.activePanel.getByRole('switch')).toBeChecked();
  });
});
