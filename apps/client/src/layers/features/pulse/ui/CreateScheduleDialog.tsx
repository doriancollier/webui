import { useState, useEffect, useMemo } from 'react';
import cronstrue from 'cronstrue';
import { useCreateSchedule, useUpdateSchedule } from '@/layers/entities/pulse';
import type { PulseSchedule } from '@dorkos/shared/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSchedule?: PulseSchedule;
}

function getCronPreview(cron: string): string {
  if (!cron.trim()) return '';
  try {
    return cronstrue.toString(cron);
  } catch {
    return 'Invalid cron expression';
  }
}

export function CreateScheduleDialog({ open, onOpenChange, editSchedule }: Props) {
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();

  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [cron, setCron] = useState('');
  const [cwd, setCwd] = useState('');
  const [timezone, setTimezone] = useState('');
  const [permissionMode, setPermissionMode] = useState<'acceptEdits' | 'bypassPermissions'>(
    'acceptEdits'
  );
  const [maxRuntimeMin, setMaxRuntimeMin] = useState(10);

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (editSchedule) {
      setName(editSchedule.name);
      setPrompt(editSchedule.prompt);
      setCron(editSchedule.cron);
      setCwd(editSchedule.cwd ?? '');
      setTimezone(editSchedule.timezone ?? '');
      setPermissionMode(
        editSchedule.permissionMode === 'bypassPermissions' ? 'bypassPermissions' : 'acceptEdits'
      );
      setMaxRuntimeMin(editSchedule.maxRuntime ? editSchedule.maxRuntime / 60_000 : 10);
    } else {
      setName('');
      setPrompt('');
      setCron('');
      setCwd('');
      setTimezone('');
      setPermissionMode('acceptEdits');
      setMaxRuntimeMin(10);
    }
  }, [editSchedule, open]);

  const cronPreview = getCronPreview(cron);
  const isValid = name.trim() && prompt.trim() && cron.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const input = {
      name: name.trim(),
      prompt: prompt.trim(),
      cron: cron.trim(),
      ...(cwd && { cwd }),
      ...(timezone && { timezone }),
      permissionMode,
      maxRuntime: maxRuntimeMin * 60_000,
    };

    if (editSchedule) {
      updateSchedule.mutate(
        { id: editSchedule.id, ...input },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createSchedule.mutate(input, { onSuccess: () => onOpenChange(false) });
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">
          {editSchedule ? 'Edit Schedule' : 'New Schedule'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name *</label>
            <input
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Daily code review"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Prompt *</label>
            <textarea
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Review all pending PRs and summarize findings..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Cron Expression *</label>
            <input
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 9 * * 1-5"
            />
            {cronPreview && (
              <p className="mt-1 text-xs text-muted-foreground">{cronPreview}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Working Directory</label>
            <input
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="~/projects/myapp"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Timezone</label>
            <select
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              <option value="">System default</option>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Max Runtime (minutes)</label>
            <input
              type="number"
              className="w-24 rounded-md border bg-transparent px-3 py-2 text-sm"
              value={maxRuntimeMin}
              onChange={(e) => setMaxRuntimeMin(Number(e.target.value))}
              min={1}
              max={720}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Permission Mode</legend>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="permissionMode"
                  checked={permissionMode === 'acceptEdits'}
                  onChange={() => setPermissionMode('acceptEdits')}
                />
                Allow file edits
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="permissionMode"
                  checked={permissionMode === 'bypassPermissions'}
                  onChange={() => setPermissionMode('bypassPermissions')}
                />
                Full autonomy
              </label>
              {permissionMode === 'bypassPermissions' && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Warning: This allows the agent to execute any tool without approval.
                </p>
              )}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              {editSchedule ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
