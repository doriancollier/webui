---
title: 'electron-vite Compatibility with Electron 40/41 and Node.js v24'
date: 2026-04-01
type: external-best-practices
status: active
tags: [electron-vite, electron, electron-40, electron-41, node-24, compatibility, desktop]
feature_slug: upgrade-electron-vite
searches_performed: 14
sources_count: 12
---

## Research Summary

electron-vite v5.0.0 (released December 7, 2025) officially targets Electron 39 as its highest
compatibility build target. Electron 40 (released January 13, 2026) and Electron 41 (released
March 10, 2026) both embed Node.js v24 (24.11.1 and 24.14.0 respectively) — a major Node version
jump from the Node 22 that shipped with Electron 39. There is **no official electron-vite release
that explicitly supports Electron 40 or 41**, and no v5.x patch or v6.x release has been published
as of April 1, 2026. Community reports of hard breakage are absent from the public issue tracker,
but no community confirmations of "it works fine" were found either. The main practical concern is
not electron-vite itself but the **Node.js v24 ABI change** requiring native modules (e.g.,
`better-sqlite3`) to be rebuilt against Electron 40/41 headers.

---

## Key Findings

1. **electron-vite v5.0.0 is the latest release and targets Electron 39**: The CHANGELOG entry for
   v5.0.0 states "perf: build compatibility target for Electron 39." No v5.x patch or v6 has been
   released since December 7, 2025. The npm page shows the package was "last published 4 months
   ago" as of April 2026, confirming no post-v5.0.0 release exists.

2. **Electron 40 ships Node 24.11.1 (released January 13, 2026)**: This is a full Node.js major
   version jump from the Node 22 used in Electron 38/39. The V8 engine version also jumped from
   14.2 to 14.4. Any native addon (.node binary) must be rebuilt against the new ABI.

3. **Electron 41 ships Node 24.14.0 (released March 10, 2026)**: Continues the Node 24 line.
   Chromium 146.0.7680.65, V8 14.6. Two behavioral breaking changes (PDF rendering and cookie
   events) but neither affects the Vite build pipeline. Recommended install is 41.0.2 due to
   high-priority bugs in 41.0.0.

4. **electron-vite has no Electron version pin in peerDependencies**: The package's `peerDependencies`
   only constrain Vite (`^5.0.0 || ^6.0.0 || ^7.0.0`) and optionally `@swc/core`. Electron itself
   is not a peer dependency, meaning npm/pnpm will not warn or fail when pairing electron-vite v5
   with Electron 40+. The compatibility claim "Electron 39" is a build-target optimization, not an
   enforced ceiling.

5. **No GitHub issues report electron-vite v5 breaking on Electron 40/41**: A search of the
   `alex8088/electron-vite` issue tracker found no issues opened in 2026 mentioning Electron 40,
   Electron 41, or Node 24 failures. This is weak positive evidence — it could mean (a) people
   haven't tried it widely yet, (b) silent failures aren't being reported, or (c) it works for
   most use cases.

