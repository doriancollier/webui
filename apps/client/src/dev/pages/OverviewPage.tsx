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

      <main className="p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PAGE_CONFIGS.map((config) => {
            const Icon = config.icon;
            return (
              <button
                key={config.id}
                type="button"
                onClick={() => onNavigate(config.id as Page)}
                className="bg-card border-border hover:bg-accent focus-visible:ring-ring group flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors">
                  <Icon className="size-4" />
                </div>

                <div className="min-w-0 space-y-0.5">
                  <h2 className="text-foreground text-sm font-semibold">{config.label}</h2>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {config.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}
