---
title: 'electron-vite Upgrade: v3.1.0 to v5.0.0 Migration Research'
date: 2026-04-01
type: implementation
status: active
tags: [electron-vite, electron, vite, desktop, migration, breaking-changes, turborepo, pnpm]
feature_slug: upgrade-electron-vite
searches_performed: 14
sources_count: 18
---

## Research Summary

The desktop app (`apps/desktop`) is currently on `electron-vite@^3.1.0` and needs upgrading to v5.0.0 (released December 2025). The jump spans two major version bumps (v3→v4→v5), each with distinct breaking changes. The most impactful change for this codebase is that the existing `electron.vite.config.ts` uses `externalizeDepsPlugin()` directly, which is deprecated in v5 and must be replaced with the built-in `build.externalizeDeps` option. The v4 bump also raised the minimum Node.js requirement to 20.19+/22.12+ and upgraded the bundled Vite to v7 (dropping CJS build). For this specific project, the migration is **low risk** — no function-based config is used, no bytecode plugin, and the tsconfig is already on modern settings.

---

## Key Findings

1. **Current state is v3.1.0, target is v5.0.0**: The task brief mentioned "very old version" but the actual installed version is `^3.1.0` (released March 2025). The upgrade skips v4.0.0 (July 2025) and lands on v5.0.0 (December 2025). This is two major bumps, not four.

2. **Only one config change is required in `electron.vite.config.ts`**: Remove `externalizeDepsPlugin` from both the `main` and `preload` plugin arrays. The functionality is now enabled by default via `build.externalizeDeps`. The existing `rollupOptions.external` entries for `better-sqlite3` and `@anthropic-ai/claude-agent-sdk` remain valid — they are Rollup externals (force-excluded from bundling), not related to the externalizeDeps feature.

3. **Node.js version constraint introduced in v4**: electron-vite v4 requires Node.js 20.19+ or 22.12+. This must be verified against the CI/dev environment before upgrading.

4. **Bundled Vite upgraded to v7 in v4, stays on v7 in v5**: electron-vite v4 pulled in Vite 7 as its peer dependency. The `@tailwindcss/vite` and `@vitejs/plugin-react` plugins used in the renderer config must be compatible with Vite 7. Both are.

5. **CJS build of electron-vite removed in v4**: The electron-vite package itself no longer ships a CommonJS build. Since `apps/desktop` does not call `require('electron-vite')` anywhere — it uses `electron.vite.config.ts` with ESM imports — this change has no effect.

6. **Function-based nested config removed in v5**: The existing config uses static objects for `main`, `preload`, and `renderer`. No `defineViteConfig(({ command, mode }) => ...)` wrappers are present. This breaking change does not affect the codebase.

7. **`main` output directory discrepancy**: The current `package.json` has `"main": "dist/main/index.js"` but the config sets `build.outDir: 'dist/main'`. These are consistent. However, the v5 docs show the default output as `out/` not `dist/`. Since the project explicitly sets `outDir`, this is not a concern.

8. **Electron 33 is installed — fully supported**: electron-vite v5 supports Electron 32 through 39. The current `electron@^33.4.11` is within that range.

---

## Detailed Analysis

### What Changed: v3.1.0 → v4.0.0 (July 2025)

| Change                                  | Impact on this project                                                   |
| --------------------------------------- | ------------------------------------------------------------------------ |
| Node.js minimum bumped to 20.19+/22.12+ | Must verify CI + dev Node version                                        |
| Vite v7 adopted (Vite 6 → Vite 7)       | `@tailwindcss/vite` and `@vitejs/plugin-react` must be Vite 7-compatible |
| CJS build of electron-vite removed      | No impact — project uses ESM config                                      |
| Electron 36-37 targets added            | No impact                                                                |

### What Changed: v4.0.0 → v5.0.0 (December 2025)

| Change                               | Impact on this project                       |
| ------------------------------------ | -------------------------------------------- |
| `externalizeDepsPlugin` deprecated   | **Action required**: remove from config      |
| `bytecodePlugin` deprecated          | No impact — not used                         |
| Function-based nested config removed | No impact — static config used               |
| Config interfaces restructured       | Verify `defineConfig` call still type-checks |
| `build.isolatedEntries` option added | Optional enhancement for preload isolation   |
| Electron 39 support added            | No impact                                    |

### The `externalizeDepsPlugin` Change in Detail

In v3, the `externalizeDepsPlugin` was required to tell electron-vite to treat Node.js built-ins and native dependencies as external (not bundled). In v5, this is the default behavior.

