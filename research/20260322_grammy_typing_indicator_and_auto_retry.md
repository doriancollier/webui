---
title: 'grammY Typing Indicator API, auto-chat-action Plugin, and auto-retry Plugin'
date: 2026-03-22
type: external-best-practices
status: active
tags:
  [
    grammy,
    telegram,
    typing-indicator,
    sendChatAction,
    auto-chat-action,
    auto-retry,
    rate-limits,
    relay,
  ]
feature_slug: relay-external-adapters
searches_performed: 8
sources_count: 14
---

# grammY Typing Indicator API, auto-chat-action Plugin, and auto-retry Plugin

## Research Summary

Telegram's `sendChatAction('typing')` expires after **5 seconds** and must be refreshed in a loop for long-running operations. grammY has an official `@grammyjs/auto-chat-action` plugin that handles this loop automatically using `setInterval` at 5000ms, with a context flavor (`ctx.chatAction`) and a `chatAction()` middleware wrapper for route-level control. The `@grammyjs/auto-retry` plugin intercepts API transformer failures — rate-limit 429s, 5xx server errors, and network errors — and retries with configurable backoff (default: infinite retries, exponential backoff starting at 3 seconds, capped at 1 hour for non-429 errors). DorkOS's existing `GrammyPlatformClient` already implements a correct, idiomatic typing loop at **4000ms** refresh — slightly more conservative than the plugin's 5000ms, which is the right call.

---

## Key Findings

### 1. `sendChatAction('typing')` — How It Works and Its Limitations

**Duration:** The typing status is active for **5 seconds or less**. Telegram clients clear the typing indicator when a message arrives from the bot, or after 5 seconds (whichever comes first).

**All valid action values:**

- `"typing"` — composing a text message
- `"upload_photo"`
- `"record_video"` / `"upload_video"`
- `"record_voice"` / `"upload_voice"`
- `"upload_document"`
- `"choose_sticker"`
- `"find_location"`
- `"record_video_note"` / `"upload_video_note"`

**Telegram's own recommendation:** "We only recommend using this method when a response from the bot will take a noticeable amount of time to arrive."

**Key limitations:**

1. **One-shot by design** — each call covers only 5 seconds. For operations longer than 5s, callers must refresh in a loop.
2. **Immediately cleared on message send** — as soon as the bot sends a message, Telegram clients automatically clear the typing indicator in that chat. No explicit "stop" API call is required or available.
3. **No "stop typing" method** — you cannot actively cancel a typing indicator. You stop refreshing and let it expire naturally.
4. **Shares the global rate limit** — `sendChatAction` counts against the same global 30 msg/sec per bot token limit as `sendMessage`. In practice, a 4–5s interval produces ~0.2 calls/sec per chat, well within limits.

---

### 2. `@grammyjs/auto-chat-action` — Built-in grammY Plugin

**Status:** Official grammY-organization plugin (`@grammyjs/` scope). Published on npm as `@grammyjs/auto-chat-action`. Listed in the grammY plugin registry.

**What it does:**

The plugin has two modes:

**Automatic mode** — Detects upload methods and starts the appropriate action automatically. When `sendPhoto`, `sendVideo`, `sendAudio`, `sendDocument`, `sendAnimation`, `sendVoice`, `sendVideoNote`, `sendSticker`, or `sendMediaGroup` are called and the payload contains an `InputFile`, the plugin automatically sends the matching chat action (e.g., `upload_photo` during `sendPhoto`).

**Manual mode** — The `ctx.chatAction` property lets handlers declare a persistent typing loop:

```typescript
import { autoChatAction, AutoChatActionFlavor } from '@grammyjs/auto-chat-action';

type MyContext = Context & AutoChatActionFlavor;
const bot = new Bot<MyContext>('');
bot.use(autoChatAction());

bot.command('start', (ctx) => {
  ctx.chatAction = 'typing'; // starts a loop, keeps indicator alive
  // ... long operation ...
  return ctx.reply('Done!'); // reply clears the indicator automatically
});
```

**Internal mechanism:** The plugin uses `setInterval` at **5000ms** to repeatedly call `sendChatAction`. The interval handle is stored and cleared in a `finally` block when the handler completes or throws.

**The `chatAction()` middleware wrapper:**

A higher-order function that applies a fixed action for an entire handler chain:

