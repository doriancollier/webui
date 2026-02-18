import { useRuns, useCancelRun } from '@/layers/entities/pulse';
import { useSessionId } from '@/layers/entities/session';
import type { PulseRun } from '@dorkos/shared/types';

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return '< 1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function StatusIcon({ status }: { status: PulseRun['status'] }) {
  switch (status) {
    case 'running':
      return <span className="text-blue-500" title="Running">&#9679;</span>;
    case 'completed':
      return <span className="text-green-500" title="Completed">&#10003;</span>;
    case 'failed':
      return <span className="text-red-500" title="Failed">&#10007;</span>;
    case 'cancelled':
      return <span className="text-neutral-400" title="Cancelled">&#8856;</span>;
    default:
      return null;
  }
}

interface Props {
  scheduleId: string;
}

export function RunHistoryPanel({ scheduleId }: Props) {
  const { data: runs = [], isLoading } = useRuns({ scheduleId, limit: 20 });
  const cancelRun = useCancelRun();
  const [, setActiveSession] = useSessionId();

  if (isLoading) {
    return <div className="py-2 text-xs text-muted-foreground">Loading runs...</div>;
  }

  if (runs.length === 0) {
    return <div className="py-2 text-xs text-muted-foreground">No runs yet</div>;
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[24px_64px_1fr_80px_80px] gap-2 text-xs font-medium text-muted-foreground">
        <span />
        <span>Trigger</span>
        <span>Started</span>
        <span>Duration</span>
        <span />
      </div>
      {runs.map((run) => (
        <div
          key={run.id}
          className="grid cursor-pointer grid-cols-[24px_64px_1fr_80px_80px] items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50"
          onClick={() => {
            if (run.sessionId) {
              setActiveSession(run.sessionId);
            }
          }}
        >
          <StatusIcon status={run.status} />
          <span className="truncate capitalize">{run.trigger}</span>
          <span>{run.startedAt ? new Date(run.startedAt).toLocaleString() : '-'}</span>
          <span>{formatDuration(run.durationMs)}</span>
          <span>
            {run.status === 'running' && (
              <button
                className="hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  cancelRun.mutate(run.id);
                }}
              >
                Cancel
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
