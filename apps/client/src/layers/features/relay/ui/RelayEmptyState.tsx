import { Button } from '@/layers/shared/ui';

interface RelayEmptyStateProps {
  onAddAdapter?: () => void;
}

/** Rich empty state for Relay — faded message activity preview with an "Add Adapter" CTA. */
export function RelayEmptyState({ onAddAdapter }: RelayEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16">
      {/* Faded message activity preview */}
      <div className="mb-8 w-full max-w-md select-none opacity-40 pointer-events-none">
        <div className="space-y-2">
          {/* Message row 1 */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="size-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <div className="size-3 rounded-full bg-blue-500" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">relay.agent.frontend</span>
                  <span className="text-xs text-muted-foreground">2m ago</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Build completed successfully
                </p>
              </div>
            </div>
          </div>
          {/* Message row 2 */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="size-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <div className="size-3 rounded-full bg-emerald-500" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">relay.system.pulse.audit</span>
                  <span className="text-xs text-muted-foreground">15m ago</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Scheduled audit run delivered
                </p>
              </div>
            </div>
          </div>
          {/* Message row 3 */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="size-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                <div className="size-3 rounded-full bg-orange-500" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">relay.agent.backend</span>
                  <span className="text-xs text-muted-foreground">1h ago</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  API migration task completed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Text */}
      <h3 className="mb-2 text-lg font-medium">Connect your agents</h3>
      <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
        Relay enables inter-agent messaging. Add an adapter to start routing messages between agents.
      </p>

      {/* CTA */}
      <Button onClick={onAddAdapter}>Add Adapter</Button>
    </div>
  );
}
