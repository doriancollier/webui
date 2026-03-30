import { useEffect, useRef } from 'react';
import { hashToEmoji } from '@/layers/shared/lib';

interface UseDocumentTitleOptions {
  cwd: string | null;
  activeForm: string | null;
  isStreaming: boolean;
  isWaitingForUser: boolean;
  /** Agent name override — when provided, replaces directory name in the title */
  agentName?: string;
  /** Agent emoji override — when provided, replaces CWD-hashed emoji */
  agentEmoji?: string;
  /** Tasks badge count — shown as (N) prefix when tab is hidden */
  tasksBadgeCount?: number;
}

const MAX_ACTIVE_FORM_LENGTH = 40;

interface BuildTitleOpts {
  cwd: string;
  activeForm: string | null;
  prefix: string;
  agentName?: string;
  agentEmoji?: string;
  tasksBadgeCount?: number;
  isTabHidden?: boolean;
}

function buildTitle({
  cwd,
  activeForm,
  prefix,
  agentName,
  agentEmoji,
  tasksBadgeCount,
  isTabHidden,
}: BuildTitleOpts): string {
  const badgePrefix =
    isTabHidden && tasksBadgeCount && tasksBadgeCount > 0 ? `(${tasksBadgeCount}) ` : '';
  const emoji = agentEmoji ?? hashToEmoji(cwd);
  const label = agentName ?? cwd.split('/').filter(Boolean).pop() ?? cwd;
  let title = `${badgePrefix}${prefix}${emoji} ${label}`;
  if (activeForm) {
    const truncated =
      activeForm.length > MAX_ACTIVE_FORM_LENGTH
        ? activeForm.slice(0, MAX_ACTIVE_FORM_LENGTH) + '\u2026'
        : activeForm;
    title += ` \u2014 ${truncated}`;
  }
  title += ' \u2014 DorkOS';
  return title;
}

/** Manage the browser document title with status prefixes, badge counts, and visibility tracking. */
export function useDocumentTitle({
  cwd,
  activeForm,
  isStreaming,
  isWaitingForUser,
  agentName,
  agentEmoji,
  tasksBadgeCount,
}: UseDocumentTitleOptions) {
  const isTabHiddenRef = useRef(document.hidden);
  const hasUnseenResponseRef = useRef(false);
  const wasStreamingRef = useRef(isStreaming);

  // Single ref to keep visibility handler in sync with latest prop values
  const optionsRef = useRef({
    cwd,
    activeForm,
    isWaitingForUser,
    agentName,
    agentEmoji,
    tasksBadgeCount,
  });
  useEffect(() => {
    optionsRef.current = {
      cwd,
      activeForm,
      isWaitingForUser,
      agentName,
      agentEmoji,
      tasksBadgeCount,
    };
  }, [cwd, activeForm, isWaitingForUser, agentName, agentEmoji, tasksBadgeCount]);

  // Track tab visibility and rebuild title on return (clears 🏁 and badge)
  useEffect(() => {
    const handler = () => {
      isTabHiddenRef.current = document.hidden;
      if (!document.hidden) {
        const opts = optionsRef.current;
        // Rebuild when returning from hidden: clears (N) badge and/or 🏁 prefix
        const hadUnseenResponse = hasUnseenResponseRef.current;
        const hadBadge = (opts.tasksBadgeCount ?? 0) > 0;
        if (hadUnseenResponse || hadBadge) {
          hasUnseenResponseRef.current = false;
          if (opts.cwd) {
            const prefix = opts.isWaitingForUser ? '🔔 ' : '';
            document.title = buildTitle({
              cwd: opts.cwd,
              activeForm: opts.activeForm,
              prefix,
              agentName: opts.agentName,
              agentEmoji: opts.agentEmoji,
              tasksBadgeCount: opts.tasksBadgeCount,
              isTabHidden: false,
            });
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Detect streaming→idle transition while tab is hidden
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && isTabHiddenRef.current) {
      hasUnseenResponseRef.current = true;
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Build title (runs on all relevant state changes)
  useEffect(() => {
    if (!cwd) {
      document.title = 'DorkOS';
      return;
    }

    // Compute prefix (priority: 🔔 > 🏁 > none)
    let prefix = '';
    if (isWaitingForUser) {
      prefix = '🔔 ';
    } else if (hasUnseenResponseRef.current) {
      prefix = '🏁 ';
    }

    document.title = buildTitle({
      cwd,
      activeForm,
      prefix,
      agentName,
      agentEmoji,
      tasksBadgeCount,
      isTabHidden: isTabHiddenRef.current,
    });
  }, [cwd, activeForm, isStreaming, isWaitingForUser, agentName, agentEmoji, tasksBadgeCount]);
}
