import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider/next'
import type { ReactNode } from 'react'
import { source } from '@/lib/source'
import 'fumadocs-ui/style.css'

/**
 * Layout for the /docs route group.
 *
 * Wraps all documentation pages with the Fumadocs sidebar navigation
 * and root provider for search, theme, and framework integration.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout tree={source.pageTree}>
        {children}
      </DocsLayout>
    </RootProvider>
  )
}
