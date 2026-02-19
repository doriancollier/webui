import { AlertTriangle } from 'lucide-react';
import { useRoadmapMeta } from '@/layers/entities/roadmap-item';
import { useAppStore } from '@/layers/shared/model';

/** Threshold above which a warning icon is shown next to the must-have percentage. */
const MUST_HAVE_WARNING_THRESHOLD = 60;

interface HealthBarProps {
  /** Total roadmap items count. */
  totalItems: number;
  /** Percentage of items classified as must-have. */
  mustHavePercent: number;
  /** Number of items currently in-progress. */
  inProgressCount: number;
  /** Number of items that are at-risk. */
  atRiskCount: number;
  /** Number of items that are blocked. */
  blockedCount: number;
  /** Number of items that are completed. */
  completedCount: number;
}

/** Individual stat pill displaying a label and value. */
function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

/** Stat pill with a warning icon, shown when the must-have percentage exceeds the threshold. */
function MustHavePill({ mustHavePercent }: { mustHavePercent: number }) {
  const isWarning = mustHavePercent > MUST_HAVE_WARNING_THRESHOLD;

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5">
      <span className="text-xs text-muted-foreground">Must-have</span>
      <span
        className={`text-sm font-semibold ${isWarning ? 'text-amber-600' : 'text-foreground'}`}
      >
        {mustHavePercent}%
      </span>
      {isWarning && (
        <AlertTriangle
          className="h-3.5 w-3.5 text-amber-600"
          aria-label="Must-have percentage is high"
        />
      )}
    </div>
  );
}

/**
 * Health stats bar showing key roadmap metrics and a "New Item" action button.
 *
 * Consumes pre-computed stats passed as props — callers should derive these
 * from the raw items list (e.g., in the parent container).
 */
export function HealthBar({
  totalItems,
  mustHavePercent,
  inProgressCount,
  atRiskCount,
  blockedCount,
  completedCount,
}: HealthBarProps) {
  const setEditingItemId = useAppStore((s) => s.setEditingItemId);
  const { data: meta } = useRoadmapMeta();

  return (
    <div className="flex flex-wrap items-center gap-3 bg-muted px-6 py-3">
      {meta?.projectName && (
        <span className="text-sm font-semibold text-foreground">
          {meta.projectName}
        </span>
      )}
      <StatPill label="Total" value={totalItems} />
      <MustHavePill mustHavePercent={mustHavePercent} />
      <StatPill label="In progress" value={inProgressCount} />
      <StatPill label="At risk" value={atRiskCount} />
      <StatPill label="Blocked" value={blockedCount} />
      <StatPill label="Completed" value={completedCount} />
      <div className="ml-auto">
        <button
          type="button"
          onClick={() => setEditingItemId('new')}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          New Item
        </button>
      </div>
    </div>
  );
}
