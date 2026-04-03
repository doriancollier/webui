---
title: 'Node.js 24 Upgrade Guide: Breaking Changes, Compatibility, and Monorepo Gotchas'
date: 2026-04-01
type: implementation
status: active
tags:
  [nodejs, node24, upgrade, breaking-changes, better-sqlite3, esbuild, vite, typescript, monorepo]
searches_performed: 13
sources_count: 22
---

# Node.js 24 Upgrade Guide: Breaking Changes, Compatibility, and Monorepo Gotchas

## Research Summary

Node.js 24 was released May 6, 2025 and entered Active LTS on October 28, 2025 — so it is now the current LTS. The upgrade from v22 is generally smooth for pure-JS/TypeScript stacks, with the two most impactful issues for DorkOS being: (1) `better-sqlite3` required a version bump to ≥12.1.0 for prebuilt Node 24 binaries, and (2) all native addons must be rebuilt due to NODE_MODULE_VERSION changing from 134 to 137. OpenSSL security level 2 (new default) prohibits weak keys and could break crypto usage in some services. Vite 6 and TypeScript 5.x are fully compatible.

---

## Key Findings

1. **Node 24 is Active LTS (not just Current)**: Entered LTS October 28, 2025. Supported until April 2028. Node 22 enters Maintenance mode April 2026 (EOL April 2027). This makes Node 24 the correct production target now.

2. **better-sqlite3 had a hard break on v12.0.0 — fixed in v12.1.0**: Prebuilt binaries for Node 24 (N-API 137) were absent. v12.1.0+ ships the correct binaries. Check the installed version — if on 12.0.0, this will silently fail or error at install time.

3. **NODE_MODULE_VERSION bumped from 134 → 137**: Any native C++ addon compiled against Node 22 will not load on Node 24. Full `node_modules` reinstall (not just `npm rebuild`) is required.

4. **OpenSSL 3.5 security level 2 is now default**: RSA/DSA/DH keys shorter than 2048 bits and ECC keys shorter than 224 bits are prohibited. RC4 cipher suites are blocked. This can break older TLS integrations.

5. **Vite 6 + Vite 7 + esbuild are all compatible**: Vite 6 supports Node 18/20/22+; Node 24 works fine. Vite 7 requires Node 20.19+/22.12+ minimum — Node 24 exceeds that. esbuild is a bundler (no native addon), no issues.

6. **TypeScript 5.x is fully compatible**: No breaking changes between TS 5.x and Node 24. Node 24 ships native TS type-stripping (unflagged), but it's opt-in and has limitations (no decorators, no enums, no type-checking). Your existing `tsc` toolchain is unaffected.

7. **Express has no known compatibility issues**: Express 4.x/5.x work on Node 24 without changes. The Node 24 URLPattern global API may eventually reduce reliance on Express routing patterns, but is not breaking.

8. **`require(ESM)` is now stable and unflagged**: This has been available since v22.12.0 / v20.19.0. On Node 24 it is fully stable. Packages dropping CJS in favor of ESM-only are now safe to `require()` — but test carefully, as packages that previously only exported CJS may now export ESM and behave differently under `require()`.

9. **Monorepo upgrade checklist**: Update `.nvmrc`, `.node-version`, root `package.json` `engines` field, CI matrix (`node-version: [22, 24]`), and `pnpm` lockfile. Delete and reinstall `node_modules` for native addon correctness.

---

## Detailed Analysis

### LTS Status

Node.js 24 was "Current" from May 6, 2025 to October 28, 2025, then transitioned to **Active LTS**. The schedule:

| Phase       | Dates                       |
| ----------- | --------------------------- |
| Current     | May 6, 2025 – Oct 28, 2025  |
| Active LTS  | Oct 28, 2025 – Oct 20, 2026 |
| Maintenance | Oct 20, 2026 – Apr 30, 2028 |
| EOL         | Apr 30, 2028                |

Node 22 is now in **Maintenance** (entered April 2026) with EOL April 2027. **Node 24 is the correct LTS target today.**

---

### Breaking Changes (v22 → v24)

#### Platform / Build Changes

- **32-bit armv7 Linux**: Dropped as of Node 24.0.0. Not relevant for DorkOS.
- **32-bit Windows (x86)**: Dropped as of Node 23.0.0. Not relevant.
- **macOS minimum**: Now macOS 13.5. If building on macOS CI, ensure host OS is up to date.
- **Windows builds**: MSVC support removed; ClangCL required. Not relevant for DorkOS server workloads.
- **C++ addons**: V8 bumped to 13.6 (C++20 may now be required). `NODE_MODULE_VERSION` is **137** (was 134 in Node 22, 131 in Node 20). All native modules need recompilation.

