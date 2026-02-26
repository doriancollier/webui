import type { Page, Locator } from '@playwright/test';

/** Page Object Model for the Pulse Scheduler dialog. */
export class PulsePage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly newScheduleButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /pulse scheduler/i });
    this.newScheduleButton = page.getByRole('button', { name: /new schedule/i });
    this.closeButton = this.dialog.getByRole('button', { name: /close/i });
  }

  /** Open Pulse via the sidebar button (uses JS click due to overlay). */
  async open() {
    await this.page.evaluate(() => {
      (document.querySelector('button[aria-label="Pulse scheduler"]') as HTMLElement)?.click();
    });
    await this.dialog.waitFor({ state: 'visible' });
  }

  async close() {
    await this.closeButton.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  /** Get the heading of the Pulse dialog. */
  get heading() {
    return this.dialog.getByRole('heading', { name: /pulse scheduler/i });
  }

  /** Get the schedules heading inside the dialog. */
  get schedulesHeading() {
    return this.dialog.getByRole('heading', { name: /schedules/i });
  }

  /** Get all schedule row buttons (each schedule is a clickable button). */
  get scheduleRows() {
    return this.dialog.getByRole('button').filter({ hasText: /toggle/i });
  }

  /** Get the "New Schedule" dialog (nested inside Pulse). */
  get createDialog() {
    return this.page.getByRole('dialog', { name: /new schedule/i });
  }

  /** Open the New Schedule creation dialog. */
  async openCreateDialog() {
    await this.newScheduleButton.click();
    await this.createDialog.waitFor({ state: 'visible' });
  }

  /** Get the Name field in the create dialog. */
  get nameInput() {
    return this.createDialog.getByRole('textbox', { name: /name/i });
  }

  /** Get the Prompt field in the create dialog. */
  get promptInput() {
    return this.createDialog.getByRole('textbox', { name: /prompt/i });
  }

  /** Get the Schedule (cron) field in the create dialog. */
  get scheduleInput() {
    return this.createDialog.getByRole('textbox', { name: /schedule/i });
  }

  /** Get the Create button in the create dialog. */
  get createButton() {
    return this.createDialog.getByRole('button', { name: /^create$/i });
  }

  /** Get the Cancel button in the create dialog. */
  get cancelButton() {
    return this.createDialog.getByRole('button', { name: /cancel/i });
  }

  /** Click a cron preset button (e.g., "Daily", "1h", "Weekly"). */
  async selectPreset(label: string) {
    await this.createDialog.getByRole('button', { name: label, exact: true }).click();
  }
}
