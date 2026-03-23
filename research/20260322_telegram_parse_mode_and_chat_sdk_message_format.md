---
title: 'Telegram Bot API parse_mode and Chat SDK Message Format'
date: 2026-03-22
type: implementation
status: active
tags:
  [
    telegram,
    parse_mode,
    html,
    markdownv2,
    chat-sdk,
    vercel,
    anthropic-claude-agent-sdk,
    message-format,
    relay,
  ]
feature_slug: relay-external-adapters
searches_performed: 14
sources_count: 16
---

# Telegram Bot API parse_mode and Chat SDK Message Format

## Research Summary

This report covers two implementation-focused questions: (1) how Telegram's `parse_mode` parameter works in `sendMessage`, including HTML vs MarkdownV2 mode, character escaping requirements, and the behavior when no `parse_mode` is set; and (2) how the Vercel `chat` npm package (also called Chat SDK) formats message content, and what the `@anthropic-ai/claude-agent-sdk` `text_delta` StreamEvent contains. The DorkOS codebase already implements best-practice answers to both questions and can serve as the authoritative reference.

---

## Key Findings

### 1. Telegram `parse_mode` is Optional — Default is Plain Text

When `parse_mode` is omitted from a `sendMessage` call, Telegram renders the message as **plain text**. HTML angle brackets (`<`, `>`) appear **literally** in the chat — they are NOT stripped. This means:

- Sending `<b>hello</b>` without `parse_mode` produces the literal string `<b>hello</b>` in the chat
- There is no implicit HTML parsing
- No error is returned — the message is delivered successfully as plain text with visible markup

### 2. `parse_mode: 'HTML'` — Supported Tags and Escaping Rules

HTML mode supports a defined subset of tags. Characters in the text content (outside tags) that are meaningful in HTML **must** be escaped as HTML entities or the API will reject/misparse the message.

**Supported HTML tags:**

| Tag(s)                                       | Effect                        |
| -------------------------------------------- | ----------------------------- |
| `<b>`, `<strong>`                            | Bold                          |
| `<i>`, `<em>`                                | Italic                        |
| `<u>`, `<ins>`                               | Underline                     |
| `<s>`, `<strike>`, `<del>`                   | Strikethrough                 |
| `<span class="tg-spoiler">`, `<tg-spoiler>`  | Spoiler (hidden text)         |
| `<a href="URL">`                             | Inline link                   |
| `<code>`                                     | Inline monospace              |
| `<pre>`                                      | Pre-formatted block           |
| `<pre><code class="language-LANG">`          | Code block with language hint |
| Custom emoji via `<tg-emoji emoji-id="...">` | Custom emoji                  |
| `<blockquote>`, `<blockquote expandable>`    | Block quotation               |

**Unsupported tags:** Silently treated as plain text, not stripped, not errored.

**Line breaks:** `<br>` is NOT supported. Use `\n`.

**Required character escaping in HTML mode:**

All `<`, `>`, and `&` characters in text content (i.e., not part of a tag or entity) **must** be escaped:

| Char | Must become |
| ---- | ----------- |
| `&`  | `&amp;`     |
| `<`  | `&lt;`      |
| `>`  | `&gt;`      |

Only four named HTML entities are recognised: `&lt;`, `&gt;`, `&amp;`, and `&quot;`. Numerical HTML entities are fully supported.

**Important:** HTML entity escaping must happen **before** inserting your own formatting tags. If you build HTML with `**bold**` text, you first escape `&`/`<`/`>` in the raw text, then apply `<b>...</b>` around the target spans.

### 3. `parse_mode: 'MarkdownV2'` — Required Escaping is Extensive

MarkdownV2 is more expressive than legacy Markdown but has a notorious escaping requirement: **18 special characters must be escaped with a preceding backslash** wherever they appear in literal text, even outside any formatting entity:

