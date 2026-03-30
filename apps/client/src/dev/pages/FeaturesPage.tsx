import { PlaygroundPageLayout } from '../PlaygroundPageLayout';
import { FEATURES_SECTIONS } from '../playground-registry';
import { AgentIdentityShowcases } from '../showcases/AgentIdentityShowcases';
import { RelayShowcases } from '../showcases/RelayShowcases';
import { AdapterWizardShowcases } from '../showcases/AdapterWizardShowcases';
import { MeshShowcases } from '../showcases/MeshShowcases';
import { TasksShowcases } from '../showcases/TasksShowcases';
import { OnboardingShowcases } from '../showcases/OnboardingShowcases';

/** Feature component showcase page for the dev playground. */
export function FeaturesPage() {
  return (
    <PlaygroundPageLayout
      title="Feature Components"
      description="Domain-specific components from Relay, Mesh, Tasks, and Onboarding features."
      sections={FEATURES_SECTIONS}
    >
      <AgentIdentityShowcases />
      <RelayShowcases />
      <AdapterWizardShowcases />
      <MeshShowcases />
      <TasksShowcases />
      <OnboardingShowcases />
    </PlaygroundPageLayout>
  );
}