#### Security / TLS

- **OpenSSL 3.5, security level 2**: Now the default. Prohibited:
  - RSA, DSA, DH keys < 2048 bits
  - ECC keys < 224 bits
  - RC4 cipher suites
- **Action required**: Audit any crypto usage. If connecting to services with weak certs (e.g., old internal services or test fixtures), this will error.

#### Removed APIs

| API                              | Replacement              |
| -------------------------------- | ------------------------ |
| `tls.createSecurePair()`         | `tls.TLSSocket`          |
| `dirent.path`                    | `dirent.parentPath`      |
| Direct `fs.F_OK`, `fs.R_OK` etc. | `fs.constants.F_OK` etc. |
| `fs.truncate(fd, ...)`           | `fs.ftruncate(fd, ...)`  |

#### Runtime Deprecations (warnings, not yet removed)

- `url.parse()` → use `new URL()`
- `SlowBuffer` → use `Buffer.allocUnsafeSlow()`
- REPL/Zlib without `new` → always use `new`
- `child_process.spawn()` / `execFile()` with string args → pass args as arrays
- `crypto.generateKeyPair` with old RSA-PSS option names (`hash`, `mgf1Hash`) → use `hashAlgorithm`, `mgf1HashAlgorithm`

#### Behavioral Changes (Silent but Breaking)

- **`URL.parse()` error handling**: No longer throws on invalid URLs; returns `null` instead. Any `try/catch` around `URL.parse()` must be rewritten to check for `null`.
- **`fetch()` stricter compliance**: Undici 7 (bundled) is stricter about HTTP semantics. Some edge-case fetch usage may behave differently.
- **Stream/pipe errors now throw**: Error propagation in streams is stricter.
- **`AsyncLocalStorage` defaults to `AsyncContextFrame`**: More efficient but subtly different behavior for edge cases involving async context.
- **`--experimental-permission` → `--permission`**: If any scripts use the old flag, update them.
- **npm 11**: Bundled. Restricts engine support to `^20.17.0 || >=22.9.0`. If you have packages with narrow `engines` fields, you may see warnings.

#### Codemods Available

Official codemods for mechanical fixes:

```bash
npx codemod run @nodejs/crypto-rsa-pss-update
npx codemod run @nodejs/dirent-path-to-parent-path
npx codemod run @nodejs/fs-access-mode-constants
npx codemod run @nodejs/fs-truncate-fd-deprecation
npx codemod run @nodejs/process-assert-to-node-assert
```

---

### better-sqlite3 (Critical for DorkOS)

DorkOS uses `@dorkos/db` with Drizzle ORM on SQLite. **This is the highest-risk dependency for the Node 24 upgrade.**

**The problem**: `better-sqlite3` is a native C++ addon. Due to:

1. V8 API removals (`v8::CopyablePersistentTraits`, `v8::AccessorGetterCallback`, changed `v8::String::Utf8Value` signatures)
2. Absent prebuilt binaries for N-API version 137 in v12.0.0

...the package failed entirely on Node 24 when at version ≤12.0.0.

**Resolution timeline**:

- `v12.0.0`: Broken on Node 24 — missing prebuilt binaries, C++ compilation failures
- `v12.1.0`: Fixed — updated `node-abi` dependency includes correct ABI numbers for Node 24
- `v12.8.0`: Latest as of research date

**Action required**: Ensure `better-sqlite3` is at **≥12.1.0** before upgrading to Node 24. Running `pnpm update better-sqlite3` and verifying the lockfile is sufficient. After upgrading Node version, do a full `node_modules` reinstall (not just rebuild) to ensure the correct prebuilt binary is downloaded.

**Alternative**: Node 24 ships an experimental built-in `node:sqlite` module, but it is still experimental and not a drop-in replacement for `better-sqlite3`'s synchronous API surface.

---

### esbuild

esbuild is a pure-Go binary distributed as a platform-specific npm package — **it is not a native Node addon** and does not link against V8. NODE_MODULE_VERSION changes do not affect it. esbuild works on Node 24 without changes.

Note: Vite 8 (not yet released at time of research) is moving away from esbuild toward Rolldown/Oxc, but this is unrelated to Node 24 compatibility.

