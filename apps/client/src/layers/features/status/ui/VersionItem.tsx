import { useState } from 'react';
import { cn } from '@/layers/shared/lib';

interface VersionItemProps {
  version: string;
  latestVersion: string | null;
}

/**
 * Status bar version badge with optional update indicator.
 *
 * Shows `v{version}` in muted text when up to date.
 * Shows `↑ v{latestVersion}` with accent color when update available.
 * Click opens a tooltip with update instructions.
 */
export function VersionItem({ version, latestVersion }: VersionItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const hasUpdate = latestVersion !== null && isNewer(latestVersion, version);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        className={cn(
          'cursor-default text-xs',
          hasUpdate
            ? 'cursor-pointer text-amber-600 hover:underline dark:text-amber-400'
            : 'text-muted-foreground'
        )}
        onClick={() => hasUpdate && setShowTooltip(!showTooltip)}
        aria-label={hasUpdate ? `Update available: v${latestVersion}` : `Version ${version}`}
      >
        {hasUpdate ? `↑ v${latestVersion}` : `v${version}`}
      </button>

      {showTooltip && hasUpdate && (
        <div
          className="bg-popover text-popover-foreground border-border absolute bottom-full right-0 z-50 mb-2 w-64 rounded-md border p-3 text-xs shadow-md"
          role="tooltip"
        >
          <p className="font-medium">
            Update available: v{version} → v{latestVersion}
          </p>
          <p className="text-muted-foreground mt-1">
            Run{' '}
            <code className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">
              npm update -g dorkos
            </code>{' '}
            to update
          </p>
        </div>
      )}
    </span>
  );
}

/** Simple semver comparison: returns true if a > b */
function isNewer(a: string, b: string): boolean {
  const [aMaj, aMin, aPat] = a.split('.').map(Number);
  const [bMaj, bMin, bPat] = b.split('.').map(Number);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}
