---
title: 'Chat SDK Typing Indicator API — @chat-adapter/telegram & DorkOS Integration'
date: 2026-03-22
type: implementation
status: active
tags:
  [
    chat-sdk,
    telegram,
    typing-indicator,
    sendChatAction,
    chat-adapter,
    relay,
    grammy,
    platform-client,
  ]
feature_slug: relay-external-adapters
searches_performed: 0
sources_count: 6
---

# Chat SDK Typing Indicator API — @chat-adapter/telegram & DorkOS Integration

## Research Summary

The Vercel Chat SDK (`chat` v4.20.2) has a **built-in, non-optional `startTyping()` method** defined on the `Adapter` interface. The `@chat-adapter/telegram` package (v4.20.2) **implements `startTyping()` by calling Telegram's `sendChatAction` API with `action: "typing"`**. The underlying bot/client instance is **not directly exposed** by the Chat SDK adapter — all Telegram API calls go through an internal `telegramFetch()` helper. DorkOS's existing Telegram adapter (via `GrammyPlatformClient`) already implements an independent, equivalent typing indicator system using grammY directly. The Chat SDK provides no middleware hooks for intercepting message processing — typing must be called explicitly.

---

## Key Findings

### 1. Chat SDK Has a Built-In `startTyping()` Method — Non-Optional on the Adapter Interface

The `Adapter<TThreadId, TRawMessage>` interface in `chat` v4.20.2 declares `startTyping` as a **required method** (not optional):

```typescript
// chat/dist/index.d.ts — Adapter interface, line 299-300
/** Show typing indicator */
startTyping(threadId: string, status?: string): Promise<void>;
```

This is also surfaced at three higher-level abstractions:

**Thread object** (`Thread` class — what you get inside an `onNewMessage` handler):

```typescript
/**
 * Show typing indicator in the thread.
 *
 * Some platforms support persistent typing indicators, others just send once.
 * Optional status (e.g. "Typing...", "Searching documents...") is shown where supported.
 */
startTyping(status?: string): Promise<void>;
```

**Channel object** (`ChannelImpl` class):

```typescript
startTyping(status?: string): Promise<void>;
```

**ThreadImpl** (internal Thread implementation class, line 2495):

```typescript
startTyping(status?: string): Promise<void>;
```

The `status` parameter is intended for platforms like Slack that support custom status text (e.g., `"Thinking..."`, `"Searching documents..."`). Telegram ignores the `status` parameter — its `sendChatAction` only supports a fixed set of action strings.

### 2. `@chat-adapter/telegram` Implements `startTyping()` via `sendChatAction`

The implementation in `@chat-adapter/telegram/dist/index.js` (lines 681-688):

```javascript
async startTyping(threadId) {
  const parsedThread = this.resolveThreadId(threadId);
  await this.telegramFetch("sendChatAction", {
    chat_id: parsedThread.chatId,
    message_thread_id: parsedThread.messageThreadId,
    action: "typing"
  });
}
```

**Key characteristics:**

- Calls Telegram's `sendChatAction` API with `action: "typing"`
- Correctly passes `message_thread_id` for forum topic support
- **One-shot only** — sends a single `sendChatAction` call. It does NOT set up a repeating interval.
- The Chat SDK therefore does NOT keep the indicator alive across the ~5s Telegram timeout. If a response takes longer than 5 seconds, the typing indicator will vanish.
- The `telegramFetch()` helper is a private method — it is not accessible from outside the adapter.

### 3. The Underlying Bot Instance Is NOT Exposed

The `TelegramAdapter` class stores its state privately:

```typescript
// @chat-adapter/telegram/dist/index.d.ts
declare class TelegramAdapter implements Adapter<TelegramThreadId, TelegramRawMessage> {
  private readonly botToken;
  private readonly apiBaseUrl;
  private readonly secretToken?;
  private readonly logger;
  private readonly formatConverter;
  private readonly messageCache;
  private chat;
  private _botUserId?;
  // ... all private
  private telegramFetch; // ← bot calls go through here, not exposed
}
```

