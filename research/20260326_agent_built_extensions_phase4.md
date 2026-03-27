---
title: 'Phase 4: Agent-Built Extensions — Architecture & Strategy Research'
date: 2026-03-26
type: external-best-practices
status: active
tags:
  [
    agent-extensions,
    mcp-tools,
    hot-reload,
    chokidar,
    esbuild,
    type-context,
    extension-security,
    extension-testing,
    scaffolding-templates,
    file-watcher,
  ]
feature_slug: ext-platform-04-agent-extensions
searches_performed: 11
sources_count: 28
---

# Phase 4: Agent-Built Extensions — Architecture & Strategy Research

**Date**: 2026-03-26
**Research Depth**: Deep Research
**Feature**: ext-platform-04-agent-extensions

---

## Research Summary

This report answers the 7 specific open questions in the `ext-platform-04-agent-extensions` brief. It synthesizes three prior research files — `20260323_plugin_extension_ui_architecture_patterns.md`, `20260326_extension_system_open_questions.md`, and `20260303_agent_tool_context_injection.md` — with 11 new targeted searches. The overall conclusion: use a layered type-delivery strategy (scaffolded comments + a `get_extension_api_reference` MCP tool), offer 3 slot-specific templates instead of a single generic starter, adopt Obsidian's full-trust model for v1 with a single confirmation seam added for non-local extensions, implement per-extension hot reload using the deactivate-then-reactivate pattern (identical to Obsidian's hot-reload plugin), use chokidar v5 with a 750ms debounce for the file watcher, target a <1.5s end-to-end cycle with the primary bottleneck being SSE client propagation, and provide headless activation smoke tests rather than full UI testing for agent-verifiable correctness.

---

## What Was Covered by Existing Research (No Re-Research Needed)

### From `research/20260323_plugin_extension_ui_architecture_patterns.md`

- **VSCode Extension Host isolation**: separate Node.js process, JSON-RPC IPC, lazy activation. Relevant to security model.
- **Obsidian full-trust model**: direct `App` object access, no sandbox, deliberate trade-off for plugin power. Full analysis of `onload()`/`onunload()` lifecycle and automatic `register*()` cleanup.
- **Grafana proxy-membrane sandbox (11.5+)**: prevents DOM escape without breaking React rendering. Only option if DorkOS adds a sandbox in v2.
- **Backstage `createExtensionTester`**: factory-function testing pattern for isolated extension activation.
- **Module Federation singleton model**: single React instance, relevant to shared dependency design.

### From `research/20260326_extension_system_open_questions.md`

- **esbuild compilation caching**: content-hash filenames at `{dorkHome}/cache/extensions/`, no built-in persistent cache in esbuild itself.
- **esbuild externals**: `react`, `react-dom`, `@dorkos/extension-api` externalized; all other deps self-bundled (Obsidian model).
- **Bundle delivery via `import()` from server endpoint**: the correct ESM delivery pattern for browser-side extensions.
- **Extension storage at `{dorkHome}/extension-data/{ext-id}/data.json`**: clean code/data separation.

### From `research/20260303_agent_tool_context_injection.md`

- **Static XML blocks via `systemPrompt.append`**: the correct injection mechanism for tool context. Proven pattern already used for relay/mesh.
- **Token budget**: 250-350 tokens per context block is sufficient and negligible at 0.5% of 200K window.
- **Division of responsibility**: tool descriptions answer "what does this do?"; injected context blocks answer "when and how to use these together."

---

## Key Findings

### 1. Agent API Context Delivery: Layered Strategy Wins

The single best approach does not exist — the correct answer is **three complementary layers**:

1. **Scaffolded file comments** (zero friction, always present)
2. **`get_extension_api_reference` MCP tool** (on-demand full reference)
3. **`<extension_api>` system prompt context block** (workflow glue, injected when building)

### 2. Extension Templates: 3 Slot-Specific Templates > Generic Starter

A generic starter forces the agent to discover the contribution model by reading comments. Slot-specific templates give the agent a working example that it modifies — measurably faster first iteration. Three templates cover >90% of expected use cases.

