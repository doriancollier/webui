/**
 * Type definitions for stream event handling.
 *
 * @module features/chat/model/stream-event-types
 */
import type { MessagePart, HookPart, ToolCallPart, SubagentPart } from '@dorkos/shared/types';
import type { ChatMessage, TransportErrorInfo } from './chat-types';

// Client-only streaming type — _partId is never serialized or sent over the wire.
// It provides a stable React key for text parts during streaming, where the parts
// array is rebuilt on every text_delta event.
export type StreamingTextPart = { type: 'text'; text: string; _partId: string };

export interface StreamEventDeps {
  currentPartsRef: React.MutableRefObject<MessagePart[]>;
  /** Buffer for hook events that arrive before their owning tool_call_start. */
  orphanHooksRef: React.MutableRefObject<Map<string, HookPart[]>>;
  assistantCreatedRef: React.MutableRefObject<boolean>;
  sessionStatusRef: React.MutableRefObject<
    import('@dorkos/shared/types').SessionStatusEvent | null
  >;
  streamStartTimeRef: React.MutableRefObject<number | null>;
  estimatedTokensRef: React.MutableRefObject<number>;
  textStreamingTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  isTextStreamingRef: React.MutableRefObject<boolean>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setError: (error: TransportErrorInfo | null) => void;
  setStatus: (status: 'idle' | 'streaming' | 'error') => void;
  setSessionStatus: (status: import('@dorkos/shared/types').SessionStatusEvent | null) => void;
  setEstimatedTokens: (tokens: number) => void;
  setStreamStartTime: (time: number | null) => void;
  setIsTextStreaming: (streaming: boolean) => void;
  setRateLimitRetryAfter: (retryAfter: number | null) => void;
  setIsRateLimited: (limited: boolean) => void;
  rateLimitClearRef: React.MutableRefObject<(() => void) | null>;
  setSystemStatus: (message: string | null) => void;
  setPromptSuggestions: (suggestions: string[]) => void;
  thinkingStartRef: React.MutableRefObject<number | null>;
  sessionId: string;
  onTaskEventRef: React.MutableRefObject<
    ((event: import('@dorkos/shared/types').TaskUpdateEvent) => void) | undefined
  >;
  onSessionIdChangeRef: React.MutableRefObject<((newSessionId: string) => void) | undefined>;
  onStreamingDoneRef: React.MutableRefObject<(() => void) | undefined>;
  /** Set to true before `onSessionIdChange` in done handler to signal that the session change is a remap, not navigation. */
  isRemappingRef: React.MutableRefObject<boolean>;
}

/** Context object passed to extracted handler functions. */
export interface StreamHandlerHelpers {
  findToolCallPart: (toolCallId: string) => ToolCallPart | undefined;
  findHookById: (hookId: string) => HookPart | undefined;
  findSubagentPart: (taskId: string) => SubagentPart | undefined;
  updateAssistantMessage: (assistantId: string) => void;
  currentPartsRef: React.MutableRefObject<MessagePart[]>;
  orphanHooksRef: React.MutableRefObject<Map<string, HookPart[]>>;
}
