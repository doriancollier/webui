---
number: 31
title: Use Default Export Factory Function for Adapter Plugins
status: draft
created: 2026-02-25
spec: relay-runtime-adapters
superseded-by: null
---

# 31. Use Default Export Factory Function for Adapter Plugins

## Status

Draft (auto-extracted from spec: relay-runtime-adapters)

## Context

Third-party adapter packages need a standard way to export their implementation. Options considered: named class export (`export class SlackAdapter`), default export factory function (`export default function createSlackAdapter(config)`), or named factory plus config schema. The Vite, ESLint, Babel, and Rollup plugin ecosystems all use factory function patterns, which allow config injection at creation time.

## Decision

Third-party adapters export a default factory function that receives adapter-specific config and returns a `RelayAdapter` instance. Package naming convention: `dorkos-relay-{channel}` (e.g., `dorkos-relay-slack`). The host system calls the factory, then duck-type validates the returned object implements the `RelayAdapter` interface shape.

## Consequences

### Positive

- Simple, ergonomic API — one function to call with config
- Config injection happens at creation time, not after construction
- Matches the dominant JavaScript plugin ecosystem convention
- Adapter authors only need to learn one pattern

### Negative

- Less explicit than named class export — harder to inspect type compatibility at import time
- Duck-type validation is runtime-only; TypeScript cannot statically verify the contract across package boundaries
