import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, ChevronDown } from 'lucide-react';
import { cn } from '@/layers/shared/lib';

interface ThinkingBlockProps {
  text: string;
  isStreaming: boolean;
  elapsedMs?: number;
}

/** Format thinking duration to a human-readable string. */
function formatThinkingDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Progressive disclosure collapsible block for Claude's extended thinking.
 *
 * Four visual states: streaming (open with breathing label), collapsing
 * (animated height transition), collapsed (chip with duration), expanded
 * (full content with max-height scroll cap).
 */
export function ThinkingBlock({ text, isStreaming, elapsedMs }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(isStreaming);
  const wasStreamingRef = useRef(isStreaming);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-collapse when streaming completes
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      setExpanded(false); // eslint-disable-line react-hooks/set-state-in-effect -- Intentional: collapse once on streaming→done transition
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Auto-scroll to bottom of content during streaming
  useEffect(() => {
    if (isStreaming && expanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [text, isStreaming, expanded]);

  const durationLabel = elapsedMs
    ? `Thought for ${formatThinkingDuration(elapsedMs)}`
    : 'Thinking...';

  return (
    <div
      className="bg-muted/50 mt-px rounded-msg-tool border-l-2 border-muted-foreground/20 text-sm first:mt-1"
      data-testid="thinking-block"
      data-streaming={isStreaming || undefined}
    >
      <button
        onClick={() => !isStreaming && setExpanded(!expanded)}
        disabled={isStreaming}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1',
          isStreaming && 'cursor-default'
        )}
        aria-expanded={expanded}
        aria-label={durationLabel}
      >
        <Brain
          className={cn(
            'size-(--size-icon-xs) text-muted-foreground',
            isStreaming && 'animate-pulse'
          )}
        />
        <span
          className={cn(
            'text-3xs font-mono text-muted-foreground',
            isStreaming && 'animate-pulse'
          )}
        >
          {durationLabel}
        </span>
        {!isStreaming && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="ml-auto"
          >
            <ChevronDown className="size-(--size-icon-xs) text-muted-foreground" />
          </motion.div>
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="max-h-64 overflow-y-auto border-t px-3 pt-1 pb-3"
            >
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {text}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
