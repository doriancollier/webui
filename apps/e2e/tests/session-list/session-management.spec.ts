import { test, expect } from '../../fixtures';

test.describe('Session List — Management @smoke', () => {
  test('creates a new chat session', async ({ chatPage, sessionSidebar }) => {
    await sessionSidebar.createNewSession();

    // URL should update with new session ID
    await expect(chatPage.page).toHaveURL(/session=/);
  });
});
