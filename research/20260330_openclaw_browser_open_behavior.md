---
title: 'OpenClaw: Browser Auto-Open Behavior on Startup'
date: 2026-03-30
type: external-best-practices
status: active
tags: [openclaw, cli, browser, dev-server, startup, flags]
searches_performed: 6
sources_count: 8
---

## Research Summary

OpenClaw is a real, actively-maintained open-source AI agent framework (not a dev server tool). It has a `openclaw dashboard` command that auto-opens the browser by default. The opt-out flag is `--no-open`. There is no explicit `--open` flag — browser opening is the default behavior with no flag required.

## Key Findings

1. **OpenClaw exists and is a known tool**: It is an open-source personal AI assistant CLI framework (formerly known as Clawdbot/Moltbot). Published on npm as `openclaw`, MIT-licensed, with a GitHub repo at `github.com/openclaw/openclaw`. Not a dev server build tool — it is an AI agent orchestration platform.

2. **Default browser behavior**: Running `openclaw dashboard` auto-opens the default system browser if possible. The docs describe it as: "copies link, opens browser if possible, shows SSH hint if headless."

3. **`--no-open` flag**: The only documented flag for controlling this behavior is `--no-open`. It suppresses the automatic browser launch and instead prints the URL (including a tokenized auth URL) to the terminal. Primary use case is headless/remote server deployments where a GUI browser is not available.

4. **No `--open` flag**: There is no documented `--open` flag. Auto-open is the default and requires no flag.

5. **Security dimension**: The `--no-open` flag also has a security dimension — it avoids exposing authentication tokens via browser-launch arguments, process lists, or clipboard history. Operators on remote servers use it to get the URL and then forward it via SSH tunnel.

## Detailed Analysis

### The `openclaw dashboard` Command

The command does three things by default:

- Copies the dashboard link to the clipboard
- Attempts to open the default system browser
- Falls back to printing an SSH forwarding hint if a browser cannot be launched (headless detection)

With `--no-open`:

- Does NOT open a browser
- Prints the tokenized URL to stdout only
- Safe for remote/headless environments

### Token Handling

The dashboard URL contains an auth token as a URL fragment for one-time bootstrap. The Control UI stores it in `sessionStorage` (not `localStorage`) for the current tab session. If `gateway.auth.token` is externally managed (SecretRef), the dashboard command intentionally omits the token from the URL to avoid leaking it in shell logs.

### What OpenClaw Is (Not a Dev Server)

OpenClaw is not a Vite/webpack-style dev server. It is an AI agent platform with:

- A local Gateway daemon (control plane for sessions, channels, tools, events)
- 26+ tools (browser, exec, web_search, file read/write, etc.)
- 53+ skills (task workflows)
- Channel integrations: WhatsApp, Telegram, Slack, Discord, iMessage, etc.
- Requires Node 24 (recommended) or Node 22.16+

The browser-opening behavior is specifically tied to the `openclaw dashboard` subcommand, which opens the web-based Control UI — not a development hot-reload server.

## Sources & Evidence

- "copies link, opens browser if possible, shows SSH hint if headless" — [Dashboard - OpenClaw](https://docs.openclaw.ai/web/dashboard)
- "--no-open: Prevents the browser from launching automatically. Useful for remote servers or environments where automatic browser opening isn't possible." — [Accessing the OpenClaw Dashboard](https://open-claw.bot/docs/cli/dashboard/)
- "appending the flag instructs the CLI to merely print the URL to the console" — [Comprehensive Guide to OpenClaw Dashboard --no-open Tokenized URL](https://skywork.ai/skypage/en/openclaw-dashboard-guide/2037426102045773824)
- npm package: [openclaw - npm](https://www.npmjs.com/package/openclaw)
- GitHub: [openclaw/openclaw](https://github.com/openclaw/openclaw)
- Official docs install: [Install - OpenClaw](https://docs.openclaw.ai/install)

## Research Gaps & Limitations

- The exact flag syntax (whether `--no-open` is the only variant, or if aliases like `--no-browser` exist) was not confirmed from primary source code; it was confirmed from multiple secondary documentation sites.
- The GitHub repo README did not surface detailed flag documentation in the fetch attempt — `openclaw dashboard --help` output would be the definitive reference.

## Search Methodology

- Searches performed: 6
- Most productive search terms: `openclaw dashboard --no-open flag headless server`, `openclaw browser open startup flags`
- Primary information sources: docs.openclaw.ai, open-claw.bot, skywork.ai guide, github.com/openclaw/openclaw
