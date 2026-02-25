import type { Page } from '@playwright/test';

export class BasePage {
  constructor(readonly page: Page) {}

  async goto(path = '/') {
    await this.page.goto(path);
  }

  async waitForAppReady() {
    await this.page.waitForSelector('[data-testid="app-shell"]', { timeout: 10_000 });
  }
}
