import { ArrowUpRight } from 'lucide-react';
import { Badge, Button, Skeleton } from '@/layers/shared/ui';
import { RelativeTime } from '@/layers/features/relay';

interface SubsystemRowProps {
  label: string;
  enabled: boolean;
  summary?: string;
  status?: { state: string; lastSeenAt?: string | null };
  loading?: boolean;
  action?: { label: string; onClick: () => void };
}

/** Shared subsystem section row showing label, status badge, optional summary, and deep-link action. */
export function SubsystemRow({
  label,
  enabled,
  summary,
  status,
  loading,
  action,
}: SubsystemRowProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{label}</h3>
          <Badge variant={enabled ? 'default' : 'secondary'} className="text-xs">
            {enabled ? (status?.state ?? 'Enabled') : 'Disabled'}
          </Badge>
        </div>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 gap-1 text-xs"
            onClick={action.onClick}
          >
            {action.label}
            <ArrowUpRight className="size-3" />
          </Button>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-4 w-48" />
      ) : summary ? (
        <p className="text-muted-foreground text-sm">{summary}</p>
      ) : status?.lastSeenAt ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Last seen</span>
          <RelativeTime dateStr={status.lastSeenAt} />
        </div>
      ) : null}
    </section>
  );
}
