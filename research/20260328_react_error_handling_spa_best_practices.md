---
title: 'React 19 + TanStack Router + TanStack Query — Error Handling Best Practices'
date: 2026-03-28
type: external-best-practices
status: active
tags:
  [
    error-handling,
    react-19,
    tanstack-router,
    tanstack-query,
    error-boundary,
    404,
    not-found,
    shadcn,
    spa,
    ux,
    developer-tools,
  ]
feature_slug: error-handling-system
searches_performed: 14
sources_count: 28
---

# React 19 + TanStack Router + TanStack Query — Error Handling Best Practices

## Research Summary

This report covers best practices for a five-level error handling architecture in a React 19 + Vite 6 + TanStack Router + TanStack Query SPA. The five levels are: (1) React 19 `createRoot` error hooks, (2) react-error-boundary at the top of the component tree, (3) TanStack Router route-level `errorComponent`, (4) TanStack Router `notFoundComponent` for 404s, and (5) TanStack Query `QueryCache`/`MutationCache` global handlers with `throwOnError` and `QueryErrorResetBoundary`. The DorkOS "Calm Tech" design language (dark, zinc/neutral, minimal, honest) should carry through all error surfaces. Existing research at `research/20260316_sdk_result_error_ux_patterns.md` and `research/20260316_error_categorization_retry.md` covers chat-level (inline message stream) errors in depth — this report covers the structural/routing/query layer above that.

---

## Key Findings

### 1. React 19 Introduces Two New createRoot Error Hooks

React 19 adds `onCaughtError` and `onUncaughtError` as options to `createRoot()`. These are the correct place to wire a monitoring service (Sentry, PostHog, custom logger).

- **`onCaughtError(error, errorInfo)`** — called when React catches an error inside an Error Boundary during rendering. `errorInfo.componentStack` is available.
- **`onUncaughtError(error, errorInfo)`** — called when an error is thrown but NOT caught by any Error Boundary. Replaces the old pattern of listening to `window.onerror` for React rendering errors.

Previously (React 18), `componentDidCatch` logged the same error multiple times (once per sibling component trying to render). React 19 bails out after the first error, so you get exactly one log per caught error. This means deduplication logic in error logging middleware is no longer needed.

**Practical setup for DorkOS `main.tsx`:**

```typescript
const root = createRoot(document.getElementById('root')!, {
  onUncaughtError: (error, info) => {
    // Error not caught by any ErrorBoundary — full app crash scenario
    console.error('[dorkos:uncaught]', error, info.componentStack);
    // Wire to monitoring here
  },
  onCaughtError: (error, info) => {
    // Caught by an ErrorBoundary — recovery UI is showing
    console.warn('[dorkos:caught]', error, info.componentStack);
    // Wire to monitoring here (lower severity)
  },
});
root.render(<App />);
```

### 2. react-error-boundary Is Still Best Practice with React 19

The native class-component approach (`getDerivedStateFromError` + `componentDidCatch`) still works and is not deprecated. However, `react-error-boundary` (by Brian Vaughn, the React team member) remains the standard choice because:

- **`FallbackComponent` / `fallbackRender` props** — cleaner API than a separate class component file
- **`resetKeys` prop** — auto-resets the boundary when specified values change (e.g., route pathname changes)
- **`onReset` prop** — callback when `resetErrorBoundary()` is called from the fallback UI
- **`onError` prop** — called when an error is caught, useful for per-boundary logging
- **`useErrorBoundary()` hook** — allows functional components to imperatively trigger the nearest error boundary via `showBoundary(error)`, useful for async errors in event handlers that don't naturally bubble to ErrorBoundary

**React 19 compatibility:** The package is compatible with React 19. React 19's form actions and `useTransition` automatically propagate thrown errors to the nearest error boundary — no special integration required.

**Key limitation:** ErrorBoundary does NOT catch:

