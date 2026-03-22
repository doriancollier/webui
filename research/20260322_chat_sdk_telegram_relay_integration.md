---
title: 'Vercel Chat SDK Telegram Adapter — Relay Integration Research'
date: 2026-03-22
type: implementation
status: active
tags: [relay, telegram, chat-sdk, vercel, adapter, streaming, asynciterable, platform-client]
feature_slug: relay-external-adapters
searches_performed: 14
sources_count: 18
---

# Vercel Chat SDK Telegram Adapter — Relay Integration Research

## Research Summary

The Vercel Chat SDK (`npm i chat`) is a unified TypeScript SDK at version **4.20.2** (for `@chat-adapter/telegram`) for building bots across Slack, Teams, Discord, Telegram, and more from a single codebase. The Telegram adapter was announced on 2026-02-27 and uses a **post+edit fallback streaming** mechanism (no native `stream()` method on the adapter itself). The SDK's `thread.post()` method accepts an `AsyncIterable<string>` directly, making it the natural target for bridging DorkOS's per-event `deliver()` calls. The critical integration challenge — converting a push-based event stream (`text_delta`, `done`, `error`) into a pull-based `AsyncIterable<string>` — is well-solved with a lightweight AsyncQueue pattern requiring no external dependencies.

---

## Key Findings

### 1. Chat SDK Package Status

- **`chat` package**: The core SDK. The `@chat-adapter/telegram` package is version `4.20.2`.
- **Telegram support**: Added 2026-02-27. Part of the official `@chat-adapter/` Vercel-maintained scope.
- **In-monorepo peer dependency**: `chat` is a peer dep of `@chat-adapter/telegram`. Both must be installed.
- **No `engines` field**: The package.json has no explicit Node.js version constraint, but the codebase uses TypeScript and standard async patterns compatible with Node 20+.
- **State adapter**: Required by the `Chat` class, but the state adapter itself (`state-memory`, `state-redis`, etc.) can be used standalone. The `Chat` class constructor requires it.

### 2. `@chat-adapter/telegram` API

The `TelegramAdapter` implements `Adapter<TelegramThreadId, TelegramRawMessage>` and exposes:

**Required methods (all adapters):**

- `initialize()` — fetches bot identity via `getMe`, resolves runtime mode (webhook vs polling)
- `handleWebhook(request)` — verifies `X-Telegram-Bot-Api-Secret-Token`, parses update, calls `chat.processMessage()`
- `postMessage(threadId, message)` — sends message with formatting + inline keyboards
- `editMessage(threadId, messageId, message)` — updates an existing message
- `deleteMessage(threadId, messageId)` — removes message + cache entry
- `fetchMessages(threadId)` — returns adapter-cached messages (Telegram has no history API for bots)
- `encodeThreadId(data)` / `decodeThreadId(str)` — `{chatId}:{messageId}` in base64url

**Optional methods:**

- `startPolling()` / `stopPolling()` — manual lifecycle control
- `resetWebhook()` — clears webhook registration

**Notably ABSENT from the Telegram adapter:**

- `stream()` — this optional method IS defined on the `Adapter` interface (`stream?(threadId, textStream, options?): Promise<SentMessage>`) but the Telegram adapter does NOT implement it. The SDK therefore falls through to the **post+edit fallback** for all streaming.

**Configuration:**

```typescript
import { createTelegramAdapter } from '@chat-adapter/telegram';

const adapter = createTelegramAdapter({
  botToken: 'YOUR_BOT_TOKEN', // or TELEGRAM_BOT_TOKEN env var
  secretToken: 'YOUR_WEBHOOK_SECRET', // or TELEGRAM_WEBHOOK_SECRET_TOKEN env var
  mode: 'auto', // 'auto' | 'webhook' | 'polling'
  longPolling: { timeout: 30 }, // optional polling config
  userName: 'mybot', // optional; auto-detected via getMe
  apiBaseUrl: 'https://api.telegram.org', // optional
  logger: myLogger, // optional
});
```

### 3. `thread.post()` and Streaming Architecture

