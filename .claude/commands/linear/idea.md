---
description: 'Submit an idea to the Linear backlog'
allowed-tools: 'Read, mcp__plugin_linear_linear__save_issue, mcp__plugin_linear_linear__list_issues, mcp__plugin_linear_linear__list_projects, mcp__plugin_linear_linear__save_comment, mcp__plugin_linear_linear__get_authenticated_user'
argument-hint: '<idea description>'
---

# /linear:idea — Quick Idea Capture

Read `.claude/skills/linear-loop/SKILL.md` for issue conventions.
Read `.claude/skills/linear-loop/config.json` for team configuration.

This is a shortcut for `/pm <idea>` — it creates a `type/idea` issue directly, skipping classification.

## Process

1. Take the user's argument as the idea description
2. If no argument provided, ask the user to describe their idea
3. Create the issue in Linear:
   - **Team**: DorkOS (from config.json `team.id`)
   - **Title**: Concise, actionable summary of the idea
   - **Description**: The full idea with any context the user provided
   - **Labels**: `idea` (from type group), `human` (from origin group)
   - **State**: Triage
4. Add a next-steps comment (per SKILL.md convention):
   ```
   **Agent Action** — [YYYY-MM-DD]
   **Action:** Captured idea, placed in Triage
   **Reasoning:** Quick capture via /linear:idea
   **Next steps:** Awaiting triage via /pm
   ```
5. Report the created issue ID and title

Do NOT evaluate the idea here — that's triage's job. Just capture it cleanly and move on.

**Tip:** For richer classification (bug reports, briefs, research questions), use `/pm <text>` instead.
