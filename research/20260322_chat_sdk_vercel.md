---
title: 'Chat SDK (Vercel) - Unified Multi-Platform Chatbot SDK'
date: 2026-03-22
type: external-best-practices
status: active
tags: [chat-sdk, vercel, slack, discord, telegram, teams, adapters, chatbot, messaging, typescript]
searches_performed: 14
sources_count: 12
---

## Research Summary

Chat SDK is a Vercel-maintained open-source TypeScript library (public beta) that allows developers to build chatbot logic once and deploy it across Slack, Microsoft Teams, Google Chat, Discord, Telegram, GitHub, Linear, and WhatsApp. It solves the multi-platform fragmentation problem with a clean adapter pattern, event-driven handler API, JSX-based UI components, first-class AI streaming support, and pluggable state management (Redis, PostgreSQL, in-memory). The package name is `chat`, installed with `npm i chat`.

## Key Findings

1. **Unified Abstraction Over 8+ Platforms**: A single `Chat` instance with registered adapters routes all webhook events — mentions, messages, reactions, slash commands, modal submissions — to platform-agnostic handlers. Platform-specific behavior is fully encapsulated in adapters.

2. **Event-Driven TypeScript API**: Handlers like `onNewMention()`, `onSubscribedMessage()`, `onAction()`, and `onSlashCommand()` receive strongly-typed `Thread`, `Channel`, and `Message` objects rather than raw platform payloads.

3. **First-Class AI Streaming**: `thread.post()` accepts any `AsyncIterable<string>`, including AI SDK `textStream` or `fullStream` directly. Streaming behavior is platform-aware (native for Slack, post-and-edit for Teams/Discord/Google Chat).

4. **Adapter + State Architecture**: Core `chat` package is separate from platform adapter packages (`@chat-adapter/slack`, etc.) and state adapter packages (`@chat-adapter/redis`, etc.). All are independently installable.

5. **JSX for Rich UI**: Cards, buttons, modals, tables, and sections are authored in JSX and compile to platform-native formats (Block Kit for Slack, Adaptive Cards for Teams, GFM markdown for Discord/Teams, etc.).

6. **Serverless-Native Design**: The `waitUntil` callback pattern defers async work while returning webhook HTTP responses immediately — critical for Slack/Teams webhook response timing constraints.

7. **Building Custom Adapters**: The `Adapter` interface defines a clear contract. Community adapters already exist for Cloudflare Durable Objects, Webex, and Baileys WhatsApp.

---

## Detailed Analysis

### What Problem It Solves

Every major messaging platform (Slack, Teams, Discord, Telegram, etc.) has its own webhook format, authentication scheme, message format, reaction system, and interactive component model. Building bots across multiple platforms traditionally requires:

- Separate codebases per platform
- Learning distinct APIs, auth flows, and event schemas
- Duplicating bot logic for each integration
- Maintaining N separate deployments

Chat SDK abstracts all of this behind a single unified interface, analogous to what AI SDK did for LLM providers.

---

### Architecture: The Three-Layer Model

```
┌─────────────────────────────────────────┐
│              Your Bot Logic             │
│  onNewMention / onAction / thread.post  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│            Chat Class (Core)            │
│  Routes webhooks → handlers             │
│  Manages adapters, state, logging       │
└──────┬───────────────────────┬──────────┘
       │                       │
┌──────▼──────┐         ┌──────▼──────────┐
│  Platform   │         │  State Adapter  │
│  Adapters   │         │  (Redis/PG/Mem) │
│  (Slack,    │         │  Locks, cache,  │
│  Teams,     │         │  subscriptions  │
│  Discord…)  │         └─────────────────┘
└─────────────┘
```

**Chat Class** — Central orchestrator. Accepts an array of `adapters`, a `state` adapter, and optional config like `fallbackStreamingPlaceholderText` and `onLockConflict`. Exposes the event registration methods and produces a `handleWebhook` function to mount on your HTTP server.

**Platform Adapters** — One per platform. Each implements the `Adapter<ThreadId, InstallData>` interface. Handles: inbound webhook parsing, signature verification, routing to correct event type, message normalization, posting/editing messages, streaming, reactions, DMs, scheduled messages, OAuth (for multi-workspace). Zero-config mode: adapter reads env vars automatically (e.g. `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`).

**State Adapters** — Persist thread subscriptions, distributed locks (prevent concurrent message processing on same thread), and key-value cache. Required for production; `state-memory` for dev/testing.

---

### Core TypeScript Interfaces

#### `Adapter<ThreadId, InstallData>`

