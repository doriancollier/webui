import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'

/**
 * MDX component overrides for documentation pages.
 *
 * Extends Fumadocs default components (code blocks, headings, tables, cards, callouts)
 * with any project-specific overrides.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  }
}