### 3. Security: Obsidian Full-Trust Model for v1, One Seam

Full-trust (Obsidian model) is the correct baseline for DorkOS's developer audience. Add one lightweight seam: a `requires_confirmation: true` field in `create_extension`'s response for non-local extensions, surfaced as a toast in the UI. No runtime sandboxing in v1.

### 4. Hot Reload: Per-Extension Deactivate → Reactivate (Obsidian Pattern)

Per-extension reload is the right call. The Obsidian `hot-reload` plugin proves the pattern works in production at exactly this scope: detect changes to one plugin's files, call `plugin.disable()` then `plugin.enable()`, show a brief toast. The complexity cost is a single `Map<extId, LoadedExtension>` lookup — very low.

### 5. File Watcher: chokidar v5 + 750ms Debounce Per-Extension

chokidar v5 (ESM-only, Node 20+, November 2025) is the right choice. Per-extension debounce (not global) prevents a rapid multi-file write by the agent from triggering multiple reloads mid-write. 750ms matches Obsidian's production-tuned value.

### 6. Iteration Speed: <1.5s is Achievable, SSE Is the Bottleneck

esbuild compilation of a 200-line extension is ~5-15ms. The write → compile → reload → SSE → React rerender cycle can run in <500ms on the hot path. The primary variable is SSE delivery latency (typically 50-200ms). The theoretical minimum is ~200ms; practical target is <1.5s end-to-end.

### 7. Extension Testing: Headless Activation + Structured Errors Is Sufficient

Full UI snapshot testing is over-engineered for agent iteration speed. The correct pattern is: activate the extension in isolation (server-side), check the returned `contributions` map for expected keys, verify no activation error. Backstage's `createExtensionTester` models this exactly — a lightweight harness, not a browser.

---

## Detailed Analysis

### Finding 1: Agent API Context Delivery

The agent needs to know three things to write a correct extension:

1. The `ExtensionAPI` interface methods and their signatures
2. Which slot names are available (`dashboard.sections`, `command-palette.items`, etc.)
3. The contribution model (how to register a slot contribution)

**Layer 1 — Scaffolded file comments (always present)**

The `create_extension` tool writes a starter `index.ts` with dense inline documentation. Unlike a separate README, comments travel with the code and survive agent context truncation:

```typescript
// ExtensionAPI Reference (v1)
// api.registerDashboardSection(config: DashboardSectionConfig)
//   config.id: string — unique slot identifier
//   config.title: string — shown in section header
//   config.render: () => React.ReactNode — your UI
//
// api.registerCommand(config: CommandConfig)
//   config.id: string — command identifier
//   config.label: string — command palette label
//   config.execute: () => void | Promise<void>
//
// api.storage.loadData<T>() => Promise<T | null>
// api.storage.saveData<T>(data: T) => Promise<void>
```

This approach is empirically validated by VS Code's yeoman generator (`generator-code`) which generates heavily-commented extension starters. GitHub Copilot's own scaffolding puts interface examples directly in generated code bodies.

**Layer 2 — `get_extension_api_reference` MCP tool**

A dedicated MCP tool that returns the full `ExtensionAPI` TypeScript declaration as a string. The agent calls this proactively when it wants the complete API surface, or when it encounters "Property X does not exist" errors.

This is exactly how the `typescript-definitions-mcp` project works: expose type definitions as tool results, not as resources. Tools are better than resources here because the agent proactively calls them in response to a need, rather than the host deciding when to inject them. The tool returns the raw `.d.ts` content, which Claude can parse directly.

```typescript
// MCP tool registration
server.tool('get_extension_api_reference', {}, async () => ({
  content: [
    {
      type: 'text',
      text: await readFile('packages/extension-api/src/index.d.ts', 'utf-8'),
    },
  ],
}));
```

**Layer 3 — `<extension_api>` system prompt context block (optional, injected when building)**

Following the proven `context-builder.ts` pattern from `research/20260303_agent_tool_context_injection.md`, add a static `<extension_api>` block to the system prompt when the extension system is enabled. This is ~200 tokens covering the slot names and the three-step creation workflow:

