---
slug: improve-slash-commands
status: approved
---

# Spec: Improve Slash Command System

## Summary

Six changes across client, server, and shared packages to fix bugs and add features in the slash command system.

---

## Changes

### 1. Fix colon regex bug (ChatPanel.tsx)

**File:** `apps/client/src/components/chat/ChatPanel.tsx`

**Line 96** — Change:
```ts
const match = value.match(/(^|\s)\/(\w*)$/);
```
To:
```ts
const match = value.match(/(^|\s)\/([\w:-]*)$/);
```

This allows `:` and `-` in the query so typing `/debug:r` keeps the palette open and filters correctly.

---

### 2. Add fuzzy subsequence matching (new utility + ChatPanel.tsx)

**New file:** `apps/client/src/lib/fuzzy-match.ts`

Create a simple subsequence matcher that returns whether all characters in the query appear in the target in order, plus a basic score (consecutive matches score higher):

```ts
export function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  // Empty query matches everything
  if (!query) return { match: true, score: 0 };

  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive; // Reward consecutive matches
    } else {
      consecutive = 0;
    }
  }

  return { match: qi === q.length, score };
}
```

**File:** `apps/client/src/components/chat/ChatPanel.tsx` — Lines 72-79

Replace the `filteredCommands` useMemo:
```ts
const filteredCommands = useMemo(() => {
  if (!commandQuery) return allCommands;
  return allCommands
    .map((cmd) => {
      const searchText = `${cmd.fullCommand} ${cmd.description}`;
      const result = fuzzyMatch(commandQuery, searchText);
      return { cmd, ...result };
    })
    .filter((r) => r.match)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.cmd);
}, [allCommands, commandQuery]);
```

**New test file:** `apps/client/src/lib/__tests__/fuzzy-match.test.ts`

Test cases:
- Empty query matches everything
- Exact match scores highest
- Subsequence match works (`drt` matches `debug:rubber-duck-test`)
- Non-matching returns `{ match: false }`
- Consecutive characters score higher than scattered
- Case-insensitive

---

### 3. Preserve pre-slash text on command selection (ChatPanel.tsx)

**File:** `apps/client/src/components/chat/ChatPanel.tsx`

Add state to track where the slash trigger starts:
```ts
const [slashTriggerPos, setSlashTriggerPos] = useState(-1);
```

In `handleInputChange`, when the regex matches, record the trigger position:
```ts
function handleInputChange(value: string) {
  setInput(value);
  const match = value.match(/(^|\s)\/([\w:-]*)$/);
  if (match) {
    setShowCommands(true);
    setCommandQuery(match[2]);
    // match.index is the start of the full match; add match[1].length to skip the leading space
    setSlashTriggerPos((match.index ?? 0) + match[1].length);
  } else {
    setShowCommands(false);
  }
}
```

In `handleCommandSelect`, splice the command into the existing text:
```ts
function handleCommandSelect(cmd: CommandEntry) {
  const before = input.slice(0, slashTriggerPos);
  setInput(before + cmd.fullCommand + ' ');
  setShowCommands(false);
}
```

---

### 4. Reload commands on directory change

This requires changes across all layers:

#### 4a. Schema — add `cwd` query param

**File:** `packages/shared/src/schemas.ts`

Update `CommandsQuerySchema`:
```ts
export const CommandsQuerySchema = z
  .object({
    refresh: z.enum(['true', 'false']).optional(),
    cwd: z.string().optional(),
  })
  .openapi('CommandsQuery');
```

#### 4b. Transport interface — add `cwd` param

**File:** `packages/shared/src/transport.ts`

Change signature:
```ts
getCommands(refresh?: boolean, cwd?: string): Promise<CommandRegistry>;
```

#### 4c. HTTP transport — pass `cwd` query param

**File:** `apps/client/src/lib/http-transport.ts`

Update `getCommands`:
```ts
async getCommands(refresh = false, cwd?: string): Promise<CommandRegistry> {
  const params = new URLSearchParams();
  if (refresh) params.set('refresh', 'true');
  if (cwd) params.set('cwd', cwd);
  const qs = params.toString();
  return fetchJSON<CommandRegistry>(this.baseUrl, `/commands${qs ? `?${qs}` : ''}`);
}
```

#### 4d. Direct transport — pass `cwd` param

**File:** `apps/client/src/lib/direct-transport.ts`

