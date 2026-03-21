---
title: 'Claude Code Channels & A2A Protocol: Comparison with DorkOS Relay/Mesh and Integration Strategy'
date: 2026-03-21
type: architecture-analysis
status: active
tags:
  [
    claude-code,
    channels,
    a2a,
    relay,
    mesh,
    agent-communication,
    interoperability,
    mcp,
    integration-strategy,
  ]
searches_performed: 17
sources_count: 44+
---

# Claude Code Channels & A2A Protocol: Comparison with DorkOS and Integration Strategy

## Executive Summary

Two emerging systems for agent communication — **Claude Code Channels** (Anthropic, March 2026) and the **Agent2Agent (A2A) Protocol** (Google/Linux Foundation, April 2025) — address overlapping but distinct problems that DorkOS's Relay and Mesh already solve internally. This report compares all three, identifies integration opportunities, and recommends a layered strategy: keep Relay as the internal backbone, adopt A2A as the external interoperability surface, and use Channels as a runtime-specific delivery optimization for Claude Code agents.

### Key Conclusions

1. **DorkOS Relay/Mesh is architecturally superior to both Channels and raw A2A for our use case** — broker-mediated pub/sub with persistent mailboxes, namespace isolation, and multi-adapter support is more robust than Channels' ephemeral single-session model or A2A's point-to-point HTTP connections.

2. **Channels is complementary, not competing.** It solves "external events into a running Claude Code session." DorkOS solves "agent-to-agent coordination across sessions." The two can interoperate: DorkOS could use Channels as a delivery mechanism when a target Claude Code session is active.

3. **A2A is the right interoperability standard for DorkOS to adopt externally.** It provides the discovery semantics (Agent Cards) and communication protocol (JSON-RPC/SSE) that would allow DorkOS-managed agents to be invoked by — and delegate to — external agents from LangGraph, Google ADK, and the broader ecosystem.

4. **The integration should be layered:** A2A as an external gateway, Relay as the internal bus, Channels as a runtime optimization. This avoids replacing proven infrastructure while gaining interoperability.

---

## Part 1: Claude Code Channels

### What Channels Are

Claude Code Channels (research preview, v2.1.80+, launched March 20, 2026) lets MCP servers push events into a running Claude Code session over stdio, making Claude reactive to external events without polling. Channels are built on standard MCP — the only addition is a `claude/channel` capability declaration and `notifications/claude/channel` notification method.

**Two modes:**

- **One-way:** Push events for Claude to act on (CI alerts, webhooks, monitoring)
- **Two-way:** Additionally expose a reply MCP tool so Claude can respond (Telegram, Discord chat bridges)

**Wire format:** Events arrive as `<channel source="name" attr="value">content</channel>` XML tags in Claude's context.

**Available channels:** Telegram, Discord, Fakechat (demo). No Slack.

### How Channels Compare to DorkOS Relay

| Dimension            | Claude Code Channels               | DorkOS Relay                                       |
| -------------------- | ---------------------------------- | -------------------------------------------------- |
| **Problem solved**   | External events → running session  | Agent ↔ agent, agent ↔ external                    |
| **Persistence**      | None — events lost if offline      | Maildir + SQLite inbox queuing                     |
| **Session coupling** | Must be running                    | Decoupled — messages wait                          |
| **Transport**        | MCP stdio (subprocess)             | NATS-style subject bus + SSE                       |
| **Multi-agent**      | Single session only                | Any number of agents                               |
| **Routing**          | Source name + meta attributes      | Subject hierarchy + pattern matching               |
| **Reliability**      | None (fire-and-forget)             | Circuit breakers, backpressure, DLQ, rate limiting |
| **Auth**             | claude.ai login + sender allowlist | Per-adapter configuration                          |
| **Platform support** | Telegram, Discord                  | Slack, Telegram, webhooks, extensible              |
| **Runtime coupling** | Claude Code only                   | Runtime-agnostic via adapters                      |
| **Budget/safety**    | `--dangerously-skip-permissions`   | Hop limits, TTL, call budgets                      |

**Verdict:** Channels is a narrow feature for a specific runtime (Claude Code). DorkOS Relay is infrastructure. They operate at different levels of abstraction.

### Where Channels Adds Value DorkOS Doesn't Have

1. **In-context event injection.** When an event arrives via Channels, Claude already has the user's files, git state, and working context. DorkOS currently delivers messages to agent sessions, but the session must process them from cold context. Channels events arrive _inside_ the active reasoning loop.

