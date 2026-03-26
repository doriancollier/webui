import { PlaygroundPageLayout } from '../PlaygroundPageLayout';
import { PROMOS_SECTIONS } from '../playground-registry';
import { PromoShowcases } from '../showcases/PromoShowcases';

/** Feature promo system showcase page for the dev playground. */
export function PromosPage() {
  return (
    <PlaygroundPageLayout
      title="Feature Promos"
      description="Promo registry, slot previews, override controls, and dialog previews."
      sections={PROMOS_SECTIONS}
    >
      <PromoShowcases />
    </PlaygroundPageLayout>
  );
}
