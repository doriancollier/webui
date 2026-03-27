/** Convert kebab-case to PascalCase: "github-prs" -> "GithubPrs" */
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** Convert kebab-case to Title Case: "github-prs" -> "Github Prs" */
function toTitleCase(str: string): string {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

/** Generate the `extension.json` manifest content for a new extension. */
export function generateManifest(name: string, description?: string, template?: string): object {
  const contributions: Record<string, boolean> = {};
  switch (template) {
    case 'dashboard-card':
      contributions['dashboard.sections'] = true;
      break;
    case 'command':
      contributions['command-palette.items'] = true;
      break;
    case 'settings-panel':
      contributions['settings.tabs'] = true;
      break;
  }

  return {
    id: name,
    name: toTitleCase(name),
    version: '0.1.0',
    ...(description && { description }),
    author: 'agent',
    minHostVersion: '0.1.0',
    contributions,
  };
}

/**
 * Select and generate the `index.ts` template content for a new extension.
 *
 * @param name - Extension ID (kebab-case)
 * @param description - Short description for the header comment
 * @param template - Which starter template to generate
 */
export function generateTemplate(
  name: string,
  description: string,
  template: 'dashboard-card' | 'command' | 'settings-panel'
): string {
  switch (template) {
    case 'dashboard-card':
      return generateDashboardCardTemplate(name, description);
    case 'command':
      return generateCommandTemplate(name, description);
    case 'settings-panel':
      return generateSettingsPanelTemplate(name, description);
  }
}

/**
 * Dashboard card template — creates a dashboard section with a placeholder component.
 * Registers into the `dashboard.sections` slot.
 */
function generateDashboardCardTemplate(name: string, description: string): string {
  const pascalName = toPascalCase(name);
  const titleName = toTitleCase(name);
  const desc = description || 'A dashboard section extension.';
  const contentDesc =
    description || 'Extension content goes here. Edit this file and call reload_extensions.';

  return `// ${name} — DorkOS Extension
// ${desc}
//
// ExtensionAPI Quick Reference:
//   api.registerComponent(slot, id, component, options?) — Register a React component in a UI slot
//   api.registerCommand(id, label, callback, options?)   — Register a command palette item
//   api.notify(message, options?)                        — Show a toast notification
//   api.loadData<T>() / api.saveData<T>(data)            — Persistent storage scoped to this extension
//   api.getState()                                       — Read-only host state (currentCwd, activeSessionId)
//   api.subscribe(selector, callback)                    — Subscribe to state changes
//
// Available slots: dashboard.sections, command-palette.items, settings.tabs,
//   sidebar.footer, sidebar.tabs, header.actions, dialog, session.canvas

import type { ExtensionAPI } from '@dorkos/extension-api';

/** Main dashboard section component. */
function ${pascalName}Section() {
  return (
    <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '12px' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>
        ${titleName}
      </h3>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted-foreground)' }}>
        ${contentDesc}
      </p>
    </div>
  );
}

export function activate(api: ExtensionAPI): void {
  // Register a section on the dashboard
  api.registerComponent('dashboard.sections', '${name}-section', ${pascalName}Section, {
    priority: 50,
  });
}
`;
}

/**
 * Command template — creates a command palette item that shows a notification.
 * Registers into the `command-palette.items` slot.
 */
function generateCommandTemplate(name: string, description: string): string {
  const titleName = toTitleCase(name);
  const desc = description || 'A command palette extension.';

  return `// ${name} — DorkOS Extension
// ${desc}
//
// ExtensionAPI Quick Reference:
//   api.registerComponent(slot, id, component, options?) — Register a React component in a UI slot
//   api.registerCommand(id, label, callback, options?)   — Register a command palette item
//   api.notify(message, options?)                        — Show a toast notification
//   api.loadData<T>() / api.saveData<T>(data)            — Persistent storage scoped to this extension
//   api.getState()                                       — Read-only host state (currentCwd, activeSessionId)
//
// Available slots: dashboard.sections, command-palette.items, settings.tabs,
//   sidebar.footer, sidebar.tabs, header.actions, dialog, session.canvas

import type { ExtensionAPI } from '@dorkos/extension-api';

export function activate(api: ExtensionAPI): void {
  // Register a command in the command palette (Cmd+K)
  api.registerCommand(
    '${name}-run',
    '${titleName}',
    () => {
      api.notify('${titleName} executed!', { type: 'success' });
    },
    { icon: 'terminal' }
  );
}
`;
}

/**
 * Settings panel template — creates a settings tab with loadData/saveData persistence.
 * Registers into the `settings.tabs` slot.
 */
function generateSettingsPanelTemplate(name: string, description: string): string {
  const pascalName = toPascalCase(name);
  const titleName = toTitleCase(name);
  const desc = description || 'A settings panel extension.';

  return `// ${name} — DorkOS Extension
// ${desc}
//
// ExtensionAPI Quick Reference:
//   api.registerComponent(slot, id, component, options?) — Register a React component in a UI slot
//   api.registerCommand(id, label, callback, options?)   — Register a command palette item
//   api.registerSettingsTab(id, label, component)        — Register a tab in the settings dialog
//   api.notify(message, options?)                        — Show a toast notification
//   api.loadData<T>() / api.saveData<T>(data)            — Persistent storage scoped to this extension
//   api.getState()                                       — Read-only host state (currentCwd, activeSessionId)
//
// Available slots: dashboard.sections, command-palette.items, settings.tabs,
//   sidebar.footer, sidebar.tabs, header.actions, dialog, session.canvas

import type { ExtensionAPI } from '@dorkos/extension-api';

/** Settings panel component demonstrating persistent storage. */
function ${pascalName}Settings() {
  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
        ${titleName} Settings
      </h3>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted-foreground)' }}>
        Configure your extension here. Use api.loadData() and api.saveData() for persistence.
      </p>
    </div>
  );
}

export function activate(api: ExtensionAPI): void {
  // Register a tab in the settings dialog
  api.registerSettingsTab('${name}-settings', '${titleName}', ${pascalName}Settings);
}
`;
}
