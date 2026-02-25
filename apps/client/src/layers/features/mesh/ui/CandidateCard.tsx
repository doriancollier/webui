import { Badge } from '@/layers/shared/ui/badge';
import type { DiscoveryCandidate } from '@dorkos/shared/mesh-schemas';

interface CandidateCardProps {
  candidate: DiscoveryCandidate;
  onApprove: (candidate: DiscoveryCandidate) => void;
  onDeny: (candidate: DiscoveryCandidate) => void;
}

/** Displays a discovered candidate with approve/deny actions. */
export function CandidateCard({ candidate, onApprove, onDeny }: CandidateCardProps) {
  const { path, strategy, hints } = candidate;

  return (
    <div className="flex items-start justify-between rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-sm font-medium">{path}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {hints.detectedRuntime}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {strategy}
          </Badge>
        </div>
        {hints.suggestedName && (
          <div className="mt-1 text-xs text-muted-foreground">{hints.suggestedName}</div>
        )}
        {hints.inferredCapabilities && hints.inferredCapabilities.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {hints.inferredCapabilities.map((cap) => (
              <Badge key={cap} variant="secondary" className="text-[10px]">
                {cap}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="ml-3 flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => onApprove(candidate)}
          className="rounded-md bg-green-600/10 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-green-400"
        >
          Approve
        </button>
        <button
          onClick={() => onDeny(candidate)}
          className="rounded-md bg-red-600/10 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-red-400"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
