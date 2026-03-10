import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ChatMessage } from '../../model/use-chat-session';
import { cn } from '@/layers/shared/lib';

/**
 * Renders user message content based on messageType.
 * Handles three sub-types: plain text, command (monospace), and compaction (expandable).
 */
export function UserMessageContent({ message }: { message: ChatMessage }) {
  const [compactionExpanded, setCompactionExpanded] = useState(false);

  if (message.messageType === 'command') {
    return (
      <div className="text-muted-foreground truncate font-mono text-sm">{message.content}</div>
    );
  }

  if (message.messageType === 'compaction') {
    return (
      <div className="w-full">
        <button
          onClick={() => setCompactionExpanded(!compactionExpanded)}
          className="text-muted-foreground/60 hover:text-muted-foreground flex w-full items-center gap-2 text-xs transition-colors"
        >
          <div className="bg-border/40 h-px flex-1" />
          <ChevronRight
            className={cn('size-3 transition-transform duration-200', compactionExpanded && 'rotate-90')}
          />
          <span>Context compacted</span>
          <div className="bg-border/40 h-px flex-1" />
        </button>
        {compactionExpanded && (
          <div className="text-muted-foreground/60 mt-2 text-xs whitespace-pre-wrap">
            {message.content}
          </div>
        )}
      </div>
    );
  }

  return <div className="break-words whitespace-pre-wrap">{message.content}</div>;
}
