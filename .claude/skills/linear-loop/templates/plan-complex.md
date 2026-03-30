# Plan Complex — Route Hypothesis to Spec Workflow

This template is loaded when `/pm` needs to plan a `type/hypothesis` issue that meets complex sizing criteria.

## Sizing Confirmation

Verify this hypothesis is actually complex (per SKILL.md Sizing Criteria):

- 3+ files across layers
- Introduces new patterns
- Architectural decisions needed
- Cross-cutting concerns
- Multi-session scope

If none of these apply, switch to `plan-simple.md` instead.

## Read the Hypothesis

Extract from the issue:

- **What we're testing**: The core hypothesis statement
- **Validation criteria**: How we know it worked
- **Confidence level**: From the `confidence/*` label
- **Project**: Which project this belongs to
- **Any linked research**: Related `type/research` issues with findings

## Prepare Ideation Brief

Compose a task brief for `/ideate` that includes:

1. The hypothesis title and description
2. The Linear issue ID (e.g., "DOR-NNN")
3. Validation criteria from the hypothesis
4. Any research findings from linked issues
5. Project context and goals

## Trigger Spec Workflow

Instruct the user to run:

```
/ideate [hypothesis title] — DOR-NNN
```

The ideation document will:

- Be created at `specs/{slug}/01-ideation.md`
- Include `linear-issue: DOR-NNN` in its frontmatter for traceability

After `/ideate` completes, the workflow continues:

1. `/ideate-to-spec` → transforms ideation to specification
2. `/spec:decompose` → creates implementation tasks
3. `/spec:execute` → implements the tasks
4. `/linear:done DOR-NNN` → closes the loop

## Update Linear Issue

1. Move hypothesis to "In Progress" state
2. Add `agent/claimed` label
3. Add next-steps comment:
   ```
   **Agent Action** — [YYYY-MM-DD]
   **Action:** Routed to spec workflow (complex scope)
   **Reasoning:** [why complex — e.g., "Requires new transport adapter pattern, touches 5+ files across client and server layers"]
   **Next steps:** Run /ideate to begin structured ideation. Spec will be at specs/{slug}/
   ```

## Important

- Do NOT decompose into Linear tasks yet — that happens via `/spec:decompose` after the spec is written
- The spec workflow runs entirely within the "In Progress" state — Linear doesn't see spec phases
- `/linear:done` closes the loop when the spec is fully implemented
- The hypothesis stays in "In Progress" until all spec tasks are complete
