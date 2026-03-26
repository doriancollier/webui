import { PlaygroundPageLayout } from '../PlaygroundPageLayout';
import { FORMS_SECTIONS } from '../playground-registry';
import { FormShowcases } from '../showcases/FormShowcases';
import { ComposedFormShowcases } from '../showcases/ComposedFormShowcases';

/** Form primitives and composed input component gallery for the dev playground. */
export function FormsPage() {
  return (
    <PlaygroundPageLayout
      title="Forms"
      description="Form primitives and composed input components."
      sections={FORMS_SECTIONS}
    >
      <FormShowcases />
      <ComposedFormShowcases />
    </PlaygroundPageLayout>
  );
}
