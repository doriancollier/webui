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
}

function buildTitle(
  cwd: string,
  activeForm: string | null,
  prefix: string,
  agentName?: string,
  agentEmoji?: string
): string {
  const emoji = agentEmoji ?? hashToEmoji(cwd);
  const label = agentName ?? (cwd.split('/').filter(Boolean).pop() ?? cwd);
  let title = `${prefix}${emoji} ${label}`;
  if (activeForm) {
    const truncated = activeForm.length > 40 ? activeForm.slice(0, 40) + '\u2026' : activeForm;
    title += ` \u2014 ${truncated}`;
  }
  title += ' \u2014 DorkOS';
  return title;
}

export function useDocumentTitle({
  cwd,
  activeForm,
  isStreaming,
  isWaitingForUser,
  agentName,
  agentEmoji,
}: UseDocumentTitleOptions) {
  const isTabHiddenRef = useRef(document.hidden);
  const hasUnseenResponseRef = useRef(false);
  const wasStreamingRef = useRef(isStreaming);

  // Refs to keep visibility handler in sync with latest prop values
  const cwdRef = useRef(cwd);
  const activeFormRef = useRef(activeForm);
  const isWaitingForUserRef = useRef(isWaitingForUser);
  const agentNameRef = useRef(agentName);
  const agentEmojiRef = useRef(agentEmoji);
  useEffect(() => {
    cwdRef.current = cwd;
    activeFormRef.current = activeForm;
    isWaitingForUserRef.current = isWaitingForUser;
    agentNameRef.current = agentName;
    agentEmojiRef.current = agentEmoji;
  }, [cwd, activeForm, isWaitingForUser, agentName, agentEmoji]);

  // Track tab visibility and clear 🏁 on return
  useEffect(() => {
    const handler = () => {
      isTabHiddenRef.current = document.hidden;
      if (!document.hidden && hasUnseenResponseRef.current) {
        hasUnseenResponseRef.current = false;
        // Rebuild title — preserve 🔔 if still waiting
        if (cwdRef.current) {
          const prefix = isWaitingForUserRef.current ? '🔔 ' : '';
          document.title = buildTitle(
            cwdRef.current,
            activeFormRef.current,
            prefix,
            agentNameRef.current,
            agentEmojiRef.current
          );
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

    document.title = buildTitle(cwd, activeForm, prefix, agentName, agentEmoji);
  }, [cwd, activeForm, isStreaming, isWaitingForUser, agentName, agentEmoji]);
}
