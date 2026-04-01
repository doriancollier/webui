---
title: DorkOS Marketplace — Project Brief
date: 2026-03-31
status: active
type: project-brief
linear-issue: null
tags: [marketplace, extensions, agent-templates, tasks, skills, distribution]
---

# DorkOS Marketplace — Project Brief

**Date:** 2026-03-31
**Status:** Pre-spec exploration — ready for ideation when prioritized

---

## Executive Summary

DorkOS needs a public marketplace for distributing installable items: agent templates, extensions, skill packs, and adapter configurations. The AI coding agent ecosystem has converged on two open standards — **MCP** (tool integration) and **Agent Skills / SKILL.md** (skill packaging) — with agent-specific plugin bundles on top. DorkOS has already adopted the SKILL.md standard (ADR-0220, `@dorkos/skills` package) — tasks, commands, and skills all share the same file format. This means marketplace distribution is naturally portable across 30+ tools.

**Core insight:** DorkOS runs on top of Claude Code. Layers 0-2 (MCP, Agent Skills, Claude Code plugins) are already solved. DorkOS only needs to build **Layer 3** — the packaging that adds UI extensions, relay adapters, task scheduling, and agent templates.

**Compatibility principle:** The DorkOS marketplace IS a Claude Code marketplace. Same `marketplace.json` schema, same plugin structure. Every DorkOS package is a valid Claude Code plugin. Claude Code users can add the DorkOS marketplace directly; DorkOS users can install from any Claude Code marketplace. DorkOS-specific features (UI extensions, task scheduling, adapters) live in `.dork/` which non-DorkOS tools silently ignore.

---

## Industry Landscape (March 2026)

### Three Universal Standards

| Layer       | Standard                                   | Adoption                                                                     | What it does                                                             |
| ----------- | ------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Tools**   | MCP (Model Context Protocol)               | 97M monthly SDK downloads, ~2K registry entries                              | Universal protocol for connecting agents to external tools               |
| **Skills**  | Agent Skills / `SKILL.md` (agentskills.io) | Claude Code, Codex, Cursor, Copilot, Windsurf, Gemini CLI, Cline, 20+ others | Portable instruction packaging — YAML frontmatter + markdown body        |
| **Context** | `AGENTS.md`                                | 20K+ GitHub repos                                                            | Cross-tool alternative to CLAUDE.md for project-level agent instructions |

### Agent-Specific Plugin Formats

Every major agent has converged on a similar plugin bundle format:

```
Claude Code:  .claude-plugin/plugin.json  → skills + hooks + agents + commands + MCP + LSP
Codex:        .codex-plugin/plugin.json   → skills + MCP + apps
Cursor:       .cursor-plugin/plugin.json  → skills + rules + agents + hooks + MCP + commands
Copilot:      .github/plugin/marketplace.json → skills + MCP
```

All bundle `SKILL.md` files + MCP server configs. The plugin manifest is the wrapper; skills are the portable unit.

### Marketplace Landscape

| Platform        | Format                                                    | Status                                                 |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| **Claude Code** | `claude-plugins-official` git repo, `marketplace.json`    | Live, browsable at claude.com/plugins                  |
| **skills.sh**   | Leaderboard/directory, auto-indexed via install telemetry | Live, 90K+ skills indexed                              |
| **Codex**       | Curated Plugin Directory                                  | Live, self-serve publishing "coming soon"              |
| **Cursor**      | cursor.com/marketplace                                    | Launched Feb 2026, private marketplaces for enterprise |
| **Cline**       | cline.bot/mcp-marketplace                                 | MCP servers only                                       |

### The SKILL.md Format (agentskills.io standard)

Every skill is a directory containing a `SKILL.md` file:

```yaml
---
name: my-skill
description: What it does and when to use it
license: Apache-2.0
compatibility: Requires Node.js 20+
metadata:
  category: code-review
allowed-tools: Read Edit Grep Glob Bash
---
# My Skill

Instructions for the agent to follow when this skill is activated.
```