```typescript
interface Adapter<ThreadId, InstallData = unknown> {
  // Required
  postMessage(threadId: ThreadId, content: PostableMessage): Promise<SentMessage>;
  editMessage(messageId: string, content: PostableMessage): Promise<void>;
  fetchMessages(threadId: ThreadId): Promise<Message[]>;
  handleWebhook(req: Request, options: WebhookOptions): Promise<Response>;
  parseMessage(raw: unknown): Message;

  // Optional capabilities
  stream?(threadId: ThreadId, stream: AsyncIterable<string>): Promise<SentMessage>;
  scheduleMessage?(
    threadId: ThreadId,
    content: PostableMessage,
    sendAt: Date
  ): Promise<ScheduledMessage>;
  postEphemeral?(
    userId: string,
    threadId: ThreadId,
    content: PostableMessage
  ): Promise<EphemeralMessage>;
  uploadFile?(threadId: ThreadId, file: FileUpload): Promise<void>;
  openModal?(triggerId: string, modal: ModalDefinition): Promise<void>;
  setInstallation?(teamId: string, data: InstallData): Promise<void>;
  getInstallation?(teamId: string): Promise<InstallData | null>;
  handleOAuthCallback?(code: string): Promise<void>;
}
```

#### `Thread`

```typescript
interface Thread {
  id: string;
  channelId: string;
  platform: string;

  // Posting
  post(content: PostableMessage | AsyncIterable<string>): Promise<SentMessage>;
  postEphemeral(userId: string, content: PostableMessage): Promise<EphemeralMessage>;

  // History
  fetchMessages(): Promise<Message[]>;

  // Subscriptions (multi-turn conversations)
  subscribe(): Promise<void>;
  unsubscribe(): Promise<void>;

  // Reactions
  react(emoji: string): Promise<void>;
  unreact(emoji: string): Promise<void>;
}
```

#### `StateAdapter`

```typescript
interface StateAdapter {
  // Distributed locking (prevent concurrent writes to same thread)
  acquireLock(key: string, ttl: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;

  // Key-value storage
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;

  // Subscriptions
  subscribe(key: string): Promise<void>;
  unsubscribe(key: string): Promise<void>;
  getSubscriptions(): Promise<string[]>;
}
```

#### `ChatConfig`

```typescript
interface ChatConfig {
  adapters: Adapter[];
  state?: StateAdapter;
  logger?: Logger;
  fallbackStreamingPlaceholderText?: string;
  onLockConflict?: 'queue' | 'drop' | ((thread: Thread) => void);
}
```

#### `Message` / `SentMessage` / `EphemeralMessage`

```typescript
interface Message {
  id: string;
  threadId: string;
  userId: string;
  text: string;
  attachments?: Attachment[];
  timestamp: Date;
  platform: string;
}

interface SentMessage extends Message {
  edit(content: PostableMessage): Promise<void>;
  delete(): Promise<void>;
}

interface EphemeralMessage {
  // Visible only to specific user
  delete(): Promise<void>;
}
```

---

### Event Handler API

```typescript
const chat = new Chat({
  adapters: [slackAdapter],
  state: createRedisState(),
});

// Called when your bot is @mentioned in a new thread/message
chat.onNewMention(async ({ thread, message, user }) => {
  await thread.subscribe(); // opt into follow-up messages
  await thread.post('Hello! I am subscribed to this thread now.');
});

// Called for subsequent messages in subscribed threads
chat.onSubscribedMessage(async ({ thread, message }) => {
  const response = streamText({ model: claude, prompt: message.text });
  await thread.post(response.textStream); // stream AI output
});

// Button/interactive component clicks
chat.onAction(async ({ thread, action, user }) => {
  if (action.id === 'approve') {
    await thread.post('Approved!');
  }
});

// Slash commands
chat.onSlashCommand('/deploy', async ({ thread, args, user }) => {
  await thread.post(`Deploying ${args[0]}...`);
});

// Modal form submission
chat.onModalSubmit('deploy-form', async ({ values, user }) => {
  const { env, branch } = values;
  // process form submission
});
```

---

### JSX-Based Rich UI (Cards, Buttons, Tables)

Files must use `.tsx` extension. Cards compile to platform-native formats:

```tsx
import { Card, Section, Button, Table, Field } from 'chat';

// In a handler:
await thread.post(
  <Card>
    <Section>Deploy request received</Section>
    <Table>
      <Field label="Branch">main</Field>
      <Field label="Environment">production</Field>
    </Table>
    <Button actionId="approve" style="primary">
      Approve
    </Button>
    <Button actionId="reject" style="danger">
      Reject
    </Button>
  </Card>
);
```

