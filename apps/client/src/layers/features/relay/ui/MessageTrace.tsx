import { useMessageTrace } from '@/layers/entities/relay';
import type { TraceSpan } from '@dorkos/shared/relay-schemas';

interface MessageTraceProps {
  messageId: string;
  onClose?: () => void;
}

/** Status color mapping for timeline dots. */
function statusColor(status: TraceSpan['status']): string {
  switch (status) {
    case 'delivered':
    case 'processed':
      return 'bg-green-500';
    case 'failed':
      return 'bg-red-500';
    case 'pending':
      return 'bg-yellow-500';
    case 'dead_lettered':
      return 'bg-gray-500';
    default:
      return 'bg-gray-400';
  }
}

/** Format millisecond timestamp to readable time. */
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

/** Calculate latency between two timestamps. */
function latencyLabel(from: number | null, to: number | null): string | null {
  if (from == null || to == null) return null;
  const delta = to - from;
  return delta < 1000 ? `${delta}ms` : `${(delta / 1000).toFixed(1)}s`;
}

/** Vertical timeline showing the delivery path of a single Relay message. */
export function MessageTrace({ messageId, onClose }: MessageTraceProps) {
  const { data, isLoading, error } = useMessageTrace(messageId);

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading trace...</div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-sm text-destructive">Failed to load trace.</div>
    );
  }

  const { traceId, spans } = data;

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">
          Trace: {traceId.slice(0, 8)}...
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        )}
      </div>

      <div className="relative ml-3 border-l border-border pl-6">
        {spans.map((span) => {
          const deliveryLatency = latencyLabel(span.sentAt, span.deliveredAt);
          const processingLatency = latencyLabel(
            span.deliveredAt,
            span.processedAt,
          );

          return (
            <div key={span.spanId} className="relative pb-4 last:pb-0">
              {/* Timeline dot */}
              <div
                className={`absolute -left-[calc(1.5rem+0.3125rem)] top-1 h-2.5 w-2.5 rounded-full ${statusColor(span.status)}`}
              />

              {/* Span content */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{span.subject}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {span.status}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  {span.fromEndpoint} → {span.toEndpoint}
                </div>

                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>Sent: {formatTime(span.sentAt)}</span>
                  {deliveryLatency && (
                    <span>Delivery: {deliveryLatency}</span>
                  )}
                  {processingLatency && (
                    <span>Processing: {processingLatency}</span>
                  )}
                </div>

                {span.budgetHopsUsed != null && (
                  <div className="text-xs text-muted-foreground">
                    Hops: {span.budgetHopsUsed}
                    {span.budgetTtlRemainingMs != null && (
                      <> · TTL remaining: {span.budgetTtlRemainingMs}ms</>
                    )}
                  </div>
                )}

                {span.error && (
                  <div className="mt-1 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                    {span.error}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
