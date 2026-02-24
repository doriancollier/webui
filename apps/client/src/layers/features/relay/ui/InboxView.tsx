import { ArrowLeft, Inbox } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/layers/shared/model';
import { MessageRow } from './MessageRow';

interface InboxViewProps {
  subject: string;
  onBack: () => void;
}

/** Inbox messages for a selected endpoint, reusing MessageRow. */
export function InboxView({ subject, onBack }: InboxViewProps) {
  const transport = useTransport();
  const { data, isLoading } = useQuery({
    queryKey: ['relay', 'inbox', subject],
    queryFn: () => transport.readRelayInbox(subject),
  });
  const messages = data?.messages ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 border-b p-3">
        <button type="button" onClick={onBack} className="rounded p-1 hover:bg-muted">
          <ArrowLeft className="size-4" />
        </button>
        <span className="font-mono text-sm">{subject}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <div className="size-4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <Inbox className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No messages in this inbox.</p>
        </div>
      ) : (
        <div className="space-y-2 p-4">
          {messages.map((msg, i) => (
            <MessageRow key={(msg as Record<string, unknown>).id as string ?? i} message={msg as Record<string, unknown>} />
          ))}
        </div>
      )}
    </div>
  );
}
