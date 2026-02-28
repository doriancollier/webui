import type { Metadata } from 'next'
import { siteConfig } from '@/config/site'
import { MarketingShell } from './marketing-shell'

const metaDescription =
  'Your AI agents are brilliant. They just can\'t do anything when you leave. DorkOS gives them scheduling, communication, memory, and a command center. Open source. Self-hosted. You slept. They shipped.'

export const metadata: Metadata = {
  title: `${siteConfig.name} - ${siteConfig.description}`,
  description: metaDescription,
  openGraph: {
    title: `${siteConfig.name} - ${siteConfig.description}`,
    description: metaDescription,
    url: '/',
    type: 'website',
  },
  alternates: {
    canonical: '/',
  },
}

// JSON-LD structured data for SoftwareApplication
const softwareAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  sameAs: [siteConfig.github, siteConfig.npm],
}

// JSON-LD for WebSite with SearchAction (helps with sitelinks search box)
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteConfig.name,
  url: siteConfig.url,
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-cream-primary">
      {/* SoftwareApplication structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareAppJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      {/* WebSite structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <MarketingShell>{children}</MarketingShell>
    </div>
  )
}