```typescript
import { chatAction } from '@grammyjs/auto-chat-action';

bot.command('start', chatAction('typing'), (ctx) => {
  return ctx.reply('42!');
});
```

This is equivalent to setting `ctx.chatAction = "typing"` at the top of every matching handler — the middleware sets the action before the next handler runs and stops it afterward.

**Conversations integration note:** When using with the `@grammyjs/conversations` plugin, you must pass `bot.api` explicitly to the plugin: `bot.use(autoChatAction(bot.api))`. This is because conversations replay middleware, and the context within a conversation replay does not have a live API reference.

**Cleanup triggers:**

- Update processing completes (handler returns/resolves)
- Handler throws an error (finally block clears interval)
- `ctx.chatAction = undefined` explicitly
- A conflicting media upload method completes (interrupts the current action)

**Installation:**

```bash
npm i @grammyjs/auto-chat-action
```

---

### 3. `@grammyjs/auto-retry` — Behavior and Configuration

**What it is:** An API transformer (not middleware). It wraps `bot.api.config.use()` and intercepts all outbound API calls at the transport layer, catching failures and retrying before they surface to the application.

**Installation:**

```typescript
import { autoRetry } from '@grammyjs/auto-retry';
bot.api.config.use(autoRetry());
```

**Error categories handled:**

| Error type         | Condition                        | Retry strategy                                       |
| ------------------ | -------------------------------- | ---------------------------------------------------- |
| Rate limit (429)   | `retry_after` value in response  | Wait exactly `retry_after` seconds, then retry       |
| Chat migration     | `migrate_to_chat_id` in response | Updates the chat ID and retries                      |
| Server error (5xx) | `error_code >= 500`              | Exponential backoff starting at 3s, capped at 1 hour |
| Network error      | `HttpError` thrown               | Same exponential backoff as server errors            |

**Exponential backoff details:**

- Initial delay: `INITIAL_LAST_DELAY = 3` seconds
- Growth: `nextDelay = Math.min(ONE_HOUR, nextDelay + nextDelay)` (doubling each retry)
- Cap: `ONE_HOUR = 3600` seconds
- Sequence: 3s → 6s → 12s → 24s → 48s → 96s → ... → 3600s

**Default values (source-verified):**

- `maxRetryAttempts`: `Infinity` — retries indefinitely unless configured
- `maxDelaySeconds`: `Infinity` — waits any `retry_after` duration unless configured

**Recommended production configuration:**

```typescript
autoRetry({
  maxRetryAttempts: 1, // Only retry once
  maxDelaySeconds: 5, // Fail fast if retry_after > 5s
});
```

**Interaction with `sendChatAction`:** The auto-retry plugin applies to all API calls including `sendChatAction`. In practice:

- If `sendChatAction` returns a 429 (rare at normal refresh rates), auto-retry waits and retries.
- If the bot is hammering the API during a broadcast and gets rate-limited on a typing call, auto-retry handles it transparently.
- DorkOS's `GrammyPlatformClient` uses `.catch(() => {})` on typing calls, which bypasses auto-retry's retry loop. This is intentional — typing indicators are best-effort and should not block the response pipeline.

**Flood Control alternative:** The `@grammyjs/transformer-throttler` plugin proactively throttles all outgoing API calls using a token-bucket algorithm. Unlike auto-retry (which is reactive), transformer-throttler is preventive. For DorkOS's use case (low-volume single-user bot), auto-retry is sufficient.

---

### 4. Best Practices for Maintaining Typing Indicators During Long-Running Operations

**The core pattern — fire immediately, then loop:**

```typescript
const TYPING_REFRESH_MS = 4_000; // 4s interval for 5s TTL gives margin

function startTyping(bot: Bot, chatId: number): NodeJS.Timeout {
  // Fire immediately so user sees indicator without delay
  bot.api.sendChatAction(chatId, 'typing').catch(() => {});

  // Refresh every 4s — less than Telegram's 5s expiry
  return setInterval(() => {
    bot.api.sendChatAction(chatId, 'typing').catch(() => {
      // Stop on API error — typing is best-effort
      clearInterval(intervalId);
    });
  }, TYPING_REFRESH_MS);
}

function stopTyping(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  // No Telegram API call needed — indicator expires naturally
  // or was already cleared when bot sent its reply message
}
```

