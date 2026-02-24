import { Radio } from 'lucide-react';
import { useRelayEndpoints } from '@/layers/entities/relay';

interface EndpointListProps {
  enabled: boolean;
  onSelectEndpoint?: (subject: string) => void;
}

/** List of registered relay endpoints. */
export function EndpointList({ enabled, onSelectEndpoint }: EndpointListProps) {
  const { data: endpoints = [], isLoading } = useRelayEndpoints(enabled);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (endpoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Radio className="size-8 text-muted-foreground/30" />
        <div>
          <p className="font-medium">No endpoints registered</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Endpoints are registered by the server or via MCP tools.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {endpoints.map((ep) => {
        const endpoint = ep as Record<string, unknown>;
        return (
          <button
            key={endpoint.subject as string}
            type="button"
            onClick={() => onSelectEndpoint?.(endpoint.subject as string)}
            className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <Radio className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-mono text-sm">{endpoint.subject as string}</span>
            </div>
            {endpoint.description != null && (
              <p className="mt-1 pl-6 text-xs text-muted-foreground">
                {String(endpoint.description)}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
