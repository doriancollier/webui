---
description: Curate research files — inventory by type, identify stale/superseded candidates, update frontmatter status
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(date:*)
category: documentation
---

# Curate Research Files

Systematically review the `research/` directory, display an inventory grouped by type, identify curation candidates, and update file frontmatter based on decisions.

---

## Steps

### Step 1: Inventory All Research Files

Glob all `.md` files in `research/`. For each file, read its YAML frontmatter (if present) or infer metadata from filename and content headers.

Build an inventory record for each file:
- **filename** — e.g. `20260222_turborepo_env_vars_dotenv_cli.md`
- **date** — from frontmatter `date` field, or inferred from `YYYYMMDD_` filename prefix, or "unknown"
- **type** — from frontmatter `type` field, or "unclassified"
- **status** — from frontmatter `status` field, or "unclassified"
- **title** — from frontmatter `title` field, or first H1/H2 heading in the file, or filename
- **feature_slug** — from frontmatter `feature_slug`, or empty

### Step 2: Display Inventory Table

Print a summary grouped by type. Within each group, sort by date descending.

```
Research Inventory (N files, M MB)
────────────────────────────────────────────────────────────────────
TYPE: external-best-practices (N files)
  DATE        STATUS      TITLE
  2026-02-28  active      Graph Topology Visualization — World-Class Patterns
  2026-02-17  active      World-Class Developer Docs
  ...

TYPE: internal-architecture (N files)
  DATE        STATUS      TITLE
  2026-02-24  active      Relay Core Library — TypeScript Options
  ...

TYPE: implementation (N files)
  ...

TYPE: strategic (N files)
  ...

TYPE: exploratory (N files)
  ...

TYPE: unclassified (N files)  ← legacy files without frontmatter
  ...
────────────────────────────────────────────────────────────────────
```

### Step 3: Identify Curation Candidates

Flag files meeting any of these criteria:

| Criterion | Why |
|-----------|-----|
| Older than 60 days with `status: active` and no `feature_slug` | May have drifted from relevance |
| `type: internal-architecture` and a related ADR exists in `decisions/` | Likely codified — safe to archive |
| Duplicate/overlapping topic (same keywords, within 7 days of each other) | Possible redundancy |
| Already `status: superseded` or `status: archived` but frontmatter not updated | Inconsistent state |
| `type: implementation` and the associated feature appears shipped (feature_slug maps to a completed spec) | Implementation complete |
| No frontmatter at all (legacy files) | Needs backfill |

Print a curation candidates list:
```
Curation Candidates (N files)
────────────────────────────────────────────────────────────────────
1. research/20260218_agent-sdk-context-injection.md
   Reason: internal-architecture, ADR 0012 covers SDK context injection
   Current status: unclassified

2. research/pulse-scheduler-design.md
   Reason: implementation, Pulse feature shipped (spec: pulse-scheduler)
   Current status: unclassified

3. research/20260217_world_class_developer_docs.md
   Reason: >60 days old, no feature_slug, status: active
   Current status: active
...
────────────────────────────────────────────────────────────────────
```

### Step 4: Process Each Candidate

For each candidate, apply the appropriate action based on context. Use the lifecycle policy:

| Type | Policy |
|------|--------|
| `external-best-practices` | Keep unless clearly outdated. Promote strong candidates to `contributing/` |
| `internal-architecture` | Archive once codified into ADRs or contributor docs |
| `strategic` | Keep as historical record |
| `implementation` | Archive once the feature is shipped and stable |
| `exploratory` | Archive when superseded or abandoned |

**For each candidate, take one of these actions:**

**A. Mark as `archived`** — update frontmatter `status: archived`

**B. Mark as `superseded`** — update frontmatter:
```yaml
status: superseded
superseded_by: research/YYYYMMDD_newer_file.md  # or decisions/NNNN-slug.md
```

**C. Promote to `contributing/`** — for high-quality evergreen best-practices that have permanent value as developer guides. Copy content, update frontmatter to `status: archived` with note, and create/update the relevant `contributing/*.md` file.

**D. Backfill frontmatter** — for legacy files without YAML frontmatter, infer and add:
```yaml
---
title: "Inferred from first heading"
date: YYYY-MM-DD    # from filename prefix or file mtime
type: <inferred>    # best guess from content
status: active      # default — curator can override
tags: [inferred, keywords]
---
```

**E. Keep as-is** — no changes needed.

### Step 5: Update Frontmatter

For each file that needs changes, use the Edit tool to update (or add) YAML frontmatter. Preserve all existing content below the frontmatter block.

When adding frontmatter to a legacy file that has none, prepend:
```
---
[fields]
---

[existing content]
```

### Step 6: Display Summary

```
Research Curation Complete
────────────────────────────────────────────────────────────────────
  Archived (N files):
    - 20260218_agent-sdk-context-injection.md
    - pulse-scheduler-design.md

  Marked superseded (N files):
    - 20260217_world_class_developer_docs.md → superseded_by: 20260228_og_seo_ai_readability_overhaul.md

  Frontmatter backfilled (N files):
    - ngrok-research.md
    - dorkos-config-file-system.md

  Promoted to contributing/ (N files):
    - 20260222_scheduler_dashboard_ui_best_practices.md → contributing/scheduler-ux.md

  No action needed (N files)

  Summary: N archived, M superseded, P backfilled, Q promoted
────────────────────────────────────────────────────────────────────
```

---

## Notes

- This command is safe to run at any time — it only edits frontmatter, never deletes files
- Files in `research/README.md` and `research/plan.md` are documentation/meta files, skip them
- When checking for related ADRs, search `decisions/` by topic keywords, not just filename
- `feature_slug` values should match entries in `specs/manifest.json`
- Run `/research:curate` periodically (e.g. monthly) to keep the research library curated