There is no `bot`, `client`, or `api` property exposed publicly. All Telegram Bot API calls are made internally via `telegramFetch()`. **There is no way to call `bot.api.sendChatAction()` directly through the Chat SDK adapter** — you would need to manage a separate grammY (or node-telegram-bot-api) bot instance.

### 4. No Middleware or Hook System in Chat SDK for Intercepting Message Processing

The Chat SDK has no middleware pipeline for the bot-processing path equivalent to grammY's `bot.use()` or Express's middleware chain. The flow is:

```
[inbound webhook/poll] → adapter.handleWebhook() → chat.processMessage()
                       → onNewMessage handler (your code)
```

There is no place to inject a "before message processing" hook at the SDK level. **Typing indicators must be called explicitly** in your `onNewMessage` / `onNewMention` handler:

```typescript
chat.onNewMessage(async (thread, message) => {
  await thread.startTyping(); // must call explicitly — no auto-typing
  const response = await generateResponse(message.text);
  await thread.post(response);
});
```

The SDK does NOT automatically call `startTyping()` when a message arrives or when `thread.post()` is called with an `AsyncIterable`. This must be wired by the caller.

---

## DorkOS Current Implementation (Already Solved)

DorkOS's existing Telegram adapter **already implements a superior typing indicator** via `GrammyPlatformClient` in `packages/relay/src/adapters/telegram/grammy-platform-client.ts`:

```typescript
/** Telegram sendChatAction value for typing indicator. */
const TELEGRAM_TYPING_ACTION = 'typing' as const;

/** Refresh interval (ms) for Telegram typing indicator (Telegram expires it after 5s). */
const TYPING_REFRESH_MS = 4_000;

startTyping(threadId: string): void {
  const chatId = parseChatId(threadId);
  this.#clearTypingInterval(chatId);

  // Fire immediately (best-effort)
  this.#bot.api.sendChatAction(chatId, TELEGRAM_TYPING_ACTION).catch(() => {});

  // Refresh every 4s — Telegram expires the indicator after 5s
  const intervalId = setInterval(() => {
    this.#bot.api.sendChatAction(chatId, TELEGRAM_TYPING_ACTION).catch(() => {
      this.#clearTypingInterval(chatId);
    });
  }, TYPING_REFRESH_MS);

  this.#typingIntervals.set(chatId, intervalId);
}

stopTyping(threadId: string): void {
  const chatId = parseChatId(threadId);
  this.#clearTypingInterval(chatId);
}
```

**DorkOS's implementation is better than Chat SDK's in one critical way:** it sets up a `setInterval` at 4000ms to keep the indicator alive, whereas Chat SDK sends only a single `sendChatAction` call. For long agent responses (>5 seconds), the Chat SDK's `startTyping()` would silently expire.

The `RelayAdapter` interface in `packages/relay/src/types.ts` already defines:

```typescript
/** Signal to the platform that the bot is composing a response. */
startTyping?(threadId: string): void;

/** Cancel any active typing indicator for the thread. */
stopTyping?(threadId: string): void;
```

These are already wired in `telegram-adapter.ts` via the `handleTypingSignal` mechanism.

---

## API Comparison Table

| Feature                     | Chat SDK `startTyping()`   | DorkOS `GrammyPlatformClient.startTyping()` |
| --------------------------- | -------------------------- | ------------------------------------------- |
| Calls `sendChatAction`      | Yes                        | Yes                                         |
| Keeps indicator alive (>5s) | No — single call only      | Yes — 4s refresh interval                   |
| Exposes underlying bot      | No                         | Yes (grammY `Bot` instance)                 |
| Forum topic support         | Yes (messageThreadId)      | Needs verification                          |
| Status text parameter       | Ignored for Telegram       | Not applicable                              |
| Access level                | Via `thread.startTyping()` | Via `platformClient.startTyping()`          |

---

