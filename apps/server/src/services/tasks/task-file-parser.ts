/**
 * Parse `.md` task files with YAML frontmatter into structured TaskDefinition objects.
 *
 * Task files are the sole source of truth for task configuration. This parser
 * validates frontmatter against a Zod schema and extracts the prompt body.
 *
 * @module services/tasks/task-file-parser
 */
import { z } from 'zod';
import matter from 'gray-matter';
import path from 'node:path';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

/** Duration string pattern like "5m", "1h", "30s", or "2h30m". */
export const DurationSchema = z
  .string()
  .regex(/^(\d+h)?(\d+m)?(\d+s)?$/, 'Duration must be like "5m", "1h", "30s", or "2h30m"')
  .refine((v) => v.length > 0, 'Duration must not be empty');

/** YAML frontmatter schema for `.md` task files. */
export const TaskFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  cron: z.string().optional(),
  timezone: z.string().default('UTC'),
  agent: z.string().optional(),
  enabled: z.boolean().default(true),
  maxRuntime: DurationSchema.optional(),
  permissions: z.enum(['acceptEdits', 'bypassPermissions']).default('acceptEdits'),
  tags: z.array(z.string()).default([]),
  cwd: z.string().optional(),
});

export type TaskFrontmatter = z.infer<typeof TaskFrontmatterSchema>;

/** Parsed task definition ready for storage or scheduling. */
export interface TaskDefinition {
  /** Filename slug (kebab-case, without `.md` extension). */
  id: string;
  /** Validated frontmatter fields. */
  meta: TaskFrontmatter;
  /** Prompt body (markdown content below frontmatter). */
  prompt: string;
  /** Whether the task comes from a project or global tasks directory. */
  scope: 'project' | 'global';
  /** Absolute path to the `.md` file on disk. */
  filePath: string;
  /** Absolute path to the project root (present for project-scoped tasks). */
  projectPath?: string;
}

/**
 * Parse a duration string like "2h30m" into milliseconds.
 *
 * @param duration - Duration string matching the DurationSchema pattern
 * @returns Duration in milliseconds
 */
export function parseDuration(duration: string): number {
  let ms = 0;
  const hours = duration.match(/(\d+)h/);
  const minutes = duration.match(/(\d+)m/);
  const seconds = duration.match(/(\d+)s/);
  if (hours) ms += parseInt(hours[1], 10) * 3_600_000;
  if (minutes) ms += parseInt(minutes[1], 10) * 60_000;
  if (seconds) ms += parseInt(seconds[1], 10) * 1_000;
  return ms;
}

/**
 * Parse a `.md` task file into a TaskDefinition or an error.
 *
 * Validates frontmatter with Zod, enforces kebab-case filenames,
 * and extracts the prompt body.
 *
 * @param filePath - Absolute path to the `.md` file
 * @param content - Raw file content (UTF-8)
 * @param scope - Whether this is a project or global task
 * @param projectPath - Project root path (for project-scoped tasks)
 * @returns A TaskDefinition on success, or an object with an `error` string
 */
export function parseTaskFile(
  filePath: string,
  content: string,
  scope: 'project' | 'global',
  projectPath?: string
): TaskDefinition | { error: string } {
  const { data, content: body } = matter(content);
  const result = TaskFrontmatterSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.message };
  }
  const slug = path.basename(filePath, '.md');
  if (!SLUG_REGEX.test(slug)) {
    return { error: `Invalid filename: must be kebab-case (got "${slug}")` };
  }
  return { id: slug, meta: result.data, prompt: body.trim(), scope, filePath, projectPath };
}