**Progressive disclosure:** Level 1 (metadata, ~100 tokens, always loaded) → Level 2 (instructions, <5K tokens, on trigger) → Level 3 (references/, scripts/, assets/, on demand).

**Claude Code extension fields:** `argument-hint`, `disable-model-invocation`, `user-invocable`, `model`, `effort`, `context` (fork), `agent`, `hooks`, `paths`, `shell`.

### Claude Code Plugin Format

```
my-plugin/
├── .claude-plugin/plugin.json    ← Manifest (name, version, skills, hooks, mcpServers, etc.)
├── skills/
│   └── my-skill/SKILL.md
├── agents/
│   └── my-agent.md
├── hooks/
│   └── hooks.json
├── commands/
│   └── my-command.md
└── .mcp.json                     ← MCP server declarations
```

**Manifest fields:** `name` (required), `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `commands`, `agents`, `skills`, `hooks`, `mcpServers`, `lspServers`, `outputStyles`, `userConfig`, `channels`.

**Distribution:** Via `marketplace.json` catalogs hosted in git repos. Sources can be GitHub repos, git URLs, git subdirectories (sparse clone), npm packages, or local paths.

---

## Foundation: SKILL.md as Universal File Format

**ADR-0220** (accepted 2026-04-01) formally adopts the agentskills.io SKILL.md open standard as the base format for all file-based definitions in DorkOS. The `@dorkos/skills` package (`packages/skills/`) provides a single parser, writer, scanner, and validator for the entire system.

### Unified Schema Hierarchy

```
SkillFrontmatterSchema (agentskills.io base — name, description, license, compatibility, metadata, allowed-tools)
├── TaskFrontmatterSchema (extends with: cron, timezone, enabled, max-runtime, permissions, display-name)
└── CommandFrontmatterSchema (extends with: argument-hint, user-invocable, etc.)
```

All three use the **directory format**: `{name}/SKILL.md`. This aligns with the spec's support for bundled `scripts/`, `references/`, and `assets/` subdirectories.

### What This Means for Distribution

- **A DorkOS task IS a valid SKILL.md file.** Install it in Claude Code → it works as a skill (minus scheduling). The `cron`, `permissions`, `max-runtime` fields are just ignored by tools that don't understand them.
- **One parser for everything.** `parseSkillFile<T>` is schema-parameterized — pass `TaskFrontmatterSchema` for tasks, `CommandFrontmatterSchema` for commands, `SkillFrontmatterSchema` for plain skills.
- **"Task Packs" are just "Skill Packs."** A marketplace item containing tasks and skills is simply a collection of SKILL.md directories with varying frontmatter. No separate item type needed.
- **Installation-specific fields are excluded from files.** `agentId` and `cwd` are derived from the file's location on disk, not stored in SKILL.md. This is what makes tasks portable across installations.

---

## DorkOS Marketplace Item Types

### 1. Agent Templates

Full agent filesystem, downloadable via git. Contains everything needed to set up a working agent.

```
code-reviewer-template/
├── .claude-plugin/plugin.json      ← Standard Claude Code plugin (portable)
├── .claude/
│   ├── skills/                      ← Agent Skills standard (SKILL.md dirs)
│   │   └── review-code/SKILL.md
│   ├── commands/                    ← Commands (SKILL.md format, CommandFrontmatter)
│   │   └── review/SKILL.md
│   ├── hooks/...
│   └── rules/...
├── .dork/
│   ├── package.json                 ← DorkOS manifest (type: "agent-template")
│   ├── agent.json.template          ← Agent identity template
│   ├── extensions/                  ← Bundled local extensions
│   ├── tasks/                       ← Bundled task definitions (SKILL.md dirs)
│   │   └── weekly-review/SKILL.md   ← TaskFrontmatter (has `cron` field)
│   └── onboarding.json              ← Template-specific onboarding steps
├── CLAUDE.md.template               ← Template-tracked (marker-based updates)
├── SOUL.md.template
├── NOPE.md.template
├── .template.json                   ← Version tracking (existing system)
└── [project scaffolding files]
```

**Install flow:** Clone repo → template system handles `.template` files → agent auto-imports via `.dork/agent.json` → bundled extensions compile → bundled tasks enter `pending_approval`.

**Update flow:** Existing `.template.json` + `/template:update` system handles version tracking, marker-based CLAUDE.md merges, backup branches, and selective file updates.

### 2. Extensions

UI components, server-side routes, background tasks, settings. Can be standalone (global) or bundled with an agent template (local).

```
linear-status/
├── .claude-plugin/plugin.json      ← Required: makes this a valid Claude Code plugin too
├── skills/                          ← Optional: portable skills (SKILL.md dirs)
├── .dork/
│   ├── package.json                 ← DorkOS manifest (type: "extension")
│   └── extensions/
│       └── linear-status/
│           ├── extension.json       ← Extension manifest (existing format)
│           ├── index.ts             ← Client UI (8 slots available)
│           └── server.ts            ← Server routes, background tasks, proxy
└── README.md
```

**Existing extension capabilities:** 8 UI slots (`sidebar.footer`, `sidebar.tabs`, `dashboard.sections`, `header.actions`, `command-palette.items`, `dialog`, `settings.tabs`, `session.canvas`), server routes, encrypted secrets, plaintext settings, persistent storage, background scheduling, SSE events, data proxy.

### 3. Skill Packs (replaces "Task Packs")

Collections of SKILL.md definitions — skills, tasks, and commands in a single distributable unit. Lightweight.

```
security-audit-pack/
├── .dork/
│   ├── package.json                 ← DorkOS manifest (type: "skill-pack")
│   └── tasks/                       ← SKILL.md dirs with TaskFrontmatter
│       ├── dependency-audit/SKILL.md    ← cron: "0 9 * * 1", permissions: bypassPermissions
│       ├── secret-scan/SKILL.md         ← cron: "0 6 * * *"
│       └── license-check/SKILL.md       ← (no cron — on-demand only)
├── skills/                          ← Optional: plain SKILL.md dirs (portable to any tool)
│   └── audit-report/SKILL.md
└── README.md
```

**Task SKILL.md format** (per `@dorkos/skills` `TaskFrontmatterSchema`): Standard SKILL.md frontmatter (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) extended with `display-name`, `cron` (optional — absent means on-demand), `timezone` (default UTC), `enabled` (default true), `max-runtime` (duration string: "5m", "1h"), `permissions` ("acceptEdits" | "bypassPermissions"). Body = the prompt. ID = directory name slug.

**Portability:** Tasks reference agent capabilities, not specific agent IDs. Installation-specific fields (`agentId`, `cwd`) are derived from directory location, never stored in the file. Project-scoped tasks run against their own project's agent. Global tasks run against Damon (system agent) or a capable agent. Install a task SKILL.md in plain Claude Code → it works as a regular skill.

### 4. Adapters

Relay channel bridges. Separate lifecycle from extensions but distributable through the same marketplace.

```
discord-adapter/
├── .dork/
│   ├── package.json                 ← DorkOS manifest (type: "adapter")
│   └── adapters/
│       └── discord/
│           ├── manifest.json        ← AdapterManifest (config fields, setup guide)
│           └── discord-adapter.ts   ← Factory + runtime
└── README.md
```

### 5. DorkOS Skills (Bundled Concept — Future)

A higher-level "DorkOS Skill" bundles multiple item types into a single user-facing concept. Because skills, tasks, and commands all share the SKILL.md format, a DorkOS Skill is naturally a collection of SKILL.md directories plus optional DorkOS-specific additions:

- SKILL.md directories (skills, tasks, commands — all the same format, differentiated by frontmatter)
- Extensions (UI slots, server routes)
- Adapter requirements (dependency declarations)
- Hooks (`.claude/hooks/`)

**Example:** A "Code Review Skill" bundles `review-code/SKILL.md` (instructions for Claude), `weekly-review/SKILL.md` (TaskFrontmatter with `cron: "0 8 * * 5"`), a dashboard extension showing review status, and a hook that triggers on PR events. All SKILL.md files are portable to other tools; the extension and hook are DorkOS-specific.

**Note:** The SKILL.md unification makes this concept more natural — the boundary between "skill" and "task" is just a `cron` field in the frontmatter. Whether to surface this bundled concept in the marketplace UI or keep separate item types is an open question.

---

## Architecture: The Layer Model

```
Layer 0: MCP                          ← DorkOS already supports (external MCP server at /mcp)
Layer 1: Agent Skills / SKILL.md      ← DorkOS already uses (.claude/skills/)
Layer 2: Claude Code Plugin           ← DorkOS agents inherit these automatically
Layer 3: DorkOS Package               ← THE NEW THING — everything above PLUS:
         ├── UI Extensions (8 slots, server routes, settings)
         ├── Task Definitions (.dork/tasks/*/SKILL.md — same format, extra frontmatter)
         ├── Adapter Configs (relay bridges)
         └── Agent Templates (full agent scaffolding)
```

**What DorkOS gets for free:**

| Capability                       | How                                                 | Cost                       |
| -------------------------------- | --------------------------------------------------- | -------------------------- |
| skills.sh compatibility          | Already using SKILL.md format                       | Zero                       |
| Claude Code plugin compatibility | DorkOS agents are Claude Code agents                | Zero                       |
| MCP tool ecosystem               | Already have MCP server + Claude Code's MCP client  | Zero                       |
| Cross-tool skill portability     | SKILL.md is the standard                            | Zero                       |
| Task portability                 | Tasks ARE SKILL.md files (`@dorkos/skills` package) | Zero — already implemented |

**What DorkOS needs to build:**

| Capability                           | Effort  | Description                                                                      |
| ------------------------------------ | ------- | -------------------------------------------------------------------------------- |
| `.dork/package.json` manifest schema | Medium  | Declares type, extensions, tasks, adapter deps, template metadata                |
| `dorkos install` CLI command         | Medium  | Git clone + file placement + extension compilation + task import                 |
| DorkOS registry (`marketplace.json`) | Small   | Claude Code-compatible format in git repo. PRs to add packages                   |
| `marketplace.json` parser            | Small   | Parse Claude Code's marketplace.json format — enables reading ANY CC marketplace |
| Marketplace Extension (built-in)     | Medium  | Browse/search UI within DorkOS client                                            |
| Web browse experience                | Medium  | `/marketplace` on dorkos.dev                                                     |
| Dependency resolution                | Medium  | `"requires"` in `.dork/package.json` with install-time checks                    |
| Agent-as-installer flow              | Small   | MCP tool that queries registry + calls install                                   |
| `AGENTS.md` detection                | Trivial | Add to unified scanner alongside CLAUDE.md                                       |

---

## Distribution & Compatibility

### Core Principle: The DorkOS Marketplace IS a Claude Code Marketplace

The DorkOS marketplace uses Claude Code's exact `marketplace.json` schema. This makes the two ecosystems bidirectionally compatible:

- **Claude Code users** can add the DorkOS marketplace (`claude marketplace add dorkos-community`) and install any package — they get skills, hooks, commands, MCP servers. DorkOS-specific features (`.dork/`) are silently ignored.
- **DorkOS users** can add any Claude Code marketplace (`dorkos marketplace add claude-plugins-official`) and install any plugin — they get everything Claude Code provides, plus DorkOS reads `.dork/` if present for additional features.

### The Superset Package Structure (Plugins)

Every DorkOS **plugin** (type: `plugin`, `skill-pack`, `adapter`) MUST include `.claude-plugin/plugin.json`. This is what makes bidirectional compatibility work. DorkOS-specific features live in `.dork/` which non-DorkOS tools silently ignore.

**Agent templates are exempt** — they're project scaffolds, not plugins. They may contain `.claude/skills/` and `CLAUDE.md` (which work in any tool), but don't need a plugin manifest.

```
my-package/
├── .claude-plugin/plugin.json     ← REQUIRED: Claude Code sees skills + hooks + MCP
├── skills/                        ← skills.sh / Codex / Cursor see: SKILL.md files
├── hooks/                         ← Claude Code sees: lifecycle hooks
├── .dork/                         ← DorkOS sees: everything above + UI + tasks + adapters
│   ├── package.json               ← DorkOS-specific metadata (type, requires, etc.)
│   ├── extensions/...             ← DorkOS-only: UI extensions
│   ├── tasks/...                  ← DorkOS-only: scheduled tasks (SKILL.md with cron)
│   └── adapters/...               ← DorkOS-only: relay adapter configs
└── README.md
```

**Install in Claude Code** → skills + hooks + MCP work (Layer 2). `.dork/` ignored.
**Install in DorkOS** → everything works including UI extensions, task scheduling, adapters (Layer 3).
**Publish skills to skills.sh** → `skills/` directories auto-indexed (Layer 1).

### Bidirectional Compatibility Matrix

| Scenario                             | Works?  | What the user gets                                                                                                 |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------ |
| **Claude Code marketplace → DorkOS** | Yes     | DorkOS parses standard `marketplace.json`, installs plugin, also reads `.dork/` for extra features if present      |
| **DorkOS marketplace → Claude Code** | Yes     | Claude Code parses same `marketplace.json` (standard format), installs `.claude-plugin/` portion, ignores `.dork/` |
| **DorkOS package → skills.sh**       | Yes     | `skills/` directories are standard SKILL.md, indexed automatically via install telemetry                           |
| **DorkOS package → Cursor/Codex**    | Partial | Skills work (SKILL.md standard). Full plugin compat depends on tool-specific plugin format differences             |
| **Any Claude Code plugin → DorkOS**  | Yes     | Skills, hooks, commands, MCP, agents all work because DorkOS agents ARE Claude Code agents                         |

### Registry Format (Extended marketplace.json)

The DorkOS marketplace extends Claude Code's `marketplace.json` with additional optional fields. The hypothesis is that Claude Code's parser ignores unknown fields — if it doesn't, we fall back to a companion `dorkos-catalog.json` file (see Open Question #7).

**Standard Claude Code fields** (guaranteed compatible):

- `name` — package identifier
- `source` — git URL (github:org/repo, full URL, etc.)
- `description` — short description

**DorkOS extension fields** (ignored by Claude Code if parser is tolerant):

- `type` — `"plugin"` | `"agent-template"` | `"skill-pack"` | `"adapter"` (default: `"plugin"`)
- `category` — browsing category (e.g., `"frontend"`, `"code-quality"`, `"security"`, `"messaging"`)
- `tags` — array of searchable tags
- `icon` — emoji or icon identifier for the browse UI
- `layers` — what the package contains: `["skills", "extension", "tasks", "adapter", "hooks"]`
- `requires` — dependency declarations (e.g., `["adapter:webhook"]`)
- `featured` — whether to highlight in browse UI
- `dorkos-min-version` — minimum DorkOS version

```json
{
  "name": "dorkos-community",
  "plugins": [
    {
      "name": "code-review-suite",
      "source": "github:dorkos-community/code-review-suite",
      "description": "Code review skills, scheduled tasks, and dashboard extension",
      "type": "plugin",
      "category": "code-quality",
      "tags": ["review", "ci", "dashboard"],
      "layers": ["skills", "extension", "tasks"],
      "icon": "🔍"
    },
    {
      "name": "nextjs-agent",
      "source": "github:dorkos-templates/nextjs",
      "description": "Next.js 16 agent template with App Router, Tailwind, and deployment tasks",
      "type": "agent-template",
      "category": "frontend",
      "tags": ["nextjs", "react", "app-router"],
      "icon": "🌐",
      "featured": true
    },
    {
      "name": "security-audit-pack",
      "source": "github:dorkos-community/security-audit-pack",
      "description": "Scheduled security audits — dependency scanning, secret detection, license checks",
      "type": "skill-pack",
      "category": "security",
      "tags": ["audit", "dependencies", "secrets"],
      "layers": ["skills", "tasks"]
    },
    {
      "name": "discord-adapter",
      "source": "github:dorkos-community/discord-adapter",
      "description": "Discord relay adapter — bridge agent messages to Discord channels",
      "type": "adapter",
      "category": "messaging",
      "tags": ["discord", "chat"],
      "layers": ["adapter"],
      "icon": "💬"
    },
    {
      "name": "express-api",
      "source": "github:dorkos-templates/express",
      "description": "Express API agent template with TypeScript, testing, and deployment tasks",
      "type": "agent-template",
      "category": "backend",
      "tags": ["express", "api", "typescript"]
    }
  ]
}
```

**Filtering by type:**

- `TemplatePicker` (agent creation dialog) filters `plugins.filter(p => p.type === "agent-template")`
- `Marketplace Extension` shows all types with tab filters: `[All] [Templates] [Plugins] [Skills] [Adapters]`
- CLI: `dorkos marketplace list --type agent-template`

**Fallback for entries without DorkOS fields:** When reading a Claude Code marketplace that has no DorkOS extension fields, all entries default to `type: "plugin"` with no category/tags. They still install and work — DorkOS just can't filter them.

### Agent Templates: Three Tiers

Templates range from plain repos to fully DorkOS-aware packages:

| Tier              |       Has `.dork/`?        |                       In marketplace?                       | What happens on install                                                     |
| ----------------- | :------------------------: | :---------------------------------------------------------: | --------------------------------------------------------------------------- |
| **Plain repo**    |             No             | Optional (via custom URL or `type: "agent-template"` entry) | Clone → DorkOS scaffolds `.dork/agent.json`, SOUL.md, NOPE.md. Works today. |
| **DorkOS-aware**  |  Yes, with `package.json`  |                             Yes                             | Clone → scaffold → also install bundled tasks, extensions, adapter configs  |
| **Rich template** | Yes, with `.template.json` |                             Yes                             | Clone → scaffold → bundled installs → template versioning/updates enabled   |

A plain GitHub repo with just a CLAUDE.md and source code can be listed as `type: "agent-template"` in the marketplace — the metadata for browsing lives in the registry entry, not in the repo. This means:

- Any existing project repo can become a template with zero modifications
- The marketplace entry provides the display name, description, category, tags
- DorkOS handles all scaffolding (agent.json, SOUL.md, NOPE.md) regardless of tier

### Template vs. Plugin: Different Install Flows

The `type` field in the registry entry determines the install flow:

```bash
# DorkOS reads the registry, sees type: "agent-template"
# → routes to creation flow
dorkos install nextjs-agent
# Equivalent to: dorkos create my-app --template nextjs-agent

# DorkOS reads the registry, sees type: "plugin" (or no type)
# → routes to plugin install flow
dorkos install code-review-suite
# Places files in ~/.dork/extensions/, .claude/skills/, etc.
```

In the UI:

- Templates show a **"Create Agent"** button → opens CreateAgentDialog with template pre-selected
- Plugins show an **"Install"** button → runs the plugin install flow
- The TemplatePicker in CreateAgentDialog shows built-in templates + marketplace templates (filtered by `type: "agent-template"`)

### Install Flows

```bash
# Install from DorkOS marketplace (default)
dorkos install code-review-suite

# Install from any Claude Code marketplace
dorkos install code-review-suite@claude-plugins-official

# Install a skills.sh skill
dorkos install --from skills.sh vercel-labs/agent-skills/nextjs

# Install from any git repo (auto-detects .claude-plugin/ and .dork/)
dorkos install github:user/repo

# Claude Code users can install DorkOS packages too:
# claude plugin install code-review-suite@dorkos-community
```

---

## Design Decisions (Proposed)

| #   | Decision                      | Choice                                                                                                                  | Rationale                                                                                                                                                         |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Plugin format                 | Plugins MUST include `.claude-plugin/plugin.json`. Agent templates are exempt (they're project scaffolds, not plugins). | Plugins need CC compatibility. Templates are cloned as projects — requiring plugin.json would be like requiring a VS Code extension manifest on Create React App. |
| 2   | Skill format                  | Use Agent Skills standard (SKILL.md) as-is — already implemented via `@dorkos/skills`                                   | ADR-0220 accepted. Tasks, commands, and skills share the format. One parser.                                                                                      |
| 3   | Registry format               | Extend Claude Code's `marketplace.json` with optional DorkOS fields (`type`, `category`, `tags`, etc.)                  | Enables browsing/filtering without cloning. If CC rejects unknown fields, fall back to companion file.                                                            |
| 4   | Distribution                  | Git-based (repos for templates, sparse clone for packages)                                                              | Aligns with Claude Code's approach. No custom registry infrastructure needed                                                                                      |
| 5   | DorkOS-specific metadata      | In registry (extended fields) + in package (`.dork/package.json` for richer data)                                       | Registry has enough for browse/filter. Package has full details (dependencies, extension manifests).                                                              |
| 6   | In-app browsing               | Built-in Marketplace Extension using extension API                                                                      | Dogfoods the extension system. Can be updated independently                                                                                                       |
| 7   | Web browsing                  | `/marketplace` on dorkos.dev (marketing site)                                                                           | Discoverable via search engines. SSG from registry JSON                                                                                                           |
| 8   | Primary install channel       | Agent-driven (agent queries registry, installs based on context)                                                        | Differentiator. "Describe what you need" > "browse and click"                                                                                                     |
| 9   | Secondary install channel     | CLI (`dorkos install`) + Marketplace Extension UI                                                                       | Traditional fallback for direct installs                                                                                                                          |
| 10  | Trust model                   | Social trust (verified publishers, signed manifests) — no sandboxing                                                    | Matches Claude Code's full-trust model. Developer audience.                                                                                                       |
| 11  | Template updates              | Existing `.template.json` + marker-based merge system                                                                   | Already built and working. Advisory updates, user controls merges                                                                                                 |
| 12  | Task portability              | Capability-based agent matching, not agent ID references                                                                | Tasks declare needed capabilities; DorkOS finds capable agents                                                                                                    |
| 13  | Dependencies                  | Declarative `"requires"` in `.dork/package.json` with install-time checks                                               | Soft enforcement v1 (warn, don't block). Full resolution later                                                                                                    |
| 14  | Adapter/extension unification | Separate systems, unified marketplace                                                                                   | Different lifecycles and APIs. Single storefront, separate installers                                                                                             |
| 15  | `AGENTS.md` support           | Add as agent detection strategy in unified scanner                                                                      | 20K+ repos. Trivial to implement. Expands discoverability                                                                                                         |

---

## V1 Scope (MVP)

**Goal:** Create a flywheel — enough packages to be useful, easy enough to contribute that the catalog grows.

### Build

1. **`.dork/package.json` manifest schema** — Zod schema defining package type, contents, dependencies, compatibility
2. **`.claude-plugin/plugin.json` scaffolding** — Tooling to generate a valid Claude Code plugin manifest from DorkOS package contents
3. **`marketplace.json` parser** — Parse Claude Code's marketplace.json format, enabling DorkOS to read any CC marketplace
4. **`dorkos install` CLI command** — Git clone, file placement, extension compilation, task import
5. **DorkOS registry** — Claude Code-compatible `marketplace.json` in the `dorkos-community` GitHub org, submissions via PR
6. **Marketplace Extension** (built-in) — `sidebar.tabs` entry with browse/search/install UI
7. **`/marketplace` web page** — Static page on dorkos.dev reading from registry
8. **5-10 seed packages** — Agent templates, extensions, skill packs (all with `.claude-plugin/plugin.json`)
9. **Agent install tool** — MCP tool for `marketplace_install` so agents can query and install

### Defer

- Payments / paid packages
- User accounts / reviews / ratings
- Automated security scanning
- Self-serve publishing (v1 is PR-based)
- Visual cron builder for skill packs with tasks
- Full dependency resolution (v1 is warn-only)
- Package versioning beyond semver in manifest
- Private/enterprise registries

---

## Open Questions

1. **Manifest naming:** `.dork/package.json` vs `.dork/dorkos.json` vs `dork.json` — need to avoid confusion with npm's `package.json`. Note: this is separate from `.claude-plugin/plugin.json` which is always required and uses Claude Code's schema.
2. **Skills as a bundling concept:** Now that tasks, commands, and skills all share the SKILL.md format (differentiated only by frontmatter), should the marketplace surface them as one "Skill Pack" category, or keep "tasks" and "skills" as separate filters? The format unification argues for one category; user mental models may argue for two.
3. **Registry hosting:** Static JSON in git repo (v1) vs API service (future) — when does the static approach stop scaling?
4. ~~**Dual marketplace registration**~~ — **RESOLVED.** The DorkOS marketplace uses Claude Code's exact `marketplace.json` schema. A single registration works in both ecosystems. Claude Code users add the DorkOS marketplace directly; DorkOS users can add any Claude Code marketplace.
5. **Adapter distribution:** Should adapters use the npm plugin loader (existing) or switch to git-based distribution (marketplace pattern)?
6. **`kind` discriminator field:** ADR-0220 deferred adding a `kind` field to SKILL.md frontmatter (the spec notes location-based inference is sufficient for now). For marketplace distribution, a `kind: task` or `kind: skill` field would make it possible to determine intent without knowing the installation path. Should the marketplace require this?
7. **Claude Code marketplace.json extension tolerance:** The extended marketplace.json approach assumes Claude Code's parser ignores unknown fields (`type`, `category`, `tags`, etc.). **This must be tested before v1 ships.** If the parser rejects unknown fields, fall back to a companion `dorkos-catalog.json` file alongside a standard `marketplace.json`. The companion approach adds maintenance overhead (two files, same data) but guarantees compatibility. Test by adding a DorkOS-extended entry to a real marketplace and running `claude plugin install` against it.

---

## Related Research

- `research/20260329_claude_code_plugin_marketplace_extensibility.md` — Claude Code plugin format deep dive
- `research/20260329_skills_sh_marketplace_format_specification.md` — skills.sh and Agent Skills standard
- `research/20260329_ai_coding_agent_plugin_marketplaces.md` — Codex, Cursor, Copilot, Windsurf, Cline landscape
- `research/20260323_plugin_extension_ui_architecture_patterns.md` — VSCode, Obsidian, Grafana, Backstage patterns
- `research/20260326_extension_point_registry_patterns.md` — Extension registry implementation
- `research/20260326_extension_system_open_questions.md` — Extension system design decisions
- `research/20260326_agent_built_extensions_phase4.md` — Agent-built extension workflow
- `research/20260329_extension_server_side_capabilities.md` — Server-side extension capabilities
- `research/20260329_extension_manifest_settings_schema.md` — Extension settings patterns

## Related Specs

- `specs/plugin-extension-system/` (Spec #173) — Core extension system
- `specs/ext-platform-02-extension-registry/` (Spec #182) — Extension point registry
- `specs/ext-platform-03-extension-system/` (Spec #183) — Extension lifecycle
- `specs/ext-platform-04-agent-extensions/` — Agent-built extensions
- `specs/extension-manifest-settings/` (Spec #209) — Extension settings
- `specs/tasks-system-redesign/` (Spec #211) — File-based task system
- `specs/skills-package/` (Spec #212) — `@dorkos/skills` package (SKILL.md standard adoption) — **implemented**

## Related ADRs

- ADR-0043 — Agent storage (file-first write-through pattern)
- ADR-0199 — Generic register API with SlotContributionMap
- ADR-0200 — App-layer synchronous extension initialization
- ADR-0214 — AES-256-GCM per-extension secret storage
- **ADR-0220** — Adopt SKILL.md open standard for task and command definitions — **key marketplace dependency**
