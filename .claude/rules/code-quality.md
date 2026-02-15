---
paths: '**/*.ts, **/*.tsx'
---

# Code Quality Guidelines

## DRY (Don't Repeat Yourself)

- **3-strike rule**: If the same logic appears 3+ times, extract it
- **Exceptions**: Coincidental duplication (similar now but different concerns), test setup code, cases where extraction would reduce clarity

## Complexity Limits

| Metric                | Limit                                  |
| --------------------- | -------------------------------------- |
| Cyclomatic complexity | 15 per function                        |
| Function length       | 50 lines (excluding types)             |
| Nesting depth         | 4 levels max                           |
| Function parameters   | 4 max (use options object beyond that) |

When limits are exceeded, refactor by extracting helper functions, using early returns, or splitting responsibilities.

## Naming Conventions

- **Functions**: verb + noun (`fetchSessions`, `parseTranscript`, `createMockTransport`)
- **Booleans**: `is`/`has`/`should`/`can` prefix (`isLoading`, `hasPermission`, `shouldRetry`)
- **Constants**: `SCREAMING_SNAKE_CASE` for true constants (`MAX_RETRIES`, `DEFAULT_PORT`)
- **Types/Interfaces**: PascalCase, descriptive nouns (`SessionMetadata`, `StreamEvent`)
- **React components**: PascalCase (`ChatPanel`, `SessionSidebar`)
- **Hooks**: `use` prefix (`useChatSession`, `useTheme`)

## Code Smells to Avoid

- **Magic numbers**: Use named constants instead of raw numbers
- **Stringly-typed code**: Use enums, union types, or Zod schemas instead of string comparisons
- **Boolean parameters**: Use options objects for functions with boolean flags
- **`any` type**: Prefer `unknown` with type narrowing; `any` is a warning-level lint issue
- **Nested ternaries**: Use `if`/`else` or extract to a function for readability
- **God objects**: Break large classes/objects into focused, single-responsibility pieces
