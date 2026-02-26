import type { Page, Locator } from '@playwright/test';

/** Page Object Model for the Relay messaging dialog. */
export class RelayPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /relay/i });
    this.closeButton = this.dialog.getByRole('button', { name: /close/i });
  }

  /** Open Relay via the sidebar button (uses JS click due to overlay). */
  async open() {
    await this.page.evaluate(() => {
      (document.querySelector('button[aria-label="Relay messaging"]') as HTMLElement)?.click();
    });
    await this.dialog.waitFor({ state: 'visible' });
  }

  async close() {
    await this.closeButton.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  get heading() {
    return this.dialog.getByRole('heading', { name: /relay/i });
  }

  get description() {
    return this.dialog.getByText('Inter-agent messaging activity and endpoints', { exact: true });
  }

  get notEnabledMessage() {
    return this.dialog.getByText(/relay is not enabled/i);
  }

  get enableInstructions() {
    return this.dialog.getByText(/DORKOS_RELAY_ENABLED=true/);
  }

  // --- Enabled-state elements ---

  get tabList() {
    return this.dialog.getByRole('tablist');
  }

  tab(name: string) {
    return this.dialog.getByRole('tab', { name: new RegExp(name, 'i') });
  }

  get activePanel() {
    return this.dialog.getByRole('tabpanel');
  }

  /** Activity tab: filter combobox. */
  get activityFilter() {
    return this.activePanel.getByRole('combobox');
  }

  get noMessagesText() {
    return this.activePanel.getByText(/no messages yet/i);
  }

  /** Endpoints tab: get endpoint button by name. */
  endpoint(name: string) {
    return this.activePanel.getByRole('button', { name: new RegExp(name) });
  }
}
