import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';
import { ActorBadge } from '@/layers/entities/activity';
import type { ActivityItem } from '@/layers/entities/activity';

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

/**
 * Format a row timestamp according to the spec:
 * - Today → "h:mm a" (e.g., "2:14 AM")
 * - Yesterday → "Yesterday 2:14 AM"
 * - This week (Mon–Sat) → "Monday 2:14 AM"
 * - Older → "Mar 25"
 *
 * @param iso - ISO 8601 timestamp string.
 * @param now - Reference date (injectable for testing).
 */
export function formatActivityTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  // Start of the current week (Sunday = 0)
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (date >= startOfToday) {
    return timeStr;
  }
  if (date >= startOfYesterday) {
    return `Yesterday ${timeStr}`;
  }
  if (date >= startOfWeek) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dayName} ${timeStr}`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// ActivityRow
// ---------------------------------------------------------------------------

export interface ActivityRowProps {
  /** The activity event to render. */
  item: ActivityItem;
  className?: string;
}

/**
 * Single compact activity row.
 *
 * Layout: [time] [ActorBadge] [summary] [link button]
 *
 * Time format follows the spec: today=h:mm a, yesterday=Yesterday h:mm a,
 * this week=Weekday h:mm a, older=Mon DD.
 */
export function ActivityRow({ item, className }: ActivityRowProps) {
  const navigate = useNavigate();
  const time = formatActivityTime(item.occurredAt);

  return (
    <div
      role="button"
      data-slot="activity-row"
      data-activity-row
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && item.linkPath) {
          navigate({ to: item.linkPath as '/', replace: false });
        }
      }}
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 transition-colors',
        'hover:bg-accent/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        className
      )}
    >
      {/* Time */}
      <span className="text-muted-foreground w-28 shrink-0 text-xs tabular-nums">{time}</span>

      {/* Actor badge */}
      <span className="w-24 shrink-0">
        <ActorBadge actorType={item.actorType} actorLabel={item.actorLabel} />
      </span>

      {/* Summary */}
      <span className="text-foreground/80 min-w-0 flex-1 truncate text-sm">{item.summary}</span>

      {/* Link button */}
      {item.linkPath && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2 text-xs"
          onClick={() => navigate({ to: item.linkPath as '/', replace: false })}
        >
          Open →
        </Button>
      )}
    </div>
  );
}
