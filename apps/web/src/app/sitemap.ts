import type { MetadataRoute } from 'next'
import { siteConfig } from '@/config/site'
import { source } from '@/lib/source'

const BASE_URL = siteConfig.url

/**
 * Generate the sitemap for the DorkOS marketing site.
 *
 * Includes static marketing/legal pages and all Fumadocs documentation pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/cookies`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  const docPages: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: `${BASE_URL}${page.url}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...docPages]
}
