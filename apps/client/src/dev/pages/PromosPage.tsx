import { PromoShowcases } from '../showcases/PromoShowcases';
import { TocSidebar } from '../TocSidebar';
import { PROMOS_SECTIONS } from '../playground-registry';

/** Feature promo system showcase page for the dev playground. */
export function PromosPage() {
  return (
    <>
      <header className="border-border border-b px-6 py-4">
        <h1 className="text-xl font-bold">Feature Promos</h1>
        <p className="text-muted-foreground text-sm">
          Promo registry, slot previews, override controls, and dialog previews.
        </p>
      </header>

      <div className="flex gap-8 p-6">
        <main className="min-w-0 flex-1 space-y-8">
          <PromoShowcases />
        </main>
        <TocSidebar sections={PROMOS_SECTIONS} />
      </div>
    </>
  );
}