Platform rendering:

- **Slack**: Block Kit JSON
- **Teams**: Adaptive Cards
- **Discord/Google Chat**: GFM markdown + buttons
- **Telegram**: Inline keyboard + formatted text
- **GitHub/Linear**: Markdown (limited interactive support)

---

### AI Streaming Integration

```typescript
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

chat.onSubscribedMessage(async ({ thread, message }) => {
  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    prompt: message.text,
  });

  // Pass fullStream (preferred) — includes finish events for paragraph breaks
  await thread.post(result.fullStream);

  // Or textStream for simple use cases
  await thread.post(result.textStream);
});
```

Platform streaming behavior:

- **Slack**: Native streaming API (smoothest UX)
- **Teams, Google Chat, Discord**: Post placeholder → edit in place (default: 500ms update interval)
- Configurable via `streamingUpdateInterval` option

Advanced Slack streaming with `StreamChunk` objects:

```typescript
async function* generateWithTasks() {
  yield { type: 'task', id: 'fetch', status: 'running', label: 'Fetching data' };
  yield 'Here is the result: ';
  // ... stream text
  yield { type: 'task', id: 'fetch', status: 'done', label: 'Fetched' };
}

await thread.post(generateWithTasks());
```

---

### Platform Feature Matrix

| Feature               | Slack | Teams   | Google Chat | Discord | Telegram | GitHub | Linear | WhatsApp |
| --------------------- | ----- | ------- | ----------- | ------- | -------- | ------ | ------ | -------- |
| Native Streaming      | Yes   | No      | No          | No      | No       | No     | No     | No       |
| Cards/Rich UI         | Yes   | Yes     | Yes         | Yes     | Limited  | No     | No     | No       |
| Slash Commands        | Yes   | Yes     | Yes         | Yes     | Yes      | No     | No     | No       |
| Modals                | Yes   | Yes     | No          | No      | No       | No     | No     | No       |
| Reactions             | Yes   | Limited | No          | Yes     | Yes      | Yes    | Yes    | No       |
| File Upload           | Yes   | Yes     | Yes         | Yes     | Yes      | Yes    | No     | Yes      |
| Scheduled Messages    | Yes   | No      | No          | No      | No       | No     | No     | No       |
| DMs                   | Yes   | Yes     | Yes         | Yes     | Yes      | Yes    | Yes    | Yes      |
| Multi-workspace OAuth | Yes   | Yes     | No          | Yes     | No       | No     | No     | No       |

---

### Mounting on an HTTP Server

The SDK is framework-agnostic — `handleWebhook` returns a standard `Response`:

```typescript
// Next.js
export async function POST(req: Request) {
  return chat.handleWebhook(req, {
    waitUntil: (p) => context.waitUntil(p), // Vercel/Cloudflare waitUntil
  });
}

// Express
app.post('/webhook', async (req, res) => {
  const response = await chat.handleWebhook(req);
  res.status(response.status).json(await response.json());
});

// Hono
app.post('/webhook', (c) => chat.handleWebhook(c.req.raw));
```

