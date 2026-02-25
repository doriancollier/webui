import type { Page, Locator } from '@playwright/test';

export class ChatPage {
  readonly page: Page;
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly messageList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.input = page.getByRole('textbox', { name: /message/i });
    this.sendButton = page.getByRole('button', { name: /send/i });
    this.messageList = page.locator('[data-testid="message-list"]');
  }

  async goto(sessionId?: string) {
    const url = sessionId ? `/?session=${sessionId}` : '/';
    await this.page.goto(url);
    await this.page.waitForSelector('[data-testid="chat-panel"]', { timeout: 10_000 });
  }

  async sendMessage(text: string) {
    await this.input.fill(text);
    await this.sendButton.click();
  }

  async waitForResponse(timeoutMs = 60_000) {
    // Wait for the streaming indicator to appear then disappear
    await this.page
      .locator('[data-testid="inference-indicator-streaming"]')
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => {});
    await this.page
      .locator('[data-testid="inference-indicator-streaming"]')
      .waitFor({ state: 'hidden', timeout: timeoutMs });
  }

  async getMessages() {
    return this.messageList.locator('[data-testid="message-item"]');
  }

  async lastAssistantMessage() {
    return this.messageList
      .locator('[data-testid="message-item"][data-role="assistant"]')
      .last();
  }
}
