import { Gauge } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';
import type { UsageInfo } from '@dorkos/shared/types';

interface UsageItemProps {
  usageInfo: UsageInfo;
}

/** Format a rate limit type into a human-readable label. */
function formatLimitType(type?: string): string {
  if (!type) return 'Rate limit';
  switch (type) {
    case 'five_hour':
      return '5-hour window';
    case 'seven_day':
      return '7-day window';
    case 'seven_day_opus':
      return '7-day Opus';
    case 'seven_day_sonnet':
      return '7-day Sonnet';
    case 'overage':
      return 'Overage';
    default:
      return type;
  }
}

/** Status bar item displaying subscription utilization. */
export function UsageItem({ usageInfo }: UsageItemProps) {
  const pct = usageInfo.utilization != null ? Math.round(usageInfo.utilization * 100) : null;
  const isWarning = usageInfo.status === 'allowed_warning';
  const isRejected = usageInfo.status === 'rejected';

  const colorClass = isRejected
    ? 'text-red-500'
    : isWarning
      ? 'text-amber-500'
      : pct != null && pct >= 80
        ? 'text-amber-500'
        : '';

  const resetsAtLabel = usageInfo.resetsAt
    ? new Date(usageInfo.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('inline-flex cursor-default items-center gap-1', colorClass)}
          aria-label="Subscription usage"
        >
          <Gauge className="size-(--size-icon-xs)" />
          {pct != null && <span>{pct}%</span>}
          {pct == null && isRejected && <span>Limit</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        <div className="space-y-1">
          <div className="text-xs font-medium">Subscription Usage</div>
          <div className="space-y-0.5 text-[10px]">
            {pct != null && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Utilization</span>
                <span>{pct}%</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Window</span>
              <span>{formatLimitType(usageInfo.rateLimitType)}</span>
            </div>
            {resetsAtLabel && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Resets at</span>
                <span>{resetsAtLabel}</span>
              </div>
            )}
            {usageInfo.isUsingOverage && (
              <div className="text-amber-500">Using overage capacity</div>
            )}
            {isRejected && <div className="text-red-500">Rate limit reached</div>}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
