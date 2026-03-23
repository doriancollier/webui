/**
 * Zod schemas and built-in defaults for the agent template catalog.
 *
 * Defines template categories, entry structure, and the 7 default
 * templates shipped with DorkOS.
 *
 * @module shared/template-catalog
 */
import { z } from 'zod';

// === Enums ===

export const TemplateCategorySchema = z.enum([
  'general',
  'frontend',
  'backend',
  'library',
  'tooling',
  'custom',
]);

export type TemplateCategory = z.infer<typeof TemplateCategorySchema>;

// === Template Entry ===

export const TemplateEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  source: z.string(),
  category: TemplateCategorySchema,
  builtin: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export type TemplateEntry = z.infer<typeof TemplateEntrySchema>;

// === Catalog ===

export const TemplateCatalogSchema = z.object({
  version: z.literal(1),
  templates: z.array(TemplateEntrySchema),
});

export type TemplateCatalog = z.infer<typeof TemplateCatalogSchema>;

// === Built-in Templates ===

export const DEFAULT_TEMPLATES: TemplateEntry[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Empty agent workspace — just agent.json and convention files',
    source: '',
    category: 'general',
    builtin: true,
    tags: ['starter'],
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'Next.js 15 starter with App Router',
    source: 'github:dorkos-templates/nextjs',
    category: 'frontend',
    builtin: true,
    tags: ['react', 'ssr', 'fullstack'],
  },
  {
    id: 'vite-react',
    name: 'Vite + React',
    description: 'Vite 6 + React 19 + TypeScript starter',
    source: 'github:dorkos-templates/vite-react',
    category: 'frontend',
    builtin: true,
    tags: ['react', 'spa', 'vite'],
  },
  {
    id: 'express',
    name: 'Express',
    description: 'Express.js API server with TypeScript',
    source: 'github:dorkos-templates/express',
    category: 'backend',
    builtin: true,
    tags: ['api', 'node', 'typescript'],
  },
  {
    id: 'fastapi',
    name: 'FastAPI',
    description: 'FastAPI Python server with async support',
    source: 'github:dorkos-templates/fastapi',
    category: 'backend',
    builtin: true,
    tags: ['api', 'python', 'async'],
  },
  {
    id: 'ts-library',
    name: 'TypeScript Library',
    description: 'TypeScript library with tsup bundling and vitest',
    source: 'github:dorkos-templates/ts-library',
    category: 'library',
    builtin: true,
    tags: ['typescript', 'npm', 'package'],
  },
  {
    id: 'cli-tool',
    name: 'CLI Tool',
    description: 'Node.js CLI tool with commander and esbuild',
    source: 'github:dorkos-templates/cli-tool',
    category: 'tooling',
    builtin: true,
    tags: ['cli', 'node', 'typescript'],
  },
];