2. **Zero-config external bridging.** `--channels plugin:telegram@claude-plugins-official` gives a user a working Telegram bridge in one command. DorkOS's Slack/Telegram adapters require server-side configuration.

3. **MCP ecosystem leverage.** Because Channels are just MCP servers, the entire MCP plugin ecosystem can be repurposed as event sources.

### Where DorkOS Is Strictly Better

1. **Offline message delivery.** Channels events are lost when sessions are offline. Relay queues them.
2. **Multi-runtime support.** Relay works with Claude Code, Cursor, Codex, and any future runtime. Channels is Claude Code only.
3. **Agent-to-agent routing.** Channels is external→agent. Relay is agent↔agent with namespace isolation.
4. **Reliability engineering.** Circuit breakers, backpressure, dead-letter queues, rate limiting — none of which exist in Channels.
5. **Slack support.** Channels has no Slack. Relay has a production Slack adapter.

---

## Part 2: Agent2Agent (A2A) Protocol

### What A2A Is

A2A is an open standard (Google, April 2025; Linux Foundation stewardship, June 2025) for AI agents to discover each other, exchange information, and coordinate tasks across vendor and framework boundaries. 150+ organizations support it. Pre-1.0, with SDKs in Python, JS/TS, Java, Go, .NET.

**Core concepts:**

- **Agent Cards** (`/.well-known/agent.json`) — discovery metadata: name, skills, capabilities, auth
- **Tasks** — stateful work units with lifecycle (working → input-required → completed/failed)
- **Messages** — communication turns with multi-part content (text, files, structured data)
- **Artifacts** — tangible outputs generated during task execution
- **Streaming** — SSE for real-time updates; WebHooks for async push

**Transport:** JSON-RPC 2.0 over HTTPS. Three bindings: JSON-RPC, gRPC, HTTP/REST.

### How A2A Compares to DorkOS Mesh + Relay

| Dimension          | A2A Protocol                                  | DorkOS Mesh + Relay                   |
| ------------------ | --------------------------------------------- | ------------------------------------- |
| **Problem solved** | Cross-vendor agent interoperability           | Single-instance agent coordination    |
| **Discovery**      | Agent Cards at well-known URL                 | Filesystem scanning + SQLite registry |
| **Communication**  | HTTP point-to-point, JSON-RPC                 | NATS-style pub/sub via broker         |
| **Persistence**    | Client must poll/reconnect                    | Maildir + SQLite inbox                |
| **Scaling**        | O(n²) — each pair needs a connection          | O(n) — all agents connect to broker   |
| **Auth**           | OpenAPI security schemes (OAuth2, mTLS, etc.) | Per-adapter config, namespace ACLs    |
| **State model**    | Task lifecycle (working, completed, etc.)     | Envelope + budget (hops, TTL)         |
| **Orchestration**  | Not specified (app layer)                     | Access control + budget enforcement   |
| **Scope**          | Internet-scale, cross-organization            | Single DorkOS instance                |
| **Maturity**       | Pre-1.0, active development                   | Production, stable internal use       |

### Where A2A Adds Value DorkOS Doesn't Have

1. **Cross-instance interoperability.** DorkOS agents can only communicate within a single instance. A2A enables communication with any A2A-compliant agent on the internet — LangGraph, Google ADK, Spring AI, etc.

2. **Standardized discovery.** Agent Cards at `/.well-known/agent.json` is a convention the broader ecosystem understands. DorkOS's discovery is filesystem-based and internal.

3. **Rich authentication.** A2A supports OAuth2, OIDC, mTLS — enterprise IAM patterns. DorkOS uses per-adapter config without standardized auth negotiation.

4. **Format negotiation.** A2A's Parts system with mediaType and format declarations allows agents to negotiate content types. DorkOS's StandardPayload is simpler.

5. **Ecosystem momentum.** 150+ organizations, 5 official SDKs, Linux Foundation governance. Adopting A2A makes DorkOS agents accessible to the growing ecosystem.

### Where DorkOS Is Strictly Better