**Key decisions:**

1. **4s vs 5s refresh interval:** Use 4000ms (not 5000ms) to give a 1s margin against Telegram's 5s expiry. Network jitter can delay an API call, and a 1s buffer prevents visible indicator flickers. The `@grammyjs/auto-chat-action` plugin uses 5000ms (right at the edge), which is technically fine but leaves no margin.

2. **Best-effort, not critical path:** Typing failures must not block the response. Always `.catch(() => {})` on typing calls, or at most log and clear the interval.

3. **Idempotent start:** If `startTyping` is called again while already active, clear the existing interval before starting a new one. Multiple overlapping intervals produce duplicate API calls.

4. **Per-chat state, not per-request:** The typing interval is keyed by `chatId`, not request ID. Multiple messages from the same chat share one interval.

5. **Cleanup in `destroy()`:** Any class owning typing intervals must clear all of them on shutdown to prevent leaked timers.

**For the `@grammyjs/auto-chat-action` plugin specifically:**

Use `ctx.chatAction = "typing"` rather than manually managing intervals when using grammY's middleware pipeline. The plugin handles cleanup, error suppression, and conversation replay edge cases. Manual interval management is appropriate when operating outside the middleware pipeline (e.g., DorkOS's `GrammyPlatformClient`, which is called from adapter code, not a handler).

---

### 5. Rate Limits on `sendChatAction`

**Global bot limits (Telegram Bot API):**

- `sendMessage` and similar: ~30 messages per second per bot token
- Per-chat (same chat): avoid more than 1 message per second
- Per group: no more than 20 messages per minute

**`sendChatAction` specifically:**

- Shares the global 30 msg/sec counter — it is a regular Bot API method
- No documented separate rate limit for `sendChatAction`
- At a 4s refresh interval per chat: ~0.25 calls/sec per active chat
- Even with 10 concurrent active chats: 2.5 calls/sec — well within limits

**When rate limits are hit (429):**

- Response includes `retry_after` (seconds to wait)
- Telegram API 8.0 also includes `adaptive_retry` (float, milliseconds) — a recommended sleep with jitter
- Repeated 429s can trigger a 30-second IP cool-down

**Practical guidance:**

- At DorkOS scale (single user, few concurrent chats), rate limits on `sendChatAction` are not a concern
- Do not add artificial throttling to typing calls — the 4s interval is already self-throttling
- If using auto-retry, it handles 429s on typing calls automatically
- DorkOS's `.catch(() => {})` pattern (suppressing errors) is appropriate since typing is cosmetic

---

## DorkOS Current Implementation Assessment

`GrammyPlatformClient` in `packages/relay/src/adapters/telegram/grammy-platform-client.ts` already implements the correct pattern:

```typescript
const TELEGRAM_TYPING_ACTION = 'typing' as const;
const TYPING_REFRESH_MS = 4_000; // 4s interval — 1s margin under Telegram's 5s TTL

startTyping(threadId: string): void {
  const chatId = parseChatId(threadId);
  this.#clearTypingInterval(chatId);        // idempotent

  this.#bot.api.sendChatAction(chatId, TELEGRAM_TYPING_ACTION).catch(() => {});  // immediate fire

  const intervalId = setInterval(() => {
    this.#bot.api.sendChatAction(chatId, TELEGRAM_TYPING_ACTION).catch(() => {
      this.#clearTypingInterval(chatId);    // stop on error
    });
  }, TYPING_REFRESH_MS);

  this.#typingIntervals.set(chatId, intervalId);
}
```

**Verdict: Correct and idiomatic.** The implementation is strictly better than `@grammyjs/auto-chat-action`'s 5000ms loop in two respects:

1. **4000ms margin** gives a 1s buffer vs. the plugin's 5000ms (right at the limit)
2. **Per-chat keying** with `#typingIntervals: Map<number, Timeout>` is correct for concurrent multi-chat scenarios
3. **Idempotent** — `#clearTypingInterval` before starting prevents overlapping intervals
4. **`destroy()` cleanup** — all intervals cleared on shutdown, preventing leaks

The only thing missing relative to the auto-chat-action plugin is automatic detection of upload methods (e.g., auto-switching to `upload_document` when sending a file). DorkOS doesn't send files from the relay adapter, so this is not relevant.

---

## Comparison Table

