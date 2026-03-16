import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Check, X, ChevronDown } from 'lucide-react';
import type { ToolCallState, HookState } from '../model/use-chat-session';
import { getToolLabel, ToolArgumentsDisplay, cn } from '@/layers/shared/lib';
import { toolStatus } from './message/message-variants';

/** Maximum characters to render before truncation (5KB). */
const TRUNCATE_THRESHOLD = 5120;

interface TruncatedOutputProps {
  /** Text content to display, truncated if over threshold. */
  content: string;
  /** Maximum characters before truncation. Defaults to TRUNCATE_THRESHOLD. */
  threshold?: number;
  /** Additional className for the wrapper div. */
  className?: string;
}

/** Renders text content with character-based truncation and a one-way expand button. */
function TruncatedOutput({ content, threshold = TRUNCATE_THRESHOLD, className }: TruncatedOutputProps) {
  const [showFull, setShowFull] = useState(false);
  const isTruncated = content.length > threshold;
  const displayContent = isTruncated && !showFull ? content.slice(0, threshold) : content;

  return (
    <div className={cn('mt-2 border-t pt-2', className)}>
      <pre className="max-h-48 overflow-y-auto text-xs whitespace-pre-wrap">{displayContent}</pre>
      {isTruncated && !showFull && (
        <button
          onClick={() => setShowFull(true)}
          className="text-muted-foreground hover:text-foreground mt-1 text-xs underline"
        >
          Show full output ({(content.length / 1024).toFixed(1)}KB)
        </button>
      )}
    </div>
  );
}

interface HookRowProps {
  /** Single hook execution to display as a compact sub-row. */
  hook: HookState;
}

/** Status icon map for hook execution states. */
const hookStatusIcon = {
  running: <Loader2 className="size-(--size-icon-xs) animate-spin text-muted-foreground" />,
  success: <Check className="size-(--size-icon-xs) text-muted-foreground" />,
  error: <X className="size-(--size-icon-xs) text-destructive" />,
  cancelled: <X className="size-(--size-icon-xs) text-muted-foreground" />,
} satisfies Record<HookState['status'], React.ReactNode>;

/**
 * Compact sub-row for a single hook execution inside a tool call card.
 * Clickable to expand/collapse output. Error hooks start expanded.
 */
function HookRow({ hook }: HookRowProps) {
  const hasOutput = !!(hook.stdout || hook.stderr);
  const [expanded, setExpanded] = useState(hook.status === 'error');
  const output = hook.stderr || hook.stdout;

  return (
    <div>
      <button
        onClick={() => hasOutput && setExpanded((e) => !e)}
        className={cn(
          'flex w-full items-center gap-1.5 py-0.5',
          !hasOutput && 'cursor-default',
        )}
        aria-expanded={hasOutput ? expanded : undefined}
        disabled={!hasOutput}
      >
        {hookStatusIcon[hook.status]}
        <span className={cn('text-3xs font-mono', hook.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
          {hook.hookName}
        </span>
        {hook.status === 'error' && (
          <span className="text-3xs text-destructive">failed</span>
        )}
        {hook.exitCode !== undefined && (
          <span className="text-3xs text-muted-foreground ml-auto">exit {hook.exitCode}</span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && hasOutput && output && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <pre className="text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap py-1 text-xs">
              {output}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ToolCallCardProps {
  toolCall: ToolCallState;
  defaultExpanded?: boolean;
}

/** Expandable card displaying a tool call's status, arguments, and result. */
export function ToolCallCard({ toolCall, defaultExpanded = false }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasProgress = !!toolCall.progressOutput;

  useEffect(() => {
    if (hasProgress && !expanded) {
      setExpanded(true); // eslint-disable-line react-hooks/set-state-in-effect -- Intentional: auto-expand once when progress first arrives
    }
  }, [hasProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusIcon = {
    pending: (
      <Loader2 className={cn('size-(--size-icon-xs) animate-spin', toolStatus({ status: 'pending' }))} />
    ),
    running: (
      <Loader2 className={cn('size-(--size-icon-xs) animate-spin', toolStatus({ status: 'running' }))} />
    ),
    complete: <Check className={cn('size-(--size-icon-xs)', toolStatus({ status: 'complete' }))} />,
    error: <X className={cn('size-(--size-icon-xs)', toolStatus({ status: 'error' }))} />,
  }[toolCall.status];

  return (
    <div
      className="bg-muted/50 hover:border-border mt-px rounded-msg-tool border text-sm shadow-msg-tool transition-all duration-150 first:mt-1 hover:shadow-msg-tool-hover"
      data-testid="tool-call-card"
      data-tool-name={toolCall.toolName}
      data-status={toolCall.status}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1"
        aria-expanded={expanded}
      >
        {statusIcon}
        <span className="text-3xs font-mono">
          {getToolLabel(toolCall.toolName, toolCall.input)}
        </span>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="ml-auto"
        >
          <ChevronDown className="size-(--size-icon-xs)" />
        </motion.div>
      </button>
      {toolCall.hooks && toolCall.hooks.length > 0 && (
        <div className="border-t border-border/50 px-3 py-1 space-y-0.5">
          {toolCall.hooks.map((hook) => (
            <HookRow key={hook.hookId} hook={hook} />
          ))}
        </div>
      )}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t px-3 pt-1 pb-3">
              {toolCall.input && (
                <ToolArgumentsDisplay toolName={toolCall.toolName} input={toolCall.input} />
              )}
              {toolCall.progressOutput && !toolCall.result && (
                <TruncatedOutput content={toolCall.progressOutput} />
              )}
              {toolCall.result && <TruncatedOutput content={toolCall.result} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