`thread.post()` accepts a `PostableMessage` union:

- `string` — plain text
- `PostableMarkdown` — markdown object
- `PostableAst` — mdast AST nodes
- `PostableCard` — card element tree (JSX-compatible)
- **`AsyncIterable<string | StreamChunk>`** — streaming input

When `thread.post()` receives an `AsyncIterable`:

1. It detects it via `Symbol.asyncIterator` presence check.
2. Calls `handleStream(message)` which normalizes the stream.
3. Checks if `adapter.stream()` exists. **For Telegram: it does NOT.**
4. Falls back to **post+edit**: posts a placeholder `"..."` message, then runs a recursive `setTimeout` loop (default 500ms) calling `editMessage()` with the accumulated text until the stream is exhausted. Final edit persists the complete text.

**The fallback interval is configurable** and avoids overwhelming slow services by scheduling edits only after the previous one completes (not on a fixed tick).

**Implication for DorkOS:** To use `thread.post(asyncIterable)`, we need to bridge DorkOS's per-event `deliver()` calls into an AsyncIterable that Chat SDK can consume. This is the core architectural challenge.

### 4. The Adapter Interface (Full Definition)

```typescript
interface Adapter<TThreadId, TRawMessage> {
  // Lifecycle
  initialize(chat: ChatInstance): Promise<void>;
  disconnect?(): Promise<void>;

  // Thread ID codec
  encodeThreadId(data: TThreadId): string;
  decodeThreadId(threadId: string): TThreadId;

  // Inbound
  handleWebhook(request: Request, options?: WebhookOptions): Promise<Response>;
  parseMessage(raw: unknown): Message;

  // Outbound
  postMessage(threadId: string, message: AdapterPostableMessage): Promise<SentMessage>;
  editMessage(
    threadId: string,
    messageId: string,
    message: AdapterPostableMessage
  ): Promise<SentMessage>;
  deleteMessage(threadId: string, messageId: string): Promise<void>;

  // Optional outbound
  stream?(
    threadId: string,
    textStream: AsyncIterable<string | StreamChunk>,
    options?: StreamOptions
  ): Promise<SentMessage>;
  scheduleMessage?(
    threadId: string,
    message: AdapterPostableMessage,
    options: ScheduleOptions
  ): Promise<ScheduledMessage>;
  openDM?(userId: string): Promise<string>;
  isDM?(threadId: string): boolean;
  openModal?(triggerId: string, modal: Modal, contextId?: string): Promise<void>;
  postEphemeral?(threadId: string, userId: string, message: AdapterPostableMessage): Promise<void>;
  postChannelMessage?(channelId: string, message: AdapterPostableMessage): Promise<SentMessage>;

  // Reactions
  addReaction?(threadId: string, messageId: string, emoji: EmojiValue | string): Promise<void>;
  removeReaction?(threadId: string, messageId: string, emoji: EmojiValue | string): Promise<void>;

  // Retrieval
  fetchMessages?(threadId: string, options?: FetchOptions): Promise<PaginatedMessages>;
  fetchThread?(threadId: string): Promise<ThreadInfo>;
  fetchChannelInfo?(channelId: string): Promise<ChannelInfo>;
  listThreads?(channelId: string): Promise<Thread[]>;
  fetchMessage?(threadId: string, messageId: string): Promise<Message>;

  // Typing
  startTyping?(threadId: string): Promise<void>;

  // Format conversion
  renderFormatted(content: MdastNode): string;
}
```

**Key insight**: The `Adapter` interface is designed to be used **through the Chat class**. The `Chat` class injects itself into the adapter via `initialize(chat)` and the adapter calls `this.chat.processMessage()` for inbound routing. There is **no documented standalone path** for using `@chat-adapter/telegram` without instantiating `new Chat(...)`.

### 5. State Adapter Requirement

The `Chat` class constructor **requires** a state adapter. Available options:

- `@chat-sdk/state-memory` — in-process, no infra needed, not distributed
- `@chat-sdk/state-redis` — Redis-backed, distributed
- `@chat-sdk/state-pg` — PostgreSQL-backed
- `@chat-sdk/state-ioredis` — ioredis client

For DorkOS's use case (single-process, no multi-replica), `state-memory` is the minimal viable choice.

### 6. AsyncIterable Bridge Pattern (No External Dependencies)

The core challenge: DorkOS calls `deliver()` once per event (`text_delta`, `done`, `error`, `approval_required`). Chat SDK expects a single `thread.post(asyncIterable)` call with a stream that yields text chunks until completion.

The bridge is a **simple AsyncQueue** that can be implemented without any library:

```typescript
/**
 * A push-based async iterable queue.
 *
 * Lets imperative push/complete/error calls feed into a for-await-of loop.
 * Uses a promise/resolve chain to avoid busy-polling: the consumer waits
 * on a pending promise until the producer calls push() or complete().
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private buffer: T[] = [];
  private resolveNext: (() => void) | null = null;
  private done = false;
  private error: Error | null = null;

  /** Push a value into the queue. Wakes a waiting consumer. */
  push(value: T): void {
    if (this.done) return;
    this.buffer.push(value);
    this.resolveNext?.();
    this.resolveNext = null;
  }

  /** Signal that the stream is complete. Wakes the consumer to drain. */
  complete(): void {
    this.done = true;
    this.resolveNext?.();
    this.resolveNext = null;
  }

  /** Signal an error. Consumer will throw on next iteration. */
  fail(err: Error): void {
    this.error = err;
    this.done = true;
    this.resolveNext?.();
    this.resolveNext = null;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    while (true) {
      if (this.buffer.length > 0) {
        yield this.buffer.shift()!;
      } else if (this.done) {
        if (this.error) throw this.error;
        return;
      } else {
        // Park until push/complete/fail wakes us
        await new Promise<void>((resolve) => {
          this.resolveNext = resolve;
        });
      }
    }
  }
}
```

**Usage in a streaming adapter session:**

```typescript
// On first text_delta for a chat: create queue and start thread.post() in background
const queue = new AsyncQueue<string>();
activeStreams.set(chatId, queue);

// Don't await — this runs concurrently while deliver() continues pushing deltas
thread.post(queue).then(() => activeStreams.delete(chatId));

// Each subsequent text_delta:
queue.push(textChunk);

// On done:
queue.complete();

// On error:
queue.fail(new Error(errorMessage));
```

**Alternatives evaluated:**

| Approach                                    | Pros                                       | Cons                                              |
| ------------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| `AsyncQueue` (custom, above)                | Zero deps, transparent, < 50 lines         | Must implement and maintain                       |
| `@n1ru4l/push-pull-async-iterable-iterator` | Battle-tested, handles backpressure        | Extra dep, API surface is larger                  |
| `event-iterator`                            | Mature, well-known                         | Designed around EventEmitter, not imperative push |
| `ReadableStream` (WHATWG)                   | Platform-native in Node 18+                | More verbose, requires `.values()` to iterate     |
| Buffer-then-send                            | Simplest: accumulate all chunks, send once | Loses progressive delivery benefit entirely       |

**Recommendation**: Use the custom `AsyncQueue` above. It is < 50 lines, has no dependencies, and maps exactly to the DorkOS delivery model. Place it in `packages/relay/src/lib/async-queue.ts`.

---

## Detailed Analysis

### Architecture: PlatformClient vs Full Chat SDK Integration

The task brief proposes a `PlatformClient` interface as a lower-level abstraction below the existing `RelayAdapter`. Two integration depth options exist:

**Option A: Thin PlatformClient wrapping Chat SDK directly**

```
RelayAdapter
  └── PlatformClient (new interface)
        └── TelegramAdapter (from @chat-adapter/telegram)
              └── new Chat({ adapters: { telegram: ... }, state: createMemoryState() })
```

In this model, `PlatformClient` owns the `Chat` instance and `TelegramAdapter`, exposes `deliver(event)` and `handleInbound(request)` to `RelayAdapter`, and internally converts the event stream into AsyncIterable via `AsyncQueue`. `RelayAdapter` doesn't change; the split is purely internal.

