import type { Page, Locator } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;
  readonly dialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.locator('[data-testid="settings-dialog"]');
  }

  async open() {
    await this.page.getByRole('button', { name: /settings/i }).click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  async close() {
    await this.page.keyboard.press('Escape');
    await this.dialog.waitFor({ state: 'hidden' });
  }

  async switchTab(tabName: string) {
    await this.dialog.getByRole('tab', { name: new RegExp(tabName, 'i') }).click();
  }
}
