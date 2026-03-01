---
title: Relay Conversation View Design
---

# Relay Conversation View Design

**Date**: 2026-02-27
**Status**: Approved
**Approach**: Conversation View (Approach 1)

## Problem

The Relay panel shows raw message data that is meaningless to users:
- Subject lines like `relay.human.console.ff5ab4df-8b70-4573-a0cf-e0243bce1e66`
- 8 individual SSE response chunks displayed as separate rows
- Payload shows "undefined" (IndexedMessage has no payload)
- Trace always fails to load (TraceStore.insertSpan never called)
- Dead letters show hash IDs instead of human context

## Design Decisions

- **Audience**: Both end users and power users, prioritizing end users
- **Core value**: Visibility — "I can see exactly what's happening between my agents"
- **Abstraction**: Human-first with technical drill-down
- **Grouping**: Conversations (request + response chunks grouped together)
- **Scope**: Bug fixes included in the redesign

## Data Model

### New Endpoint: `GET /relay/conversations`

Returns messages grouped into request-response exchanges.

```typescript
interface RelayConversation {
  id: string;                    // The request message ID
  direction: 'outbound' | 'inbound';
  status: 'delivered' | 'failed' | 'pending';

  // Human-readable labels (resolved server-side)
  from: { label: string; raw: string };
  to: { label: string; raw: string };

  // Content
  preview: string;               // First 120 chars of payload.content
  payload: unknown;              // Full payload (from Maildir read)

  // Response grouping
  responseCount: number;

  // Timing
  sentAt: string;
  completedAt?: string;
  durationMs?: number;

  // Technical (available on expand)
  subject: string;
  sessionId?: string;
  clientId?: string;
  traceId?: string;

  // Dead letter info
  failureReason?: string;
}
```

### Grouping Logic

1. Read all messages from SQLite index
2. For `relay.agent.*` messages: read envelope from Maildir for payload + replyTo
3. For `relay.human.console.*` messages: group by subject as response chunks
4. Correlate: match response chunks to requests by checking if request's `from` matches response subject
5. Resolve agent names via session ID → cwd → agent manifest

### Subject → Human Label Resolution

| Subject Pattern | Label |
|----------------|-------|
| `relay.human.console.*` | "You" |
| `relay.agent.{sessionId}` | Agent name from manifest, fallback: `Agent (a6010b)` |
| `relay.system.pulse.*` | "Pulse Scheduler" |
| `relay.system.console` | "System Console" |

Resolution happens server-side to avoid N+1 client requests.

### Existing Endpoint Enhancement

`GET /relay/messages?include=payload` — optional query param reads envelope from Maildir and includes payload field. Backward compatible.

### Trace Store Wiring

Wire `TraceStore.insertSpan()` into `RelayCore.publish()` and `deliverToAdapter()`:

```typescript
// After delivery in publish():
if (this.traceStore) {
  this.traceStore.insertSpan({
    traceId: messageId,
    messageId,
    subject,
    status: deliveredTo > 0 ? 'delivered' : 'failed',
    sentAt: envelope.createdAt,
    deliveredAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(envelope.createdAt).getTime(),
    error: deliveredTo === 0 ? 'no matching endpoints or adapters' : undefined,
  });
}
```

## Client UI

### ConversationRow (Collapsed)

```
┌─────────────────────────────────────────────────────────┐
│ 🟢  You → Obsidian Repo                    20m ago     │
│     "hi"                              delivered · 8 chunks│
└─────────────────────────────────────────────────────────┘
```

- Status dot (green/red/amber)
- Human labels: Who → Who
- Message preview (first 120 chars)
- Relative time
- Outcome: status + chunk count or failure reason

### ConversationRow (Expanded)

```
┌─────────────────────────────────────────────────────────┐
│ 🟢  You → Obsidian Repo                    20m ago     │
│     "hi"                              delivered · 8 chunks│
│─────────────────────────────────────────────────────────│
│  Payload                                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ { "content": "hi" }                             │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Delivery   Sent 8:22:10 PM · Completed 8:22:31 PM     │
│             Duration: 21s · 8 response chunks           │
│                                                         │
│  ▸ Technical Details                                    │
│    Subject: relay.agent.a6010b5c-e384-486a-89c9-...     │
│    Session: a6010b5c                                    │
│    Client: ff5ab4df                                     │
│    Trace ID: 01KJGPHQVG...                              │
│                                                         │
│  ▸ Trace Timeline                    (lazy-loaded)      │
└─────────────────────────────────────────────────────────┘
```

Three disclosure levels:
1. **Collapsed**: Only human-readable info
2. **First expand**: Payload + delivery summary
3. **Accordions**: Technical Details, Trace Timeline (for power users)

### Dead Letter Section

**Before**: `01KJG7Z6ZQAFXRTMB1WQKS1MQM` / `Unknown` / `4h ago`
**After**: `"hello" → Obsidian Repo` / `No matching endpoints` / `4h ago`

Dead letter data already includes full envelope — extract preview and resolve target agent name.

### Endpoints Tab

Add human-readable names above raw subjects:

```
┌─────────────────────────────────────────────────────────┐
│ 🟢  System Console                                     │
│     relay.system.console            0 messages · idle   │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ 🟢  Your Browser Session                               │
│     relay.human.console.ff5ab4…     8 messages · 20m ago│
└─────────────────────────────────────────────────────────┘
```

### Filters

Rename to human-friendly labels:
- Source: "All", "Chat messages", "Pulse jobs", "System"
- Status: "All", "Delivered", "Failed", "Pending"
- Search: "Filter by agent or message..."

### Adapters Tab (Minor Polish)

- Claude Code adapter: Show "Handles: Chat messages, Pulse jobs" instead of "In: 1 | Out: 0"
- Available adapters: Add one-line descriptions

## Not Changing

- Health bar — already good
- Compose dialog — stays technical (power user tool)
- Adapter setup wizard — already excellent
- SSE real-time updates — same event stream, same animations
- DeliveryMetricsDashboard — already clean
- Connection status banner — works as-is

## Change Summary

| Layer | Change |
|-------|--------|
| Server: RelayCore | Wire trace store into publish() and deliverToAdapter() |
| Server: New endpoint | GET /relay/conversations — grouped, resolved, with payloads |
| Server: Existing endpoint | GET /relay/messages?include=payload |
| Server: Agent resolution | Parse subjects → resolve names via session/agent identity |
| Client: ActivityFeed | Swap MessageRow for ConversationRow |
| Client: ConversationRow | Human labels, preview, expandable technical detail |
| Client: DeadLetterSection | Message preview + resolved agent name |
| Client: EndpointList | Human-readable names above raw subjects |
| Client: Filters | Rename to friendly labels |
| Client: AdapterCard | "Handles: ..." description |
