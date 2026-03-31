import { useNavigate } from '@tanstack/react-router';
import { Button, TableRow, TableCell } from '@/layers/shared/ui';
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
 * Single compact activity row rendered as a table row.
 *
 * Layout: [time] [ActorBadge] [summary] [link button]
 *
 * Must be rendered inside a `<Table><TableBody>` context. Supports keyboard
 * navigation via `data-activity-row` and roving tabindex.
 */
export function ActivityRow({ item, className }: ActivityRowProps) {
  const navigate = useNavigate();
  const time = formatActivityTime(item.occurredAt);

  return (
    <TableRow
      data-slot="activity-row"
      data-activity-row
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && item.linkPath) {
          navigate({ to: item.linkPath as '/', replace: false });
        }
      }}
      className={cn(
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        className
      )}
    >
      {/* Time — hidden on mobile (redundant with group headers) */}
      <TableCell className="w-28 py-1.5 pr-0 pl-2 max-sm:hidden">
        <span className="text-muted-foreground text-xs tabular-nums">{time}</span>
      </TableCell>

      {/* Actor badge — hidden on mobile */}
      <TableCell className="w-24 py-1.5 pr-0 max-sm:hidden">
        <ActorBadge actorType={item.actorType} actorLabel={item.actorLabel} />
      </TableCell>

      {/* Summary — on mobile, shows actor label inline */}
      <TableCell className="max-w-0 py-1.5 max-sm:pl-2">
        <span className="text-foreground/80 block truncate text-sm">
          <span className="text-muted-foreground mr-1 text-xs font-medium sm:hidden">
            {item.actorLabel}
          </span>
          {item.summary}
        </span>
      </TableCell>

      {/* Link button */}
      <TableCell className="w-16 py-1.5 pr-2 text-right max-sm:w-10">
        {item.linkPath && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 min-h-[44px] px-2 text-xs sm:min-h-0"
            onClick={() => navigate({ to: item.linkPath as '/', replace: false })}
          >
            Open →
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
