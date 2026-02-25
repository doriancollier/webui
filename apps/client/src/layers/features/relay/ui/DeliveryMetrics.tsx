import { useDeliveryMetrics } from '@/layers/entities/relay';

/** Format a number or null to a display string. */
function fmt(n: number | null, suffix = ''): string {
  if (n == null) return '—';
  return n % 1 === 0 ? `${n}${suffix}` : `${n.toFixed(1)}${suffix}`;
}

/** Dashboard showing Relay delivery health metrics. */
export function DeliveryMetricsDashboard() {
  const { data, isLoading, error } = useDeliveryMetrics();

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading metrics...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load metrics.
      </div>
    );
  }

  const dlqDepth = data.deadLetteredCount;
  const hasBudgetRejections =
    data.budgetRejections &&
    Object.values(data.budgetRejections).some((v) => v > 0);

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-medium">Delivery Metrics</h3>

      {/* Message counts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="Total" value={data.totalMessages} />
        <MetricCard
          label="Delivered"
          value={data.deliveredCount}
          variant="success"
        />
        <MetricCard
          label="Failed"
          value={data.failedCount}
          variant={data.failedCount > 0 ? 'danger' : 'default'}
        />
        <MetricCard
          label="Dead Letter"
          value={dlqDepth}
          variant={dlqDepth > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Latency */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Avg Latency" value={fmt(data.avgDeliveryLatencyMs, 'ms')} />
        <MetricCard label="P95 Latency" value={fmt(data.p95DeliveryLatencyMs, 'ms')} />
      </div>

      {/* Endpoints */}
      <div className="text-xs text-muted-foreground">
        Active endpoints: {data.activeEndpoints}
      </div>

      {/* Budget rejections (only shown when non-zero) */}
      {hasBudgetRejections && (
        <div className="rounded border border-border p-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Budget Rejections
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {data.budgetRejections.hopLimit > 0 && (
              <span>Hop limit: {data.budgetRejections.hopLimit}</span>
            )}
            {data.budgetRejections.ttlExpired > 0 && (
              <span>TTL expired: {data.budgetRejections.ttlExpired}</span>
            )}
            {data.budgetRejections.cycleDetected > 0 && (
              <span>Cycle: {data.budgetRejections.cycleDetected}</span>
            )}
            {data.budgetRejections.budgetExhausted > 0 && (
              <span>Exhausted: {data.budgetRejections.budgetExhausted}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type MetricVariant = 'default' | 'success' | 'danger' | 'warning';

interface MetricCardProps {
  label: string;
  value: number | string;
  variant?: MetricVariant;
}

const VALUE_COLORS: Record<MetricVariant, string> = {
  default: 'text-foreground',
  success: 'text-green-600 dark:text-green-400',
  danger: 'text-red-600 dark:text-red-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
};

function MetricCard({ label, value, variant = 'default' }: MetricCardProps) {
  return (
    <div className="rounded border border-border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${VALUE_COLORS[variant]}`}>
        {value}
      </div>
    </div>
  );
}
