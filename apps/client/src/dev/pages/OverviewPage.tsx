import { PAGE_CONFIGS } from '../playground-config';
import type { Page } from '../playground-registry';

interface OverviewPageProps {
  /** Called when the user clicks a category card to navigate to that page. */
  onNavigate: (page: Page) => void;
}

/** Overview landing page for the dev playground — entry point with category cards. */
export function OverviewPage({ onNavigate }: OverviewPageProps) {
  return (
    <>
      <header className="border-border border-b px-6 py-4">
        <h1 className="text-xl font-bold">DorkOS Dev Playground</h1>
        <p className="text-muted-foreground text-sm">
          Design system reference and component showcase.
        </p>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAGE_CONFIGS.map((config) => {
            const Icon = config.icon;
            return (
              <button
                key={config.id}
                type="button"
                onClick={() => onNavigate(config.id as Page)}
                className="bg-card border-border hover:bg-accent focus-visible:ring-ring group flex flex-col gap-4 rounded-xl border p-6 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-10 items-center justify-center rounded-lg transition-colors">
                  <Icon className="size-5" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-foreground text-base font-semibold">{config.label}</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {config.description}
                  </p>
                </div>

                <div className="mt-auto">
                  <span className="text-muted-foreground font-mono text-xs">
                    {config.sections.length} sections
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}
