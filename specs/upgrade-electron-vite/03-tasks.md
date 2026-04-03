# Tasks: Upgrade electron-vite v3→v5 and Electron 33→39

**Spec:** `specs/upgrade-electron-vite/02-specification.md`
**Generated:** 2026-04-01
**Mode:** Full

---

## Overview

4 tasks across 1 phase. Tasks 1.1 and 1.2 can run in parallel. Tasks 1.3 and 1.4 are sequential and depend on both 1.1 and 1.2 completing first.

```
1.1 Bump versions ─┐
                   ├─→ 1.3 pnpm install ─→ 1.4 Verify
1.2 Remove plugin ─┘
```

---

## Phase 1: Implementation

### Task 1.1 — Bump electron-vite, electron, and @tailwindcss/vite versions

**Size:** Small | **Priority:** High | **Parallel with:** 1.2

**File:** `apps/desktop/package.json`

Three version bumps in `devDependencies`:

| Package             | From       | To        |
| ------------------- | ---------- | --------- |
| `electron-vite`     | `^3.1.0`   | `^5.0.0`  |
| `electron`          | `^33.4.11` | `^39.8.5` |
| `@tailwindcss/vite` | `^4.1.18`  | `^4.2.2`  |

All other dependencies stay unchanged. Notably:

- `@vitejs/plugin-react` stays at `5.1.4` (v6 requires Vite 8; electron-vite v5 bundles Vite 7)
- `@electron/rebuild` stays at `^3.7.2` (v4 has breaking API changes)
- `electron-builder`, `electron-updater`, `electron-log` are already at latest

---

### Task 1.2 — Remove externalizeDepsPlugin from electron.vite.config.ts

**Size:** Small | **Priority:** High | **Parallel with:** 1.1

**File:** `apps/desktop/electron.vite.config.ts`

`externalizeDepsPlugin` is deprecated in electron-vite v5. Its behavior — treating all `node_modules` as external for main and preload — is now the default (`build.externalizeDeps: true`). The explicit plugin call is dead code.

Three line-level changes:

1. **Import** — remove `externalizeDepsPlugin` from the named import:

   ```ts
   // Before
   import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
   // After
   import { defineConfig } from 'electron-vite';
   ```

2. **`main` block** — remove `plugins: [externalizeDepsPlugin()],`

3. **`preload` block** — remove `plugins: [externalizeDepsPlugin()],`

**Important:** Do NOT remove `rollupOptions.external: ['better-sqlite3', '@anthropic-ai/claude-agent-sdk']` from the `main` block. These are Rollup-level directives that force specific packages out of the bundle entirely — a separate concern from `externalizeDepsPlugin`'s auto-externalization of all `node_modules`. They must stay.

Do not touch the `renderer` section.

---

### Task 1.3 — Regenerate pnpm lockfile

**Size:** Small | **Priority:** High | **Depends on:** 1.1, 1.2

From the repo root:

```bash
pnpm install
```

This regenerates `pnpm-lock.yaml` to reflect the new package versions. Run from the repo root, not from `apps/desktop/`.

**Native module note:** Electron 33→39 changes the native ABI. `better-sqlite3` has a compiled native binary that must match the Electron ABI. For production builds, `electron-builder` handles this automatically (`npmRebuild: true` in `electron-builder.yml`). For dev mode, this is handled lazily — only run the manual rebuild if a `NODE_MODULE_VERSION` mismatch error appears in the Electron dev console during task 1.4:

```bash
cd apps/desktop && npx @electron/rebuild --version 39.8.5
```

---

### Task 1.4 — Verify the upgrade

**Size:** Small | **Priority:** High | **Depends on:** 1.3

All steps must pass.

| Step         | Command                               | Pass Condition                                                                                                  |
| ------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Build        | `pnpm --filter @dorkos/desktop build` | Exit 0; `dist/` populated with `main/`, `preload/`, `renderer/`                                                 |
| TypeScript   | `pnpm typecheck`                      | Zero errors across all packages                                                                                 |
| Lint         | `pnpm lint`                           | Zero errors                                                                                                     |
| Dev mode     | `pnpm --filter @dorkos/desktop dev`   | Electron window opens, React app loads, HMR functional                                                          |
| Native check | Inspect Electron dev console          | No `NODE_MODULE_VERSION` mismatch; if present run `npx @electron/rebuild --version 39.8.5` from `apps/desktop/` |
| Pack         | `pnpm --filter @dorkos/desktop pack`  | Unsigned `.app` produced in `apps/desktop/release/mac-arm64/`                                                   |

Run in the order listed. Fix any failures before marking complete.
