import { Inbox } from 'lucide-react';
import { useRelayMessages } from '@/layers/entities/relay';
import { MessageRow } from './MessageRow';

interface ActivityFeedProps {
  enabled: boolean;
}

/** Chronological message list with load-more pagination. */
export function ActivityFeed({ enabled }: ActivityFeedProps) {
  const { data, isLoading } = useRelayMessages(undefined, enabled);
  const messages = data?.messages ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <div className="size-4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Inbox className="size-8 text-muted-foreground/30" />
        <div>
          <p className="font-medium">No messages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages sent through the Relay bus will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {messages.map((msg, i) => (
        <MessageRow key={(msg as Record<string, unknown>).id as string ?? i} message={msg as Record<string, unknown>} />
      ))}
    </div>
  );
}