1. **Broker-mediated scaling.** A2A's O(n²) point-to-point connections don't scale. Relay's pub/sub is O(n).
2. **Durable message delivery.** A2A has no built-in message queue. If the server is down, messages are lost.
3. **Budget enforcement.** Hop limits, TTL, call budgets prevent runaway agent chains. A2A has no equivalent.
4. **Namespace isolation.** DorkOS enforces invisible boundaries between agent groups. A2A has no native namespace concept.
5. **Reliability stack.** Circuit breakers, backpressure, DLQ — none specified in A2A.

---

## Part 3: Three-System Comparison Matrix

| Capability                          | DorkOS Relay/Mesh                | Claude Code Channels        | A2A Protocol                  |
| ----------------------------------- | -------------------------------- | --------------------------- | ----------------------------- |
| Agent discovery                     | Filesystem scan + DB registry    | N/A (single session)        | Agent Cards (well-known URL)  |
| Agent-to-agent messaging            | Yes (pub/sub)                    | No (external→session only)  | Yes (HTTP point-to-point)     |
| External platform bridging          | Yes (Slack, Telegram, webhooks)  | Yes (Telegram, Discord)     | Not built-in                  |
| Message persistence                 | Yes (Maildir + SQLite)           | No                          | No                            |
| Offline delivery                    | Yes                              | No                          | No (client must reconnect)    |
| Multi-runtime                       | Yes (Claude Code, Cursor, Codex) | No (Claude Code only)       | Yes (any A2A-compliant agent) |
| Cross-instance                      | No (single instance)             | No (single session)         | Yes (internet-scale)          |
| Reliability (circuit breakers, DLQ) | Yes                              | No                          | No                            |
| Budget/safety enforcement           | Yes (hops, TTL, call limits)     | No                          | No                            |
| Namespace isolation                 | Yes                              | N/A                         | No                            |
| Streaming                           | SSE (client sync)                | MCP notifications (stdio)   | SSE + WebHooks                |
| Authentication                      | Per-adapter                      | claude.ai login + allowlist | OAuth2, OIDC, mTLS, API keys  |
| Ecosystem interop                   | DorkOS only                      | Claude Code only            | 150+ orgs, 5 SDKs             |
| Maturity                            | Production                       | Research preview            | Pre-1.0                       |

---

## Part 4: Integration Strategies

### Strategy 1: A2A Gateway (Recommended — High Value, Medium Effort)

**Concept:** Expose DorkOS agents as A2A-compliant endpoints. DorkOS becomes an A2A server that external agents can discover and invoke, while internally routing through Relay.

**Architecture:**

```
External A2A Client (LangGraph, ADK, etc.)
         │
         ▼
    GET /.well-known/agent.json   →   DorkOS generates Agent Card from Mesh registry
    POST /a2a  SendMessage        →   DorkOS A2A Gateway
         │
         ▼
    A2A Gateway (new Express routes)
         │
         ├── Translates A2A Task → RelayEnvelope
         ├── Publishes to relay.agent.{namespace}.{agent-id}
         ├── Opens SSE subscription for response
         └── Translates RelayEnvelope → A2A TaskStatusUpdate/ArtifactUpdate
         │
         ▼
    Relay (existing infrastructure)
         │
         ▼
    Target Agent (via ClaudeCodeAdapter, etc.)
```

**What we'd build:**

1. `GET /.well-known/agent.json` — generates Agent Card from Mesh registry (agent manifest → Agent Card mapping)
2. `GET /a2a/agents/:id/card` — per-agent Agent Card with skills derived from capabilities
3. `POST /a2a` — JSON-RPC 2.0 handler implementing `message/send`, `message/stream`, `tasks/get`, `tasks/cancel`
4. A2A Task → Relay envelope translator (maps A2A Messages/Parts to StandardPayload)
5. Relay response → A2A Task/Artifact translator (maps responses back to A2A format)
6. Auth integration: expose DorkOS's existing MCP API key auth as an A2A security scheme

**What we'd NOT build:**

- A2A as internal transport (Relay is better for our use case)
- A2A client for outbound calls to external agents (phase 2)
- gRPC binding (JSON-RPC is sufficient initially)

**Value:**

- DorkOS agents become discoverable and invocable by the entire A2A ecosystem
- Zero changes to existing Relay/Mesh internals
- Natural extension of the existing MCP server at `/mcp`

**Effort:** ~1-2 weeks. New route module + schema translation layer. No changes to core infrastructure.

**Risks:**

- A2A is pre-1.0 — breaking changes possible
- A2A Task lifecycle is richer than Relay's envelope model (need to synthesize task state from message flow)

