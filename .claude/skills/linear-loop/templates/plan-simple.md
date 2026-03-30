# Plan Simple — Decompose Hypothesis into Linear Tasks

This template is loaded when `/pm` needs to plan a `type/hypothesis` issue that meets simple sizing criteria.

## Sizing Confirmation

Verify this hypothesis is actually simple (per SKILL.md Sizing Criteria):

- Single file change or clearly-scoped component
- < 200 LOC estimated
- No new architectural patterns
- No cross-cutting concerns

If any of these fail, switch to `plan-complex.md` instead.

## Read the Hypothesis

Extract from the issue:

- **What we're testing**: The core hypothesis statement
- **Validation criteria**: How we know it worked
- **Confidence level**: From the `confidence/*` label
- **Project**: Which project this belongs to

## Decompose into Tasks

Break the hypothesis into concrete `type/task` sub-issues. Each task must be:

- **Single-session scope** — completable in one agent session (see SKILL.md)
- **Self-contained** — has enough context in its description to work without asking questions
- **Testable** — clear acceptance criteria

Guidelines:

- Prefer fewer, larger tasks over many tiny ones (3-5 tasks is typical)
- Include test writing as part of each task, not as a separate task
- Each task description should include: relevant file paths, what to change, acceptance criteria

## Create Sub-Issues

For each task, create via `save_issue`:

- **title**: Actionable imperative phrase (e.g., "Add error boundary to ChatPanel")
- **team**: DorkOS (from config.json)
- **description**: Full context — what, why, where, acceptance criteria, relevant file paths
- **labels**: `["task", "from-agent"]`
- **parentId**: The hypothesis issue ID (creates parent-child relationship)
- **project**: Same project as the hypothesis
- **state**: Backlog

## Set Up Relations

After creating all tasks:

1. Identify dependency order — which tasks must complete before others can start
2. Use `blockedBy` on `save_issue` to set dependencies (keep chains shallow, max 2 levels)
3. For tasks with no dependencies: add `agent/ready` label (available for immediate execution)

## Update Hypothesis

1. Move hypothesis to "In Progress" state
2. Add next-steps comment:
   ```
   **Agent Action** — [YYYY-MM-DD]
   **Action:** Decomposed into N tasks (simple plan)
   **Reasoning:** [brief — e.g., "Clearly scoped, single component change"]
   **Next steps:** M tasks ready for execution. Run /pm to dispatch the first one.
   ```

## Report

Display:

- Number of tasks created
- Which tasks are ready (have `agent/ready` label)
- Dependency order (if any)
- Recommended first task to execute
