---
paths: '**/*.ts, **/*.tsx'
---

# Documentation Standards

## JSDoc: When Required

- Public APIs exported from barrel `index.ts` files
- Complex algorithms where the approach is non-obvious
- FSD module `index.ts` files (brief module description)
- Non-obvious type constraints or generic parameters
- Functions with surprising behavior or side effects

## JSDoc: When to Skip

- Self-explanatory functions with clear names (e.g., `getUserById`)
- Standard CRUD operations and simple data transformations
- Private/internal utilities only used in one place
- React components where props interface is self-documenting

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