- Event handler errors (use try/catch + `showBoundary()`)
- Async errors in effects (use try/catch + `showBoundary()`)
- Server-side rendering errors
- Errors in the ErrorBoundary itself

### 3. TanStack Router errorComponent — Two Distinct Recovery Paths

TanStack Router provides built-in error boundaries per route via the `errorComponent` property. The key distinction is **what caused the error**:

**Rendering error (in component JSX):** Call `reset()` from `ErrorComponentProps` to retry the render.

**Loader/beforeLoad error (in route loading phase):** Call `router.invalidate()` which both re-runs the loader AND resets the error boundary. Calling `reset()` alone does NOT re-run the loader.

```typescript
import { ErrorComponentProps, useRouter } from '@tanstack/react-router';

function RouteErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  const handleRetry = () => {
    // router.invalidate() handles both loader-phase AND render-phase errors correctly
    // It re-runs loaders AND resets the error boundary reset key
    router.invalidate();
  };

  return (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={handleRetry}>Retry</button>
    </div>
  );
}
```

**Auto-reset on navigation:** TanStack Router's `CatchBoundary` has a `resetKey` tied to `router.state.loadedAt` — the error boundary automatically clears when a new navigation completes. This means an error in `/session` clears when the user navigates to `/`. No manual reset needed for navigation-driven recovery.

**`defaultErrorComponent`:** Set at the router level to apply as a fallback for all routes that don't define their own `errorComponent`. This is the minimum viable setup:

```typescript
const router = createRouter({
  routeTree,
  defaultErrorComponent: GlobalRouteErrorFallback,
  defaultNotFoundComponent: GlobalNotFoundComponent,
});
```

**`onCatch` callback at route level:** Each route can define an `onCatch(error, errorInfo)` callback — this is the correct place for route-specific error logging/telemetry.

### 4. TanStack Router notFoundComponent — Two Modes

Not-found errors come from two sources:

