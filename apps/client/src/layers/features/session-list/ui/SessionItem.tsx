import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Copy, Check, ShieldOff, GitFork } from 'lucide-react';
import type { Session } from '@dorkos/shared/types';
import { cn, formatRelativeTime, TIMING } from '@/layers/shared/lib';
import { useSessionChatStore } from '@/layers/entities/session';

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  onFork?: (sessionId: string) => void;
  onRename?: (sessionId: string, title: string) => void;
  isNew?: boolean;
}

/*
 * Border color uses inline style because an unlayered browser-extension stylesheet
 * (`:where(:not(.copilot-view-content *))`) overrides all Tailwind border-color
 * utilities in `@layer utilities`. Explicit RGB values are required for the pulse
 * animation since motion cannot interpolate CSS custom properties.
 */
const BORDER_COLORS = {
  green: 'rgb(34, 197, 94)',
  greenDim: 'rgba(34, 197, 94, 0.15)',
  amber: 'rgb(245, 158, 11)',
  amberDim: 'rgba(245, 158, 11, 0.15)',
  blue: 'var(--color-blue-500)',
  destructive: 'hsl(var(--destructive))',
  primary: 'hsl(var(--primary))',
  transparent: 'transparent',
} as const;

interface BorderState {
  color: string;
  pulse: boolean;
  dimColor?: string;
}

/**
 * Derives a border color and pulse flag from session activity state.
 *
 * Priority: active → pending approval → streaming → error → unseen → idle.
 * Streaming and pending states pulse between full and dim opacity.
 */
function useSessionBorderState(sessionId: string, isActive: boolean): BorderState {
  const status = useSessionChatStore(
    useCallback((s) => s.sessions[sessionId]?.status ?? 'idle', [sessionId])
  );
  const sdkRunning = useSessionChatStore(
    useCallback((s) => s.sessions[sessionId]?.sdkState === 'running', [sessionId])
  );
  const hasUnseenActivity = useSessionChatStore(
    useCallback((s) => s.sessions[sessionId]?.hasUnseenActivity ?? false, [sessionId])
  );
  const hasPendingApproval = useSessionChatStore(
    useCallback(
      (s) =>
        s.sessions[sessionId]?.sdkState === 'requires_action' ||
        (s.sessions[sessionId]?.messages.some((m) =>
          m.toolCalls?.some((tc) => tc.interactiveType && tc.status === 'pending')
        ) ??
          false),
      [sessionId]
    )
  );

  if (isActive) return { color: BORDER_COLORS.primary, pulse: false };
  if (hasPendingApproval)
    return { color: BORDER_COLORS.amber, pulse: true, dimColor: BORDER_COLORS.amberDim };
  if (sdkRunning || status === 'streaming')
    return { color: BORDER_COLORS.green, pulse: true, dimColor: BORDER_COLORS.greenDim };
  if (status === 'error') return { color: BORDER_COLORS.destructive, pulse: false };
  if (hasUnseenActivity) return { color: BORDER_COLORS.blue, pulse: false };
  return { color: BORDER_COLORS.transparent, pulse: false };
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
      } catch {
        // Clipboard API not available
      }
    },
    [text]
  );

  return (
    <button
      onClick={handleCopy}
      className="hover:bg-secondary/80 text-muted-foreground/60 hover:text-muted-foreground rounded p-0.5 transition-colors duration-100 max-md:p-2"
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="size-(--size-icon-xs) text-green-500" />
      ) : (
        <Copy className="size-(--size-icon-xs)" />
      )}
    </button>
  );
}

