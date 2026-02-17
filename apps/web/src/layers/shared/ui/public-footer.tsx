import Link from 'next/link'

export function PublicFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/30">
      <div className="container-default py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Brand / Copyright */}
          <div className="space-y-1">
            <p className="text-sm font-medium">Dork Labs</p>
            <p className="text-xs text-muted-foreground">
              © {currentYear} Dork Labs. All rights reserved.
            </p>
          </div>

          {/* Legal Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms of Service
            </Link>
            <Link
              href="/cookies"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Cookie Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
