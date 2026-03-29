import { PlaygroundPageLayout } from '../PlaygroundPageLayout';
import { ERROR_STATES_SECTIONS } from '../playground-registry';
import { ErrorStateShowcases } from '../showcases/ErrorStateShowcases';

/** Error state component gallery for the dev playground. */
export function ErrorStatesPage() {
  return (
    <PlaygroundPageLayout
      title="Error States"
      description="Error boundaries, 404 pages, crash fallbacks, and toast notifications."
      sections={ERROR_STATES_SECTIONS}
    >
      <ErrorStateShowcases />
    </PlaygroundPageLayout>
  );
}