---

### Vite 6 / Vite 7

- **Vite 6**: Supports Node 18, 20, 22+. Node 24 works fine; no explicit documentation needed since Vite 6 has no upper bound restriction.
- **Vite 7** (released June 2025): Requires Node `20.19+` or `22.12+` minimum. Node 24 meets and exceeds this requirement. Vite 7 also drops CommonJS — it is now ESM-only. This is a Vite-side breaking change, not Node 24-specific, but coincides with the upgrade era.

No known runtime issues with Vite on Node 24. The `--experimental-global-fetch` and `--experimental-vm-modules` flags (sometimes used in Vite tooling) were stabilized in Node 22/24 and no longer need to be explicitly set.

---

### TypeScript 5.x

TypeScript 5.x is fully compatible with Node 24. There are no breaking changes.

**New in Node 24 (opt-in, not forced)**: Native type stripping via `--experimental-strip-types` (was experimental in v22.6+, unflagged in v24). Important limitations:

- Only erases type syntax; does not type-check
- Does not support: decorators, enums, parameter properties, triple-slash imports
- Does not support path aliases (no `tsconfig.json` `paths` resolution)
- For full TypeScript support you still need `tsc` — your existing pipeline is unaffected

**TypeScript 5.8** introduced `--erasableSyntaxOnly` flag, which restricts TS to the subset compatible with Node's native stripping. Useful for tooling scripts, but irrelevant to build pipelines using `tsc`.

---

### Express.js

Express 4.x and 5.x work on Node 24 without modification. No known compatibility issues. Express does not use native addons.

**Potentially relevant new APIs in Node 24**:

- `URLPattern` is now global — could eventually simplify route pattern matching without a library
- Undici 7 powers built-in `fetch()` — if Express handlers are making outbound HTTP requests via `node-fetch` or `undici` directly, the built-in is now stricter about HTTP compliance

---

### Monorepo (pnpm + Turborepo) Gotchas

#### Files to update

1. **`.nvmrc`** — change `22.x.x` → `24.x.x` (or `24`)
2. **`.node-version`** — if present, same change
3. **Root `package.json` `engines`** field:
   ```json
   "engines": { "node": ">=24.0.0" }
   ```
4. **Each package's `package.json` `engines`** — update all, including internal packages
5. **CI matrix** — update `node-version` arrays; keep `22` in matrix until fully confident, then remove

#### Dependency audit

Run this before upgrading Node to identify all native addons:

```bash
pnpm ls --depth Infinity 2>/dev/null | grep -E "\.node$|prebuild|node-gyp|bindings"
```

Known native addons in DorkOS stack:

- `better-sqlite3` — needs ≥12.1.0 (confirmed fixed)
- Check for any transitive dependencies via `pnpm why better-sqlite3` and similar

#### Node_modules reinstall

After switching Node version, do a full clean reinstall — not just rebuild:

```bash
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
pnpm install
```

This ensures prebuilt binaries for the new NODE_MODULE_VERSION (137) are downloaded.

#### Turborepo cache

Turborepo caches build artifacts. After upgrading Node version:

- Clear the Turborepo cache: `pnpm turbo run build --force` (or delete `.turbo/`)
- The runtime env vars declared in `globalPassThroughEnv` do not affect cache keys, but the Node binary version itself changes compilation outputs for native packages

#### Corepack

On Node 25+, Corepack will need separate installation. Not relevant for Node 24, but worth noting for forward planning.

---

### Summary: What Actually Needs to Change for DorkOS

| Item                            | Risk         | Action                                 |
| ------------------------------- | ------------ | -------------------------------------- |
| `better-sqlite3`                | **HIGH**     | Ensure ≥12.1.0 before upgrading        |
| `.nvmrc` / `.node-version`      | Medium       | Update to `24`                         |
| `package.json` `engines` fields | Medium       | Update all packages to `>=24`          |
| CI `node-version` matrix        | Medium       | Add `24`, remove `20`                  |
| Full `node_modules` reinstall   | Required     | Delete and `pnpm install` fresh        |
| OpenSSL crypto audit            | Low–Medium   | Audit any RSA/TLS usage                |
| `fs.F_OK` et al.                | Low          | Run codemod (deprecation warning only) |
| `url.parse()` usage             | Low          | Audit and replace with `new URL()`     |
| `dirent.path`                   | Low          | Run codemod                            |
| Vite 6/7                        | None         | Compatible, no changes needed          |
| esbuild                         | None         | No changes needed                      |
| TypeScript 5.x                  | None         | No changes needed                      |
| Express                         | None         | No changes needed                      |
| Turbo cache                     | Housekeeping | Clear after upgrade                    |