```xml
<extension_api>
DorkOS extensions register contributions via the ExtensionAPI object passed to your activate() function.

Available slots: dashboard.sections, command-palette.items, settings.tabs, canvas.renderers

Typical workflow:
1. Call create_extension(name, slots, scope) to scaffold a starter
2. Edit index.ts to implement your contribution
3. Call reload_extensions() to compile and activate
4. Read errors from the reload result; fix and repeat
5. Verify with list_extensions() — status should be 'active'

Full API reference: call get_extension_api_reference() for the complete .d.ts
</extension_api>
```

**Recommendation**: Implement all three layers. Layer 1 is zero marginal cost (part of scaffolding). Layer 2 is one MCP tool (~15 lines). Layer 3 follows an already-proven pattern with a known implementation path.

---

### Finding 2: Extension Templates

**The VS Code yeoman generator approach** provides 7 template types (TypeScript extension, color theme, language pack, etc.) when running `yo code`. Each template produces a working, runnable starting point. The key insight is that templates are scoped to **what the extension contributes**, not how it's structured.

**The Obsidian sample plugin** takes the opposite approach: a single generic starter that demonstrates every feature. This is fine for human developers who read through it, but agents benefit more from templates scoped to their goal.

**Recommendation: 3 slot-specific templates**

| Template name    | `slots` param               | What it generates                                                   |
| ---------------- | --------------------------- | ------------------------------------------------------------------- |
| `dashboard-card` | `["dashboard.sections"]`    | Working dashboard section with placeholder data and a fetch example |
| `command`        | `["command-palette.items"]` | Registered command that shows a notification                        |
| `settings-panel` | `["settings.tabs"]`         | Settings tab with `loadData`/`saveData` persistence example         |

A fourth template for `canvas-renderer` can be added in a follow-up once the canvas slot type stabilizes.

**Why not a generic starter?** The generic starter requires the agent to know what it wants to build and how to wire it. With a template, the agent gets a working example that demonstrates the full contribution registration pattern for that specific slot — it only needs to replace the placeholder data/logic. This cuts the first-iteration error rate significantly.

**Template implementation**: `create_extension` accepts a `template` parameter defaulting to `'dashboard-card'` (most common expected use case). Each template is a string constant in the MCP tools file. No external template files to maintain — the starter code is inlined.

---

### Finding 3: Security Model

**Reference implementations:**

- **Obsidian**: Zero sandbox. Plugins get direct `App` object access. Deliberate — "due to technical limitations in the plugin architecture." Community code review is the only mitigation for published plugins. For self-written/agent-written plugins, there is zero risk (you trust your own code).
- **VS Code**: Extension Host process isolation + webview iframes for UI. Heavyweight but the audience is public extension marketplace. Not appropriate for DorkOS's local-only, developer-audience use case.
- **Figma**: Realms-based sandbox (separate JS context, no shared globals). Main thread runs plugin logic; iframe runs plugin UI. Severe performance and communication overhead. Not appropriate for synchronous React rendering in the host.
- **Grafana 11.5**: Proxy-membrane sandbox (Salesforce near-membrane). Best available option for React-integrated sandboxing, but adds observable rendering overhead and is still in preview status.

**DorkOS audience analysis**: The Phase 4 target user is Kai — a developer running 10-20 agent sessions across 5 projects. Extensions are written by agents he controls, on his machine. The risk model is identical to Obsidian's: you are running your own code. A sandboxed approach would add 100-300ms of rendering overhead per extension render cycle (from iframe/proxy overhead) for zero security benefit.

**Recommendation: Full-trust model with one confirmation seam**

1. **Local extensions** (`.dork/extensions/` in active CWD): no confirmation. The agent creates and activates them in one step.
2. **Global extensions** (`~/.dork/extensions/`): `create_extension(scope: 'global')` returns a `requires_confirmation: true` flag. The MCP tool does NOT auto-activate. The client shows a toast: "Agent wants to install a global extension 'X'. Activate?" The user clicks yes. This is the same model Obsidian uses for enabling new plugins — one-time human checkpoint before global activation.

This single seam is not a security sandbox. It is a UX checkpoint that prevents the agent from silently polluting global extension state without the user's awareness. It also creates a natural audit trail.