1. **No route matches the URL** (structural 404)
2. **`notFound()` thrown from a loader** (resource 404 — e.g., session ID doesn't exist)

**Configuration:** The root route (`__root`) should define `notFoundComponent`. When `notFoundMode` is `'fuzzy'` (default), the router finds the closest parent route with a `notFoundComponent` and renders it with the parent route's layout (sidebar, header) intact. When `notFoundMode` is `'root'`, all 404s go to the root route's component.

**DorkOS recommendation:** Use `'fuzzy'` mode. A session 404 should render within the `SessionPage` layout (with sidebar visible), not blow away the entire shell.

**Key constraint:** Routes must have `children` and an `<Outlet>` to render `notFoundComponent`. The root route already satisfies this.

**`beforeLoad` limitation:** Throwing `notFound()` in `beforeLoad` always goes to the root `notFoundComponent` regardless of `notFoundMode`, because `beforeLoad` runs before route matching completes.

**`notFound()` in loaders:**

```typescript
export const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/session',
  loader: async ({ context, search }) => {
    const session = await context.queryClient.fetchQuery(sessionQueryOptions(search.session));
    if (!session) throw notFound(); // renders notFoundComponent at nearest route
    return session;
  },
  notFoundComponent: SessionNotFound,
  errorComponent: SessionErrorFallback,
});
```

### 5. TanStack Query v5 Global Error Handling

**Key v5 change:** `onError`, `onSuccess`, `onSettled` callbacks were removed from `useQuery` and `QueryObserver` to prevent confusion about when they fire (they fired per-observer, not per-fetch, causing multiple calls). The correct global error handling pattern in v5 uses `QueryCache`:

```typescript
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Called exactly once per failed query (not per observer)
      // query.meta can carry per-query configuration
      const label = (query.meta?.errorLabel as string) ?? 'Query failed';
      console.error(`[dorkos:query] ${label}`, error);
      // Show a toast for non-boundary errors
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error('[dorkos:mutation]', error, mutation.options.mutationKey);
    },
  }),
});
```

**`throwOnError` (renamed from `useErrorBoundary` in v5):** When `true` (or a predicate function), a query failure re-throws the error into React's component tree, causing the nearest error boundary to catch it. Default behavior:

```typescript
// Default: only throw to error boundary if no cached data exists
throwOnError: (error, query) => typeof query.state.data === 'undefined';
```

This means: if a query has stale data in cache, it shows stale data silently on error (graceful degradation). If there's no prior data, it throws to the nearest boundary.

**`useSuspenseQuery`:** Always uses `throwOnError: true`. Cannot be overridden. This is intentional — Suspense mode assumes error boundaries handle errors.

**`QueryErrorResetBoundary`:** Required when using `throwOnError: true` or `useSuspenseQuery` inside an error boundary. Without it, re-rendering after reset triggers the same error immediately (the query is still in error state). `QueryErrorResetBoundary` resets all queries within its scope when `resetErrorBoundary()` is called.

```typescript
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

function SessionPageWrapper() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          FallbackComponent={SessionErrorFallback}
        >
          <SessionPage />
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

**The `meta` field pattern for selective error handling:**

```typescript
// Opt specific queries into toast-based errors (not boundary)
useQuery({
  ...sessionQueryOptions(id),
  throwOnError: false, // handle inline
  meta: { errorLabel: 'Failed to load session' },
});
```

This lets the `QueryCache.onError` handler show a toast for this specific query while other queries bubble to boundaries.

### 6. Error Page Design for Developer Tools

**Industry reference patterns (Linear, Vercel, GitHub):**

- **Linear** uses minimal, high-contrast error pages with a short status message, a single CTA ("Go to home"), and optionally a muted code/ID. No illustrations, no apologetic copy.
- **Vercel Dashboard** shows the error code prominently (500, 404), a one-sentence explanation, and a "Back to dashboard" link. Very dark, neutral palette — matches the product shell.
- **GitHub** 404 is famous for its Octocat illustration — but that works because GitHub has strong consumer brand identity. Developer tools without that established brand should avoid whimsical illustrations; they read as off-brand noise.

**Copy tone for DorkOS:**

- No apologies: "Not found" beats "Sorry, we couldn't find that page."
- Honest: tell the user exactly what happened, no vague "something went wrong."
- Actionable: one primary CTA — "Go to dashboard" or "Retry."
- Technical detail: collapse raw error info behind a `<details>` or chevron — available for debugging, not the primary message.

**Information hierarchy for error pages:**

1. Status (what happened) — short, bold, e.g., "Session not found"
2. Context (why) — one sentence, e.g., "The session ID in the URL doesn't match any recorded session."
3. Action (next step) — single button, e.g., "View all sessions"
4. Debug (optional, collapsed) — error code, stack fragment, correlation ID

**404 specific:** Avoid HTTP status code language ("404 Not Found") in the headline — users don't think in HTTP. Say "Session not found" or "Page not found" instead. The HTTP 404 is fine as a muted secondary label.

**DorkOS "Calm Tech" aesthetic for error pages:**

- Background: `bg-background` (zinc-950 in dark)
- Container: centered column, max-w-md, py-24
- Icon: Lucide `AlertTriangle` (error) or `Search` (not found), `text-muted-foreground`, `size-10`
- Headline: `text-lg font-medium text-foreground`
- Subtext: `text-sm text-muted-foreground`
- CTA: shadcn `Button` variant `"outline"` (not destructive — not the user's fault)
- Error code/detail: `text-xs font-mono text-muted-foreground/60`, collapsed

**What NOT to do:**

- No full-page red backgrounds
- No emoji in production error messages
- No "Oops!" or "Uh oh!" — these read as consumer app, not developer tool
- No illustrations unless on-brand and already in the design system
- No auto-redirect timers — let users control navigation

### 7. Dev Playground Error Component Showcase

**Pattern:** A controlled "error trigger" component that conditionally throws. Used to demonstrate all error states without needing to break real functionality.

```typescript
// Thin wrapper — toggle a boolean prop to trigger the boundary
function ErrorTrigger({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Controlled error for showcase');
  return null;
}
```

**Design system showcase structure (Storybook-equivalent in a `/dev` route):**

- Render each error variant side-by-side at natural size
- Include a toggle/button to trigger live errors in a sandboxed ErrorBoundary
- Show all categories: route error, not found, query error, inline chat error (from existing `ErrorPart`)
- Use `resetKeys` on the boundary so toggling the trigger prop auto-resets

**Key insight from Storybook research:** Storybook's own internal error boundary sometimes conflicts with custom error boundaries — for DorkOS's `/dev` playground approach (no Storybook), this is a non-issue. The dev-only route renders components directly with their error states.

---

## Detailed Analysis

### Architecture: Five-Level Error Hierarchy

```
Level 1: createRoot({ onUncaughtError, onCaughtError })
  └── Level 2: <ErrorBoundary> (top-level, wraps entire App)
        └── Level 3: TanStack Router <RouterProvider>
              └── defaultErrorComponent (all unhandled route errors)
              └── route-level errorComponent (per-route)
              └── defaultNotFoundComponent (all unhandled 404s)
              └── route-level notFoundComponent (per-route 404)
                    └── Level 4: <QueryErrorResetBoundary> + <ErrorBoundary>
                          (wrapping data-heavy features with Suspense queries)
```

Level 1 is "telemetry only" — it does not render any UI. It fires after the error boundary has caught and rendered fallback. It's the monitoring integration point.

Level 2 (top-level ErrorBoundary) is the last resort. It catches anything the router's error boundaries miss — including errors thrown in the router's own rendering, or errors during app initialization before the router renders. Its fallback is the most minimal possible: a plain HTML-like page that doesn't depend on any context providers (which may themselves have thrown).

Level 3 (TanStack Router) handles the vast majority of runtime errors. Route `errorComponent` renders with the parent layout intact (sidebar stays visible). `defaultErrorComponent` ensures no route is ever unhandled.

Level 4 (QueryErrorResetBoundary + ErrorBoundary) is needed only for routes that use `useSuspenseQuery` or `throwOnError: true`. For DorkOS's current architecture (TanStack Query without Suspense), this level is optional but recommended for the dashboard and session pages.

### TanStack Router and React ErrorBoundary: Interaction

TanStack Router uses its own `CatchBoundary` internally — it is a React class component error boundary under the hood. When `errorComponent` is configured on a route, that route's `CatchBoundary` catches the error and renders `errorComponent`. This is **a separate boundary from any `react-error-boundary` ErrorBoundary you wrap around the router**.

The interaction matrix:

- Error in a route component → caught by route's `CatchBoundary` → renders `errorComponent`
- Error in `RouterProvider` itself → NOT caught by route boundaries → caught by Level 2 top-level ErrorBoundary
- Error in a component that explicitly calls `showBoundary(error)` → propagates to nearest react-error-boundary ErrorBoundary (not TanStack Router's boundary)

**Practical implication:** If you use `react-error-boundary` inside a route component (e.g., to wrap a specific widget), that boundary catches before TanStack Router's route boundary. The `CatchBoundary` only catches what the inner boundaries don't.

### Retry Semantics: When Each Reset Mechanism Applies

| Error Source                  | Correct Reset Method                                              | Why                                              |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| Route component rendering     | `reset()` from `ErrorComponentProps`                              | Re-renders the component tree                    |
| Route loader / beforeLoad     | `router.invalidate()`                                             | Re-runs the loader AND resets the boundary       |
| TanStack Query (throwOnError) | `resetErrorBoundary()` wrapped in `QueryErrorResetBoundary` reset | Clears the query error state before re-rendering |
| Top-level ErrorBoundary       | Navigate away or `resetErrorBoundary()` with `resetKeys`          | Depends on what caused the top-level error       |

**Critical bug to avoid:** Calling only `reset()` when the error came from a loader leaves the loader result still in error state — the route re-renders, the loader error is still there, the error boundary fires again immediately. Always use `router.invalidate()` for loader errors.

### QueryCache Global Handler vs. throwOnError: When to Use Each

| Use Case                          | Pattern                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| Background refetch fails silently | `QueryCache.onError` toast notification                        |
| Critical page data fails to load  | `throwOnError: true` + ErrorBoundary                           |
| Optional widget data fails        | `throwOnError: false`, handle in component                     |
| Mutation fails                    | `MutationCache.onError` toast, inline form error               |
| Suspense query fails              | `useSuspenseQuery` + `QueryErrorResetBoundary` + ErrorBoundary |

The `QueryCache.onError` callback fires for ALL query failures regardless of `throwOnError`. So a sensible pattern is: use `QueryCache.onError` for logging/telemetry always, and additionally show a toast only for queries that opted out of boundary handling (`throwOnError: false`). This prevents duplicate user-visible feedback (toast + error boundary fallback for the same error).

Check via query meta:

```typescript
new QueryCache({
  onError: (error, query) => {
    logErrorToTelemetry(error);
    // Only show toast for queries that don't throw to boundary
    if (query.meta?.showToastOnError) {
      toast.error((query.meta.errorLabel as string) ?? 'Failed to load data');
    }
  },
});
```

---

## Potential Solutions (Per Level)

### Level 1: createRoot Error Hooks

**Approach A: Wire directly in main.tsx (Recommended)**

```typescript
createRoot(document.getElementById('root')!, {
  onUncaughtError: logUncaughtToMonitoring,
  onCaughtError: logCaughtToMonitoring,
});
```

Pros: Centralized, correct semantics, no wrapper component needed.
Cons: Only available in React 19+ (confirmed for DorkOS).

**Approach B: Sentry.init() with React plugin**
Sentry's React 19 support uses these same hooks internally. If you use Sentry, you get this for free.
Pros: Full session replay + breadcrumbs.
Cons: External dependency, overkill for a self-hosted dev tool.

**Recommendation:** Use Approach A with a simple structured logger (`@dorkos/shared/logger`).

---

### Level 2: Top-Level Error Boundary

**Approach A: react-error-boundary at root (Recommended)**

```typescript
// App.tsx
<ErrorBoundary FallbackComponent={AppCrashFallback} onError={logError}>
  <RouterProvider router={router} />
</ErrorBoundary>
```

**`AppCrashFallback` design:**

- No shadcn components (providers may be crashed)
- Inline styles only
- Message: "DorkOS encountered an unexpected error."
- Subtext: error.message in a `<pre>` block (collapsed by default)
- Button: `window.location.reload()` (hard refresh, bypasses React state)
- No navigation (router may be broken)

Pros: Zero dependencies in fallback, maximum reliability.
Cons: Jarring if it triggers — but it should be extremely rare.

**Approach B: Sentry ErrorBoundary wrapper**
Pros: Automatic error reporting.
Cons: Same as above.

**Recommendation:** Approach A. For DorkOS (developer tool with local data), a simple logger + reload is more appropriate than a cloud telemetry service.

---

### Level 3: TanStack Router Route Error Components

**Approach A: defaultErrorComponent at router + per-route overrides (Recommended)**

Configure `defaultErrorComponent` on the router for all unhandled cases. Override `errorComponent` only on routes that need specific recovery copy (e.g., "Session failed to load" vs generic "Something went wrong").

```typescript
const router = createRouter({
  routeTree,
  defaultErrorComponent: DefaultRouteError,
  defaultNotFoundComponent: DefaultNotFound,
});
```

`DefaultRouteError` props: `{ error: Error, reset: () => void }`
Use `router.invalidate()` for loader errors, `reset()` for render errors. When in doubt, `router.invalidate()` is safer — it handles both cases.

Pros: Consistent baseline, minimal per-route configuration.
Cons: Generic copy ("Something went wrong") may not be specific enough for some routes.

**Approach B: Per-route only, no default**
Pros: More control.
Cons: Any route without an `errorComponent` shows a TanStack Router generic default (unstyled, not on-brand).

**Recommendation:** Approach A always. A styled `defaultErrorComponent` is non-negotiable for a product with a design language.

---

### Level 4: TanStack Query Error Integration

**Approach A: QueryCache.onError for toast + throwOnError: false for component-level handling**
Most conservative, maximum explicit control. No error boundaries triggered by queries.
Pros: Predictable, easy to debug.
Cons: Components must handle `isError` states manually, more boilerplate.

**Approach B: throwOnError: true + QueryErrorResetBoundary (Recommended for critical queries)**
For queries that load primary page content (session data, agent list), throwing to the nearest boundary is correct. Wrap with `QueryErrorResetBoundary` to enable retry.
Pros: Cleaner component code, consistent recovery UX.
Cons: Requires `QueryErrorResetBoundary` wrapper; misuse causes infinite re-render on reset.

**Approach C: useSuspenseQuery everywhere**
The "full Suspense" approach — all data loading uses Suspense, all errors use boundaries.
Pros: Cleanest component code, natural loading/error state separation.
Cons: Requires `QueryErrorResetBoundary` on every Suspense boundary, significant refactor from current TanStack Query usage.

**Recommendation:** Approach B for primary page-level queries, Approach A for background/optional data. DorkOS's current usage is non-Suspense, so Approach C is a future consideration.

---

### Level 5: 404 / Not Found Pages

**Approach A: Root-level notFoundComponent + route-level overrides for resource 404s (Recommended)**

```typescript
// Root route
export const rootRoute = createRootRoute({
  notFoundComponent: GlobalNotFound,
  // ...
});

// Session route
export const sessionRoute = createRoute({
  // ...
  notFoundComponent: SessionNotFound, // "Session not found" with link to sessions list
  loader: async ({ search }) => {
    const session = await loadSession(search.session);
    if (!session) throw notFound();
    return session;
  },
});
```

`GlobalNotFound` design:

- "Page not found" headline
- "The URL you followed doesn't match any known route." subtext
- "Go to dashboard" button → navigate to `/`
- Muted `text-xs font-mono` showing the attempted path

`SessionNotFound` design (rendered within session layout, sidebar intact):

- "Session not found" headline
- "The session ID `{id}` doesn't exist or has been removed."
- "View all sessions" button → navigate to `/`

Pros: Correct behavior for both URL 404s and resource 404s. Route-level 404 preserves the app shell.
Cons: Requires consistent use of `throw notFound()` in loaders.

**Approach B: Single root-level notFoundComponent only**
Simpler but loses the layout context for resource 404s.

**Recommendation:** Approach A. The session-specific 404 with the sidebar intact is significantly better UX than a bare root-level 404 page.

---

## Security Considerations

- **Never expose raw stack traces in production error UI.** The `error.stack` property contains file paths that reveal code structure. Use `error.message` for display; collapse `error.stack` behind a developer-only disclosure.
- **Never log error details containing user content to external services** without consent. Session content and agent output may appear in error messages if errors occur during data processing.
- **ErrorPart `details` field** (from existing chat error handling) may contain API key fragments or internal endpoint URLs — already handled by the existing collapsible disclosure pattern.
- **HTTP status semantics:** When using `notFound()` from loaders, this is a client-side concept. The server response for the initial HTML is always 200 (SPA). Only APIs return true 404 status codes.

---

## Performance Considerations

- **Error boundaries have near-zero overhead** when no error has occurred. The class component's `getDerivedStateFromError` is only called after a throw. No performance concern.
- **`QueryErrorResetBoundary`** subscribes to the query client's error state. Keep its scope as narrow as possible (wrap individual pages/sections, not the entire app) to minimize subscription overhead.
- **`router.invalidate()`** re-runs all active loaders for the current route match. In a route with multiple parallel loaders, all re-run on invalidation. This is usually correct (if one loader errored, you want all fresh) but is worth being aware of for routes with expensive loaders.
- **Top-level `AppCrashFallback`** should have zero imports from the app bundle — use inline styles only. If the app-level context crashed, any import that depends on those contexts will also fail.

---

## Recommendation

### Recommended Overall Approach

**Implement all five levels as a strict hierarchy, with TanStack Router's route-level boundaries as the primary user-facing recovery surface.**

The implementation order, from lowest to highest risk:

1. **`createRoot` error hooks** — zero user-visible impact, just telemetry wiring. No risk.
2. **`defaultErrorComponent` and `defaultNotFoundComponent`** on the router — styled, on-brand fallbacks for any unhandled route error. Low risk.
3. **Route-specific `notFoundComponent`** with `throw notFound()` in loaders — enables per-route 404 UX with layout preserved. Medium scope.
4. **`QueryErrorResetBoundary` + `ErrorBoundary`** wrapping critical data-loading sections — enables query error recovery. Medium scope, only needed for `throwOnError` queries.
5. **Top-level `ErrorBoundary`** in `App.tsx` — last-resort crash net. Minimal component, high reliability requirement.

**Key design decisions:**

- `defaultErrorComponent` uses `router.invalidate()` for the retry button universally (safer than `reset()` alone).
- All error/404 pages follow the "Calm Tech" aesthetic: zinc/neutral palette, no illustrations, no apologies, single CTA.
- `QueryCache.onError` logs always; shows toast only when `throwOnError: false` AND `meta.showToastOnError: true`.
- The existing chat-level `ErrorPart` + `ErrorMessageBlock` pattern (from `research/20260316_error_categorization_retry.md`) remains separate from these structural boundaries — it handles in-stream agent errors, not page-level failures.

**What to avoid:**

- Don't use `window.location.reload()` in route-level error components — it loses React state. Reserve for the top-level crash fallback only.
- Don't `throwOnError: true` for background/polling queries (session list refresh, system status) — unexpected boundaries are disruptive for background operations.
- Don't show HTTP status codes (404, 500) as primary headlines — use human-readable descriptions.
- Don't put `router.invalidate()` in an effect or subscription — call it only from user-initiated actions (button click, link click).

---

## Contradictions and Disputes

- **`reset()` vs `router.invalidate()`:** GitHub issue #2539 ("Error component's `reset()` does not retry the route") confirms that `reset()` alone does not re-run loaders. The DeepWiki documentation and TanStack Start docs both recommend `router.invalidate()` for loader errors. This is the correct pattern and not disputed — just not prominently documented in the main TanStack Router docs.
- **Class component vs react-error-boundary:** The native class approach and react-error-boundary are functionally equivalent. The library adds `resetKeys`, `useErrorBoundary` hook, and cleaner props API. For DorkOS's needs, the library is preferable. No meaningful dispute here.
- **`throwOnError` for all queries vs. selective use:** The TanStack Query maintainers' guidance (Tkdodo's blog, official docs) advocates for selective use: throw to boundaries for critical data, handle inline for optional data. This is consistent across all sources.

---

## Research Gaps

- The exact behavior of TanStack Router's `CatchBoundary` reset key when `router.invalidate()` is called in a `defaultErrorComponent` (vs route-specific `errorComponent`) needs verification in practice.
- Whether `notFoundComponent` renders with full parent layout intact (sidebar visible) when thrown from a deeply nested route's loader has not been independently confirmed from source — inferred from the `notFoundMode: 'fuzzy'` description.
- The `onCatch` callback per-route (for logging) is documented in DeepWiki but not prominently in official TanStack Router docs — may be a TanStack Start feature only.

---

## Sources and Evidence

- [React v19 – React Blog](https://react.dev/blog/2024/12/05/react-19) — official React 19 release notes, `onCaughtError`/`onUncaughtError` introduction
- [React 19 Error Boundary Behaves Differently — Andrei Calazans](https://andrei-calazans.com/posts/react-19-error-boundary-changed/) — confirmed single-error-per-boundary behavior change vs React 18
- [Guide to Error & Exception Handling in React — Sentry](https://blog.sentry.io/guide-to-error-and-exception-handling-in-react/) — `createRoot` integration pattern, strategic placement
- [react-error-boundary README — bvaughn/react-error-boundary](https://github.com/bvaughn/react-error-boundary/blob/main/README.md) — full API: `FallbackComponent`, `resetKeys`, `onReset`, `useErrorBoundary`
- [Error Boundaries — TanStack Start React Docs](https://tanstack.com/start/latest/docs/framework/react/guide/error-boundaries) — `errorComponent`, `ErrorComponentProps`, `router.invalidate()` vs `reset()`
- [Not Found Errors — TanStack Router Docs](https://tanstack.com/router/latest/docs/framework/react/guide/not-found-errors) — `notFoundComponent`, `notFoundMode`, `notFound()` function
- [Error Handling — TanStack Router DeepWiki](https://deepwiki.com/TanStack/router/4.6-error-handling) — `CatchBoundary`, `onCatch`, reset key auto-clear on navigation
- [ErrorComponent component — TanStack Router v1 Docs](https://tanstack.com/router/v1/docs/framework/react/api/router/errorComponentComponent) — `ErrorComponentProps` interface
- [Error component's reset() does not retry the route — Issue #2539](https://github.com/TanStack/router/issues/2539) — confirmed `reset()` does not re-run loaders
- [How to handle global errors in React Query v5 — Medium](https://medium.com/@valerasheligan/how-to-handle-global-errors-in-react-query-v5-4f8b919ee47a) — QueryCache.onError pattern
- [QueryErrorResetBoundary — TanStack Query Docs](https://tanstack.com/query/latest/docs/framework/react/reference/QueryErrorResetBoundary) — reset boundary + query reset coordination
- [Migrating to TanStack Query v5 — TanStack Docs](https://tanstack.com/query/v5/docs/react/guides/migrating-to-v5) — `throwOnError` rename from `useErrorBoundary`, removal of per-observer callbacks
- [Suspense — TanStack Query v5 Docs](https://tanstack.com/query/v5/docs/react/guides/suspense) — `useSuspenseQuery` always throws, `throwOnError` default behavior
- [react-error-boundary npm](https://www.npmjs.com/package/react-error-boundary) — current version and React 19 compatibility
- [Why React Error Boundaries Aren't Just Try/Catch — Epic React](https://www.epicreact.dev/why-react-error-boundaries-arent-just-try-catch-for-components-i6e2l) — `useErrorBoundary` for async/event errors
- [React 19 Support — Sentry Changelog](https://sentry.io/changelog/react-19-support/) — onCaughtError/onUncaughtError Sentry integration
- `research/20260316_sdk_result_error_ux_patterns.md` — existing DorkOS research on inline chat error patterns
- `research/20260316_error_categorization_retry.md` — existing DorkOS research on ErrorPart, ErrorMessageBlock, and retry patterns

---

## Search Methodology

- Searches performed: 14
- Most productive search terms: "React 19 onCaughtError onUncaughtError createRoot", "TanStack Router errorComponent ErrorComponentProps reset router.invalidate retry", "TanStack Query v5 QueryCache onError throwOnError global", "react-error-boundary React 19 resetErrorBoundary"
- Primary information sources: Official React docs (react.dev), TanStack Router official docs + DeepWiki, GitHub issues (#2539 for reset() behavior), Sentry blog for React 19 integration patterns
