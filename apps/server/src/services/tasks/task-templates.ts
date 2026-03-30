/**
 * Default task templates seeded on first server run.
 *
 * Templates are .md files in `{dorkHome}/tasks/templates/`.
 * Users can edit, add, or delete template files.
 *
 * @module services/tasks/task-templates
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeTaskFile } from './task-file-writer.js';
import type { TaskFrontmatter } from './task-file-parser.js';
import { logger } from '../../lib/logger.js';

interface TemplateDefinition {
  slug: string;
  frontmatter: TaskFrontmatter;
  prompt: string;
}

/** Built-in task templates seeded on first run. */
const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  {
    slug: 'daily-health-check',
    frontmatter: {
      name: 'Daily Health Check',
      description: 'Run lint, test, and typecheck across the project',
      cron: '0 9 * * 1-5',
      timezone: 'UTC',
      enabled: true,
      permissions: 'acceptEdits',
      tags: ['ci', 'health'],
    },
    prompt: `Run the following checks and report results:

1. \`pnpm lint\` — Report any linting errors
2. \`pnpm typecheck\` — Report any type errors
3. \`pnpm test -- --run\` — Report any test failures

Summarize the results concisely. If everything passes, say so. If anything fails, list the failures with file paths and line numbers.`,
  },
  {
    slug: 'weekly-dependency-audit',
    frontmatter: {
      name: 'Weekly Dependency Audit',
      description: 'Check for outdated or vulnerable dependencies',
      cron: '0 10 * * 1',
      timezone: 'UTC',
      enabled: true,
      permissions: 'acceptEdits',
      tags: ['dependencies', 'security'],
    },
    prompt: `Audit project dependencies:

1. Run \`pnpm outdated\` and list packages with major version bumps available
2. Check for known security vulnerabilities
3. Identify any deprecated packages

Provide a prioritized list of recommended updates with risk assessment (safe, moderate, breaking).`,
  },
  {
    slug: 'activity-summary',
    frontmatter: {
      name: 'Activity Summary',
      description: 'Summarize recent agent activity across all sessions',
      cron: '0 18 * * 1-5',
      timezone: 'UTC',
      enabled: true,
      permissions: 'acceptEdits',
      tags: ['summary', 'reporting'],
    },
    prompt: `Summarize today's agent activity:

1. List sessions that were active today
2. Note any errors or failures
3. Highlight completed tasks and their outcomes
4. Flag anything that needs human attention

Keep the summary concise — aim for a quick daily digest.`,
  },
  {
    slug: 'code-review-digest',
    frontmatter: {
      name: 'Code Review Digest',
      description: 'Review recent commits for quality and patterns',
      cron: '0 11 * * 5',
      timezone: 'UTC',
      enabled: true,
      permissions: 'acceptEdits',
      tags: ['review', 'quality'],
    },
    prompt: `Review commits from the past week:

1. Run \`git log --oneline --since="7 days ago"\`
2. Identify any concerning patterns (large commits, missing tests, style inconsistencies)
3. Note any TODO comments that were added
4. Highlight exemplary commits worth learning from

Provide a brief weekly code quality report.`,
  },
];

/**
 * Seed default task templates if the templates directory is empty.
 *
 * @param dorkHome - Resolved data directory path
 */
export async function ensureDefaultTemplates(dorkHome: string): Promise<void> {
  const templatesDir = path.join(dorkHome, 'tasks', 'templates');
  await fs.mkdir(templatesDir, { recursive: true });

  try {
    const existing = await fs.readdir(templatesDir);
    if (existing.some((f) => f.endsWith('.md'))) return; // Already seeded
  } catch {
    // Directory didn't exist, that's fine — we just created it
  }

  for (const template of DEFAULT_TEMPLATES) {
    await writeTaskFile(templatesDir, template.slug, template.frontmatter, template.prompt);
  }

  logger.info(`[Tasks] Seeded ${DEFAULT_TEMPLATES.length} default templates`);
}

/**
 * Load task templates from the templates directory.
 *
 * @param dorkHome - Resolved data directory path
 * @returns Array of parsed templates
 */
export async function loadTemplates(
  dorkHome: string
): Promise<Array<{ id: string; name: string; description: string; prompt: string; cron: string }>> {
  const templatesDir = path.join(dorkHome, 'tasks', 'templates');

  try {
    const { parseTaskFile } = await import('./task-file-parser.js');
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });
    const templates = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filePath = path.join(templatesDir, entry.name);
      const content = await fs.readFile(filePath, 'utf-8');
      const result = parseTaskFile(filePath, content, 'global');
      if ('error' in result) continue;

      templates.push({
        id: result.id,
        name: result.meta.name,
        description: result.meta.description ?? '',
        prompt: result.prompt,
        cron: result.meta.cron ?? '',
      });
    }

    return templates;
  } catch {
    return [];
  }
}
