import { AgentIdentityShowcases } from '../showcases/AgentIdentityShowcases';
import { RelayShowcases } from '../showcases/RelayShowcases';
import { AdapterWizardShowcases } from '../showcases/AdapterWizardShowcases';
import { MeshShowcases } from '../showcases/MeshShowcases';
import { PulseShowcases } from '../showcases/PulseShowcases';
import { OnboardingShowcases } from '../showcases/OnboardingShowcases';
import { TocSidebar } from '../TocSidebar';
import { FEATURES_SECTIONS } from '../playground-registry';

/** Feature component showcase page for the dev playground. */
export function FeaturesPage() {
  return (
    <>
      <header className="border-border border-b px-6 py-4">
        <h1 className="text-xl font-bold">Feature Components</h1>
        <p className="text-muted-foreground text-sm">
          Domain-specific components from Relay, Mesh, Pulse, and Onboarding features.
        </p>
      </header>

      <div className="flex gap-8 p-6">
        <main className="min-w-0 flex-1 space-y-8">
          <AgentIdentityShowcases />
          <RelayShowcases />
          <AdapterWizardShowcases />
          <MeshShowcases />
          <PulseShowcases />
          <OnboardingShowcases />
        </main>
        <TocSidebar sections={FEATURES_SECTIONS} />
      </div>
    </>
  );
}
