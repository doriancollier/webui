# Audit Workspace — Linear Health Check

This template is loaded when `/pm audit` is run. It performs a comprehensive health check of the Linear workspace and fixes issues.

## Process

Run all checks, collect findings, present a report, then offer to fix issues.

### 1. Gather Data

Query everything in the team:

- `list_projects(team: "dorkos", includeMembers: true)` — all projects with status and lead
- `list_issues(team: "dorkos", limit: 250)` — all issues
- `list_issue_labels(team: "dorkos")` — all labels for validation

### 2. Label Audit

For each issue, check:

| Check                             | Problem                                                          | Auto-Fix                          |
| --------------------------------- | ---------------------------------------------------------------- | --------------------------------- |
| **Missing type label**            | Issue has no `type/*` label                                      | Ask user to classify              |
| **Multiple type labels**          | Issue has more than one `type/*` label                           | Ask user which to keep            |
| **Missing origin label**          | Issue has no `origin/*` label                                    | Add `origin/human` (safe default) |
| **Stale agent labels**            | `agent/claimed` on a Done issue, or `agent/ready` on In Progress | Remove stale label                |
| **Confidence without hypothesis** | `confidence/*` label on non-hypothesis issue                     | Remove confidence label           |
| **needs-input without question**  | `needs-input` label but no agent question comment                | Remove label, unassign            |

### 3. Project Status Audit

For each project, check:

| Check                                   | Problem                                            | Auto-Fix              |
| --------------------------------------- | -------------------------------------------------- | --------------------- |
| **Wrong status: should be Completed**   | All issues Done, project still In Progress         | Update to Completed   |
| **Wrong status: should be In Progress** | Has In Progress issues, project is Planned/Backlog | Update to In Progress |
| **Wrong status: should be Planned**     | Has triaged issues, project is Backlog             | Update to Planned     |
| **No lead, has active work**            | Project in scope but may need ownership            | Flag for user         |
| **Completed with new issues**           | Completed project received new issues              | Update to In Progress |

### 4. Stale Issue Detection

| Check                 | Threshold                                 | Action                                  |
| --------------------- | ----------------------------------------- | --------------------------------------- |
| **Stale In Progress** | No updates in >7 days                     | Flag — recommend checking or unblocking |
| **Stale Triage**      | In Triage for >14 days                    | Flag — recommend triaging or closing    |
| **Stale needs-input** | No response in >7 days                    | Flag — re-notify or escalate            |
| **Orphan tasks**      | `type/task` with no parent and no project | Flag — recommend assigning              |

### 5. Orphan Detection

- Issues not assigned to any project
- `type/task` issues without a parent hypothesis
- `type/monitor` issues referencing Done hypotheses that are already validated

### 6. Spec-Linear Cross-Reference

Check `specs/manifest.json` for specs with `linearIssue` fields:

- Is the referenced Linear issue still open? If the spec is implemented but the issue isn't Done, flag it.
- Are there In Progress Linear issues that should have specs but don't?

### 7. Present Report

```
## Workspace Audit Report

### Label Issues (N found)
- DOR-12: Missing type label
- DOR-34: Has both type/idea and type/task (conflict)
- DOR-56: agent/claimed but issue is Done

### Project Status Issues (N found)
- "SDK Upgrade 0.2.86" [In Progress]: All issues Done → should be Completed
- "TanStack Pacer" [Backlog]: Has triaged issues → should be Planned

### Stale Issues (N found)
- DOR-78: In Progress for 12 days with no updates
- DOR-90: In Triage for 21 days

### Orphans (N found)
- DOR-23: task with no project assignment
- DOR-45: task with no parent hypothesis

### Auto-Fixable: N issues
### Needs Your Input: N issues

Fix all auto-fixable issues now? (Y/N)
```

### 8. Execute Fixes

On approval:

- Apply all auto-fixes (label corrections, project status updates)
- For issues needing user input, create `needs-input` issues or ask interactively
- Add a next-steps comment to each fixed issue documenting what changed

Report what was fixed and what still needs attention.