---

## Sources & Evidence

- Official migration guide: [Node.js v22 to v24](https://nodejs.org/en/blog/migrations/v22-to-v24)
- Release announcement: [Node.js 24.0.0 (Current)](https://nodejs.org/en/blog/release/v24.0.0)
- LTS schedule: [Node.js Releases](https://nodejs.org/en/about/previous-releases)
- LTS schedule (endoflife): [Node.js | endoflife.date](https://endoflife.date/nodejs)
- better-sqlite3 Node 24 binary issue: [Missing prebuild-install release binaries for Node 24/N-API 137 · Issue #1384](https://github.com/WiseLibs/better-sqlite3/issues/1384)
- better-sqlite3 "not working" bug report: [Not working with new nodejs version 24 · Issue #1376](https://github.com/WiseLibs/better-sqlite3/issues/1376)
- better-sqlite3 musl binary issue: [Provide prebuilt binary for Node 24 musl · Issue #1382](https://github.com/WiseLibs/better-sqlite3/issues/1382)
- Prisma adapter issue: [Cannot install @prisma/adapter-better-sqlite3 on Node.js v24 · Issue #28624](https://github.com/prisma/prisma/issues/28624)
- Node 24 vs 22 analysis: [Node.js 22 vs Node.js 24: What Changed](https://www.pkgpulse.com/blog/nodejs-22-vs-nodejs-24-upgrade-guide-2026)
- Deep dive features: [Node.js 24 is here: What's new and what to expect](https://blog.logrocket.com/node-js-24-new/)
- require(esm) stability: [require(esm) in Node.js: from experiment to stability](https://joyeecheung.github.io/blog/2025/12/30/require-esm-in-node-js-from-experiment-to-stability/)
- TypeScript + Node 24 native stripping: [Node.js 24 Ships Native TypeScript](https://dev.to/benriemer/nodejs-24-ships-native-typescript-the-end-of-build-steps-440f)
- OpenJS Foundation release notes: [What's New with Node.js 24](https://openjsf.org/blog/nodejs-24-released)
- NodeSource overview: [Node.js 24 Is Here: What You Need to Know](https://nodesource.com/blog/Node.js-version-24)
- AppSignal breakdown: [What's New in Node.js 24](https://blog.appsignal.com/2025/05/09/whats-new-in-nodejs-24.html)
- Userland migrations tracking: [spec(v22-to-v24): what we have to do · Issue #239](https://github.com/nodejs/userland-migrations/issues/239)
- Vite 7 release and Node requirements: [Vite 7 Released — ESM-only, Node 20+](https://progosling.com/en/dev-digest/vite-7-esm-rolldown-node20)
- Vite 8 announcement: [Vite 8.0 is out!](https://vite.dev/blog/announcing-vite8)

---

## Research Gaps & Limitations

- **better-sqlite3 v12.8.0 (latest)**: npm.js returned 403, so exact changelog was not verified — but the GitHub issue tracker confirms fixes were in v12.1.0 and no new Node 24 regressions have been reported in later versions.
- **Vitest compatibility**: Not explicitly researched. Vitest 2.x+ (which DorkOS uses) should be fine as it does not use native addons, but worth checking if any Vitest upgrades are pending.
- **pnpm version compatibility with Node 24**: Not explicitly verified. pnpm 9.x/10.x should work; pnpm is a JS-only package manager with no native addons.

---

## Contradictions & Disputes

- Some early reports (May–June 2025) stated better-sqlite3 was "completely broken" on Node 24. This was accurate for v12.0.0 but is resolved in v12.1.0+. Older GitHub issues and blog posts may still cite the broken state — check version numbers carefully.
- Some sources claim Node 24 "requires" TypeScript stripping for scripts — this is misleading. Native stripping is opt-in and your existing tsc pipeline is completely unaffected.

---

## Search Methodology

- Searches performed: 13
- Most productive terms: "Node.js 24 breaking changes", "better-sqlite3 Node 24", "Node 24 LTS", "NODE_MODULE_VERSION 137", "node 22 to 24 migration"
- Primary sources: nodejs.org official blog, GitHub issue trackers (WiseLibs/better-sqlite3, nodejs/userland-migrations), LogRocket, NodeSource, endoflife.date
