import type { Metadata } from 'next'
import Link from 'next/link'
import { blog } from '@/lib/source'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Blog',
  description: `Latest news and updates from ${siteConfig.name}.`,
  openGraph: {
    title: `Blog | ${siteConfig.name}`,
    description: `Latest news and updates from ${siteConfig.name}.`,
    url: '/blog',
    type: 'website',
  },
  alternates: {
    canonical: '/blog',
    types: {
      'application/rss+xml': '/blog/feed.xml',
    },
  },
}

const categoryColors: Record<string, string> = {
  release: 'bg-emerald-100/60 text-emerald-900',
  tutorial: 'bg-blue-100/60 text-blue-900',
  announcement: 'bg-amber-100/60 text-amber-900',
  news: 'bg-purple-100/60 text-purple-900',
}

export default function BlogIndex() {
  const posts = blog
    .getPages()
    .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())

  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="mb-2 font-mono text-3xl font-bold tracking-tight text-charcoal">Blog</h1>
      <p className="mb-12 text-warm-gray">
        Release notes, tutorials, and updates from the {siteConfig.name} team.
      </p>

      <div className="space-y-8">
        {posts.map((post) => (
          <article key={post.url} className="group">
            <Link href={post.url} className="block">
              <div className="flex items-center gap-3 text-sm text-warm-gray-light">
                <time dateTime={new Date(post.data.date).toISOString()}>
                  {new Date(post.data.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                {post.data.category && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[post.data.category] ?? 'bg-warm-gray/10 text-warm-gray'}`}
                  >
                    {post.data.category}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl font-semibold text-charcoal group-hover:underline">
                {post.data.title}
              </h2>
              {post.data.description && (
                <p className="mt-1 text-warm-gray">
                  {post.data.description}
                </p>
              )}
            </Link>
          </article>
        ))}

        {posts.length === 0 && (
          <p className="text-warm-gray-light">No posts yet.</p>
        )}
      </div>
    </div>
  )
}
