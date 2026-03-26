import { TocSidebar } from './TocSidebar';
import type { PlaygroundSection } from './playground-registry';

interface PlaygroundPageLayoutProps {
  /** Page heading. */
  title: string;
  /** Short description shown below the heading. */
  description: string;
  /** Section entries for the right-hand TOC sidebar. */
  sections: PlaygroundSection[];
  /** Showcase content rendered in the main column. */
  children: React.ReactNode;
}

/** Shared layout for standard playground pages — header, two-column body with TOC sidebar. */
export function PlaygroundPageLayout({
  title,
  description,
  sections,
  children,
}: PlaygroundPageLayoutProps) {
  return (
    <>
      <header className="border-border border-b px-6 py-4">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </header>

      <div className="flex gap-8 p-6">
        <main className="min-w-0 flex-1 space-y-8">{children}</main>
        <TocSidebar sections={sections} />
      </div>
    </>
  );
}
