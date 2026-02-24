import { useState } from 'react';
import { Route } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/layers/shared/ui';
import { useRelayEnabled, useRelayEventStream } from '@/layers/entities/relay';
import { ActivityFeed } from './ActivityFeed';
import { EndpointList } from './EndpointList';
import { InboxView } from './InboxView';

/** Main Relay panel — tabs for Activity Feed and Endpoints, with disabled/loading states. */
export function RelayPanel() {
  const relayEnabled = useRelayEnabled();
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

  // Connect SSE stream when relay is enabled
  useRelayEventStream(relayEnabled);

  if (!relayEnabled) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Route className="size-8 text-muted-foreground/50" />
        <div>
          <p className="font-medium">Relay is not enabled</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Relay provides inter-agent messaging. Start DorkOS with relay enabled.
          </p>
        </div>
        <code className="mt-2 rounded-md bg-muted px-3 py-1.5 font-mono text-sm">
          DORKOS_RELAY_ENABLED=true dorkos
        </code>
      </div>
    );
  }

  return (
    <Tabs defaultValue="activity" className="flex h-full flex-col">
      <TabsList className="mx-4 mt-3 shrink-0">
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
      </TabsList>

      <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto">
        <ActivityFeed enabled={relayEnabled} />
      </TabsContent>

      <TabsContent value="endpoints" className="min-h-0 flex-1 overflow-y-auto">
        {selectedEndpoint ? (
          <InboxView subject={selectedEndpoint} onBack={() => setSelectedEndpoint(null)} />
        ) : (
          <EndpointList enabled={relayEnabled} onSelectEndpoint={setSelectedEndpoint} />
        )}
      </TabsContent>
    </Tabs>
  );
}