### Strategy 2: Channels-Aware Claude Code Adapter (Recommended — Medium Value, Low Effort)

**Concept:** When DorkOS's ClaudeCodeAdapter needs to deliver a message to a running Claude Code session, check if a Channels endpoint is available and use it for in-context delivery.

**Architecture:**

```
Relay message → ClaudeCodeAdapter
    │
    ├── Is session running with Channels enabled?
    │   ├── YES: Inject via MCP notification (in-context, zero latency)
    │   └── NO:  Queue in Maildir (existing behavior)
    │
    └── Fallback: standard session dispatch
```

**What we'd build:**

1. A DorkOS Channel plugin (MCP server) that Claude Code sessions can opt into
2. The plugin connects to DorkOS Relay and subscribes to the agent's subject
3. When a Relay message arrives, emits `notifications/claude/channel` to the session
4. For replies, exposes a `relay_reply` MCP tool that publishes back through Relay
5. Plugin registration: `--channels server:dorkos-relay` in `.mcp.json`

**What this solves:**

- Messages from other DorkOS agents arrive _in context_ of what the Claude Code session is working on
- Slack messages routed through Relay → Channel arrive without cold-starting a new session
- Human messages from Telegram/Slack arrive via Relay's adapters, then into the active session

**Value:**

- Best-of-both-worlds: Relay's reliability + Channels' in-context delivery
- No changes to Relay core — the Channel plugin is a new adapter/bridge

**Effort:** ~3-5 days. Small MCP server (~200 lines) + adapter bridge.

**Risks:**

- Channels is research preview — the duplicate-spawn bug and `meta` key constraints apply
- Only benefits Claude Code sessions, not Cursor or Codex agents
- Requires sessions to opt in via `--channels`

### Strategy 3: A2A Client for External Agent Delegation (Future — High Value, High Effort)

**Concept:** DorkOS agents can discover and delegate work to external A2A-compliant agents (LangGraph, Google ADK, etc.).

**Architecture:**

```
DorkOS Agent (Claude Code session)
    │
    ├── "delegate to inventory-agent at agents.example.com"
    │
    ▼
A2A Client (new service)
    │
    ├── Fetch Agent Card from /.well-known/agent.json
    ├── Authenticate per security scheme
    ├── POST /a2a SendMessage
    ├── Stream SSE responses
    └── Map A2A Artifacts → Relay messages back to originating agent
```

**What we'd build:**

1. `A2AClientService` — fetches Agent Cards, manages auth, sends messages
2. MCP tool `delegate_to_a2a_agent` — exposed in DorkOS's external MCP server
3. Agent Card cache + discovery registry for external agents
4. Response routing: A2A task updates → Relay messages back to the calling agent

**Value:**

- DorkOS becomes a "super-orchestrator" that can leverage any A2A agent
- Kai can tell his Claude Code agent to delegate inventory checks to a specialized agent at another company

**Effort:** ~2-3 weeks. New service + MCP tool + discovery integration.

**Defer until:** A2A reaches 1.0 and ecosystem has production-grade agents to delegate to.

### Strategy 4: Agent Card Generation from Mesh Registry (Recommended — Low Effort, Immediate Value)

**Concept:** Automatically generate A2A-compatible Agent Cards from DorkOS Mesh agent manifests. Even before full A2A protocol support, this makes DorkOS agents discoverable.

**Mapping:**

```typescript
// Mesh AgentManifest → A2A Agent Card
{
  name: manifest.name,
  description: `DorkOS agent: ${manifest.name}`,
  url: `${dorkosBaseUrl}/a2a`,
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: manifest.capabilities.map(cap => ({
    id: cap,
    name: cap,
    description: `Agent capability: ${cap}`,
  })),
  securitySchemes: {
    apiKey: { type: "apiKey", in: "header", name: "X-API-Key" }
  },
  security: [{ apiKey: [] }],
}
```

**Effort:** ~1 day. Single route + schema mapper.

### Integration Priority Roadmap

| Phase | Strategy                            | Effort    | Value               | When          |
| ----- | ----------------------------------- | --------- | ------------------- | ------------- |
| 1     | Agent Card generation (Strategy 4)  | 1 day     | Discoverability     | Now           |
| 2     | Channels-aware adapter (Strategy 2) | 3-5 days  | In-context delivery | Next sprint   |
| 3     | A2A Gateway (Strategy 1)            | 1-2 weeks | Ecosystem interop   | Q2 2026       |
| 4     | A2A Client delegation (Strategy 3)  | 2-3 weeks | Full interop        | After A2A 1.0 |