Update `getCommands` to pass cwd through (the direct transport's `CommandRegistryService` may need to support this — but for the Obsidian plugin the cwd is fixed at construction, so this is a no-op pass-through for now):
```ts
async getCommands(refresh?: boolean, _cwd?: string): Promise<CommandRegistry> {
  return this.services.commandRegistry.getCommands(refresh);
}
```

#### 4e. Server route — accept `cwd`, cache registries per directory

**File:** `apps/server/src/routes/commands.ts`

Replace the singleton pattern with a registry cache:
```ts
const defaultRoot = process.env.GATEWAY_CWD ?? path.resolve(__dirname, '../../../../');
const registryCache = new Map<string, CommandRegistryService>();

function getRegistry(cwd?: string): CommandRegistryService {
  const root = cwd || defaultRoot;
  let registry = registryCache.get(root);
  if (!registry) {
    registry = new CommandRegistryService(root);
    registryCache.set(root, registry);
  }
  return registry;
}

router.get('/', async (req, res) => {
  const parsed = CommandsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.format() });
  }
  const refresh = parsed.data.refresh === 'true';
  const registry = getRegistry(parsed.data.cwd);
  const commands = await registry.getCommands(refresh);
  res.json(commands);
});
```

#### 4f. React Query hook — include cwd in query key

**File:** `apps/client/src/hooks/use-commands.ts`

```ts
export function useCommands(cwd?: string | null) {
  const transport = useTransport();
  return useQuery<CommandRegistry>({
    queryKey: ['commands', { cwd: cwd ?? null }],
    queryFn: () => transport.getCommands(false, cwd ?? undefined),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
```

Remove `useRefreshCommands` — it's no longer needed since cwd-based key changes trigger automatic refetches.

#### 4g. ChatPanel — pass cwd to useCommands

**File:** `apps/client/src/components/chat/ChatPanel.tsx`

```ts
import { useDirectoryState } from '../../hooks/use-directory-state';

// Inside component:
const [cwd] = useDirectoryState();
const { data: registry } = useCommands(cwd);
```

---

### 5. Remove unused `onClose` prop from CommandPalette

**File:** `apps/client/src/components/commands/CommandPalette.tsx`

- Remove `onClose` from `CommandPaletteProps` interface
- Remove `void onClose;` from the function body

**File:** `apps/client/src/components/chat/ChatPanel.tsx`

- Remove `onClose={() => setShowCommands(false)}` from the `<CommandPalette>` JSX

---

### 6. Replace mutable `flatIndex` with pre-computed array

**File:** `apps/client/src/components/commands/CommandPalette.tsx`

Instead of `let flatIndex = 0` mutated during render, pre-compute the grouped structure with stable indices using `useMemo`:

```ts
const groupedWithIndices = useMemo(() => {
  const groups: { namespace: string; commands: { cmd: CommandEntry; index: number }[] }[] = [];
  let idx = 0;
  const grouped = new Map<string, { cmd: CommandEntry; index: number }[]>();

  for (const cmd of filteredCommands) {
    if (!grouped.has(cmd.namespace)) {
      grouped.set(cmd.namespace, []);
    }
    grouped.get(cmd.namespace)!.push({ cmd, index: idx++ });
  }

  for (const [namespace, commands] of grouped) {
    groups.push({ namespace, commands });
  }

  return groups;
}, [filteredCommands]);
```

---

## File Change Summary

| File | Change Type |
|------|-------------|
| `apps/client/src/lib/fuzzy-match.ts` | **New** — fuzzy subsequence matcher |
| `apps/client/src/lib/__tests__/fuzzy-match.test.ts` | **New** — tests for matcher |
| `apps/client/src/components/chat/ChatPanel.tsx` | **Modified** — regex fix, fuzzy filter, trigger pos tracking, cwd passthrough |
| `apps/client/src/components/commands/CommandPalette.tsx` | **Modified** — remove onClose, pre-compute indices |
| `apps/client/src/hooks/use-commands.ts` | **Modified** — cwd in query key, remove useRefreshCommands |
| `packages/shared/src/schemas.ts` | **Modified** — add cwd to CommandsQuerySchema |
| `packages/shared/src/transport.ts` | **Modified** — add cwd param to getCommands |
| `apps/client/src/lib/http-transport.ts` | **Modified** — pass cwd query param |
| `apps/client/src/lib/direct-transport.ts` | **Modified** — accept cwd param (pass-through) |
| `apps/server/src/routes/commands.ts` | **Modified** — registry cache per cwd |

## Implementation Order

1. Shared layer first (schemas, transport interface) — unblocks everything else
2. Server changes (route + registry cache) — can test with curl
3. Client transport adapters (http + direct) — wire up cwd
4. Fuzzy match utility + tests — independent, can be parallel
5. ChatPanel changes (regex, fuzzy filter, trigger pos, cwd) — depends on 1-4
6. CommandPalette cleanup (onClose, flatIndex) — independent

## Testing Strategy

- Unit test `fuzzyMatch` function thoroughly
- Existing `command-registry.test.ts` needs test for cwd-based registry cache
- Existing `commands.test.ts` needs test for `?cwd=` query param
- Manual smoke test: type `/debug:r`, verify palette stays open and filters
- Manual smoke test: type `please run /deb`, select command, verify prefix preserved
- Manual smoke test: switch directories, verify command list updates
