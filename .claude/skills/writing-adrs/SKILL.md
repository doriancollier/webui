---
name: writing-adrs
description: Guides writing concise, effective Architecture Decision Records. Use when creating ADRs, extracting decisions from specs, or reviewing ADR quality.
---

# Writing Architecture Decision Records

## Overview

Architecture Decision Records (ADRs) capture significant technical decisions in a concise, standardized format. They answer "why did we do this?" for future developers and AI agents. DorkOS ADRs live in `decisions/` with a `manifest.json` index.

## When to Write an ADR

Write an ADR when a decision:

- **Chooses between alternatives** — "We picked X over Y because..."
- **Adopts a pattern or technology** — New library, architecture pattern, data model
- **Has lasting consequences** — Affects how future features are built
- **Would surprise a new team member** — Non-obvious choices that need explanation

## When NOT to Write an ADR

Skip ADRs for:

- **Trivial implementation details** — Variable naming, file placement within an established structure
- **Obvious choices** — Using TypeScript in a TypeScript project
- **Temporary decisions** — Workarounds that will be replaced soon
- **Single-feature scope** — Decisions that only affect one spec with no project-wide impact

## Writing Guidelines

### Context (2-5 sentences)

Focus on the **problem**, not the solution. What situation existed? What forces were at play?

- **Good**: "DorkOS runs as both a standalone web app and an Obsidian plugin. The Obsidian plugin cannot make HTTP requests to localhost, so the client needs a way to communicate with the server that works in both environments."
- **Bad**: "We needed an architecture." (Too vague)
- **Bad**: A full page of background. (Too long — that belongs in the spec)

### Decision (2-5 sentences)

State what was decided in **active voice**. Start with "We will..."

- **Good**: "We will use a Transport interface that abstracts the communication layer. HttpTransport handles standalone mode via REST/SSE. DirectTransport handles Obsidian mode via in-process function calls."
- **Bad**: "The transport pattern was implemented." (Passive, vague)

### Consequences

List concrete positives and negatives. Every decision has trade-offs — if you can't list a negative, think harder.

- **Positive**: Real benefits the project gains
- **Negative**: Real costs, complexity, or limitations introduced

## Decision Signals in Specs

When scanning specs for ADR candidates, look for:

| Signal | Example |
|--------|---------|
| "We chose X over Y" | Technology or library selection |
| "The recommended approach" | Pattern adoption after comparing options |
| "Trade-offs" section | Explicit trade-off analysis |
| "Architecture" or "Design" | Structural decisions |
| "We will not" / "Out of scope" | Deliberate exclusions with rationale |

## ADR Lifecycle

| Status | Meaning |
|--------|---------|
| `proposed` | Under discussion, not yet committed |
| `accepted` | Active decision guiding implementation |
| `deprecated` | No longer relevant (project evolved past it) |
| `superseded` | Replaced by a newer ADR (link via `superseded-by`) |

## Common Pitfalls

- **Too long** — ADRs are not specs. Keep each section to 2-5 sentences.
- **Missing negative consequences** — Every decision has costs. Be honest.
- **Vague context** — "We needed a better solution" tells nothing. What was broken?
- **Solution in context** — Context describes the problem, not the answer.
- **No spec link** — If a spec drove this decision, always link it.

## File Conventions

- **Location**: `decisions/NNNN-kebab-case-title.md`
- **Numbers**: Zero-padded 4 digits (0001, 0002, ...)
- **Manifest**: `decisions/manifest.json` tracks all ADRs
- **Template**: `decisions/TEMPLATE.md` for the standard format