```
_ * [ ] ( ) ~ ` > # + - = | { } . !
```

In addition:

- The backslash `\` itself must be escaped as `\\`
- Inside `pre` and `code` entities: all backticks and backslashes must be escaped
- Inside inline link `()` parts: all parentheses and backslashes must be escaped

**Failure to escape any of these characters causes a 400 Bad Request error from the Telegram API.** This is why MarkdownV2 is difficult to use for AI-generated text — agent output routinely contains `.`, `!`, `-`, `(`, `)`, and other chars that must all be escaped before sending.

**MarkdownV2 formatting syntax:**

| Syntax               | Effect        |
| -------------------- | ------------- |
| `*bold*`             | Bold          |
| `_italic_`           | Italic        |
| `__underline__`      | Underline     |
| `~strikethrough~`    | Strikethrough |
| `\|\|spoiler\|\|`    | Spoiler       |
| `` `code` ``         | Inline code   |
| ` ```code block``` ` | Code block    |
| `[text](url)`        | Link          |
| `>quote`             | Blockquote    |

### 4. Legacy `parse_mode: 'Markdown'` — Use with Caution

The original Markdown mode is considered deprecated. It supports fewer characters and has more ambiguous parsing rules. It does NOT support underline, strikethrough, or spoiler. It is still accepted by the API and used in DorkOS for approval cards (where the template text is controlled and known-safe), but should not be used for LLM-generated output.

### 5. Chat SDK (`chat` package from Vercel) — Message Content is Markdown, Converted Per-Platform

The Vercel Chat SDK (`npm i chat`) accepts `PostableMessage` which can be:

- A plain string
- `PostableMarkdown` — a markdown object
- `PostableAst` — an mdast AST
- `PostableCard` — JSX-based card element
- `AsyncIterable<string | StreamChunk>` — streaming text input

The Chat SDK's **Telegram adapter** uses `TELEGRAM_MARKDOWN_PARSE_MODE = "Markdown"` (legacy Markdown mode) and performs its own Markdown-to-Markdown conversion via `TelegramFormatConverter.fromAst()`. Notably:

- It does NOT use HTML parse_mode
- It does NOT use MarkdownV2
- It escapes Markdown special characters within entity text using `text.replace(/([[\\\]()\\\\])/g, "\\$1")`
- When streaming, intermediate edits during streaming also pass through the format conversion pipeline (so users see formatted text progressively, not raw `**bold**`)
- Tables are converted to code blocks (Telegram has no table support)

### 6. `@anthropic-ai/claude-agent-sdk` — `text_delta` Contains Plain Markdown Text

The `@anthropic-ai/claude-agent-sdk` is the package DorkOS actually uses (NOT a package named `@anthropic-ai/chat-sdk` — that does not exist). The SDK yields a stream of `StreamEvent` objects defined in `@dorkos/shared`:

```typescript
type StreamEventType =
  | 'text_delta' // Text chunk from the agent
  | 'thinking_delta' // Internal reasoning
  | 'tool_call_start' // Tool invocation beginning
  | 'tool_call_delta' // Tool input streaming
  | 'tool_call_end' // Tool invocation complete
  | 'tool_result' // Tool execution result
  | 'approval_required' // Human approval needed
  | 'done' // Stream complete
  | 'error'; // Error condition
// ... and more internal event types

interface TextDelta {
  text: string; // Raw text chunk — plain Markdown, not HTML
}
```

The `text_delta.data.text` field contains **plain Markdown text** as generated by Claude. It is NOT pre-escaped for any platform. The text may contain:

- Standard Markdown syntax (`**bold**`, `_italic_`, `` `code` ``, `# heading`, etc.)
- Characters that are Telegram HTML entities (raw `<`, `>`, `&`) if the agent is discussing code
- MarkdownV2 special characters that would need escaping before sending to Telegram

**Consequence:** Whatever the agent writes must be converted/escaped before being sent to Telegram. Using `parse_mode: 'HTML'` with a Markdown→HTML converter (as DorkOS does) is the most robust approach.

---

## Detailed Analysis

### DorkOS's Current Implementation (Best Practice Reference)

The DorkOS Telegram adapter (`packages/relay/src/adapters/telegram/outbound.ts`) uses **`parse_mode: 'HTML'`** for all standard messages:

