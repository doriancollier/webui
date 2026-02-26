import type { Page, Locator } from '@playwright/test';

/** Page Object Model for the Mesh agent discovery dialog. */
export class MeshPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /mesh/i });
    this.closeButton = this.dialog.getByRole('button', { name: /close/i });
  }

  /** Open Mesh via the sidebar button (uses JS click due to overlay). */
  async open() {
    await this.page.evaluate(() => {
      (document.querySelector('button[aria-label="Mesh agent discovery"]') as HTMLElement)?.click();
    });
    await this.dialog.waitFor({ state: 'visible' });
  }

  async close() {
    await this.closeButton.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  get heading() {
    return this.dialog.getByRole('heading', { name: /mesh/i });
  }

  get description() {
    return this.dialog.getByText('Agent discovery and registry', { exact: true });
  }

  get notEnabledMessage() {
    return this.dialog.getByText(/mesh is not enabled/i);
  }

  get enableInstructions() {
    return this.dialog.getByText(/DORKOS_MESH_ENABLED=true/);
  }

  // --- Enabled-state elements ---

  get agentCount() {
    return this.dialog.getByText(/\d+ agents?/);
  }

  get tabList() {
    return this.dialog.getByRole('tablist');
  }

  tab(name: string) {
    return this.dialog.getByRole('tab', { name: new RegExp(name, 'i') });
  }

  get activePanel() {
    return this.dialog.getByRole('tabpanel');
  }

  /** Discovery tab: scan input. */
  get scanInput() {
    return this.activePanel.getByRole('textbox', { name: /roots to scan/i });
  }

  /** Discovery tab: scan button. */
  get scanButton() {
    return this.activePanel.getByRole('button', { name: /scan/i });
  }
}
