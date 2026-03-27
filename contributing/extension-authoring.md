# Extension Authoring

Extensions add UI components, commands, and behavior to DorkOS. This guide covers everything you need to create, install, and debug a custom extension.

## Quick Start

1. Copy `examples/extensions/hello-world/` to `~/.dork/extensions/hello-world/`
2. Open DorkOS Settings > Extensions
3. Enable "Hello World" and reload the page
4. The dashboard shows a new section; the command palette has a "Hello World: Show Greeting" command

## Directory Structure

An extension is a directory with two files:

```
my-extension/
├── extension.json   # Required — manifest
└── index.ts         # Required — entry point (or index.js for pre-compiled)
```

**Global extensions** live in `~/.dork/extensions/{id}/`. **Local extensions** (project-scoped) live in `{projectDir}/.dork/extensions/{id}/`. Local overrides global when IDs match.

## Manifest (`extension.json`)

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "What this extension does",
  "author": "Your Name",
  "minHostVersion": "0.1.0",
  "contributions": {
    "dashboard.sections": true,
    "command-palette.items": true
  },
  "permissions": []
}
```

| Field            | Required | Description                                                           |
| ---------------- | -------- | --------------------------------------------------------------------- |
| `id`             | Yes      | Unique kebab-case identifier. Must match the directory name.          |
| `name`           | Yes      | Display name shown in Settings.                                       |
| `version`        | Yes      | Semver string (e.g. `1.0.0`).                                         |
| `description`    | No       | Short description for the settings UI.                                |
| `author`         | No       | Author name or identifier.                                            |
| `minHostVersion` | No       | Minimum DorkOS version. Extension won't load on older hosts.          |
| `contributions`  | No       | Declares which UI slots the extension contributes to (informational). |
| `permissions`    | No       | Reserved for future use.                                              |

## Entry Point (`activate`)

The entry point must export an `activate` function:

```typescript
import type { ExtensionAPI } from '@dorkos/extension-api';

export function activate(api: ExtensionAPI): void | (() => void) {
  // Register UI components, commands, subscriptions...

  // Optionally return a cleanup function
  return () => {
    // Called when the extension is disabled or the page unloads
  };
}
```

Cleanup is automatic: any registrations made through `api.registerComponent`, `api.registerCommand`, etc. are unregistered when the extension deactivates, whether or not you return a cleanup function.

## API Reference

### UI Registration

```typescript
// Add a React component to a UI slot
api.registerComponent(slot, id, Component, { priority?: number }): () => void

// Add a command palette item
api.registerCommand(id, label, callback, { icon?, shortcut? }): () => void

// Register a dialog
api.registerDialog(id, Component): { open: () => void; close: () => void }

// Add a tab to the settings dialog
api.registerSettingsTab(id, label, Component): () => void
```

### UI Control

```typescript
// Execute a UI command (open panel, show toast, etc.)
api.executeCommand(command: UiCommand): void

// Open the canvas with content
api.openCanvas(content: UiCanvasContent): void

// Navigate to a client-side route
api.navigate(path: string): void
```

### State

```typescript
// Read-only snapshot: { currentCwd, activeSessionId, agentId }
api.getState(): ExtensionReadableState

// Subscribe to state changes (returns unsubscribe function)
api.subscribe(selector, callback): () => void
```

### Storage

```typescript
// Load persistent data (returns null if nothing saved)
const data = await api.loadData<MyData>();

// Save persistent data (scoped to this extension)
await api.saveData({ key: 'value' });
```

Storage is JSON-serialized and persisted at `~/.dork/extensions/{id}/data.json`.

### Notifications

```typescript
api.notify('Something happened', { type: 'info' | 'success' | 'error' });
```

### Introspection

```typescript
// Check if a slot is rendered in the current context
api.isSlotAvailable('dashboard.sections'): boolean