## Answering the Four Questions Directly

### Q1: Does Chat SDK have a built-in typing indicator API?

**Yes.** `startTyping(threadId, status?)` is a required method on the `Adapter` interface and is surfaced as `thread.startTyping(status?)` and `channel.startTyping(status?)` on higher-level objects. It must be called explicitly — it is not triggered automatically.

### Q2: Does `@chat-adapter/telegram` expose a way to call `sendChatAction`?

**Yes, indirectly.** The `TelegramAdapter.startTyping(threadId)` method calls `sendChatAction` with `action: "typing"` internally. There is no way to pass a different action string (e.g., `"upload_photo"`, `"record_video"`) through the Chat SDK interface. If you need full `sendChatAction` control, you must use grammY directly (as DorkOS already does).

### Q3: Does the Chat SDK adapter expose the underlying bot/client instance?

**No.** All of `TelegramAdapter`'s fields are private. There is no `bot`, `api`, or `client` accessor. The only way to make Telegram API calls beyond what the adapter interface provides is to maintain a separate grammY `Bot` instance.

### Q4: Are there hooks or middleware for intercepting message processing to add typing?

**No.** There is no middleware pipeline or interceptor system. The only integration point is the `onNewMessage` / `onNewMention` callback where you call `thread.startTyping()` manually before processing.

---

## Recommendation for DorkOS

DorkOS's existing typing indicator implementation in `GrammyPlatformClient` is already correct and superior to what Chat SDK provides. The Chat SDK's `startTyping()` would be a regression because:

1. It only fires once (no 4s refresh interval)
2. It does not expose the bot instance for other Telegram API operations
3. Requires the full Chat SDK integration (`new Chat(...)`, state adapter, etc.)

If integrating with Chat SDK is desired for its streaming or multi-platform benefits, the typing indicator should still be driven by DorkOS's own `startTyping()`/`stopTyping()` lifecycle, bypassing Chat SDK's version. This can be done by calling `adapter.postMessage()` / `adapter.editMessage()` directly for outbound streaming rather than going through `thread.post()`, and using a separate grammY bot reference for `sendChatAction`.

---

## Sources

- `/Users/doriancollier/Keep/dork-os/core/node_modules/.pnpm/@chat-adapter+telegram@4.20.2/node_modules/@chat-adapter/telegram/dist/index.d.ts` — `TelegramAdapter` class declaration, `startTyping` method signature
- `/Users/doriancollier/Keep/dork-os/core/node_modules/.pnpm/@chat-adapter+telegram@4.20.2/node_modules/@chat-adapter/telegram/dist/index.js` — `startTyping` implementation (lines 681-688), `sendChatAction` call with `action: "typing"`
- `/Users/doriancollier/Keep/dork-os/core/node_modules/.pnpm/chat@4.20.2/node_modules/chat/dist/index.d.ts` — `Adapter` interface `startTyping` (line 299-300), `Thread.startTyping()` (line 725), `ChannelImpl.startTyping()` (line 1834), `ThreadImpl.startTyping()` (line 2495)
- `/Users/doriancollier/Keep/dork-os/core/packages/relay/src/adapters/telegram/grammy-platform-client.ts` — DorkOS's `GrammyPlatformClient.startTyping()` with 4s refresh interval
- `/Users/doriancollier/Keep/dork-os/core/packages/relay/src/adapters/telegram/telegram-adapter.ts` — `handleTypingSignal` wiring
- `/Users/doriancollier/Keep/dork-os/core/packages/relay/src/types.ts` — `RelayAdapter` interface `startTyping?` / `stopTyping?` definitions (lines 490-507)
- Prior research: `research/20260322_chat_sdk_telegram_relay_integration.md`
- Prior research: `research/20260318_slack_bot_typing_processing_indicators.md`

---

## Search Methodology

- Searches performed: 0 (all answers found from installed node_modules source and prior research)
- Files examined: 6 source files across node_modules and packages/relay/src
- Research depth: Focused Investigation