| Aspect                      | DorkOS `GrammyPlatformClient` | `@grammyjs/auto-chat-action`  | Chat SDK `startTyping()`   |
| --------------------------- | ----------------------------- | ----------------------------- | -------------------------- |
| Refresh interval            | 4000ms                        | 5000ms                        | One-shot only (no loop)    |
| Margin under 5s TTL         | 1s                            | 0s                            | N/A                        |
| Auto-detects upload methods | No                            | Yes                           | No                         |
| Per-chat state tracking     | Yes                           | Yes                           | No                         |
| Cleanup on shutdown         | Yes (`destroy()`)             | Yes (finally block)           | N/A                        |
| Works outside middleware    | Yes                           | No (requires handler context) | Via `thread.startTyping()` |
| Conversations compatible    | N/A                           | With `bot.api` option         | N/A                        |
| Error handling              | Best-effort `.catch()`        | Best-effort                   | Unknown                    |

---

## Research Gaps

1. The exact `setInterval` duration in `@grammyjs/auto-chat-action`'s source was confirmed as 5000ms via search results citing the source; the GitHub source was not directly fetched.
2. Telegram has not published official documentation for rate limits on `sendChatAction` specifically. The 30 msg/sec global limit is the only documented constraint.
3. `adaptive_retry` in Bot API 8.0 responses is mentioned in third-party sources but not in official Telegram docs — treat as empirical observation.

---

## Sources & Evidence

- [GitHub: grammyjs/auto-chat-action](https://github.com/grammyjs/auto-chat-action) — official plugin repository, `setInterval` implementation, `AutoChatActionFlavor`, `chatAction()` wrapper
- [npm: @grammyjs/auto-chat-action](https://www.npmjs.com/package/@grammyjs/auto-chat-action) — package metadata and README
- [grammY: Retry API Requests (auto-retry)](https://grammy.dev/plugins/auto-retry) — full plugin documentation, configuration options table
- [grammY: Scaling Up IV: Flood Limits](https://grammy.dev/advanced/flood.html) — rate limit behavior, auto-retry recommendation, broadcast guidance
- [GitHub: grammyjs/auto-retry source (mod.ts)](https://github.com/grammyjs/auto-retry/blob/main/src/mod.ts) — `INITIAL_LAST_DELAY = 3`, `ONE_HOUR = 3600`, doubling backoff, `maxRetryAttempts: Infinity` default
- [grammY: AutoRetryOptions reference](https://grammy.dev/ref/auto-retry/autoretryoptions) — all configuration options
- [grammY: Flood Control (transformer-throttler)](https://grammy.dev/plugins/transformer-throttler) — alternative to auto-retry for proactive throttling
- [Telegram Bot API: sendChatAction](https://core.telegram.org/bots/api#sendchataction) — official method spec, all action values, 5-second duration
- [GramIO: How to solve rate limit errors](https://gramio.dev/rate-limits) — rate limit taxonomy, adaptive_retry field
- [BytePlus: Telegram API Rate Limits Comprehensive Guide](https://www.byteplus.com/en/topic/450604) — 30 msg/sec global limit, token-bucket recommendations, jitter
- [Bot Market: The "Typing" action (sendChatAction)](https://bot-market.com/blog/botmarket-knowledge-base/the-typing-action-sendchataction-in-telegram-/en) — 5-second TTL behavior explanation
- [grammY: The Hitchhiker's Guide to grammY Plugins](https://grammy.dev/plugins/guide) — plugin taxonomy (official vs community)
- Prior research: `research/20260322_chat_sdk_typing_indicator_api.md` — Chat SDK `startTyping()` comparison, DorkOS `GrammyPlatformClient` analysis
- Prior research: `research/20260313_slack_bot_adapter_best_practices.md` — Slack typing indicator comparison

---

## Search Methodology

- Searches performed: 8
- Most productive terms: `grammY auto-chat-action plugin typing indicator middleware`, `grammY @grammyjs/auto-retry plugin behavior flood wait`, `Telegram sendChatAction rate limits best practices 2025`, `grammY sendChatAction typing 5 seconds duration loop interval best practice long operation`, `grammY "auto-chat-action" source code setInterval 5000 loop implementation github`
- Primary sources: grammy.dev, github.com/grammyjs, npmjs.com, core.telegram.org
- Research depth: Focused Investigation