/** Sidebar row representing a single session with expandable details. */
export function SessionItem({
  session,
  isActive,
  onClick,
  onFork,
  onRename,
  isNew = false,
}: SessionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isSkipMode = session.permissionMode === 'bypassPermissions';

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  const startRename = useCallback(() => {
    setRenameValue(session.title);
    setIsRenaming(true);
  }, [session.title]);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    setIsRenaming(false);
    if (!trimmed || trimmed === session.title) return;
    onRename?.(session.id, trimmed);
  }, [renameValue, session.id, session.title, onRename]);

  const borderState = useSessionBorderState(session.id, isActive);

  function handleExpandToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }

  const needsMotionAnimate = isNew || borderState.pulse;
  const animate = needsMotionAnimate
    ? {
        ...(isNew ? { opacity: 1, y: 0 } : {}),
        ...(borderState.pulse && borderState.dimColor
          ? { borderLeftColor: [borderState.color, borderState.dimColor, borderState.color] }
          : {}),
      }
    : undefined;
  const transition = needsMotionAnimate
    ? {
        ...(isNew
          ? {
              opacity: { duration: 0.2, ease: [0, 0, 0.2, 1] as const },
              y: { duration: 0.2, ease: [0, 0, 0.2, 1] as const },
            }
          : {}),
        ...(borderState.pulse
          ? { borderLeftColor: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const } }
          : {}),
      }
    : undefined;

  return (
    <motion.div
      data-testid="session-item"
      initial={isNew ? { opacity: 0, y: -8 } : undefined}
      animate={animate}
      transition={transition}
      style={borderState.pulse ? undefined : { borderLeftColor: borderState.color }}
      className={cn(
        'group relative rounded-lg border-l-2 transition-colors duration-150',
        isActive && 'text-foreground'
      )}
    >
      {isActive && (
        <motion.div
          layoutId="active-session-bg"
          className="bg-secondary absolute inset-0 rounded-lg"
          transition={{ type: 'spring', stiffness: 280, damping: 32 }}
        />
      )}
      <motion.div
        role="button"
        tabIndex={0}
        onClick={() => {
          onClick();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative z-10 cursor-pointer px-3 py-2"
      >
        {/* Line 1: relative time + activity indicator + permission icon + expand */}
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <span className="min-w-0 flex-1">{formatRelativeTime(session.updatedAt)}</span>
          <span className="flex flex-shrink-0 items-center gap-1">
            {isSkipMode && (
              <ShieldOff
                className="size-(--size-icon-xs) text-red-500"
                aria-label="Permissions skipped"
              />
            )}
            <button
              onClick={handleExpandToggle}
              className={cn(
                'rounded p-0.5 transition-all duration-150 max-md:hidden max-md:p-2',
                expanded
                  ? 'text-muted-foreground opacity-100'
                  : 'text-muted-foreground/60 hover:text-muted-foreground opacity-0 group-hover:opacity-100'
              )}
              aria-label="Session details"
            >
              <motion.div
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <ChevronDown className="size-(--size-icon-sm)" />
              </motion.div>
            </button>
          </span>
        </div>

        {/* Line 2: title (double-click to rename) */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background text-foreground mt-0.5 w-full rounded border px-1 text-xs outline-none"
          />
        ) : onRename ? (
          <div
            className="text-muted-foreground/70 mt-0.5 truncate text-xs"
            role="button"
            tabIndex={-1}
            onDoubleClick={(e) => {
              e.stopPropagation();
              startRename();
            }}
            onKeyDown={(e) => {
              if (e.key === 'F2') startRename();
            }}
            title="Double-click or F2 to rename"
          >
            {session.title}
          </div>
        ) : (
          <div className="text-muted-foreground/70 mt-0.5 truncate text-xs">{session.title}</div>
        )}
      </motion.div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            className="relative z-10 overflow-hidden"
          >
            <div className="text-muted-foreground border-border/30 mx-2 space-y-1.5 border-t px-3 pt-2 pb-2 text-[11px]">
              <DetailRow label="Session ID" value={session.id} copyable />
              <DetailRow label="Created" value={formatTimestamp(session.createdAt)} />
              <DetailRow label="Updated" value={formatTimestamp(session.updatedAt)} />
              <DetailRow label="Permissions" value={isSkipMode ? 'Skip (unsafe)' : 'Default'} />
              {onFork && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFork(session.id);
                  }}
                  className="hover:bg-secondary/80 text-muted-foreground/60 hover:text-muted-foreground mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors duration-100"
                  aria-label="Fork session"
                >
                  <GitFork className="size-(--size-icon-xs)" />
                  <span>Fork</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DetailRow({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground/60 w-16 flex-shrink-0">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono select-all">{value}</span>
      {copyable && <CopyButton text={value} label={label} />}
    </div>
  );
}
