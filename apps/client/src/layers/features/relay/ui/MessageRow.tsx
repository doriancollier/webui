import { useState } from 'react';
import { Clock, Check, AlertTriangle, MailX } from 'lucide-react';
import { Badge } from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';

interface MessageRowProps {
  message: Record<string, unknown>;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; className: string; label: string }> = {
  new: { icon: Clock, className: 'text-muted-foreground', label: 'New' },
  cur: { icon: Check, className: 'text-muted-foreground', label: 'Delivered' },
  failed: { icon: AlertTriangle, className: 'text-destructive', label: 'Failed' },
  dead_letter: { icon: MailX, className: 'text-amber-500', label: 'Dead Letter' },
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Compact/expanded message card with status indicators. */
export function MessageRow({ message }: MessageRowProps) {
  const [expanded, setExpanded] = useState(false);
  const status = (message.status as string) ?? 'new';
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
  const StatusIcon = config.icon;

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
        expanded && 'bg-muted/30',
      )}
    >
      <div className="flex items-center gap-2">
        <StatusIcon className={cn('size-4 shrink-0', config.className)} />
        <span className="min-w-0 flex-1 truncate font-mono text-sm">
          {message.subject as string}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {message.from as string}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {message.createdAt ? formatTimeAgo(message.createdAt as string) : ''}
        </span>
        <Badge variant="outline" className="shrink-0 text-xs">
          {config.label}
        </Badge>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Payload</span>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-xs">
              {String(JSON.stringify(message.payload, null, 2))}
            </pre>
          </div>
          {message.budget != null && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Budget</span>
              <pre className="mt-1 rounded bg-muted p-2 font-mono text-xs">
                {String(JSON.stringify(message.budget, null, 2))}
              </pre>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
