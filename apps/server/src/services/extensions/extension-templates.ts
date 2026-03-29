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

/** Template type union for extension scaffolding. */
export type ExtensionTemplate = 'dashboard-card' | 'command' | 'settings-panel' | 'data-provider';

/** Generate the `extension.json` manifest content for a new extension. */
export function generateManifest(
  name: string,
  description?: string,
  template?: ExtensionTemplate
): object {
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
    case 'data-provider':
      contributions['dashboard.sections'] = true;
      contributions['settings.tabs'] = true;
      break;
  }

  const manifest: Record<string, unknown> = {
    id: name,
    name: toTitleCase(name),
    version: '0.1.0',
    ...(description && { description }),
    author: 'agent',
    minHostVersion: '0.1.0',
    contributions,
  };

  // Data-provider extensions declare server-side capabilities with a sample secret
  if (template === 'data-provider') {
    manifest.serverCapabilities = {
      serverEntry: './server.ts',
      secrets: [
        {
          key: 'api_key',
          label: `${toTitleCase(name)} API Key`,
          description: `API key for the ${toTitleCase(name)} integration`,
          required: true,
        },
      ],
    };
  }

  return manifest;
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
  template: ExtensionTemplate
): string {
  switch (template) {
    case 'dashboard-card':
      return generateDashboardCardTemplate(name, description);
    case 'command':
      return generateCommandTemplate(name, description);
    case 'settings-panel':
      return generateSettingsPanelTemplate(name, description);
    case 'data-provider':
      return generateDataProviderTemplate(name, description);
  }
}

/**
 * Generate the `server.ts` template content for a data-provider extension.
 *
 * @param name - Extension ID (kebab-case)
 * @param description - Short description for the header comment
 */
export function generateServerTemplate(name: string, description: string): string {
  const titleName = toTitleCase(name);
  const desc = description || 'A data provider extension with server-side capabilities.';

  return `// ${name}/server.ts — DorkOS Server Extension
// ${desc}
//
// DataProviderContext Quick Reference:
//   ctx.secrets.get(key)            — Read an encrypted secret
//   ctx.secrets.set(key, value)     — Store an encrypted secret
//   ctx.storage.loadData<T>()       — Load persisted JSON data
//   ctx.storage.saveData<T>(data)   — Persist JSON data (atomic write)
//   ctx.schedule(seconds, fn)       — Run fn on an interval (min 5s), returns cancel()
//   ctx.emit(event, data)           — Broadcast an SSE event to connected clients
//   ctx.extensionId                 — This extension's unique identifier
//   ctx.extensionDir                — Absolute path to this extension's directory

import type { Router } from 'express';
import type { DataProviderContext } from '@dorkos/extension-api/server';

/**
 * Register server-side routes and background tasks for ${titleName}.
 *
 * @param router - Scoped Express router mounted at /api/extensions/${name}/
 * @param ctx - Isolated context with secrets, storage, scheduling, and SSE emission
 * @returns Optional cleanup function called on extension shutdown
 */
export default function register(router: Router, ctx: DataProviderContext): (() => void) | void {
  // --- Routes ---

  // GET /api/extensions/${name}/data — Fetch cached data
  router.get('/data', async (_req, res) => {
    const data = await ctx.storage.loadData();
    res.json({ data: data ?? [] });
  });

  // --- Background sync ---

  // Poll every 60 seconds (edit interval and logic to suit your data source)
  const cancel = ctx.schedule(60, async () => {
    // TODO: Replace with real API call using ctx.secrets.get('api_key')
    const apiKey = await ctx.secrets.get('api_key');
    if (!apiKey) return;

    // Example: fetch data from external API
    // const response = await fetch('https://api.example.com/data', {
    //   headers: { Authorization: \`Bearer \${apiKey}\` },
    // });
    // const items = await response.json();
    // await ctx.storage.saveData(items);
    // ctx.emit('data-updated', { count: items.length });
  });

  // Return cleanup function to cancel the scheduled task on shutdown
  return () => {
    cancel();
  };
}
`;
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

/**
 * Data provider template — creates a dashboard section and settings tab for
 * an extension with server-side data fetching capabilities.
 * Registers into the `dashboard.sections` and `settings.tabs` slots.
 */
function generateDataProviderTemplate(name: string, description: string): string {
  const pascalName = toPascalCase(name);
  const titleName = toTitleCase(name);
  const desc = description || 'A data provider extension with server-side capabilities.';
  const contentDesc = description || 'Data from your server-side provider will appear here.';

  return `// ${name} — DorkOS Data Provider Extension
// ${desc}
//
// This extension has a companion server.ts that runs server-side.
// The server handles API calls, secrets, and background data syncing.
// This client-side code displays data fetched via the server proxy.
//
// ExtensionAPI Quick Reference:
//   api.registerComponent(slot, id, component, options?) — Register a React component in a UI slot
//   api.registerSettingsTab(id, label, component)        — Register a tab in the settings dialog
//   api.notify(message, options?)                        — Show a toast notification
//   api.loadData<T>() / api.saveData<T>(data)            — Persistent storage scoped to this extension
//   api.getState()                                       — Read-only host state (currentCwd, activeSessionId)
//   api.subscribe(selector, callback)                    — Subscribe to state changes
//
// Available slots: dashboard.sections, command-palette.items, settings.tabs,
//   sidebar.footer, sidebar.tabs, header.actions, dialog, session.canvas

import type { ExtensionAPI } from '@dorkos/extension-api';

/** Dashboard section showing data from the server-side provider. */
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

/** Settings tab for configuring the data provider (e.g., API key). */
function ${pascalName}Settings() {
  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
        ${titleName} Settings
      </h3>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted-foreground)' }}>
        Configure your API key and other settings. Secrets are stored encrypted on the server.
      </p>
    </div>
  );
}

export function activate(api: ExtensionAPI): void {
  // Register a dashboard section to display provider data
  api.registerComponent('dashboard.sections', '${name}-section', ${pascalName}Section, {
    priority: 50,
  });

  // Register a settings tab for configuration
  api.registerSettingsTab('${name}-settings', '${titleName}', ${pascalName}Settings);
}
`;
}
