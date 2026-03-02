import { Button } from '@/layers/shared/ui';

interface PulseEmptyStateProps {
  onCreateSchedule?: () => void;
}

/** Rich empty state for Pulse — faded schedule preview with a "Create Schedule" CTA. */
export function PulseEmptyState({ onCreateSchedule }: PulseEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16">
      {/* Faded schedule preview */}
      <div className="mb-8 w-full max-w-md select-none opacity-40 pointer-events-none">
        <div className="space-y-2">
          {/* Schedule row 1 */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-emerald-500" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Daily Health Check</span>
                  <span className="text-xs text-muted-foreground">Every day at 9:00 AM</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Run test suite and report failures
                </p>
              </div>
            </div>
          </div>
          {/* Schedule row 2 */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-blue-500" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Weekly Code Review</span>
                  <span className="text-xs text-muted-foreground">Every Monday at 8:00 AM</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Review open PRs and summarize changes
                </p>
              </div>
            </div>
          </div>
          {/* Schedule row 3 */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Dependency Audit</span>
                  <span className="text-xs text-muted-foreground">Every Friday at 5:00 PM</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Check for outdated or vulnerable packages
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Text */}
      <h3 className="mb-2 text-lg font-medium">Automate recurring tasks</h3>
      <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
        Schedules run Claude Code on a cron — health checks, audits, code reviews, and more.
      </p>

      {/* CTA */}
      <Button onClick={onCreateSchedule}>Create Schedule</Button>
    </div>
  );
}
