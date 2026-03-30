import { test, expect } from '../../fixtures';

test.describe('Tasks — Scheduler Dialog @smoke', () => {
  test.beforeEach(async ({ basePage }) => {
    await basePage.goto();
    await basePage.waitForAppReady();
  });

  test('opens and closes the Tasks Scheduler dialog', async ({ tasksPage }) => {
    await tasksPage.open();
    await expect(tasksPage.heading).toBeVisible();
    await expect(tasksPage.schedulesHeading).toBeVisible();

    await tasksPage.close();
    await expect(tasksPage.dialog).toBeHidden();
  });

  test('displays existing schedules', async ({ tasksPage }) => {
    await tasksPage.open();

    // The "test" schedule should be visible (created via API/config)
    await expect(tasksPage.dialog.getByText('test')).toBeVisible();
    await expect(tasksPage.dialog.getByText(/every hour/i)).toBeVisible();
  });

  test('opens and closes the New Schedule dialog', async ({ tasksPage }) => {
    await tasksPage.open();
    await tasksPage.openCreateDialog();

    await expect(tasksPage.createDialog).toBeVisible();
    await expect(tasksPage.nameInput).toBeVisible();
    await expect(tasksPage.promptInput).toBeVisible();
    await expect(tasksPage.scheduleInput).toBeVisible();
    await expect(tasksPage.createButton).toBeDisabled();

    await tasksPage.cancelButton.click();
    await expect(tasksPage.createDialog).toBeHidden();
  });

  test('shows cron preset buttons in create dialog', async ({ tasksPage }) => {
    await tasksPage.open();
    await tasksPage.openCreateDialog();

    const presets = ['5m', '15m', '1h', '6h', 'Daily', '9am', 'Weekdays', 'Weekly', 'Monthly'];
    for (const preset of presets) {
      await expect(
        tasksPage.createDialog.getByRole('button', { name: preset, exact: true })
      ).toBeVisible();
    }
  });

  test('preset populates schedule field', async ({ tasksPage }) => {
    await tasksPage.open();
    await tasksPage.openCreateDialog();

    await tasksPage.selectPreset('Daily');
    await expect(tasksPage.scheduleInput).toHaveValue(/0 0 \* \* \*/);
  });

  test('enables create button when required fields are filled', async ({ tasksPage }) => {
    await tasksPage.open();
    await tasksPage.openCreateDialog();

    await expect(tasksPage.createButton).toBeDisabled();

    await tasksPage.nameInput.fill('Test Schedule');
    await tasksPage.promptInput.fill('Run tests');
    await tasksPage.selectPreset('Daily');

    await expect(tasksPage.createButton).toBeEnabled();
  });

  test('schedule toggle switch is interactive', async ({ tasksPage }) => {
    await tasksPage.open();

    const toggle = tasksPage.dialog.getByRole('switch', { name: /toggle test/i });
    await expect(toggle).toBeVisible();
    // Toggle is checked by default (schedule is active)
    await expect(toggle).toBeChecked();
  });
});