// The extension's own ID
api.id: string
```

## UI Slots

| Slot ID                 | Where it renders            |
| ----------------------- | --------------------------- |
| `sidebar.footer`        | Bottom of the sidebar       |
| `sidebar.tabs`          | Sidebar tab bar             |
| `dashboard.sections`    | Dashboard main content area |
| `header.actions`        | Header action buttons       |
| `command-palette.items` | Command palette entries     |
| `dialog`                | Modal dialog layer          |
| `settings.tabs`         | Settings dialog tabs        |
| `session.canvas`        | Session canvas panel        |

## TypeScript vs JavaScript

**TypeScript** (`index.ts`): Compiled automatically by the host using esbuild. JSX is supported in `.ts` files. Type against `@dorkos/extension-api` for full autocompletion.

**Pre-compiled JavaScript** (`index.js`): Served directly with no compilation step. Use `React.createElement` for components since JSX isn't available without a build step.

If both `index.js` and `index.ts` exist, the pre-compiled JS takes priority.

## React Components

React is provided by the host. Do not bundle your own copy.

In TypeScript extensions, JSX works out of the box:

```typescript
function MySection() {
  return <div style={{ padding: '16px' }}>Hello</div>;
}
```

In JavaScript extensions, use `React.createElement`:

```javascript
function MySection() {
  return React.createElement('div', { style: { padding: '16px' } }, 'Hello');
}
```

Use CSS custom properties (`var(--border)`, `var(--muted-foreground)`) from the host theme for consistent styling.

## Debugging

- **Console**: Extensions run in the browser. Use `console.log` and inspect in browser devtools.
- **Source maps**: TypeScript extensions include inline source maps. Set breakpoints in the original `.ts` file via the Sources panel.
- **Compilation errors**: Check Settings > Extensions for error details if your extension fails to compile.
- **State inspection**: Call `api.getState()` from a command callback to inspect host state.

## Limitations (v1)

- No sandboxing: extensions run in the host process with full DOM access.
- No access to the Transport layer or server APIs.
- No extension marketplace or auto-update mechanism.
- Storage is local-only (no sync across machines).

---

## Agent-Built Extensions

DorkOS agents (Claude Code, Cursor, Windsurf) can create and manage extensions autonomously via MCP tools. The agent writes files to disk, compiles, tests, and reloads — the user sees the result in the DorkOS client immediately. No manual file creation or settings toggling required.

### MCP Tools Reference

Six MCP tools provide the complete extension lifecycle:

| Tool                   | Parameters                                    | Description                                                        |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `get_extension_api`    | None                                          | Full ExtensionAPI type definitions and usage examples as markdown  |
| `list_extensions`      | None                                          | List all extensions with status, scope, and errors                 |
| `create_extension`     | `name`, `description?`, `template?`, `scope?` | Scaffold, compile, and enable a new extension in one step          |
| `reload_extensions`    | `id?`                                         | Recompile all extensions, or a single extension by ID (hot reload) |
| `get_extension_errors` | None                                          | Get only extensions in an error state with diagnostic details      |
| `test_extension`       | `id`                                          | Headless smoke test: compile + activate against mock API           |

### Agent Workflow

The recommended iteration loop:

```
1. get_extension_api         # Understand the API surface
2. create_extension          # Scaffold with a starter template
3. Edit index.ts             # Write the extension logic
4. test_extension            # Verify compilation and activation (headless)
5. reload_extensions --id    # Hot-reload into the running client
6. Iterate from step 3       # Fix errors, add features
```

The `create_extension` tool handles scaffolding, compilation, and enabling in a single call. After that, the edit-test-reload cycle is the core loop. Use `test_extension` for fast headless validation before triggering a visual reload.

### Template Types

The `create_extension` tool accepts a `template` parameter:

**`dashboard-card`** (default) — Registers a React component in the `dashboard.sections` slot. Produces a styled card with heading and description. Good starting point for data display extensions.

**`command`** — Registers a command palette item (`Cmd+K`). The starter template fires a toast notification on execution. Use for action-oriented extensions that do not need a persistent UI.

**`settings-panel`** — Registers a tab in the settings dialog. The starter template includes a settings panel skeleton with `loadData`/`saveData` hooks for persistence. Use for extensions that need user configuration.

All templates include an inline API Quick Reference comment at the top of `index.ts` listing the most common methods and all available slot names. Templates compile and activate out of the box — the agent can modify from a known-working baseline.

### Scope: Global vs Local

The `scope` parameter controls where the extension is installed:

- **`global`** (`~/.dork/extensions/{id}/`) — Available in all projects. Use for general-purpose utilities.
- **`local`** (`.dork/extensions/{id}/` in the active CWD) — Scoped to the current project. Use for project-specific dashboards or tools.

When the same extension ID exists in both scopes, local overrides global. When the user switches projects (CWD change), local extensions are re-scanned and the client reloads automatically.

Default scope for `create_extension` is `global`.

### Error Handling

Agents can diagnose and fix errors autonomously using structured error feedback:

**Compilation errors** — Returned by `test_extension` and `reload_extensions` with file, line, and column information:

```json
{
  "status": "error",
  "phase": "compilation",
  "errors": [
    { "text": "Expected ';'", "location": { "file": "index.ts", "line": 12, "column": 5 } }
  ]
}
```

**Activation errors** — Returned by `test_extension` when the extension compiles but throws during `activate()`:

```json
{
  "status": "error",
  "phase": "activation",
  "error": "Cannot read property 'registerComponent' of undefined",
  "stack": "TypeError: ..."
}
```

**Diagnostic workflow:**

1. Call `get_extension_errors` to see all extensions with problems
2. Read the structured error (phase, message, location)
3. Edit the source file to fix the issue
4. Call `test_extension` to verify the fix (headless, sub-300ms)
5. Call `reload_extensions --id` to push the fix to the client

### What Agents Should Not Do

- **Do not create `node_modules` or install npm packages.** Extensions cannot have external dependencies beyond `react`, `react-dom`, and `@dorkos/extension-api` (provided by the host).
- **Do not modify `extension.json` after creation** unless changing metadata. The `id` field must remain stable.
- **Do not write to extension directories owned by other extensions.** Each extension has an isolated directory.
- **Do not create extensions that import from `@dorkos/shared` or server internals.** Only `@dorkos/extension-api` is available at runtime.
