import { test, expect } from '../../fixtures';

test.describe('Chat — Send Message @integration', () => {
  test('sends a message and receives a response', async ({ chatPage }) => {
    await chatPage.sendMessage('Respond with exactly: hello world');
    await chatPage.waitForResponse();

    const lastMessage = await chatPage.lastAssistantMessage();
    await expect(lastMessage).toContainText('hello world');
  });

  test('shows inference indicator while streaming', async ({ chatPage }) => {
    await chatPage.sendMessage('Count from 1 to 5');

    await expect(chatPage.page.locator('[data-testid="inference-indicator-streaming"]')).toBeVisible(
      { timeout: 10_000 },
    );
  });
});
