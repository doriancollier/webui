import { useState } from 'react';
import { PlaygroundSection } from '../PlaygroundSection';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { ShowcaseDemo } from '../ShowcaseDemo';
import { TimezoneCombobox } from '@/layers/features/pulse/ui/TimezoneCombobox';
import { ScanRootInput } from '@/layers/features/mesh/ui/ScanRootInput';
import { SettingRow, PasswordInput, Switch } from '@/layers/shared/ui';

/** Composed form component showcases: TimezoneCombobox, ScanRootInput, SettingRow, PasswordInput. */
export function ComposedFormShowcases() {
  return (
    <>
      <TimezoneComboboxSection />
      <ScanRootInputSection />
      <SettingRowSection />
      <PasswordInputSection />
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

// ---------------------------------------------------------------------------
// SettingRow
// ---------------------------------------------------------------------------

function SettingRowSection() {
  const [autoStart, setAutoStart] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [telemetry, setTelemetry] = useState(false);

  return (
    <PlaygroundSection
      title="SettingRow"
      description="Horizontal settings row with label and description on the left, control on the right."
    >
      <ShowcaseLabel>Toggle off (default)</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="w-full max-w-md">
          <SettingRow label="Auto-start agents" description="Launch agents automatically on startup.">
            <Switch checked={autoStart} onCheckedChange={setAutoStart} />
          </SettingRow>
        </div>
      </ShowcaseDemo>

      <ShowcaseLabel>Toggle on</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="w-full max-w-md">
          <SettingRow
            label="Desktop notifications"
            description="Receive alerts when agent tasks complete."
          >
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </SettingRow>
        </div>
      </ShowcaseDemo>

      <ShowcaseLabel>Multiple rows</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="w-full max-w-md space-y-4">
          <SettingRow label="Auto-start agents" description="Launch agents automatically on startup.">
            <Switch checked={autoStart} onCheckedChange={setAutoStart} />
          </SettingRow>
          <SettingRow
            label="Desktop notifications"
            description="Receive alerts when agent tasks complete."
          >
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </SettingRow>
          <SettingRow
            label="Usage telemetry"
            description="Share anonymous usage data to improve DorkOS."
          >
            <Switch checked={telemetry} onCheckedChange={setTelemetry} />
          </SettingRow>
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ---------------------------------------------------------------------------
// PasswordInput
// ---------------------------------------------------------------------------

function PasswordInputSection() {
  const [controlled, setControlled] = useState(false);

  return (
    <PlaygroundSection
      title="PasswordInput"
      description="Password input with eye/eye-off visibility toggle. Supports controlled and uncontrolled modes."
    >
      <ShowcaseLabel>Uncontrolled (hidden by default)</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="w-full max-w-xs">
          <PasswordInput placeholder="Enter password" />
        </div>
      </ShowcaseDemo>

      <ShowcaseLabel>Uncontrolled (visible by default)</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="w-full max-w-xs">
          <PasswordInput placeholder="Enter password" visibleByDefault />
        </div>
      </ShowcaseDemo>

      <ShowcaseLabel>Controlled</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="w-full max-w-xs">
          <PasswordInput
            placeholder="Enter password"
            showPassword={controlled}
            onShowPasswordChange={setControlled}
          />
        </div>
      </ShowcaseDemo>

      <ShowcaseLabel>Disabled</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="w-full max-w-xs">
          <PasswordInput placeholder="Enter password" disabled />
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}
