# Automatic ADR Extraction & Curation

**Date:** 2026-02-18
**Status:** Approved

## Problem

ADR creation is manual — `/ideate-to-spec` suggests running `/adr:from-spec` as a next step, but it's easy to forget. Architectural decisions embedded in specs go undocumented. We want to capture every decision automatically, then separate the significant from the trivial over time.

## Design

Two-phase system: **capture everything first, curate later.**

### Phase 1: Inline Auto-Extract

**Where:** New Step 7.5 in `/ideate-to-spec`, after spec validation and before the summary.

**What it does:**

1. Reads `specs/{slug}/01-ideation.md` and `specs/{slug}/02-specification.md`
2. Checks `decisions/manifest.json` for existing ADRs referencing this spec (avoids duplicates)
3. Scans for decision signals using the `writing-adrs` skill criteria:
   - Technology choices ("We chose X over Y")
   - Pattern adoption (architectural patterns, libraries)
   - Trade-off resolutions ("We decided to...")
   - Rejected alternatives ("We considered X but...")
4. For each candidate, writes a draft ADR file using the standard template with `status: draft`
5. Updates `decisions/manifest.json` with all new entries
6. Adds a line to the Step 7 summary: "Auto-extracted N draft ADRs from this spec"

**Key differences from `/adr:from-spec`:**

- No interactive candidate selection (captures everything)
- Status is `draft` not `proposed`
- No significance filtering — that's Phase 2's job
- Runs as part of the existing workflow, not a separate command

**Step 7.7 changes from:**
```
2. [ ] Consider extracting ADRs: `/adr:from-spec {slug}`
```
**To:**
```
2. [x] Auto-extracted N draft ADRs (run `/adr:curate` to promote significant ones)
```

The existing `/adr:from-spec` command stays as-is for retroactive extraction or manual control.

### Phase 2: Daily Background Curation

**New command:** `/adr:curate`

**Trigger:** A SessionStart hook checks `decisions/.last-curated` timestamp. If >24h old and draft ADRs exist, it prints a hint. Claude sees this and automatically runs `/adr:curate` via a background subagent.

**Curation process:**

1. Reads `decisions/manifest.json`, filters for `status: "draft"` entries
2. If no drafts exist, exits silently (updates `.last-curated` timestamp)
3. For each draft ADR, evaluates against the `writing-adrs` skill criteria:
   - Does it choose between alternatives? (not just "we used X")
   - Does it have project-wide impact beyond the originating spec?
   - Would it surprise a new team member?
   - Does it adopt a lasting pattern or technology?
4. **Promote** (draft -> proposed): ADRs that meet 2+ criteria
5. **Archive** (draft -> archived): ADRs that meet 0-1 criteria — moved to `decisions/archive/` and removed from manifest
6. Updates `decisions/.last-curated` with current timestamp
7. Outputs summary: "Promoted N, archived M draft ADRs"

## ADR Lifecycle Changes

New statuses added to existing lifecycle:

```
draft → proposed → accepted → deprecated/superseded
  ↓
archived (moved to decisions/archive/)
```

- **`draft`**: Raw decision capture from auto-extraction. Not yet evaluated for significance.
- **`archived`**: Curation determined this is trivial/single-feature-scope. Moved to `decisions/archive/`, removed from manifest.

Manual `/adr:create` continues to create `proposed` ADRs (skips draft).

## File & Manifest Changes

**New files:**

| File | Purpose |
|------|---------|
| `decisions/archive/` | Directory for archived draft ADRs |
| `decisions/.last-curated` | Single-line ISO timestamp |
| `.claude/commands/adr/curate.md` | Curation command |
| `.claude/hooks/check-adr-curation.sh` | SessionStart hook script |

**Modified files:**

| File | Change |
|------|--------|
| `.claude/commands/ideate-to-spec.md` | Add Step 7.5 (auto-extract) |
| `.claude/commands/adr/list.md` | Show drafts in separate section |
| `.claude/skills/writing-adrs/SKILL.md` | Document `draft` and `archived` statuses |
| `.claude/settings.json` | Add SessionStart hook for curation check |

**Manifest schema addition:**

```json
{
  "number": 6,
  "slug": "use-sse-for-streaming",
  "title": "Use SSE for Server-to-Client Streaming",
  "status": "draft",
  "created": "2026-02-18",
  "specSlug": "cross-client-session-sync",
  "extractedFrom": "cross-client-session-sync"
}
```

`extractedFrom` is only set on auto-extracted ADRs. Archived entries are removed from the manifest array entirely.

Draft ADRs consume real ADR numbers from `nextNumber` — if promoted, the number stays stable. Gaps from archiving are fine.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Re-run `/ideate-to-spec` on spec with existing drafts | Checks `extractedFrom` in manifest, skips if already extracted |
| Promoted ADR overlaps with existing accepted ADR | Curation checks title/topic similarity, archives the draft instead |
| Spec created via `/spec:create` (bypassing `/ideate-to-spec`) | Manual `/adr:from-spec` still available; auto-extract only runs in `/ideate-to-spec` |
| Zero decision signals in a spec | Step 7.5 is a no-op, summary says "No decision signals found" |
| Spec abandoned after draft ADRs created | Drafts fail significance criteria during curation and get archived naturally |

## Scope

- **In scope:** Extraction from specs only (01-ideation.md, 02-specification.md)
- **Out of scope:** Implementation-time decisions, commit messages, conversation mining
