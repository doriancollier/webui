import { docs } from '@/.source'
import { loader } from 'fumadocs-core/source'
import { openapiPlugin } from 'fumadocs-openapi/server'

/**
 * Fumadocs source loader for documentation pages.
 *
 * Reads MDX content from the root-level docs/ directory (configured in source.config.ts)
 * and makes it available at the /docs base URL. The openapiPlugin processes
 * generated OpenAPI MDX pages so they can be rendered with the APIPage component.
 */
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [openapiPlugin()],
})