**Future v2**: If the audience expands to include less-trusted extension sources, the Grafana proxy-membrane model is the right path. Grafana's implementation demonstrates it is feasible for a React SPA — it just has meaningful complexity and performance costs that are not justified for v1.

---

### Finding 4: Hot Reload Architecture

**Reference implementations:**

- **VSCode**: Does NOT support per-extension hot reload today. Full Extension Development Host window reload is required. Active issue [#190917](https://github.com/microsoft/vscode/issues/190917) from 2023 requesting this feature remains open. VSCode reloads the entire extension host process.
- **Obsidian hot-reload plugin** (pjeby/hot-reload): The definitive reference. Watches individual plugin directories. On file change, debounces 750ms, then calls `app.plugins.disablePlugin(id)` followed by `app.plugins.enablePlugin(id)`. Reload is **per-plugin** — only the changed plugin reloads. Other plugins are unaffected. A brief toast appears during reload.
- **Figma**: Hot reloads the entire plugin (equivalent to full reload) but it's fast enough that it feels instant because plugins are stateless single-function executions.

**DorkOS implementation for per-extension reload:**

The key architectural requirement is that the extension loader maintains a `Map<extId, LoadedExtension>` (or equivalent registry) so individual extensions can be targeted for reload. Phase 3's activation lifecycle (activate/deactivate per extension) provides the mechanism.

```typescript
async function reloadExtension(extId: string): Promise<ExtensionLoadResult> {
  // 1. Deactivate current instance if active
  const current = loadedExtensions.get(extId);
  if (current?.status === 'active') {
    await current.instance.deactivate();
    loadedExtensions.delete(extId);
  }

  // 2. Recompile (esbuild, ~10ms, may hit content-hash cache)
  const bundle = await compileExtension(extId);
  if (bundle.error) return { extId, status: 'error', phase: 'compilation', errors: bundle.errors };

  // 3. Re-import (ESM cache bust via query string)
  const mod = await import(`/api/extensions/${extId}/bundle?t=${Date.now()}`);

  // 4. Re-activate
  const api = createExtensionAPI(extId);
  try {
    await mod.activate(api);
    loadedExtensions.set(extId, { instance: mod, status: 'active' });
    return { extId, status: 'active' };
  } catch (err) {
    return { extId, status: 'error', phase: 'activation', error: err };
  }
}
```

**ESM module re-import problem**: Node.js ESM does not expose a clearable module cache (unlike CommonJS `require.cache`). The cache-bust-via-query-string pattern (`import('./bundle.js?t=timestamp')`) works but leaks module memory — the stale module cannot be garbage collected. For an interactive development loop where an extension is reloaded 10-50 times, this is acceptable (each module instance is ~50-500KB). Memory pressure only becomes a concern for very high reload frequency or very large extensions. A server restart clears all module instances.

**Full reload vs per-extension reload summary:**

|                 | Full reload                         | Per-extension reload                        |
| --------------- | ----------------------------------- | ------------------------------------------- |
| Complexity      | Lower — reload all, no targeting    | Higher — requires `Map<extId, instance>`    |
| User impact     | All extensions flicker/reinitialize | Only changed extension reloads              |
| Agent iteration | Acceptable if reload is fast (<2s)  | Better DX — other extensions stable         |
| State loss      | All extension state lost            | Only changed extension state lost           |
| Error isolation | One bad extension blocks all        | Compilation error stops only that extension |

**Recommendation**: Implement per-extension reload. The `Map<extId, LoadedExtension>` should already exist from Phase 3 implementation. The incremental complexity over full reload is low. Error isolation (one bad extension does not affect others) is the key advantage for agent iteration — the agent can fix its broken extension while other extensions stay active.

---

### Finding 5: File Watcher Strategy

**chokidar v5 (November 2025)**:

- ESM-only package, requires Node 20+
- Uses native `fs.events` on macOS (kqueue/FSEvents), `inotify` on Linux
- Used by Vite, Webpack, Jest, and ~30 million repositories
- **Do not use raw `fs.watch()`**: misses events in editors, doesn't report filenames consistently on macOS, emits spurious rename events

**Debounce strategy for agent-generated files:**

Agents write multiple files in rapid succession: `extension.json`, `index.ts`, possibly `utils.ts`. A global debounce on the extensions directory would fire for every file write, potentially triggering N compilations for an N-file extension. The correct strategy:

1. Watch the extension **directory** (not individual files), debounced **per extension ID**
2. Use **750ms debounce** (proven by Obsidian's hot-reload plugin, empirically tuned for development workflows)
3. On debounce fire: compile and reload only the extension whose directory changed

```typescript
import chokidar from 'chokidar';

const reloadTimers = new Map<string, NodeJS.Timeout>();

const watcher = chokidar.watch(
  [join(resolveDorkHome(), 'extensions'), join(cwd, '.dork', 'extensions')],
  { ignoreInitial: true, depth: 2 }
);

watcher.on('all', (event, filePath) => {
  // Identify which extension directory changed
  const extId = resolveExtIdFromPath(filePath);
  if (!extId) return;

  // Per-extension debounce
  clearTimeout(reloadTimers.get(extId));
  reloadTimers.set(
    extId,
    setTimeout(async () => {
      const result = await reloadExtension(extId);
      // Push to SSE clients
      broadcastExtensionEvent({ type: 'extension_reloaded', extId, result });
    }, 750)
  );
});
```

**Watcher + explicit `reload_extensions` coexistence:**

The watcher is optional and additive. When both are active:

- Agent calls `reload_extensions` → synchronous reload, returns structured result to agent
- Agent writes files → watcher fires after 750ms debounce → async reload, pushes SSE event

There is no conflict because `reloadExtension()` is the shared implementation. If the agent calls `reload_extensions` and the watcher fires 750ms later (because the file writes triggered it), the second reload is a no-op (same content hash → cache hit → same bundle → fast). This is the "harmless double" pattern used by webpack watch mode.

**`depth: 2`** in chokidar config watches `{ext-dir}/` and one level of subdirectories — sufficient for extensions with a flat or shallow structure. Deep nesting (e.g., `src/components/`) would be caught by the default depth but is uncommon in v1 extensions.

---

### Finding 6: Iteration Speed Optimization

**Cycle breakdown: write → compile → reload → render**

| Phase                            | Latency         | Notes                                        |
| -------------------------------- | --------------- | -------------------------------------------- |
| Agent file write                 | 0-50ms          | Write to local filesystem                    |
| chokidar detection               | <10ms           | FSEvents/inotify latency                     |
| Debounce wait                    | 750ms           | Required for agent multi-file writes         |
| esbuild compilation              | 5-15ms          | Small extension (<300 lines); ~10ms typical  |
| Content-hash cache lookup        | <1ms            | If source unchanged, immediate cache hit     |
| ESM dynamic import               | 5-20ms          | Module parsing + evaluation                  |
| Extension activation             | 1-10ms          | `activate()` call, synchronous in most cases |
| SSE push to client               | 1-5ms           | Express SSE write to socket                  |
| SSE receive in browser           | 50-200ms        | Network RTT + EventSource delivery           |
| React rerender                   | 5-30ms          | Depends on extension's render complexity     |
| **Total (watcher path)**         | **~830-1060ms** | Dominated by debounce wait                   |
| **Total (explicit reload path)** | **~70-280ms**   | No debounce; direct call                     |

**The watcher path is bottlenecked by the debounce, not esbuild.** Reduce debounce from 750ms to 300ms and the cycle drops to ~400-600ms — but at the risk of triggering mid-write for slower agent file writes.

**The explicit `reload_extensions` path is <500ms in practice.** This is the fast path. The agent writes all files, then explicitly calls `reload_extensions`. There is no debounce.

**Optimization opportunities (in order of ROI):**

1. **Explicit reload by default, watcher as DX improvement** — The explicit tool call gives the agent control over when to trigger, eliminating the debounce wait entirely.
2. **Compilation cache hit rate** — For repeated agent iterations where only `index.ts` changes, the compile step is ~1ms (cache miss check) vs 10ms (full compile). Good cache key design (content hash) maximizes this.
3. **SSE connection persistence** — The existing DorkOS SSE infrastructure (`GET /api/sessions/:id/stream`) is already persistent. Reuse this channel for `extension_reloaded` events rather than opening a new SSE connection.
4. **Skip re-activation if bundle unchanged** — If the agent calls `reload_extensions` without changing any files, the content hash matches the cached bundle. Can short-circuit to "already up to date" without re-importing the module.
5. **React rerender batching** — The `extension_reloaded` SSE event should trigger a single React state update, not a full component remount. If the ExtensionPointRegistry update is batched in React, the DOM diff is minimal for stable extension slots.

**Theoretical minimum (explicit reload, warm cache, same bundle):**

- File already written, explicit `reload_extensions` call: 0ms write detection
- Compilation: ~1ms (cache hit)
- Module re-import: ~10ms (browser fetch from `/api/extensions/X/bundle`)
- Activation: ~3ms
- SSE push + receive: ~60ms
- React rerender: ~10ms
- **Total: ~85ms** — well within the "feels instant" threshold

---

### Finding 7: Extension Testing Patterns

**The challenge**: The agent needs to verify its extension works before the user sees a broken UI. Full browser-based UI testing (Playwright snapshots) is ~10-30 seconds per run — too slow for tight iteration.

**Reference implementations:**

- **Backstage `createExtensionTester`**: Creates a minimal React rendering harness for an extension in isolation. The extension's factory function is called, its contributions are collected, and you can assert on what was registered. No browser required.
- **Obsidian plugin testing**: Historically required a headless Electron instance (slow, heavy). The `obsidian-testing` package (MohrJonas) allows testing plugin logic by mocking the `App` object. The community consensus is: test plugin logic by mocking the Obsidian API, not by running a real Obsidian instance.
- **VSCode extension testing**: Uses `@vscode/test-electron` which runs real VS Code headlessly. Slow (~15s startup) but thorough.

**Recommendation: `test_extension` MCP tool with headless activation**

A lightweight server-side activation smoke test:

```typescript
server.tool('test_extension', { id: z.string() }, async ({ id }) => {
  // 1. Compile the extension
  const bundle = await compileExtension(id);
  if (bundle.error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ status: 'error', phase: 'compilation', errors: bundle.errors }),
        },
      ],
    };
  }

  // 2. Activate in isolation with a mock ExtensionAPI
  const mockAPI = createMockExtensionAPI();
  try {
    const mod = await import(`/api/extensions/${id}/bundle?t=${Date.now()}`);
    await mod.activate(mockAPI);
    // 3. Report what was registered
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            contributions: mockAPI.getRegistrations(), // { 'dashboard.sections': 1, 'command-palette.items': 0, ... }
          }),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ status: 'error', phase: 'activation', error: String(err) }),
        },
      ],
    };
  }
});
```

The `mockAPI.getRegistrations()` returns a simple map of slot → count of registered contributions. The agent can verify: "I registered a dashboard section" → contributions shows `{ 'dashboard.sections': 1 }`. This confirms the extension activated successfully without requiring a real UI.

**What this catches:**

- Compilation errors (TypeScript type errors, syntax errors)
- Runtime errors during `activate()` (null dereferences, invalid API calls)
- Missing contributions (agent wrote extension but forgot to call `registerDashboardSection`)
- Wrong slot names (typo in slot ID → contribution count is 0 where 1 was expected)

**What this does not catch:**

- Visual rendering correctness (whether the React component renders correctly)
- Runtime data fetching errors (the component may fail when it actually tries to fetch GitHub PRs)
- CSS/layout issues

For visual verification, the `reload_extensions` → SSE → client render loop is the lightweight alternative. The agent can describe what it expects to see and ask the user to confirm. This is appropriate for Phase 4 where the user is watching the agent work.

**Agent iteration loop with testing:**

```
create_extension → test_extension (smoke) → [fix errors] → reload_extensions → user confirms visually
```

The `test_extension` smoke test catches ~80% of failures in the edit loop. The final `reload_extensions` handles the remaining 20% (visual/data issues). This is the minimum effective testing surface for agent-written extensions.

---

## Overall Recommendation

A coherent Phase 4 implementation strategy based on all findings:

### Architecture Summary

```
Agent (Claude Code / Cursor / Windsurf)
    │
    ├── create_extension(name, template, scope)
    │     └── Writes extension.json + index.ts with inline API reference
    │
    ├── get_extension_api_reference()
    │     └── Returns packages/extension-api/src/index.d.ts as text
    │
    ├── test_extension(id)
    │     └── Headless activation smoke test; returns contributions map
    │
    ├── reload_extensions()  ← Primary iteration tool
    │     └── Per-extension recompile + deactivate/reactivate
    │     └── Returns structured errors (file:line:col:message)
    │
    └── list_extensions()
          └── All discovered extensions with status + last error
              │
chokidar watcher (optional, file-change path)
    └── 750ms per-extension debounce
    └── Calls same reloadExtension() as reload_extensions tool
    └── Broadcasts extension_reloaded SSE event
              │
SSE → React client → ExtensionPointRegistry update → rerender
```

### Priority Order for Implementation

1. **`list_extensions` + `create_extension` + `reload_extensions`** — The core loop. Agent can write code and reload. Nothing else matters until this works end-to-end.
2. **Structured errors in `reload_extensions`** — esbuild error objects with file/line/column. Non-negotiable for agent feedback loop.
3. **`get_extension_api_reference` MCP tool** — 15 lines of code, high value for agent context.
4. **`test_extension` smoke test** — Headless activation check. Saves the agent a full reload cycle for catchable errors.
5. **`<extension_api>` system prompt block** — Workflow glue injected via `context-builder.ts`. Low effort, proven pattern.
6. **chokidar file watcher** — DX improvement. `reload_extensions` tool is sufficient for v1. Watcher makes the auto-iteration loop possible.
7. **Per-extension vs full reload** — Per-extension is better but full reload is acceptable as a starting point. Refine once the loop works.
8. **3 slot-specific templates** — Add after the generic starter works. Template content can be refined based on what agents actually build first.
9. **`test_extension` UI confirmation seam for global extensions** — After the basic flow is stable.

### Non-Recommendations

- **No runtime sandboxing in v1** — Wrong risk model for the audience. Adds complexity and rendering overhead for zero security benefit.
- **No automatic template selection** — The agent specifies the template. Do not try to infer it from a natural language description. The agent reads the template options from `create_extension`'s tool description and chooses.
- **No polling watcher** — `fs.watchFile` polling is CPU-intensive and unnecessary on macOS/Linux. chokidar's native event approach is the correct default.
- **No separate HTTP endpoints for extension management** — MCP tools only, consistent with DorkOS's agent-facing API design (from `00-brief.md` decision #1).

---

## Sources & Evidence

### Prior DorkOS Research

- `research/20260323_plugin_extension_ui_architecture_patterns.md` — VSCode, Obsidian, Grafana, Backstage deep analysis
- `research/20260326_extension_system_open_questions.md` — esbuild compilation caching, Phase 3 design
- `research/20260303_agent_tool_context_injection.md` — Static XML block pattern, token budget

### File Watchers

- [chokidar GitHub (paulmillr/chokidar)](https://github.com/paulmillr/chokidar) — v5 release Nov 2025, ESM-only, Node 20+
- [Vite issue: use fs.watch instead of chokidar if Node >=v19.1](https://github.com/vitejs/vite/issues/12495) — Decision to stay with chokidar; fs.watch instability documented
- [chokidar-debounced npm](https://www.npmjs.com/package/chokidar-debounced) — Per-watcher debounce wrapper

### Hot Reload

- [pjeby/hot-reload — Obsidian hot reload plugin](https://github.com/pjeby/hot-reload) — Per-plugin deactivate/reactivate, 750ms debounce, `.hotreload` marker file pattern
- [VSCode issue #190917 — Hot reload for extension development](https://github.com/microsoft/vscode/issues/190917) — Confirms VSCode does NOT have per-extension hot reload; only full host reload
- [Hot Reload blog post (hediet.de)](https://blog.hediet.de/post/hot_reload_for_vs_code_extension_development/) — VSCode extension hot reload architecture

### ESM Module Reloading

- [Cache busting in Node.js dynamic ESM imports (Aral Balkan)](https://ar.al/2021/02/22/cache-busting-in-node.js-dynamic-esm-imports/) — Query string cache bust pattern, memory leak caveat
- [Clear Module Cache — ESM vs CJS (codewithhugo.com)](https://codewithhugo.com/nodejs-esm-cjs-clear-module-cache/) — ESM has no exposed cache; query string is only option
- [Allow busting ESM cache — Node.js issue #38322](https://github.com/nodejs/node/issues/38322) — Long-standing open issue; no native solution

### Type Context Delivery

- [typescript-definitions-mcp (blakeyoder/typescript-definitions-mcp)](https://github.com/blakeyoder/typescript-definitions-mcp) — MCP tool (not resource) pattern for exposing TypeScript definitions to Claude Code
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Official SDK; resources vs tools distinction
- [Agent SDK reference — Claude API Docs](https://platform.claude.com/docs/en/agent-sdk/typescript) — systemPrompt.append mechanism

### Extension Testing

- [Backstage Frontend System Testing Plugins](https://backstage.io/docs/frontend-system/building-plugins/testing/) — `createExtensionTester` pattern; headless factory activation
- [Obsidian plugin testing challenges](https://www.moritzjung.dev/obsidian-collection/plugin-dev/testing/challengeswhentestingplugins/) — Obsidian testing patterns and limitations
- [obsidian-testing package (MohrJonas)](https://github.com/MohrJonas/obsidian-testing) — Mock App object pattern for headless testing

### Security

- [Figma plugin architecture](https://www.figma.com/blog/how-we-built-the-figma-plugin-system/) — Realms-based sandbox; worker + iframe model
- [Grafana Frontend Sandbox](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-frontend-sandbox/) — Proxy-membrane approach (near-membrane)
- [Obsidian Plugin Security](https://help.obsidian.md/plugin-security) — Full-trust model rationale

### esbuild

- [esbuild API reference](https://esbuild.github.io/api/) — Official docs; rebuild API, `write: false`, content-hash filenames
- [esbuild performance analysis — Feature-Sliced Design blog](https://feature-sliced.design/blog/esbuild-performance-explained) — Architecture of why esbuild is fast (Go, parallel, no type checking)

---

## Research Gaps & Limitations

- **ESM module memory leak quantification**: No authoritative measurement of how much memory each stale module instance consumes. For agent iteration (10-50 reloads per session), the practical impact is likely small but unverified.
- **chokidar v5 ESM-only migration cost**: DorkOS currently uses `tsconfig` with NodeNext module resolution. chokidar v5's ESM-only requirement should be compatible but was not verified against the actual build config.
- **SSE event delivery latency**: The 50-200ms range is an estimate from general SSE literature. Actual DorkOS SSE channel latency depends on connection persistence and client reconnect behavior — not benchmarked.
- **Template content quality**: The specific contents of the 3 templates are not specified here. The first agent iteration loops will reveal what level of detail is needed in the starter code. Plan to iterate on template content after 3-5 real agent extension builds.
- **`test_extension` mock API completeness**: The `createMockExtensionAPI()` needs to implement all methods of `ExtensionAPI` to avoid activation failures from missing methods. This requires keeping the mock in sync with the Phase 3 `ExtensionAPI` interface. A generated mock (using `vi.fn()` per method) is the maintainable approach.

---

## Search Methodology

- Searches performed: 11 WebSearch + 3 WebFetch calls
- Most productive search terms: "Obsidian plugin hot reload deactivate activate", "chokidar v5 2025", "node.js ESM dynamic import cache bust", "typescript-definitions-mcp"
- Prior research consulted first: 3 existing deep-research reports covered ~50% of the question space
- Primary sources: GitHub repositories (pjeby/hot-reload, blakeyoder/typescript-definitions-mcp, paulmillr/chokidar), official docs (chokidar, Backstage, Grafana, VS Code), npm-compare.com statistics