---

## Part 5: Should DorkOS Adopt A2A?

### The Case For

1. **Ecosystem leverage.** 150+ organizations are building A2A-compliant agents. Being A2A-compatible means Kai's agents can interoperate with LangGraph agents, Google ADK agents, Spring AI agents, etc. without custom integrations.

2. **Discovery standard.** Agent Cards solve a problem DorkOS currently doesn't address: how does an external system find and understand what a DorkOS agent can do? Mesh discovery is filesystem-based and internal.

3. **Complementary architecture.** A2A + Relay is the combination HiveMQ recommends: A2A for semantic interoperability (Agent Cards, task semantics), message broker for reliable delivery. DorkOS already has the broker. Adding A2A gives us the semantic layer.

4. **Future-proofing.** If A2A becomes the industry standard (Linux Foundation backing, 150+ orgs, IBM ACP absorbed), not supporting it becomes a competitive disadvantage.

5. **Low cost of adoption.** A2A as an external gateway doesn't require replacing Relay. It's an additional surface, not a replacement.

### The Case Against

1. **Pre-1.0 instability.** Breaking changes are expected. Early adoption means maintenance burden.

2. **DorkOS's users don't need it yet.** Kai manages 10-20 agents on a single machine. Cross-organization agent delegation is a future problem, not today's.

3. **Quadratic scaling is a footgun.** If users start adding dozens of A2A connections, the O(n²) topology becomes unmanageable — but DorkOS's internal Relay avoids this.

4. **Missing players.** OpenAI and Microsoft haven't endorsed A2A. Agents built on those platforms won't be reachable via A2A.

### Recommendation: **Yes, adopt A2A — as an external gateway, not as internal transport.**

The architecture is clear: Relay stays as DorkOS's internal message bus (it's architecturally better for our use case). A2A becomes the external-facing interoperability layer that lets DorkOS agents be discovered and invoked by the broader ecosystem. This is additive, not disruptive.

Start with Agent Card generation (trivial), then build the A2A gateway when there are real external agents to interoperate with.

---

## Part 6: Should DorkOS Integrate Claude Code Channels?

### The Case For

1. **In-context delivery is genuinely better.** When a Relay message arrives via Channels, it lands inside the active reasoning context — no cold-start, no context reconstruction. This is measurably better UX for the agent.

2. **Leverages Anthropic's investment.** Channels is Anthropic's first-party solution for event injection. Building on it means we benefit from their security hardening, enterprise controls, and future improvements.

3. **Low effort.** A DorkOS Channel plugin is ~200 lines. It bridges Relay → MCP notification. The infrastructure already exists on both sides.

4. **Fills the Slack gap for Claude Code users.** Channels has no Slack. DorkOS Relay has Slack. A DorkOS Channel plugin means Slack messages reach Claude Code sessions — something Anthropic's official channels can't do today.

### The Case Against

