import { Button } from '@/layers/shared/ui';

interface ChatEmptyStateProps {
  onNewSession?: () => void;
}

/** Welcome empty state for the chat area when no session is selected. */
export function ChatEmptyState({ onNewSession }: ChatEmptyStateProps) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-6">
      {/* Wordmark */}
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">DorkOS</h1>
      <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground">
        Your OS-layer for AI agents. Start a conversation to explore, build, and automate with Claude
        Code.
      </p>

      {/* CTA */}
      <Button size="lg" onClick={onNewSession}>
        New Session
      </Button>
    </div>
  );
}