6. **The host-side Node.js requirement is separate from the Electron-bundled Node**: electron-vite's
   `engines` field requires `node: "^20.19.0 || >=22.12.0"` — this is the _build-time_ Node.js
   (the developer's machine), not the Node bundled inside Electron 40/41. A dev environment running
   Node 22 LTS will satisfy this constraint regardless of which Electron version is being targeted.

7. **Native modules are the real compatibility risk**: Electron 40 introduced Node 24 headers.
   Projects using `better-sqlite3`, `@anthropic-ai/claude-agent-sdk`, or other native addons must
   re-run `@electron/rebuild` targeting the new Electron version. electron-vite itself does not
   handle this — it delegates to `@electron/rebuild`. This is an operational step, not a
   electron-vite API incompatibility.

---

## Detailed Analysis

### Why No Official Support Statement Exists

electron-vite v5.0.0 shipped December 7, 2025. Electron 40 shipped January 13, 2026 — five weeks
later. The electron-vite maintainer (alex8088) has not published a v5.1.0 or v6.0.0 in the
subsequent ~3 months. This is not necessarily a sign of abandonment; prior release cadence shows
roughly one major per 6-8 months (v3.0.0 Feb 2025, v4.0.0 Jul 2025, v5.0.0 Dec 2025).

The next major version would be expected around mid-2026 at the current pace. That release would
likely declare Electron 40 or 41 as its canonical build target.

### What "Build Compatibility Target" Means in the CHANGELOG

The CHANGELOG entry "perf: build compatibility target for Electron 39" refers to internal Rollup
and esbuild output settings — specifically the `chrome` and `node` target versions that control
which ES syntax features are transpiled vs. passed through. Setting target to Electron 39 means the
output uses syntax supported by Chromium 136 / Node 22.

If Electron 40 (Node 24, Chromium 144) is used, the emitted code will be _under-optimized_ — it
will still run correctly because Electron 40 is a superset of Electron 39's runtime capabilities.
This is not a correctness issue, just a missed opportunity for slightly smaller/faster output.

### The Node.js v24 ABI Jump in Practice

Node.js follows its own module versioning via `NODE_MODULE_VERSION`. Moving from Node 22 to Node 24
increments this value. Any prebuilt `.node` binary linked against the Node 22 ABI will fail to
load in Electron 40/41 with an error like:

```
Error: The module '/path/to/native.node' was compiled against a different Node.js version
using NODE_MODULE_VERSION X. This version of Node.js requires NODE_MODULE_VERSION Y.
```

The fix is always the same: `@electron/rebuild` targeting the new Electron version. electron-vite
has no involvement in this process — it externalizes native modules from bundling but does not
rebuild them.

### Practical Assessment for Projects Using electron-vite v5 + Electron 40/41

| Aspect                                | Risk Level | Notes                                                                     |
| ------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| Build-time config API                 | None       | electron-vite v5 API is stable, Electron version is irrelevant to config  |
| Renderer Vite HMR                     | None       | Renderer runs in Chromium context, unaffected by Node bump                |
| Main process transpilation            | Very Low   | Code works, just targets Node 22 syntax baseline instead of Node 24       |
| Preload scripts                       | Very Low   | Same transpilation target concern; functionally correct                   |
| Native modules (e.g., better-sqlite3) | High       | Must rebuild against Electron 40/41 Node 24 headers via @electron/rebuild |
| ESM in main process                   | None       | Requires Electron 28+; Electron 40/41 qualifies                           |

### Electron 40/41 Specific Breaking Changes Relevant to Build Tools

From the Electron 41 release notes, two breaking changes are documented:

- PDFs no longer create a separate WebContents (affects renderer code using PDF, not the build tool)
- Cookie 'changed' event cause values changed (runtime behavior, not build-time)

Neither affects electron-vite's build pipeline, plugin system, or config API.

The Electron 40 release notes call out that using the clipboard API directly in the renderer process
is deprecated and should move to the preload script via contextBridge. This is a code architecture
concern, not an electron-vite compatibility issue.

### Community Signal

Searches across GitHub Issues, Reddit, and Discord turned up zero community threads specifically
reporting electron-vite v5 failures with Electron 40/41. The absence of reports is mildly
encouraging but inconclusive — Electron 41 is only ~3 weeks old as of this research date (April 1,
2026), and Electron 40 is ~11 weeks old. Community adoption of the newest Electron versions tends
to lag by several months for production projects.

The `itchio/itch` project has an open issue "Upgrade Electron 25 → 40" showing that at least some
teams are actively planning/executing the 40 upgrade, though it uses a different build toolchain.

---

## Compatibility Matrix (Updated)

| electron-vite  | Build Target Electron | Vite | Node.js (host/dev) | Node.js (bundled in Electron) |
| -------------- | --------------------- | ---- | ------------------ | ----------------------------- |
| 3.1.0          | 35                    | 6.x  | 18+                | ~22 (Electron 33-35)          |
| 4.0.0          | 37                    | 7.x  | 20.19+, 22.12+     | ~22 (Electron 36-37)          |
| 5.0.0          | 39                    | 7.x  | 20.19+, 22.12+     | Node 22 (Electron 38-39)      |
| 5.0.0 (actual) | ~40/41 (untested)     | 7.x  | 20.19+, 22.12+     | Node 24 (Electron 40-41)      |
| 6.0.0 (TBD)    | 40 or 41 (expected)   | 7.x+ | TBD                | Node 24                       |

The "5.0.0 actual with 40/41" row represents the expected practical outcome based on:

- No peerDependency constraint on Electron version
- Build target optimization is a "nice to have," not a correctness requirement
- No reported breakage in the issue tracker

---

## Research Gaps & Limitations

- No direct hands-on testing data was found — no blog posts, Reddit threads, or issue comments
  from someone who actually ran `electron-vite v5 + electron@40` and reported results.
- The electron-vite CHANGELOG is accessible but GitHub's rendered issue search was unreliable for
  date-filtered queries; some 2026 issues may have been missed.
- Electron 41 was released March 10, 2026 — only 22 days before this research. Community reports
  have had very little time to accumulate.
- Whether the `build.chrome` and `build.node` targets inside electron-vite v5 hardcode Electron 39
  values or derive them dynamically from the installed electron package was not confirmed from
  source inspection.

---

## Recommendation for DorkOS

The desktop app (`apps/desktop`) currently targets Electron 33. The existing research
(`20260401_electron_vite_upgrade_v3_to_v5.md`) recommends upgrading electron-vite to v5.0.0 and
staying on Electron 33. That plan remains sound.

**Do not chase Electron 40/41 now.** Reasons:

1. No official electron-vite support statement exists for Electron 40/41
2. `better-sqlite3` would need a new `@electron/rebuild` run against Node 24 headers — untested
3. Electron 41 is 22 days old at time of writing; community battle-testing is minimal
4. Electron 33 is still within the supported range (32-39) for electron-vite v5

If Electron 40/41 is required in future (e.g., for a specific Chromium feature or Node 24 API),
the safe upgrade sequence would be:

1. Wait for electron-vite v5.x patch or v6.0.0 explicitly listing Electron 40+ support
2. Run `@electron/rebuild -f -w better-sqlite3` against the new Electron target
3. Test the full build pipeline before shipping

---

## Sources & Evidence

- [electron-vite CHANGELOG](https://raw.githubusercontent.com/alex8088/electron-vite/master/CHANGELOG.md) — v5.0.0 "build compatibility target for Electron 39" confirmation
- [electron-vite Releases](https://github.com/alex8088/electron-vite/releases) — v5.0.0 (Dec 7, 2025) confirmed as latest, no 2026 releases
- [electron-vite npm package](https://www.npmjs.com/package/electron-vite) — peerDependencies: Vite only, no Electron pin; engines: Node 20.19+/22.12+
- [electron-vite Getting Started](https://electron-vite.org/guide/) — Official docs: Node.js 20.19+, Vite 5.0+ requirements
- [Electron 40.0.0 Release Blog](https://www.electronjs.org/blog/electron-40-0) — Released Jan 13, 2026; Node 24.11.1, Chromium 144, V8 14.4
- [Electron 41 Release Blog](https://www.electronjs.org/blog/electron-41-0) — Released Mar 10, 2026; Node 24.14.0, Chromium 146, V8 14.6; install 41.0.2 recommended
- [Electron 40 Release Summary](https://progosling.com/en/dev-digest/2026-01/electron-40-release-chromium-144-node-24) — Third-party confirmation of Node 24 ABI implications
- [electron-vite Issues (alex8088)](https://github.com/alex8088/electron-vite/issues) — No issues found mentioning Electron 40, 41, or Node 24
- [electron-vite blog: 5.0 is out](https://electron-vite.org/blog/) — Isolated builds, deprecations, no version range announcement
- [Prior research: 20260401_electron_vite_upgrade_v3_to_v5.md] — Upgrade path from v3→v5, Electron 33 in range
- [Prior research: 20260324_electron_desktop_app_monorepo.md] — Architecture patterns for desktop app
- [itchio/itch Electron upgrade issue](https://github.com/itchio/itch/issues/3382) — Community signal: Electron 25→40 upgrade tracked by another project