The `waitUntil` pattern is critical for serverless: it lets the webhook return a 200 immediately while async bot logic continues running in the background (required by Slack's 3-second response window).

---

### Building Custom Adapters

To add a new platform, implement the `Adapter` interface:

```typescript
import type { Adapter, Thread, Message, PostableMessage } from 'chat';

export class MyPlatformAdapter implements Adapter<string, unknown> {
  async handleWebhook(req: Request, options: WebhookOptions): Promise<Response> {
    // 1. Verify request signature
    // 2. Parse the request body
    // 3. Identify event type
    // 4. Invoke options.onNewMention / options.onAction / etc.
    return new Response('OK', { status: 200 });
  }

  async postMessage(threadId: string, content: PostableMessage): Promise<SentMessage> {
    // Convert PostableMessage (text, JSX card, etc.) to platform format
    // Call platform API
    // Return SentMessage with edit/delete capabilities
  }

  async fetchMessages(threadId: string): Promise<Message[]> {
    // Return normalized Message array
  }

  parseMessage(raw: unknown): Message {
    // Normalize platform payload to Message shape
  }
}
```

The monorepo provides `adapter-shared` package with utilities shared across official adapters.

---

### State Management

State adapters handle:

1. **Distributed locking** — Prevent two concurrent webhook calls from both processing the same thread message simultaneously (race condition protection)
2. **Thread subscriptions** — Persist which threads a bot has subscribed to across serverless restarts
3. **Key-value cache** — Generic persistent store for bot state

```typescript
import { createRedisState } from '@chat-adapter/redis';
import { createMemoryState } from '@chat-adapter/memory'; // for testing

const chat = new Chat({
  adapters: [slackAdapter],
  state: createRedisState(), // reads REDIS_URL from env
});
```

Production: Use Redis, ioredis, or PostgreSQL adapters.
Development/Testing: Use in-memory adapter.

---

### Testing

The SDK provides a mock/test adapter for simulating end-to-end interactions without real platform credentials:

```typescript
import { createMemoryState } from '@chat-adapter/memory';

const testChat = new Chat({
  adapters: [new MockAdapter()],
  state: createMemoryState(),
});

// Simulate a mention
await testChat.simulate.mention({ userId: 'user-1', text: 'hello' });
// Assert response
```

---

### Package Installation

```bash
# Core
npm i chat

# Platform adapters (install only what you need)
npm i @chat-adapter/slack
npm i @chat-adapter/teams
npm i @chat-adapter/discord
npm i @chat-adapter/gchat
npm i @chat-adapter/telegram
npm i @chat-adapter/github
npm i @chat-adapter/linear
npm i @chat-adapter/whatsapp

# State adapters
npm i @chat-adapter/redis      # production
npm i @chat-adapter/ioredis    # alternative Redis client
npm i @chat-adapter/pg         # PostgreSQL
npm i @chat-adapter/memory     # development/testing
```

---

### Deployment

Designed for serverless-first deployment:

- **Vercel** — Recommended, integrates with `waitUntil` via edge runtime
- **Cloudflare Workers** — Community adapter available
- **Any Node.js server** — Express, Fastify, Hono, etc.

---

## Sources & Evidence

- "A unified TypeScript SDK for building chat bots across Slack, Microsoft Teams, Google Chat, Discord, Telegram, GitHub, Linear, and WhatsApp" — [Chat SDK Homepage](https://chat-sdk.dev/)
- "Platform-specific behavior is handled by adapters, so your handlers don't change when your deployment target does" — [Vercel Blog: Chat SDK brings agents to your users](https://vercel.com/blog/chat-sdk-brings-agents-to-your-users)
- "The adapter auto-detects SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET from your environment" — [Slack with Next.js Guide](https://chat-sdk.dev/docs/guides/slack-nextjs)
- Adapter interface, Thread interface, StateAdapter interface, ChatConfig type — [GitHub: packages/chat/src/types.ts](https://github.com/vercel/chat/blob/main/packages/chat/src/types.ts)
- Slack adapter uses AsyncLocalStorage for per-request token resolution — [GitHub: packages/adapter-slack/src/index.ts](https://github.com/vercel/chat/blob/main/packages/adapter-slack/src/index.ts)
- Main exports including Chat, Thread, Message, JSX components, markdown utilities — [GitHub: packages/chat/src/index.ts](https://github.com/vercel/chat/blob/main/packages/chat/src/index.ts)
- Streaming accepts AsyncIterable, fullStream preferred over textStream for AI SDK — [Chat SDK Streaming Docs](https://chat-sdk.dev/docs/streaming)
- Official adapters for 8 platforms, vendor-official adapters (Beeper Matrix, Photon iMessage, Resend), community adapters (Cloudflare, Webex, Baileys) — [Chat SDK Adapters Page](https://chat-sdk.dev/adapters)
- Package structure: 15 packages in monorepo — [GitHub: vercel/chat packages](https://github.com/vercel/chat/tree/main/packages)
- Public beta announcement — [Vercel Changelog: npm i chat](https://vercel.com/changelog/chat-sdk)

## Research Gaps & Limitations

- Direct doc pages (`/docs/usage`, `/docs/api/thread`, etc.) returned 404 or connection errors — content may be available only via the interactive docs site
- Exact TypeScript signatures for all `Adapter` interface methods not confirmed from source (derived from DeepWiki analysis and README)
- Feature parity table values are approximate based on available documentation
- WhatsApp adapter details (24-hour messaging window handling) mentioned but not deeply documented
- Webhook mounting for all frameworks not fully documented

## Search Methodology

- Searches performed: 14
- Most productive search terms: "vercel chat-sdk GitHub README TypeScript adapter", "site:chat-sdk.dev docs", "chat-sdk vercel TypeScript unified chatbot SDK"
- Primary information sources: chat-sdk.dev, github.com/vercel/chat, vercel.com/blog, deepwiki.com/vercel/chat
