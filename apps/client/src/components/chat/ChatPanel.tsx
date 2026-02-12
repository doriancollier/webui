import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowDown } from 'lucide-react';
import { useChatSession } from '../../hooks/use-chat-session';
import { useCommands } from '../../hooks/use-commands';
import { useTaskState } from '../../hooks/use-task-state';
import { useSessionId } from '../../hooks/use-session-id';
import { useSessionStatus } from '../../hooks/use-session-status';
import { MessageList } from './MessageList';
import type { MessageListHandle, ScrollState } from './MessageList';
import { ChatInput } from './ChatInput';
import { TaskListPanel } from './TaskListPanel';
import { CommandPalette } from '../commands/CommandPalette';
import { StatusLine } from '../status/StatusLine';
import type { CommandEntry } from '@lifeos/shared/types';

interface ChatPanelProps {
  sessionId: string;
  /** Optional transform applied to message content before sending to server */
  transformContent?: (content: string) => string | Promise<string>;
}

export function ChatPanel({ sessionId, transformContent }: ChatPanelProps) {
  const [, setSessionId] = useSessionId();
  const messageListRef = useRef<MessageListHandle>(null);
  const taskState = useTaskState(sessionId);
  const { messages, input, setInput, handleSubmit, status, error, stop, isLoadingHistory, sessionStatus, streamStartTime, estimatedTokens } =
    useChatSession(sessionId, {
      transformContent,
      onTaskEvent: taskState.handleTaskEvent,
      onSessionIdChange: setSessionId,
    });
  const { permissionMode } = useSessionStatus(sessionId, sessionStatus, status === 'streaming');
  const [showCommands, setShowCommands] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Scroll overlay state (Tasks #7, #8, #9)
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMessageCountRef = useRef(messages.length);

  const handleScrollStateChange = useCallback((state: ScrollState) => {
    setIsAtBottom(state.isAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    messageListRef.current?.scrollToBottom();
    setIsAtBottom(true);
    setHasNewMessages(false);
  }, []);

  // Detect new messages arriving when user is scrolled up
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (messages.length > prevCount && !isAtBottom) {
      setHasNewMessages(true);
    }
  }, [messages.length, isAtBottom]);

  // Reset hasNewMessages when user scrolls to bottom
  useEffect(() => {
    if (isAtBottom) {
      setHasNewMessages(false);
    }
  }, [isAtBottom]);

  const { data: registry } = useCommands();
  const allCommands = registry?.commands ?? [];

  const filteredCommands = useMemo(() => {
    if (!commandQuery) return allCommands;
    const q = commandQuery.toLowerCase();
    return allCommands.filter((cmd) => {
      const searchText = `${cmd.fullCommand} ${cmd.description}`.toLowerCase();
      return searchText.includes(q);
    });
  }, [allCommands, commandQuery]);

  // Reset selectedIndex when filter changes or palette opens/closes
  useEffect(() => {
    setSelectedIndex(0);
  }, [commandQuery, showCommands]);

  // Clamp selectedIndex when filteredCommands shrinks
  useEffect(() => {
    if (filteredCommands.length > 0 && selectedIndex >= filteredCommands.length) {
      setSelectedIndex(filteredCommands.length - 1);
    }
  }, [filteredCommands.length, selectedIndex]);

  function handleInputChange(value: string) {
    setInput(value);
    // Detect slash command trigger
    const match = value.match(/(^|\s)\/(\w*)$/);
    if (match) {
      setShowCommands(true);
      setCommandQuery(match[2]);
    } else {
      setShowCommands(false);
    }
  }

  function handleCommandSelect(cmd: CommandEntry) {
    setInput(cmd.fullCommand + ' ');
    setShowCommands(false);
  }

  const handleArrowDown = useCallback(() => {
    setSelectedIndex((prev) =>
      filteredCommands.length === 0 ? 0 : (prev + 1) % filteredCommands.length
    );
  }, [filteredCommands.length]);

  const handleArrowUp = useCallback(() => {
    setSelectedIndex((prev) =>
      filteredCommands.length === 0
        ? 0
        : (prev - 1 + filteredCommands.length) % filteredCommands.length
    );
  }, [filteredCommands.length]);

  const handleKeyboardCommandSelect = useCallback(() => {
    if (filteredCommands.length > 0 && selectedIndex < filteredCommands.length) {
      handleCommandSelect(filteredCommands[selectedIndex]);
    } else {
      setShowCommands(false);
    }
  }, [filteredCommands, selectedIndex]);

  const activeDescendantId =
    showCommands && filteredCommands.length > 0
      ? `command-item-${selectedIndex}`
      : undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1 min-h-0">
        {isLoadingHistory ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground" style={{ animation: 'typing-dot 1.4s ease-in-out infinite', animationDelay: '0s' }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground" style={{ animation: 'typing-dot 1.4s ease-in-out infinite', animationDelay: '0.2s' }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground" style={{ animation: 'typing-dot 1.4s ease-in-out infinite', animationDelay: '0.4s' }} />
              </div>
              Loading conversation...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground text-base">Start a conversation</p>
              <p className="text-muted-foreground/60 text-sm mt-2">Type a message below to begin</p>
            </div>
          </div>
        ) : (
          <MessageList
            ref={messageListRef}
            messages={messages}
            sessionId={sessionId}
            status={status}
            onScrollStateChange={handleScrollStateChange}
            streamStartTime={streamStartTime}
            estimatedTokens={estimatedTokens}
            permissionMode={permissionMode}
          />
        )}

        {/* "New messages" pill — centered above scroll button */}
        <AnimatePresence>
          {hasNewMessages && !isAtBottom && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              onClick={scrollToBottom}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 rounded-full bg-foreground text-background text-xs font-medium px-3 py-1.5 shadow-sm cursor-pointer hover:bg-foreground/90 transition-colors"
              role="status"
              aria-live="polite"
            >
              New messages
            </motion.button>
          )}
        </AnimatePresence>

        {/* Scroll-to-bottom button — right-aligned, fixed above input */}
        <AnimatePresence>
          {!isAtBottom && messages.length > 0 && !isLoadingHistory && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 rounded-full bg-background border shadow-sm p-2 hover:shadow-md transition-shadow"
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="size-(--size-icon-md)" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <TaskListPanel
        tasks={taskState.tasks}
        activeForm={taskState.activeForm}
        isCollapsed={taskState.isCollapsed}
        onToggleCollapse={taskState.toggleCollapse}
      />

      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="chat-input-container relative border-t p-4">
        <AnimatePresence>
          {showCommands && (
            <CommandPalette
              filteredCommands={filteredCommands}
              selectedIndex={selectedIndex}
              onSelect={handleCommandSelect}
              onClose={() => setShowCommands(false)}
            />
          )}
        </AnimatePresence>

        <ChatInput
          value={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={status === 'streaming'}
          onStop={stop}
          onEscape={() => setShowCommands(false)}
          isPaletteOpen={showCommands}
          onArrowUp={handleArrowUp}
          onArrowDown={handleArrowDown}
          onCommandSelect={handleKeyboardCommandSelect}
          activeDescendantId={activeDescendantId}
        />

        <StatusLine
          sessionId={sessionId}
          sessionStatus={sessionStatus}
          isStreaming={status === 'streaming'}
        />
      </div>
    </div>
  );
}
