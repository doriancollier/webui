import { test as base } from '@playwright/test';
import { ChatPage } from '../pages/ChatPage';
import { SessionSidebarPage } from '../pages/SessionSidebarPage';
import { SettingsPage } from '../pages/SettingsPage';
import { BasePage } from '../pages/BasePage';

type DorkOSFixtures = {
  basePage: BasePage;
  chatPage: ChatPage;
  sessionSidebar: SessionSidebarPage;
  settingsPage: SettingsPage;
};

export const test = base.extend<DorkOSFixtures>({
  basePage: async ({ page }, use) => {
    await use(new BasePage(page));
  },
  chatPage: async ({ page }, use) => {
    const chatPage = new ChatPage(page);
    await chatPage.goto();
    await use(chatPage);
  },
  sessionSidebar: async ({ page }, use) => {
    await use(new SessionSidebarPage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});

export { expect } from '@playwright/test';
