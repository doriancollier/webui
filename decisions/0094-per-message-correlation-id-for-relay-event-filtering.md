---
number: 94
title: Per-Message Correlation ID for Relay Event Filtering
status: accepted
created: 2026-03-08
spec: fix-relay-ghost-messages
superseded-by: null
---

# 0094. Per-Message Correlation ID for Relay Event Filtering

## Status

Accepted

## Context

The relay-mode SSE pipeline uses a persistent EventSource connection per session. When a user sends messages in rapid succession, late-arriving events from Message N can bleed into Message N+1's response stream because the `relay_message` listener always routes events to the current `assistantIdRef`. Four approaches were considered: (1) correlation IDs threaded through the full pipeline, (2) `stream_ready_ack` from the adapter as a hard barrier, (3) client-side request queuing/serialization, (4) server-side event buffering with sequence numbers.

## Decision

Thread a client-generated UUID `correlationId` through the full relay pipeline: POST body → relay envelope payload → adapter response chunks → SSE events. The client filters incoming events, discarding any whose `correlationId` doesn't match the current message's ID. The filter is permissive — if either side lacks a correlation ID, events pass through for backward compatibility.

## Consequences

### Positive

- Eliminates event bleed regardless of timing — events are tagged at origin and filtered at destination
- Industry-standard pattern (Slack, Discord use similar approaches)
- Self-documenting — correlation IDs make debugging easier
- Backward compatible — optional field, permissive filter
- No additional latency (unlike `stream_ready_ack` which adds ~50-100ms per message)

### Negative

- Requires changes across 6 files (client, shared, server route, adapter, broadcaster)
- Adds ~40 bytes per relay event (UUID string) — negligible but non-zero
- Client-side filtering means late events are still transmitted over the wire before being discarded