```typescript
const html = formatForPlatform(text, 'telegram');
await bot.api.sendMessage(chatId, html, { parse_mode: 'HTML' });
```

Where `formatForPlatform()` calls `markdownToTelegramHtml()` in `payload-utils.ts`:

````typescript
function markdownToTelegramHtml(md: string): string {
  let html = md;

  // Step 1: Escape HTML entities FIRST (before adding tags)
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Step 2: Code blocks (```lang\n...\n```) -> <pre><code>...</code></pre>
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const cls = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${cls}>${code.trimEnd()}</code></pre>`;
  });

  // Step 3: Inline code -> <code>
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Step 4: Bold, italic, strikethrough
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // Step 5: Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  // Step 6: Headings -> bold (Telegram has no heading tag)
  html = html.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  return html;
}
````

This approach is correct and canonical. The entity escaping step **must happen first** before any `<b>` or other tags are inserted, to prevent accidentally double-escaping or producing malformed HTML.

The only exception in the DorkOS code is the approval card, which uses legacy `parse_mode: 'Markdown'` with a manually crafted template string:

```typescript
await bot.api.sendMessage(chatId, messageText, {
  parse_mode: 'Markdown',  // Legacy — only safe because the template is controlled
  reply_markup: { inline_keyboard: [...] }
});
```

This is acceptable for approval cards because the template is written by the developer, not by an LLM, and Markdown is simpler to construct correctly for a few fixed formatting elements.

### Why HTML is Preferred Over MarkdownV2 for Agent Output

| Aspect              | HTML                                            | MarkdownV2                                      |
| ------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Escaping complexity | 3 characters (`&`, `<`, `>`)                    | 18 characters + backslash                       |
| LLM output safety   | High — only literal `<`, `>`, `&` need escaping | Low — `.`, `!`, `-`, `(`, `)` are all hazardous |
| Error behavior      | Unsupported tags silently shown as plain        | Missing escape → 400 API error                  |
| Feature parity      | All formatting features available               | All formatting features available               |
| Code block support  | `<pre><code class="language-X">`                | Triple backtick                                 |

**Recommendation: Always use `parse_mode: 'HTML'` for LLM-generated content going to Telegram.**

### What Happens with Unsupported HTML Tags

When `parse_mode: 'HTML'` is set and an unsupported tag (e.g., `<div>`, `<h1>`, `<br>`) is encountered:

- Telegram ignores the tag and displays the enclosed text as plain text
- No error is returned
- The message is delivered successfully

This is more forgiving than MarkdownV2 where a missing backslash causes a hard 400 failure.

### The Claude Code Telegram Plugin Issue (#36622)

There is an open GitHub issue on the `anthropics/claude-code` repository requesting that the Claude Code Telegram plugin add `parse_mode` support. Currently the plugin's `reply` and `edit_message` tools send messages **without any `parse_mode`**, so all agent formatting (`*bold*`, `` `code` ``) appears as literal characters.

The proposed implementation would default to `parse_mode: 'MarkdownV2'` with a `plain` fallback option:

```typescript
const parseMode = rawParseMode === 'plain' ? undefined : (rawParseMode as 'MarkdownV2' | 'HTML');
await bot.api.sendMessage(chat_id, text, { parse_mode: parseMode });
```

This issue confirms DorkOS's explicit handling of `parse_mode` is the correct approach.

---

## Clarification: Package Name Disambiguation

The research question used the term "Anthropic Chat SDK" or `@anthropic-ai/chat-sdk`. This package does not exist on npm. The relevant packages are:

| What was asked about             | Actual package                   | Publisher |
| -------------------------------- | -------------------------------- | --------- |
| `@anthropic-ai/chat-sdk`         | Does not exist                   | —         |
| "Vercel Chat SDK" / "npm i chat" | `chat` + `@chat-adapter/*`       | Vercel    |
| Claude Code SDK                  | `@anthropic-ai/claude-agent-sdk` | Anthropic |
| Anthropic API SDK                | `@anthropic-ai/sdk`              | Anthropic |

The DorkOS codebase uses `@anthropic-ai/claude-agent-sdk` for its agent runtime. The `chat` SDK (Vercel) is used by the `@chat-adapter/telegram` integration path. These are entirely separate packages.

---

## Sources & Evidence

- [Telegram Bot API — Formatting options](https://core.telegram.org/bots/api) — official documentation for parse_mode
- [Telegram Bot sendMessage API reference — telegram-bot-sdk.readme.io](https://telegram-bot-sdk.readme.io/reference/sendmessage) — parameter documentation including "All `<`, `>` and `&` symbols that are not part of a tag or HTML entity must be replaced with corresponding HTML entities"
- [GitHub Issue #36622: Telegram plugin parse_mode support](https://github.com/anthropics/claude-code/issues/36622) — Confirms that the Claude Code Telegram plugin currently omits parse_mode, causing literal rendering of markdown syntax
- [Vercel Chat SDK Telegram adapter](https://vercel.com/changelog/chat-sdk-adds-telegram-adapter-support) — Chat SDK Telegram adapter uses legacy Markdown parse mode
- [Vercel Chat SDK streaming markdown changelog](https://vercel.com/changelog/chat-sdk-adds-table-rendering-and-streaming-markdown) — Chat SDK converts markdown to native format on each streaming edit
- [MarkdownV2 escaping — telegraf/telegraf issue #1242](https://github.com/telegraf/telegraf/issues/1242) — Community documentation of all 18 special chars requiring escaping
- [GramIO formatting docs](https://gramio.dev/formatting) — Explains entity-based vs parse_mode approaches; note `htmlToFormattable()` / `markdownToFormattable()` utilities
- [DorkOS source: `packages/relay/src/lib/payload-utils.ts`](/Users/doriancollier/Keep/dork-os/core/packages/relay/src/lib/payload-utils.ts) — `markdownToTelegramHtml()` implementation, `parse_mode: 'HTML'`
- [DorkOS source: `packages/relay/src/adapters/telegram/outbound.ts`](/Users/doriancollier/Keep/dork-os/core/packages/relay/src/adapters/telegram/outbound.ts) — `sendAndTrack()` uses `parse_mode: 'HTML'`; approval cards use `parse_mode: 'Markdown'`
- [DorkOS source: `packages/shared/src/schemas.ts`](/Users/doriancollier/Keep/dork-os/core/packages/shared/src/schemas.ts) — `StreamEventTypeSchema`, `TextDeltaSchema` (confirms `text_delta.data.text: string` — plain markdown)
- [vercel/chat GitHub adapter-telegram/src/index.ts](https://github.com/vercel/chat/blob/main/packages/adapter-telegram/src/index.ts) — `TELEGRAM_MARKDOWN_PARSE_MODE = "Markdown"`; `renderFormatted` delegates to `TelegramFormatConverter.fromAst()`
- Prior internal research: `research/20260322_chat_sdk_telegram_relay_integration.md`
- Prior internal research: `research/20260322_chat_sdk_vercel.md`

---

## Research Gaps & Limitations

1. **Telegram API error response for malformed HTML**: The exact error message when an HTML entity is missing is documented as a 400 Bad Request, but the exact error body was not verified.

2. **Vercel Chat SDK's `TelegramFormatConverter` exact escaping logic**: The source file `packages/adapter-telegram/src/format-converter.ts` returned 404 on GitHub (may have been moved or renamed). The parse_mode and general approach were confirmed via the main adapter index file.

3. **Custom emoji HTML syntax**: The `<tg-emoji emoji-id="...">` tag is supported in newer Bot API versions. Exact version where it was introduced was not verified.

---

## Search Methodology

- Searches performed: 14
- Most productive terms: `"Telegram Bot API sendMessage parse_mode HTML MarkdownV2 escaping"`, `"@anthropic-ai/chat-sdk npm"`, `"vercel chat SDK renderFormatted telegram"`, `"Telegram bot sendMessage no parse_mode HTML angle brackets"`
- Key local files examined: `payload-utils.ts`, `outbound.ts`, `schemas.ts`
- Prior research reused: `20260322_chat_sdk_telegram_relay_integration.md`, `20260322_chat_sdk_vercel.md`