**Current config (v3 style):**

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        external: ['better-sqlite3', '@anthropic-ai/claude-agent-sdk'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
    },
  },
  // ...
});
```

**Required v5 config:**

```ts
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    // externalizeDepsPlugin removed — now default behavior
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        external: ['better-sqlite3', '@anthropic-ai/claude-agent-sdk'],
      },
    },
  },
  preload: {
    // externalizeDepsPlugin removed — now default behavior
    build: {
      outDir: 'dist/preload',
    },
  },
  // ...
});
```

Note: The `rollupOptions.external` array is independent of `externalizeDepsPlugin` — it forces specific packages to be treated as external at the Rollup level. These entries (`better-sqlite3`, `@anthropic-ai/claude-agent-sdk`) must stay.

### TypeScript Configuration Assessment

The existing `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["electron"]
  }
}
```

This is already on modern settings. electron-vite v5 with Vite 7 uses `"moduleResolution": "bundler"` by default in its scaffold templates, so this is aligned. No tsconfig changes needed.

### Vite Plugin Compatibility

The renderer uses:

- `@vitejs/plugin-react@5.1.4` — supports Vite 5, 6, and 7
- `@tailwindcss/vite@^4.1.18` — Tailwind CSS v4's official Vite plugin, supports Vite 7

Both are Vite 7-compatible. No version bumps needed for these plugins unless `peerDependencies` warnings appear after the electron-vite upgrade.

### Monorepo / pnpm Considerations

No changes needed to `pnpm-workspace.yaml` or `turbo.json`. The `shamefully-hoist` workaround mentioned in some electron-vite issue threads is for projects that don't declare workspace dependencies properly — the `apps/desktop` package already correctly declares `@dorkos/shared`, `@dorkos/db`, and `@dorkos/server` as workspace dependencies.

The custom `sharedSubpathAliases()` function in the config (which resolves `@dorkos/shared/*` subpath exports directly to TypeScript source) is not affected by the electron-vite version change. It operates at the Vite resolve alias level, which is unchanged between v3 and v5.

### electron-builder Compatibility

The existing `electron-builder@^26.8.1` is not tied to the electron-vite version. No changes needed.

---

## Potential Solutions

### 1. Direct Upgrade (Recommended)

Bump `electron-vite` from `^3.1.0` to `^5.0.0` in `package.json` and remove `externalizeDepsPlugin` from `electron.vite.config.ts`. One package version change, two lines removed from config.

- **Pros:**
  - Minimal diff — two lines removed from config, one version bump
  - Gets on the latest Vite 7-powered build pipeline
  - `externalizeDeps` is now on by default, so behavior is preserved
  - Electron 33 is fully supported by v5
  - Access to new `build.isolatedEntries` feature for preload sandbox improvements
- **Cons:**
  - Node.js 20.19+ requirement must be verified (could affect CI)
  - Skipping v4 means absorbing two major versions' worth of changes in one step
- **Complexity:** Low
- **Maintenance:** Low

### 2. Incremental Upgrade (v3 → v4, then v4 → v5)

Upgrade to v4.0.0 first, verify it works, then upgrade to v5.0.0.

- **Pros:**
  - Easier to isolate which major version caused a regression if one appears
  - Mirrors the official migration path
- **Cons:**
  - Two separate PRs/cycles for a change that can be done in one
  - The v3→v4 changes (Node version, Vite 7) are the harder part; v4→v5 is lightweight
  - No additional risk mitigation for this specific project given the config is simple
- **Complexity:** Low-Medium
- **Maintenance:** Low

### 3. Stay on v3.x with Selective Vite Upgrade

Pin `electron-vite` at the latest v3.x patch and manually bump Vite-related plugins.

- **Pros:**
  - Zero migration risk
- **Cons:**
  - electron-vite v3.x receives no security or feature updates
  - Vite 6 (used by v3) has already been superseded by Vite 7 and Vite 8
  - Defers the inevitable; the codebase will fall further behind
  - Already on a version that was released ~13 months ago
- **Complexity:** None (but accrues technical debt)
- **Maintenance:** High (increasingly divergent from upstream)

---

## Compatibility Matrix

| electron-vite       | Electron | Vite | Node.js minimum |
| ------------------- | -------- | ---- | --------------- |
| 3.1.0 (current)     | 32–35    | 6.x  | 18+             |
| 4.0.0               | 32–37    | 7.x  | 20.19+, 22.12+  |
| 5.0.0 (target)      | 32–39    | 7.x  | 20.19+, 22.12+  |
| (installed) 33.4.11 | —        | —    | —               |

---

## File-by-File Change Map

| File                                   | Change Required                                                                           | Notes                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------- |
| `apps/desktop/package.json`            | `electron-vite: "^3.1.0"` → `"^5.0.0"`                                                    | Single version bump        |
| `apps/desktop/electron.vite.config.ts` | Remove `externalizeDepsPlugin` import and two `plugins: [externalizeDepsPlugin()]` usages | ~3 lines removed           |
| `apps/desktop/tsconfig.json`           | None                                                                                      | Already on modern settings |
| `apps/desktop/src/**`                  | None                                                                                      | Source files unaffected    |
| `pnpm-lock.yaml`                       | Regenerated by `pnpm install`                                                             | Automatic                  |

---

## Research Gaps & Limitations

- The exact Vite peer dependency version range in electron-vite v5 (`peerDependencies`) was not confirmed from npm — if it requires Vite 7.x specifically (not 6.x), the `@tailwindcss/vite` and `@vitejs/plugin-react` versions in the project need to be verified as Vite 7-compatible (they appear to be, but `pnpm install` will surface any peer warnings).
- electron-vite does not publish a dedicated migration guide from v3 to v4 on its docs site (only v4 to v5 is documented). The v3→v4 changes were reconstructed from the CHANGELOG.
- Whether the CI environment (GitHub Actions) runs Node.js 20.19+ was not verified. The smoke test workflow should be checked.

---

## Recommendation

**Recommended Approach:** Direct Upgrade (Approach 1)

**Rationale:** The actual migration delta is extremely small for this project. The config uses `externalizeDepsPlugin` but not `bytecodePlugin` or function-based config, so only two plugin references need to be removed. The TypeScript config is already on modern settings. The installed Electron 33 and both renderer Vite plugins are fully compatible with electron-vite v5. The only external dependency to verify before upgrading is the Node.js version in CI (`>=20.19` or `>=22.12`).

**Caveats:**

- Confirm that the CI/GitHub Actions environment uses Node.js 20.19+ (introduced as a hard requirement in v4). If CI uses an older Node 20.x patch (e.g., 20.18), it needs a bump before the electron-vite upgrade.
- After `pnpm install`, check for `pnpm` peer dependency warnings about Vite version mismatches. `@tailwindcss/vite@^4.1.18` and `@vitejs/plugin-react@5.1.4` are expected to be Vite 7-compatible, but warnings should be treated as actionable.
- The `"main": "dist/main/index.js"` entry in `package.json` uses `dist/` as the output directory, which differs from electron-vite v5's default scaffold output of `out/`. Since the project explicitly sets `outDir` in config, this is fine — but if someone runs `electron-vite preview` without the config, it may look for files in the wrong place. This is an existing pre-upgrade concern, not introduced by v5.

---

## Search Methodology

- Searches performed: 14
- Most productive terms: "electron-vite latest version 2026", "electron-vite v2 migration guide breaking changes", "electron-vite 5.0 release notes", "electron-vite v4 migration guide vite 7 node 20"
- Primary sources: electron-vite.org (official docs, migration guide, blog), github.com/alex8088/electron-vite (CHANGELOG, releases), codebase inspection of `apps/desktop/`

---

## Sources & Evidence

- [electron-vite Migration from v4](https://electron-vite.org/guide/migration) — Official v4→v5 migration guide
- [electron-vite 5.0 is out!](https://electron-vite.org/blog/) — Release announcement with feature summary
- [electron-vite Getting Started](https://electron-vite.org/guide/) — Node.js 20.19+/22.12+ requirement confirmation
- [electron-vite CHANGELOG](https://github.com/alex8088/electron-vite/blob/master/CHANGELOG.md) — Version-by-version change history
- [electron-vite Env Variables](https://electron-vite.org/guide/env-and-mode) — MAIN*VITE*, PRELOAD*VITE*, RENDERER*VITE*, VITE\_ prefix system
- [electron-vite Releases](https://github.com/alex8088/electron-vite/releases) — Version dates (v4.0.0: July 6 2024, v5.0.0: December 7 2025)
- [electron-vite npm](https://www.npmjs.com/package/electron-vite) — Version history and peer deps
- [Codebase: apps/desktop/package.json] — Confirmed current version: `^3.1.0`, Electron: `^33.4.11`
- [Codebase: apps/desktop/electron.vite.config.ts] — Confirmed `externalizeDepsPlugin` usage, static config structure
- [Codebase: apps/desktop/tsconfig.json] — Confirmed modern `moduleResolution: bundler` setting
- [Prior research: research/20260324_electron_desktop_app_monorepo.md] — Architecture decisions for the desktop app
