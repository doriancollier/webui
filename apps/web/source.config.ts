import { defineConfig, defineDocs } from 'fumadocs-mdx/config'

export const docs = defineDocs({
  // Points to the root-level docs/ directory in the monorepo
  dir: '../../docs',
})

export default defineConfig()
