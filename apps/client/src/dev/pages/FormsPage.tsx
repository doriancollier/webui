import { FormShowcases } from '../showcases/FormShowcases';
import { ComposedFormShowcases } from '../showcases/ComposedFormShowcases';
import { TocSidebar } from '../TocSidebar';
import { FORMS_SECTIONS } from '../playground-registry';

/** Form primitives and composed input component gallery for the dev playground. */
export function FormsPage() {
  return (
    <>
      <header className="border-border border-b px-6 py-4">
        <h1 className="text-xl font-bold">Forms</h1>
        <p className="text-muted-foreground text-sm">
          Form primitives and composed input components.
        </p>
      </header>

      <div className="flex gap-8 p-6">
        <main className="min-w-0 flex-1 space-y-8">
          <FormShowcases />
          <ComposedFormShowcases />
        </main>
        <TocSidebar sections={FORMS_SECTIONS} />
      </div>
    </>
  );
}