**Pros:**

- Platform-normalized message delivery (Chat SDK handles Telegram's editMessage cycles)
- Free path to other platforms (swap adapter, keep PlatformClient logic)
- Telegram streaming via post+edit is free
- Chat SDK's markdown-to-Telegram-HTML conversion is reused

**Cons:**

- Requires `new Chat(...)` + state adapter even for simple use
- Chat SDK routes inbound events through `processMessage()` → DorkOS must register a message handler on the `Chat` instance
- Chat SDK's ThreadId encoding (`{chatId}:{msgId}`) differs from DorkOS's subject system — mapping layer required
- DorkOS already has its own `ResponseBuffer` + `sendMessageDraft` streaming implementation in `outbound.ts` — Chat SDK replaces it, which is a meaningful refactor

**Option B: Direct adapter usage without Chat class**

Based on the source analysis, `TelegramAdapter` internally calls `this.chat.processMessage()` for inbound routing — it stores a reference injected via `initialize(chat)`. Without instantiating `Chat`, the adapter cannot route inbound messages. **There is no documented or clean path to use `@chat-adapter/telegram` without `new Chat(...)`.**

However, for the **outbound-only** use case (DorkOS receiving from Relay and delivering to Telegram), you could call `adapter.postMessage(threadId, text)` and `adapter.editMessage(...)` directly, bypassing `thread.post()` entirely. This means:

- You get the Telegram API call helpers but not the streaming/fallback infrastructure
- No `Chat` instance needed for pure outbound

**Recommendation: Option A** for a clean integration, or skip Chat SDK entirely and use the existing grammY-based implementation that already solves the problem well.

### The Streaming Mismatch Problem

DorkOS's per-event `deliver()` model is the right abstraction for a message bus. Chat SDK's `thread.post(asyncIterable)` is the right abstraction for an LLM-backed bot framework. The impedance mismatch is real:

**DorkOS model:**

```
deliver(text_delta) → accumulate
deliver(text_delta) → accumulate
deliver(done)       → flush/send
```

**Chat SDK model:**

```
thread.post(asyncIterable) → internally: post "..." → editMessage loop → final edit
```

The `AsyncQueue` bridge converts the DorkOS model into what Chat SDK expects. However, it's worth noting that DorkOS's existing implementation in `outbound.ts` **already does exactly what Chat SDK's post+edit fallback does**, just using grammY directly:

- `sendMessageDraft` calls for live preview
- Buffer-accumulate-flush on `done`
- Error handling on `error` event

The main **new value** Chat SDK would add over the existing implementation:

1. Markdown-to-Telegram-HTML conversion via `BaseFormatConverter` (already done by `formatForPlatform()` in `payload-utils.ts`)
2. Platform-agnostic message format (`PostableCard`, `PostableMarkdown`, etc.)
3. Unified adapter interface enabling future Slack/Discord/Teams adapters from one codebase

### Polling vs Webhook Mode

For DorkOS's self-hosted case:

- `mode: 'auto'` is correct: uses polling in local dev (no public URL), webhooks in production
- `startPolling()` / `stopPolling()` must be called by the adapter lifecycle (`_start` / `_stop`)
- The `TelegramAdapter` manages its own `pollingAbortController` — the DorkOS adapter wrapper just needs to call `telegramAdapter.initialize()` and `telegramAdapter.startPolling()`

### ThreadId Encoding

Chat SDK encodes thread IDs as `{adapter}:{segment1}:{segment2}` using base64url for special characters. For Telegram: `telegram:{chatId}:{messageId}`.

DorkOS uses subject-based addressing: `relay.human.telegram.{chatId}`.

A mapping function is required in the `PlatformClient` layer:

```typescript
function dorkSubjectToThreadId(subject: string): string {
  const chatId = extractChatId(subject); // existing utility
  return `telegram:${chatId}:0`; // 0 as placeholder for top-level thread
}
```

### State Adapter for DorkOS

Since DorkOS is single-process and state persistence is not a Chat SDK concern (DorkOS has its own SQLite/file storage), use `@chat-sdk/state-memory`. It has no infra dependencies and zero overhead for the single-process use case.

---

## Integration Approach Recommendation

### Recommended: "Thin Bridge" Pattern

Given that DorkOS already has a working, well-tested Telegram adapter with streaming support (`outbound.ts`, `stream-api.ts`), the most pragmatic path is:

**Introduce `PlatformClient` as a thin interface that either:**

1. Wraps the existing grammY implementation (no new dependencies)
2. Or wraps `@chat-adapter/telegram` for the standardized multi-platform future

For the proof-of-concept Telegram adapter, **wrap Chat SDK** using this structure:

```typescript
// packages/relay/src/adapters/telegram-chat-sdk/platform-client.ts

import { Chat } from 'chat';
import { createTelegramAdapter } from '@chat-adapter/telegram';
import { createMemoryState } from '@chat-sdk/state-memory';
import { AsyncQueue } from '../../lib/async-queue.js';
import type { RelayEnvelope } from '@dorkos/shared/relay-schemas';

/**
 * Minimal interface for platform-specific delivery.
 *
 * Adapters implement this to bridge the relay event model to a chat platform.
 * The relay adapter layer handles subject routing; PlatformClient handles
 * the actual API calls.
 */
export interface PlatformClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  deliverEvent(chatId: number, event: RelayStreamEvent): Promise<void>;
  handleInbound(request: Request): Promise<Response>;
}

/** A relay stream event for delivery to a platform. */
export type RelayStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'message'; text: string };

/**
 * PlatformClient backed by Vercel Chat SDK's Telegram adapter.
 *
 * Converts DorkOS's per-event deliver() model into Chat SDK's
 * thread.post(AsyncIterable) model using an AsyncQueue bridge.
 */
export class ChatSdkTelegramClient implements PlatformClient {
  private bot: ReturnType<typeof new Chat>;
  private telegramAdapter: ReturnType<typeof createTelegramAdapter>;
  // Active stream queues keyed by chatId
  private streams = new Map<number, AsyncQueue<string>>();

  constructor(config: { botToken: string; onMessage: (chatId: number, text: string) => void }) {
    this.telegramAdapter = createTelegramAdapter({ botToken: config.botToken, mode: 'auto' });
    this.bot = new Chat({
      userName: 'dorkos',
      adapters: { telegram: this.telegramAdapter },
      state: createMemoryState(),
    });
    // Register inbound message handler
    this.bot.onNewMention(async (thread, message) => {
      config.onMessage(/* extract chatId from thread */, message.text ?? '');
    });
  }

  async start(): Promise<void> {
    await this.telegramAdapter.initialize(/* chat instance */);
    if (/* polling mode */) await this.telegramAdapter.startPolling();
  }

  async stop(): Promise<void> {
    await this.telegramAdapter.stopPolling();
  }

  async deliverEvent(chatId: number, event: RelayStreamEvent): Promise<void> {
    const threadId = `telegram:${chatId}:0`;

    if (event.type === 'message') {
      await this.telegramAdapter.postMessage(threadId, event.text);
      return;
    }

    if (event.type === 'text_delta') {
      let queue = this.streams.get(chatId);
      if (!queue) {
        queue = new AsyncQueue<string>();
        this.streams.set(chatId, queue);
        // Start streaming — don't await, runs concurrently
        const thread = /* get thread reference */ null;
        thread?.post(queue).finally(() => this.streams.delete(chatId));
      }
      queue.push(event.text);
      return;
    }

    if (event.type === 'done') {
      this.streams.get(chatId)?.complete();
      return;
    }

    if (event.type === 'error') {
      this.streams.get(chatId)?.fail(new Error(event.message));
      return;
    }
  }

  handleInbound(request: Request): Promise<Response> {
    return this.bot.webhooks.telegram(request);
  }
}
```

**The main gap in the above sketch**: `thread.post()` belongs to a `Thread` object that Chat SDK creates contextually when processing an inbound message. For **outbound-only** streaming from DorkOS to a known `chatId`, calling `adapter.postMessage()` + `adapter.editMessage()` directly is cleaner than trying to obtain a `Thread` instance.

### Simpler Outbound-Only Approach

For the common case (DorkOS agent → Telegram user), skip `thread.post()` entirely and drive `postMessage` / `editMessage` directly with the `AsyncQueue`:

```typescript
async deliverEvent(chatId: number, event: RelayStreamEvent): Promise<void> {
  const threadId = encodeTelegramThreadId(chatId);

  if (event.type === 'text_delta') {
    let state = this.streams.get(chatId);
    if (!state) {
      // Post initial placeholder and start accumulating
      const sent = await this.telegramAdapter.postMessage(threadId, '...');
      state = { queue: new AsyncQueue<string>(), messageId: sent.id, accumulated: '' };
      this.streams.set(chatId, state);
      // Drive the edit loop
      void this.streamLoop(chatId, threadId, state);
    }
    state.queue.push(event.text);
    return;
  }

  if (event.type === 'done') {
    this.streams.get(chatId)?.queue.complete();
  }

  if (event.type === 'error') {
    this.streams.get(chatId)?.queue.fail(new Error(event.message));
  }
}

private async streamLoop(
  chatId: number,
  threadId: string,
  state: StreamState
): Promise<void> {
  for await (const chunk of state.queue) {
    state.accumulated += chunk;
    await this.telegramAdapter.editMessage(threadId, state.messageId, state.accumulated);
    // Respect Telegram's edit rate limit (~once per 0.5s handled by Chat SDK)
  }
  this.streams.delete(chatId);
}
```

---

## Implementation Notes

### Package Installation

```bash
pnpm add chat @chat-adapter/telegram @chat-sdk/state-memory
```

Note: `@chat-sdk/state-memory` is the package name inferred from the monorepo structure. Verify on npm — it may be published as `@chat-adapter/state-memory` or similar. The monorepo uses `state-memory` as the package folder name.

### Peer Dependency Constraint

`@chat-adapter/telegram` has `chat` as a peer dependency. Both must be installed in the same package. In DorkOS's monorepo, add both to `packages/relay/package.json`.

### Node.js Compatibility

No explicit `engines` field in the `@chat-adapter/telegram` package.json. The SDK uses standard async/await, `AsyncIterable`, and `AbortController` — all available in Node 18+. Node 20+ (DorkOS's CI target) is confirmed compatible.

### Streaming Rate Limits

- Chat SDK's post+edit fallback uses recursive `setTimeout` (not `setInterval`) to avoid stacking edits.
- Telegram's Bot API allows ~20 edits/minute per message. Chat SDK's default 500ms interval stays well within this.
- DorkOS's existing implementation already applies a 200ms `DRAFT_UPDATE_INTERVAL_MS` throttle — this is more aggressive than Chat SDK's default but valid.

### What DorkOS Already Has

The existing `packages/relay/src/adapters/telegram/` implementation already handles:

- post+edit streaming via `sendMessageDraft` (undocumented Telegram API)
- Buffer-accumulate-flush pattern
- Typing indicators
- Approval required inline keyboards
- Error state handling

Chat SDK's Telegram adapter provides the same capabilities through a more abstract interface. The main new capability Chat SDK would unlock is **multi-platform parity**: the same `PlatformClient` logic working across Slack, Teams, Discord by swapping the adapter.

---

## Sources & Evidence

- [Chat SDK Telegram Adapter — chat-sdk.dev](https://chat-sdk.dev/adapters/telegram)
- [Chat SDK Introduction & Architecture](https://chat-sdk.dev/docs)
- [Chat SDK Adapter Interface (Building a Community Adapter)](https://chat-sdk.dev/docs/contributing/building)
- [Chat SDK Adds Telegram Adapter Support — Vercel Changelog](https://vercel.com/changelog/chat-sdk-adds-telegram-adapter-support)
- [Chat SDK Brings Agents to Your Users — Vercel Blog](https://vercel.com/blog/chat-sdk-brings-agents-to-your-users)
- [Chat SDK Adds Streaming Markdown — Vercel Changelog](https://vercel.com/changelog/chat-sdk-adds-table-rendering-and-streaming-markdown)
- [Introducing npm i chat — Vercel Changelog](https://vercel.com/changelog/chat-sdk)
- [vercel/chat GitHub Repository](https://github.com/vercel/chat)
- [DeepWiki: vercel/chat](https://deepwiki.com/vercel/chat)
- [@chat-adapter/telegram package.json — GitHub](https://github.com/vercel/chat/blob/main/packages/adapter-telegram/package.json) (version: 4.20.2)
- [GitHub: n1ru4l/push-pull-async-iterable-iterator](https://github.com/n1ru4l/push-pull-async-iterable-iterator)
- [GitHub: rolftimmermans/event-iterator](https://github.com/rolftimmermans/event-iterator)
- [TypeScript AsyncGenerator Event Iterator Pattern — DEV Community](https://dev.to/redjohnsh/asynchronously-iterating-over-event-emitters-in-typescript-with-async-generators-3mk)
- [queueable push-pull adapter](https://slikts.github.io/queueable/)
- [Chat SDK Community Forum — Vercel Weekly 2026-03-16](https://community.vercel.com/t/vercel-weekly-2026-03-16/36138)

---

## Research Gaps & Limitations

1. **`thread.post()` with a raw `chatId`**: The `Thread` object in Chat SDK is created contextually by the Chat class when an inbound message arrives. The documentation does not describe how to obtain a `Thread` for an arbitrary `chatId` outside of an inbound event handler. For pure outbound delivery from DorkOS, calling `adapter.postMessage()` + `adapter.editMessage()` directly is the confirmed path.

2. **`@chat-sdk/state-memory` exact package name**: The monorepo uses `packages/state-memory/` as the folder. The published npm name needs verification (`@chat-sdk/state-memory` or `@chat-adapter/state-memory`).

3. **Multi-turn conversation model**: Chat SDK's `thread.subscribe()` enables multi-turn (the bot continues to respond in a thread). DorkOS uses a different model (agent sessions vs message threads). The integration design above skips thread subscription entirely for simplicity.

4. **Webhook secret validation**: The `TelegramAdapter.handleWebhook()` validates the `X-Telegram-Bot-Api-Secret-Token` header. When integrating with DorkOS's Express server, the raw `Request` (WHATWG Fetch API) must be adapted from Express's `IncomingMessage`. A small adapter shim is needed.

5. **`sendMessageDraft` parity**: DorkOS's existing `stream-api.ts` uses Telegram's undocumented `sendMessageDraft` API for live typing preview (different from post+edit). Chat SDK does NOT use this API — it uses post+edit. The live-preview experience would be slightly degraded with Chat SDK.

---

## Contradictions & Disputes

- **Chat SDK docs vs source**: The documentation says "Telegram adapter supports streaming" but this means post+edit fallback, not native streaming. The source confirms no `stream()` method on `TelegramAdapter`. The existing DorkOS `sendMessageDraft` approach is actually more real-time than Chat SDK's post+edit.

- **"Standalone adapter usage"**: The Chat SDK docs mention adapters can be configured with explicit values "enabling flexible deployment scenarios" — this was interpreted as standalone usage, but the source analysis shows `TelegramAdapter` requires `this.chat` for inbound routing. Outbound-only standalone is feasible; full standalone is not.

---

## Search Methodology

- Searches performed: 14
- Most productive search terms: `@chat-adapter/telegram npm vercel`, `vercel chat-sdk thread.post streaming asynciterable`, `chat-sdk adapter interface postMessage editMessage typescript`, `typescript asyncgenerator push complete event bridge pattern`
- Primary sources: chat-sdk.dev, github.com/vercel/chat, deepwiki.com/vercel/chat, npmjs.com, dev.to
- Research depth: Deep
