import { PlaygroundPageLayout } from '../PlaygroundPageLayout';
import { FILTER_BAR_SECTIONS } from '../playground-registry';
import { FilterBarShowcase } from '../showcases/FilterBarShowcase';

/** Filter bar component gallery for the dev playground. */
export function FilterBarPage() {
  return (
    <PlaygroundPageLayout
      title="Filter Bar"
      description="Composable filter system with text search, enum, date range, sort, and responsive active filters."
      sections={FILTER_BAR_SECTIONS}
    >
      <FilterBarShowcase />
    </PlaygroundPageLayout>
  );
}
