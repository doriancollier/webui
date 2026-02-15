---
paths: '**/*.ts, **/*.tsx'
---

# TSDoc Documentation Standards

Enforced by `eslint-plugin-jsdoc` (warn-first). Use TSDoc syntax — no `{type}` annotations (TypeScript provides types).

## TSDoc: When Required

- Exported functions and classes (enforced by linter)
- Public APIs exported from barrel `index.ts` files
- FSD module `index.ts` files: module-level TSDoc describing purpose and FSD layer role
- Complex algorithms where the approach is non-obvious
- Non-obvious type constraints or generic parameters
- Functions with surprising behavior or side effects

## TSDoc: When to Skip

- Self-explanatory functions with clear names (e.g., `getUserById`)
- Standard CRUD operations and simple data transformations
- Private/internal utilities only used in one place
- React components where props interface is self-documenting
- Test files (linter rule disabled for `__tests__/`)

## TSDoc Format

Use `@param name - Description` (no `{type}` — let TypeScript handle types):

```typescript
/**
 * Send a message and stream the response via SSE.
 *
 * @param sessionId - Target session UUID
 * @param content - User message text
 * @param onEvent - Callback invoked for each streamed event
 * @param signal - Optional AbortSignal to cancel the request
 */
export function sendMessage(sessionId: string, content: string, ...): Promise<void> {
```

## Barrel `index.ts` Module Docs

Every FSD barrel file should have a module-level TSDoc comment:

```typescript
/**
 * Session entity — domain hooks for session lifecycle and state.
 *
 * @module entities/session
 */
export { useSessions } from './model/use-sessions';
export { useSessionId } from './model/use-session-id';
```

## `@internal` Tag

Mark exports that are public for testing but not intended for external use:

```typescript
/** @internal Exported for testing only. */
export function parsePorcelainOutput(stdout: string): GitStatusResponse {
```

## Inline Comments

Use inline comments for:

- Complex conditional logic that requires explanation
- Magic numbers or non-obvious constants
- Non-obvious data flow or ordering dependencies
- Workarounds with references to issues or PRs
- Performance-critical sections explaining why a specific approach was chosen

Skip inline comments for:

- Self-documenting code with descriptive variable names
- Obvious operations (`// increment counter` before `count++`)
- Code that restates what the next line does
