import type { Page, Locator } from '@playwright/test';

/** Page Object Model for the Settings dialog. */
export class SettingsPage {
  readonly page: Page;
  readonly dialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /settings/i });
  }

  /** Open Settings via the sidebar button (uses JS click due to overlay). */
  async open() {
    await this.page.evaluate(() => {
      (document.querySelector('button[aria-label="Settings"]') as HTMLElement)?.click();
    });
    await this.dialog.waitFor({ state: 'visible' });
  }

  async close() {
    await this.page.keyboard.press('Escape');
    await this.dialog.waitFor({ state: 'hidden' });
  }

  async closeViaButton() {
    await this.dialog.getByRole('button', { name: /close/i }).click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  async switchTab(tabName: string) {
    await this.dialog.getByRole('tab', { name: new RegExp(tabName, 'i') }).click();
  }

  get heading() {
    return this.dialog.getByRole('heading', { name: /settings/i });
  }

  get tabList() {
    return this.dialog.getByRole('tablist');
  }

  /** Get a specific tab by name. */
  tab(name: string) {
    return this.dialog.getByRole('tab', { name: new RegExp(name, 'i') });
  }

  /** Get the active tab panel. */
  get activePanel() {
    return this.dialog.getByRole('tabpanel');
  }

  /** Appearance tab elements. */
  get themeCombobox() {
    return this.activePanel.getByRole('combobox').first();
  }

  /** Get all toggle switches in the current tab panel. */
  get switches() {
    return this.activePanel.getByRole('switch');
  }

  /** Server tab: port display. */
  get portInfo() {
    return this.activePanel.getByRole('button', { name: /port/i });
  }

  /** Server tab: Node.js display. */
  get nodeInfo() {
    return this.activePanel.getByRole('button', { name: /node\.js/i });
  }
}
