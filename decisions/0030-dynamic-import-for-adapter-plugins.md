---
number: 30
title: Use Native Dynamic import() for Adapter Plugin Loading
status: draft
created: 2026-02-25
spec: relay-runtime-adapters
superseded-by: null
---

# 30. Use Native Dynamic import() for Adapter Plugin Loading

## Status

Draft (auto-extracted from spec: relay-runtime-adapters)

## Context

The Relay adapter system needs to support third-party adapters distributed as npm packages or local files. Several approaches were considered: a full plugin framework with dependency injection, require()-based loading, and native ES module dynamic import(). The codebase already uses ESM (NodeNext module resolution), and the Node.js import() function handles both npm package resolution and file URL loading natively.

## Decision

Use native `import()` for all dynamic adapter loading: `import(packageName)` for npm packages and `import(pathToFileURL(absolutePath).href)` for local files. Duck-type validate the loaded module against the `RelayAdapter` interface shape. Loading errors are non-fatal — log and continue with remaining adapters. No hot-reload of adapter code (server restart required); only enable/disable toggling via config.

## Consequences

### Positive

- Zero new dependencies — uses Node.js built-in module system
- Matches established patterns from ESLint, Vite, and Rollup plugin ecosystems
- Simple, well-understood mechanism with good error messages

### Negative

- Node.js module cache prevents true hot-reload of local file adapters without restart
- esbuild CLI bundles may need testing to ensure dynamic import resolution works correctly
