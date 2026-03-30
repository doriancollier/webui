/**
 * Atomic file writer for `.md` task files.
 *
 * Uses write-to-temp + rename for crash-safe persistence.
 * Pairs with `task-file-parser.ts` for the read path.
 *
 * @module services/tasks/task-file-writer
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import matter from 'gray-matter';
import type { TaskFrontmatter } from './task-file-parser.js';

/**
 * Write a task definition to a `.md` file with YAML frontmatter.
 *
 * Creates the target directory if it does not exist. Uses atomic
 * write (temp file + rename) to prevent partial writes on crash.
 *
 * @param tasksDir - Absolute path to the tasks directory
 * @param slug - Kebab-case filename (without `.md` extension)
 * @param frontmatter - Validated task frontmatter fields
 * @param prompt - Markdown prompt body
 * @returns Absolute path to the written file
 */
export async function writeTaskFile(
  tasksDir: string,
  slug: string,
  frontmatter: TaskFrontmatter,
  prompt: string
): Promise<string> {
  await fs.mkdir(tasksDir, { recursive: true });
  const content = matter.stringify(prompt, frontmatter);
  const targetPath = path.join(tasksDir, `${slug}.md`);
  const tempPath = path.join(tasksDir, `.task-${randomUUID()}.tmp`);
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, targetPath);
  return targetPath;
}

/**
 * Delete a task file from disk.
 *
 * @param filePath - Absolute path to the `.md` file to remove
 */
export async function deleteTaskFile(filePath: string): Promise<void> {
  await fs.unlink(filePath);
}
