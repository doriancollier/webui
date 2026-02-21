import { cn } from '@/layers/shared/lib';

const PRESETS = [
  { label: '5m', cron: '*/5 * * * *' },
  { label: '15m', cron: '*/15 * * * *' },
  { label: '1h', cron: '0 * * * *' },
  { label: '6h', cron: '0 */6 * * *' },
  { label: 'Daily', cron: '0 0 * * *' },
  { label: '9am', cron: '0 9 * * *' },
  { label: 'Weekdays', cron: '0 9 * * 1-5' },
  { label: 'Weekly', cron: '0 9 * * 1' },
  { label: 'Monthly', cron: '0 9 1 * *' },
] as const;

interface CronPresetsProps {
  value: string;
  onChange: (cron: string) => void;
}

/** Preset pill buttons for common cron expressions. */
export function CronPresets({ value, onChange }: CronPresetsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((preset) => (
        <button
          key={preset.cron}
          type="button"
          className={cn(
            'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
            value === preset.cron
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input hover:bg-accent hover:text-accent-foreground'
          )}
          onClick={() => onChange(preset.cron)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
