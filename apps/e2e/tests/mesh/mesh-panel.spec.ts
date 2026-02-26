import { test, expect } from '../../fixtures';

test.describe('Mesh — Discovery Panel @smoke', () => {
  test.beforeEach(async ({ basePage }) => {
    await basePage.goto();
    await basePage.waitForAppReady();
  });

  test('opens and closes the Mesh dialog', async ({ meshPage }) => {
    await meshPage.open();
    await expect(meshPage.heading).toBeVisible();
    await expect(meshPage.description).toBeVisible();

    await meshPage.close();
    await expect(meshPage.dialog).toBeHidden();
  });

  test('has Topology, Discovery, Agents, Denied, and Access tabs', async ({ meshPage }) => {
    await meshPage.open();

    const tabs = ['Topology', 'Discovery', 'Agents', 'Denied', 'Access'];
    for (const tabName of tabs) {
      await expect(meshPage.tab(tabName)).toBeVisible();
    }
  });

  test('Topology tab shows empty state', async ({ meshPage }) => {
    await meshPage.open();

    // Topology is default tab
    await expect(meshPage.activePanel.getByText(/no agents discovered/i)).toBeVisible();
  });

  test('Discovery tab has scan input and button', async ({ meshPage }) => {
    await meshPage.open();
    await meshPage.tab('Discovery').click();

    await expect(meshPage.scanInput).toBeVisible();
    await expect(meshPage.scanButton).toBeVisible();
    await expect(meshPage.scanButton).toBeDisabled();
  });

  test('Scan button enables when roots are entered', async ({ meshPage }) => {
    await meshPage.open();
    await meshPage.tab('Discovery').click();

    await meshPage.scanInput.fill('~/projects');
    await expect(meshPage.scanButton).toBeEnabled();
  });

  test('Agents tab shows empty state', async ({ meshPage }) => {
    await meshPage.open();
    await meshPage.tab('Agents').click();

    await expect(meshPage.activePanel.getByText(/no agents registered/i)).toBeVisible();
  });

  test('Denied tab shows empty state', async ({ meshPage }) => {
    await meshPage.open();
    await meshPage.tab('Denied').click();

    await expect(meshPage.activePanel.getByText(/no denied/i)).toBeVisible();
  });

  test('shows agent count in header', async ({ meshPage }) => {
    await meshPage.open();

    await expect(meshPage.agentCount).toBeVisible();
  });
});
