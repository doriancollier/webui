import { useState } from 'react';
import cronstrue from 'cronstrue';
import {
  useSchedules,
  useUpdateSchedule,
  useTriggerSchedule,
  useDeleteSchedule,
} from '@/layers/entities/pulse';
import { cn } from '@/layers/shared/lib';
import type { PulseSchedule } from '@dorkos/shared/types';
import { CreateScheduleDialog } from './CreateScheduleDialog';
import { RunHistoryPanel } from './RunHistoryPanel';

function formatCron(cron: string): string {
  try {
    return cronstrue.toString(cron);
  } catch {
    return cron;
  }
}

function StatusDot({ schedule }: { schedule: PulseSchedule }) {
  const color =
    schedule.status === 'pending_approval'
      ? 'bg-yellow-500'
      : !schedule.enabled
        ? 'bg-neutral-400'
        : 'bg-green-500';

  return <span className={cn('inline-block size-2 rounded-full', color)} />;
}

export function PulsePanel() {
  const { data: schedules = [], isLoading } = useSchedules();
  const updateSchedule = useUpdateSchedule();
  const triggerSchedule = useTriggerSchedule();
  const deleteSchedule = useDeleteSchedule();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<PulseSchedule | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading schedules...</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-end">
        <button
          className="border-input hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md border bg-transparent px-3 py-1.5 text-sm font-medium shadow-sm transition-colors"
          onClick={() => {
            setEditSchedule(undefined);
            setDialogOpen(true);
          }}
        >
          New Schedule
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No scheduled jobs. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="rounded-lg border">
              <div
                className="flex cursor-pointer items-center gap-3 p-3"
                onClick={() => setExpandedId(expandedId === schedule.id ? null : schedule.id)}
              >
                <StatusDot schedule={schedule} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{schedule.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCron(schedule.cron)}
                    {schedule.nextRun && (
                      <> &middot; Next: {new Date(schedule.nextRun).toLocaleString()}</>
                    )}
                  </div>
                </div>

                {schedule.status === 'pending_approval' ? (
                  <div className="flex gap-1">
                    <button
                      className="border-input hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md border bg-transparent px-2.5 py-1 text-xs font-medium shadow-sm transition-colors"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        updateSchedule.mutate({ id: schedule.id, status: 'active', enabled: true });
                      }}
                    >
                      Approve
                    </button>
                    <button
                      className="hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        deleteSchedule.mutate(schedule.id);
                      }}
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      className="hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
                      disabled={!schedule.enabled}
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        triggerSchedule.mutate(schedule.id);
                      }}
                    >
                      Run Now
                    </button>
                    <button
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                        schedule.enabled ? 'bg-primary' : 'bg-input'
                      )}
                      role="switch"
                      aria-checked={schedule.enabled}
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        updateSchedule.mutate({
                          id: schedule.id,
                          enabled: !schedule.enabled,
                        });
                      }}
                    >
                      <span
                        className={cn(
                          'pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform',
                          schedule.enabled ? 'translate-x-4' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                )}
              </div>

              {expandedId === schedule.id && (
                <div className="border-t px-3 pb-3 pt-2">
                  <RunHistoryPanel scheduleId={schedule.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editSchedule={editSchedule}
      />
    </div>
  );
}
