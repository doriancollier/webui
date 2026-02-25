import type { Page, Locator } from '@playwright/test';

export class SessionSidebarPage {
  readonly page: Page;
  readonly newChatButton: Locator;
  readonly sessionList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newChatButton = page.getByRole('button', { name: /new chat/i });
    this.sessionList = page.locator('[data-testid="session-list"]');
  }

  async createNewSession() {
    await this.newChatButton.click();
  }

  async selectSession(index: number) {
    const sessions = this.sessionList.locator('[data-testid="session-item"]');
    await sessions.nth(index).click();
  }

  async getSessionCount() {
    return this.sessionList.locator('[data-testid="session-item"]').count();
  }
}
