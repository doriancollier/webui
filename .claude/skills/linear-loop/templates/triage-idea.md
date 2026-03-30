# Triage Idea — Evaluate a Single Idea

This template is loaded when `/pm` needs to triage an issue in Triage state with a `type/idea` label.

## Prerequisites

- Issue must have `type/idea` label and be in Triage state
- Read the issue description fully before evaluating

## Evaluation

### 1. Alignment Check

- Query active projects (per ownership filter) via `list_projects`
- Does this idea align with any project's goals?
- If aligned: note which project for assignment

### 2. Feasibility Quick-Check

- Is this technically feasible within the current architecture?
- Does it conflict with any known constraints? (Check `decisions/` if uncertain)
- Estimated scope: trivial / small / medium / large / epic

### 3. Duplication Check

- Search existing issues: `list_issues(team: "dorkos", query: "<key terms from idea>", includeArchived: false)`
- If a duplicate or very similar issue exists: link as related, note in triage comment

## Decision

| Decision             | Criteria                                         | Action                                                               |
| -------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| **Accept**           | Aligned, feasible, not duplicate                 | Move to Backlog, assign to project                                   |
| **Reject**           | Misaligned, infeasible, or out of scope          | Move to Cancelled, comment explaining why                            |
| **Needs Research**   | Feasibility uncertain or scope unclear           | Create `type/research` issue linked as related, move idea to Backlog |
| **Needs Refinement** | Idea is vague, needs more detail from originator | Add `needs-input` label, assign to user, post question comment       |

## Post-Triage

1. Add a next-steps comment:

   ```
   **Agent Action** — [YYYY-MM-DD]
   **Action:** [Accepted / Rejected / Needs Research / Needs Refinement]
   **Reasoning:** [brief rationale]
   **Next steps:** [e.g., "Convert to hypothesis for validation" or "Research feasibility first"]
   ```

2. If accepted, recommend the next lifecycle stage:
   - Clear and small scope → suggest converting to `type/task` directly
   - Needs validation → suggest converting to `type/hypothesis` with validation criteria
   - Needs investigation → the research issue created above handles this

3. Update the issue:
   - Move to appropriate state (Backlog for accepted, Cancelled for rejected)
   - Assign to project if aligned
   - Remove from Triage
