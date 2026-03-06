import { Folder } from 'lucide-react';
import { Badge } from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';
import type { DiscoveryCandidate } from '@dorkos/shared/mesh-schemas';
import { formatMarker } from '../lib/marker-labels';
import { useSpotlight } from '../lib/use-spotlight';

interface AgentCardProps {
  candidate: DiscoveryCandidate;
  selected: boolean;
  onToggle: () => void;
}

/** Replace home directory prefix with ~ for compact display. */
function formatPath(path: string): string {
  return path.replace(/^\/(?:Users|home)\/[^/]+/, '~');
}

/** Extract org/repo from a git remote URL (HTTPS or SSH). */
function formatRemote(remote: string): string {
  // git@github.com:org/repo.git → org/repo
  const sshMatch = remote.match(/:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];
  // https://github.com/org/repo.git → org/repo
  const segments = remote.replace(/\.git$/, '').split('/');
  if (segments.length >= 2) return `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
  return remote;
}

/**
 * Card displaying a discovered agent project with selection toggle.
 *
 * Clicking anywhere on the card toggles selection. Shows project name,
 * truncated path, AI marker badges, and git remote when available.
 * Features a mouse-tracking spotlight effect on hover.
 */
export function AgentCard({ candidate, selected, onToggle }: AgentCardProps) {
  const { onMouseMove, onMouseLeave, spotlightStyle } = useSpotlight();

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={cn(
        'relative flex w-full items-start gap-4 rounded-xl border p-6 text-left transition-colors',
        'hover:bg-muted/50',
        selected ? 'border-primary bg-primary/5' : 'border-border'
      )}
    >
      {/* Spotlight overlay */}
      {spotlightStyle && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={spotlightStyle}
        />
      )}

      {/* Selection checkbox — 44px touch target wrapping the visual checkbox */}
      <div className="mt-0.5 flex size-11 flex-shrink-0 items-center justify-center">
        <div
          className={cn(
            'flex size-5 items-center justify-center rounded border-2 transition-colors',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/40'
          )}
        >
          {selected && (
            <svg
              className="size-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Card content */}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{candidate.hints.suggestedName}</span>
          {candidate.strategy === 'dork-manifest' && (
            <Badge variant="secondary" className="text-xs">
              Registered
            </Badge>
          )}
        </div>

        {/* Capability badges derived from inferred capabilities */}
        {(candidate.hints.inferredCapabilities ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(candidate.hints.inferredCapabilities ?? []).map((cap) => (
              <Badge key={cap} variant="secondary" className="text-xs">
                {formatMarker(cap)}
              </Badge>
            ))}
          </div>
        )}

        <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
          <Folder className="size-3.5 shrink-0" />
          <span className="truncate font-mono">{formatPath(candidate.path)}</span>
        </p>
      </div>
    </button>
  );
}
