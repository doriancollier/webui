import { useState } from 'react';
import { PlaygroundSection } from '../PlaygroundSection';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { ShowcaseDemo } from '../ShowcaseDemo';
import { TimezoneCombobox } from '@/layers/features/pulse/ui/TimezoneCombobox';
import { ScanRootInput } from '@/layers/features/mesh/ui/ScanRootInput';

/** Composed form component showcases: TimezoneCombobox, ScanRootInput. */
export function ComposedFormShowcases() {
  return (
    <>
      <TimezoneComboboxSection />
      <ScanRootInputSection />
    </>
  );
}

// ---------------------------------------------------------------------------
// TimezoneCombobox
// ---------------------------------------------------------------------------

function TimezoneComboboxSection() {
  const [defaultTz, setDefaultTz] = useState('');
  const [explicitTz, setExplicitTz] = useState('America/New_York');

  return (
    <PlaygroundSection
      title="TimezoneCombobox"
      description="Searchable IANA timezone selector grouped by continent. Detects system timezone."
    >
      <ShowcaseLabel>Default (system timezone)</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="max-w-xs">
          <TimezoneCombobox value={defaultTz} onChange={setDefaultTz} />
        </div>
      </ShowcaseDemo>

      <ShowcaseLabel>With explicit value</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="max-w-xs">
          <TimezoneCombobox value={explicitTz} onChange={setExplicitTz} />
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ---------------------------------------------------------------------------
// ScanRootInput
// ---------------------------------------------------------------------------

function ScanRootInputSection() {
  const [populated, setPopulated] = useState(['/Users/kai/projects', '/opt/agents']);
  const [empty, setEmpty] = useState<string[]>([]);

  return (
    <PlaygroundSection
      title="ScanRootInput"
      description="Chip/tag input for filesystem scan paths with DirectoryPicker integration."
    >
      <ShowcaseLabel>With pre-populated paths</ShowcaseLabel>
      <ShowcaseDemo>
        <ScanRootInput roots={populated} onChange={setPopulated} />
      </ShowcaseDemo>

      <ShowcaseLabel>Empty</ShowcaseLabel>
      <ShowcaseDemo>
        <ScanRootInput roots={empty} onChange={setEmpty} />
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}
