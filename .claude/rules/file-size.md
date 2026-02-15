---
paths: '**/*.ts, **/*.tsx'
---

# File Size Limits

## Thresholds

| Lines   | Action                                                |
| ------- | ----------------------------------------------------- |
| < 300   | Ideal size, no action needed                          |
| 300-500 | Consider splitting if multiple responsibilities exist |
| 500+    | Must split — find extraction opportunities            |

## When to Split

- File has multiple distinct responsibilities
- Contains reusable logic that other files could benefit from
- Has complex logic that could be isolated and tested independently
- Large type definitions that could live in a separate types file

## Extraction Patterns

- **Extract component**: Split a large component into smaller sub-components
- **Extract hook**: Move stateful logic from a component into a custom hook
- **Extract utility**: Move pure functions into a `lib/` file
- **Extract types**: Move large type definitions into a dedicated types file

## Exceptions

These files may exceed 300 lines without requiring splitting:

- Generated files (OpenAPI specs, schema definitions)
- Barrel export files (`index.ts`)
- Tightly coupled state machines where splitting would harm readability
- Test files (test setup and many test cases naturally grow large)
