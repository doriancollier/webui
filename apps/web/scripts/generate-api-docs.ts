/**
 * Generate MDX documentation files from the DorkOS OpenAPI specification.
 *
 * Reads the OpenAPI JSON spec from docs/api/openapi.json and generates
 * MDX pages in the docs/api/ directory. These pages are then picked up
 * by the Fumadocs MDX pipeline and rendered as interactive API reference docs.
 *
 * Must be run from the apps/web/ directory (the default for npm workspace scripts).
 * Run via: npm run generate:api-docs -w apps/web
 */
import { generateFiles } from 'fumadocs-openapi'
import { createOpenAPI } from 'fumadocs-openapi/server'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../../..')
const outputDir = path.join(repoRoot, 'docs/api')

// Use the same relative path as lib/openapi.ts so generated MDX references
// match the runtime resolution in the Next.js server context.
const openapi = createOpenAPI({
  input: ['../../docs/api/openapi.json'],
})

void generateFiles({
  input: openapi,
  output: outputDir,
  includeDescription: true,
})
