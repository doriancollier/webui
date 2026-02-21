import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { useRuns, useCancelRun } from '@/layers/entities/pulse';
import { useSessionId } from '@/layers/entities/session';
import { cn, formatRelativeTime } from '@/layers/shared/lib';
import type { PulseRun } from '@dorkos/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return '< 1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/** Truncate a multi-line string to its first line, clipped at maxLen chars. */
function firstLine(text: string, maxLen = 80): string {
  const line = text.split('\n')[0] ?? '';
  return line.length > maxLen ? `${line.slice(0, maxLen)}…` : line;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: PulseRun['status'] }) {
  switch (status) {
    case 'running':
      return (
        <span title="Running" aria-label="Running">
          <Loader2 className="size-3.5 animate-spin text-blue-500" />
        </span>
      );
    case 'completed':
      return (
        <span title="Completed" aria-label="Completed">
          <CheckCircle2 className="size-3.5 text-green-500" />
        </span>
      );
    case 'failed':
      return (
        <span title="Failed" aria-label="Failed">
          <XCircle className="size-3.5 text-destructive" />
        </span>
      );
    case 'cancelled':
      return (
        <span title="Cancelled" aria-label="Cancelled">
          <MinusCircle className="size-3.5 text-muted-foreground" />
        </span>
      );
    default:
      return null;
  }
}

interface RunRowProps {
  run: PulseRun;
  onNavigate: (sessionId: string) => void;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}

/**
 * Single run row rendered as a CSS grid.
 *
 * The outer element is a plain div. When the run has a sessionId, an invisible
 * full-coverage anchor-style overlay div handles the click so that the Cancel
 * button (a real <button>) sits outside the clickable region and avoids the
 * invalid nested-button HTML constraint.
 */
function RunRow({ run, onNavigate, onCancel, isCancelling }: RunRowProps) {
  const isClickable = !!run.sessionId;

  function handleRowClick() {
    if (run.sessionId) onNavigate(run.sessionId);
  }

  function handleCancel(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onCancel(run.id);
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onClick={isClickable ? handleRowClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') handleRowClick();
            }
          : undefined
      }
      className={cn(
        'grid grid-cols-[20px_56px_1fr_64px_72px_20px] items-center gap-2',
        'rounded-md border border-transparent px-2 py-2 text-xs transition-colors',
        isClickable && 'cursor-pointer hover:bg-muted/50 hover:border-border',
        run.status === 'failed' && 'bg-destructive/5'
      )}
    >
      <StatusIcon status={run.status} />

      <span className="truncate capitalize text-muted-foreground">
        {run.trigger}
      </span>

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground">
          {run.startedAt ? formatRelativeTime(run.startedAt) : '-'}
        </span>
        {run.outputSummary && (
          <span className="truncate text-muted-foreground">
            {firstLine(run.outputSummary)}
          </span>
        )}
        {run.status === 'failed' && run.error && (
          <span className="truncate text-destructive">
            {firstLine(run.error)}
          </span>
        )}
      </span>

      <span className="text-muted-foreground">{formatDuration(run.durationMs)}</span>

      <span>
        {run.status === 'running' && (
          <button
            type="button"
            disabled={isCancelling}
            onClick={handleCancel}
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
              'text-muted-foreground transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            Cancel
          </button>
        )}
      </span>

      <span className="flex items-center justify-end">
        {isClickable && (
          <ChevronRight className="size-3.5 text-muted-foreground/50" aria-hidden="true" />
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface Props {
  scheduleId: string;
}

/** Run history list for a Pulse schedule. */
export function RunHistoryPanel({ scheduleId }: Props) {
  const { data: runs = [], isLoading } = useRuns({ scheduleId, limit: 20 });
  const cancelRun = useCancelRun();
  const [, setActiveSession] = useSessionId();

  if (isLoading) {
    return <div className="py-2 text-xs text-muted-foreground">Loading runs...</div>;
  }

  if (runs.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        No runs yet
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {/* Column headers — desktop only */}
      <div className="hidden sm:grid sm:grid-cols-[20px_56px_1fr_64px_72px_20px] sm:gap-2 sm:px-2 sm:pb-1 sm:text-xs sm:font-medium sm:text-muted-foreground">
        <span />
        <span>Trigger</span>
        <span>Started</span>
        <span>Duration</span>
        <span />
        <span />
      </div>
      {runs.map((run) => (
        <RunRow
          key={run.id}
          run={run}
          onNavigate={setActiveSession}
          onCancel={(id) => cancelRun.mutate(id)}
          isCancelling={cancelRun.isPending}
        />
      ))}
    </div>
  );
}