1. **Research preview instability.** The duplicate-spawn bug (#36800) breaks stateful channels. Our plugin would need defensive mitigations.

2. **Claude Code only.** Cursor, Codex, and future runtimes won't benefit. The investment only pays off for one runtime.

3. **Session must be running.** If the session is offline, the Channel is useless and we fall back to Relay's mailbox anyway. The happy path is narrow.

4. **Adds a dependency on an unstable feature.** If Channels changes protocol or gets deprecated, we maintain code against a moving target.

### Recommendation: **Yes, build a DorkOS Channel plugin — but as an optimization, not a dependency.**

The architecture: Relay remains the primary delivery path. When a target Claude Code session has the DorkOS Channel plugin active, delivery happens via Channels (in-context, zero latency). When the session is offline or the plugin isn't active, Relay's mailbox handles it. Graceful degradation, not hard dependency.

Wait for the duplicate-spawn bug to be resolved before shipping to users. Build it now for internal validation.

---

## Part 7: Architectural Vision — Where This All Leads

```
                    ┌──────────────────────────────────────────┐
                    │          External Agent Ecosystem          │
                    │  (LangGraph, Google ADK, Spring AI, ...)  │
                    └──────────────────┬───────────────────────┘
                                       │
                              A2A Protocol (JSON-RPC/SSE)
                                       │
                    ┌──────────────────▼───────────────────────┐
                    │           DorkOS A2A Gateway               │
                    │  /.well-known/agent.json (Agent Cards)    │
                    │  POST /a2a (JSON-RPC handler)             │
                    └──────────────────┬───────────────────────┘
                                       │
                              Translate: A2A ↔ Relay
                                       │
    ┌──────────────────────────────────▼──────────────────────────────────┐
    │                         DorkOS Relay (Internal Bus)                  │
    │                                                                      │
    │  NATS-style subjects: relay.agent.{ns}.{id}, relay.human.{platform} │
    │  Maildir persistence, circuit breakers, backpressure, DLQ           │
    │  Access control, budget enforcement, namespace isolation             │
    │                                                                      │
    ├─────────┬──────────┬──────────┬──────────┬──────────┬───────────────┤
    │         │          │          │          │          │               │
    ▼         ▼          ▼          ▼          ▼          ▼               ▼
 Claude    Cursor     Codex    Slack       Telegram   Webhook    Future
 Code      Adapter   Adapter  Adapter     Adapter    Adapter    Adapters
 Adapter                                                        (A2A Client,
    │                                                            email, etc.)
    │
    ├── Standard path: session dispatch via SDK
    └── Optimized path: MCP Channel injection (when session active + plugin enabled)
```

This architecture preserves everything DorkOS does well (broker-mediated reliability, namespace isolation, multi-runtime support) while adding two new surfaces:

- **A2A inbound:** External agents can discover and invoke DorkOS agents
- **Channels optimization:** Active Claude Code sessions get zero-latency in-context delivery

Neither requires replacing existing infrastructure. Both are additive.

---

## Sources

### Claude Code Channels

- [Channels Reference (Official)](https://code.claude.com/docs/en/channels-reference)
- [Channels User Guide (Official)](https://code.claude.com/docs/en/channels)
- [Agent Teams (Official)](https://code.claude.com/docs/en/agent-teams)
- [GitHub Issue #36800 — Duplicate Plugin Instances](https://github.com/anthropics/claude-code/issues/36800)
- [Anthropic turns Claude Code into an always-on AI agent](https://the-decoder.com/anthropic-turns-claude-code-into-an-always-on-ai-agent-with-new-channels-feature/)
- [Claude Code Channels vs OpenClaw: Tradeoffs](https://dev.to/ji_ai/claude-code-channels-vs-openclaw-the-tradeoffs-nobodys-talking-about-2h5h)
- [Coding via Telegram with Claude Code Channels — Honest Comparison](https://jangwook.net/en/blog/en/claude-code-channels-telegram-bridge/)
- [How to Connect External Webhooks via Channels and Hookdeck CLI](https://hookdeck.com/blog/claude-code-channels-webhooks-hookdeck)
- [claude-plugins-official (GitHub)](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins)

### A2A Protocol

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [Google Developers Blog: A2A Launch](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [A2A and MCP Relationship](https://a2a-protocol.org/latest/topics/a2a-and-mcp/)
- [A2A Key Concepts](https://a2a-protocol.org/latest/topics/key-concepts/)
- [Linux Foundation A2A Launch](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project)
- [IBM Think: Agent2Agent Protocol](https://www.ibm.com/think/topics/agent2agent-protocol)
- [HiveMQ: A2A Enterprise Scale](https://www.hivemq.com/blog/a2a-enterprise-scale-agentic-ai-collaboration-part-1/)
- [Auth0: MCP vs A2A](https://auth0.com/blog/mcp-vs-a2a/)
- [arXiv: Improving Google A2A Protocol](https://arxiv.org/html/2505.12490v3)
- [a2aproject/A2A (GitHub)](https://github.com/a2aproject/A2A)
- [Gravitee: A2A vs MCP](https://www.gravitee.io/blog/googles-agent-to-agent-a2a-and-anthropics-model-context-protocol-mcp)
- [Spring AI A2A Integration](https://spring.io/blog/2026/01/29/spring-ai-agentic-patterns-a2a-integration/)

### DorkOS Internal

- `packages/relay/src/` — Relay core, adapters, delivery pipeline
- `packages/mesh/src/` — Mesh core, agent registry, discovery, topology
- `packages/shared/src/relay-schemas.ts` — Message schemas
- `contributing/relay-adapters.md` — Adapter development guide
- `contributing/architecture.md` — Hexagonal architecture
