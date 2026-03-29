---
title: 'Extension Manifest Settings Schema: Declarative Settings, Grouped Secrets, and Placeholder Patterns'
date: 2026-03-29
type: external-best-practices
status: active
tags:
  [
    extension-manifest,
    settings-schema,
    declarative-config,
    secrets-management,
    form-generation,
    raycast,
    vscode,
    grafana,
    shopify,
    dorkos,
  ]
feature_slug: extension-manifest-settings
searches_performed: 10
sources_count: 18
---

# Extension Manifest Settings Schema: Declarative Settings, Grouped Secrets, and Placeholder Patterns

**Date**: 2026-03-29
**Research Depth**: Deep Research

---

## Research Summary

This report surveys how major extension systems (Raycast, VS Code, Grafana, Shopify) handle declarative settings/config in manifests, then synthesizes that into a concrete recommendation for DorkOS. The task has three sub-goals: (1) add a `settings` array to the extension manifest for non-secret config (text, number, boolean, select fields that auto-generate a settings form), (2) add a `placeholder` field to `SecretDeclaration`, and (3) support grouped secrets with collapsible sections.

The central finding: **Raycast is the strongest reference model** for DorkOS's needs — flat array of typed settings declarations with `placeholder` on each field, and the grouping mechanism (title on first item in a group, empty title on subsequent items) maps directly to what DorkOS needs. VS Code's approach to multiple sections (array of `{ title, properties }` objects) is the better pattern for _grouped secrets_. Grafana's `jsonData`/`secureJsonData` split is the canonical industry pattern for separating non-sensitive config from sensitive secrets at the manifest level.

The recommended DorkOS schema extension:

- Add `settings?: SettingDeclaration[]` to `ServerCapabilitiesSchema` (alongside the existing `secrets` array)
- Add `placeholder?: string` to `SecretDeclarationSchema`
- Add `group?: string` to `SecretDeclarationSchema` for logical grouping (render as collapsible sections in the UI)
- **Do not** move secrets into a separate `secretGroups` structure — keep the flat array with an optional `group` property to preserve backward compatibility

---

## Key Findings

### 1. Raycast: The Strongest Reference Model

Raycast's `package.json` manifest is the most directly applicable reference. Extensions declare `preferences` as a flat array of typed objects. Each preference has:

- `name` — unique key (snake_case or camelCase)
- `title` — human-readable label (shown as section header for first item in a visual group)
- `description` — tooltip / help text
- `type` — one of `textfield`, `password`, `checkbox`, `dropdown`, `appPicker`, `file`, `directory`
- `required` — boolean
- `placeholder` — hint text shown in empty field (applies to textfield, password)
- `default` — initial value (string/boolean/dropdown value)
- `data` — array of `{ title, value }` objects (dropdown only)
- `label` — checkbox label text (checkbox only)

**Grouping mechanism**: Title on the first item in a group, blank title on subsequent items. This is implicit grouping — no nesting required.

**Why it maps well to DorkOS**: DorkOS's `SecretDeclaration` already has `key`, `label`, `description`, `required` — this is Raycast's `name`, `title`, `description`, `required` under different names. Adding `placeholder` is a direct port of Raycast's pattern.

### 2. VS Code: Array-of-Sections for Named Groups

VS Code's `contributes.configuration` can be either a single object or an array of category objects:

```json
{
  "contributes": {
    "configuration": [
      {
        "title": "Authentication",
        "properties": { ... }
      },
      {
        "title": "Advanced",
        "properties": { ... }
      }
    ]
  }
}
```

Each category becomes a submenu entry in the Settings UI. This is the right model when groups are **named and stable** — e.g., "Slack Credentials" and "GitHub Credentials" as distinct collapsible panels.

**Why it's relevant to DorkOS**: The grouped secrets feature maps cleanly to this: each group gets a `title` and renders as a collapsible `FieldCard`. Rather than nesting secrets inside group objects (which breaks backward compatibility), DorkOS can add a `group` field to each `SecretDeclaration` — the UI groups them by that string.

### 3. Grafana: `jsonData` vs `secureJsonData` Split

Grafana data source plugins separate non-sensitive configuration (`jsonData`) from sensitive credentials (`secureJsonData`) at the schema level. This is the canonical industry pattern:

- `jsonData`: visible to viewers, returned to browser, safe to log
- `secureJsonData`: encrypted at save time, **never returned to browser again**, only accessible to server-side plugin code
- `secureJsonFields`: boolean map ("is this field set?") — the only browser-visible indicator of secret state

**Why it's relevant to DorkOS**: DorkOS already has this split implicitly — `serverCapabilities.secrets` stores secrets in `ExtensionSecretStore` (AES-256-GCM encrypted), and the `ManifestSecretsPanel` shows only "Configured/not configured" state. The new `settings` array should hold non-secret config that can be stored unencrypted (or in a simple `extension-settings/{id}.json` file) and read back by the browser.

### 4. Shopify: TOML-Based Field Declarations

Shopify's `shopify.extension.toml` uses `[[settings.fields]]` array entries with `key`, `type`, `name`, `description`, `required`. The type system includes `single_line_text_field`, `multi_line_text_field`, `boolean`, `number_integer`, and resource-picker types (`product`, `collection`, etc.). The principle is the same as Raycast — flat array, typed fields.

**Why it's relevant**: Confirms the flat array + typed field approach is the industry standard. The type names differ across systems but the concept is identical.

### 5. JSON Schema-Based Form Generation (react-jsonschema-form)

The RJSF approach uses JSON Schema to describe fields and a separate `uiSchema` to control rendering. This is powerful but heavyweight:

- Pro: Standards-based, composable, validation built in
- Con: Two-schema split (data schema + uiSchema) adds cognitive overhead for extension authors
- Con: No out-of-the-box collapsible sections without custom field templates
- Con: JSON Schema is verbose for simple cases

**Why it's NOT the right choice for DorkOS**: Extension authors are building extensions for personal use. They want to declare `{ key: "theme", label: "Theme", type: "select", options: ["dark", "light"] }` — not learn JSON Schema's `{ "type": "string", "enum": ["dark", "light"] }` plus a `uiSchema` entry. The Raycast-style flat array is far better DX.

---

## Detailed Analysis

### The Three Approaches Compared

#### Approach A: Flat Settings Array (Raycast-style)

```json
{
  "serverCapabilities": {
    "settings": [
      {
        "key": "refresh_interval",
        "label": "Refresh Interval",
        "type": "number",
        "description": "How often to poll for updates (seconds)",
        "default": 60,
        "min": 10,
        "max": 3600
      },
      {
        "key": "show_archived",
        "label": "Show Archived Items",
        "type": "boolean",
        "default": false
      },
      {
        "key": "theme",
        "label": "Theme",
        "type": "select",
        "options": [
          { "label": "Dark", "value": "dark" },
          { "label": "Light", "value": "light" }
        ],
        "default": "dark"
      }
    ]
  }
}
```

**Pros:**

- Dead simple for extension authors
- Each field is self-contained and readable
- Easy to add new types without structural change
- Backward compatible by default (optional array)
- Auto-generates a settings form with zero UI code from the extension author

**Cons:**

- No inherent grouping (must add `group` property)
- Validation rules (min/max, pattern) need to be per-type or in a generic `validation` object

**Verdict**: **Recommended for DorkOS.** Mirrors what ManifestSecretsPanel already does for secrets — the host reads the declarations and renders a polished form automatically.

---

#### Approach B: Grouped Settings with Sections (VS Code-style)

```json
{
  "serverCapabilities": {
    "settingGroups": [
      {
        "title": "Display",
        "settings": [
          { "key": "theme", "label": "Theme", "type": "select", ... }
        ]
      },
      {
        "title": "Sync",
        "settings": [
          { "key": "refresh_interval", "label": "Refresh Interval", "type": "number", ... }
        ]
      }
    ]
  }
}
```

**Pros:**

- Groups are explicit and named
- Natural mapping to collapsible UI sections
- VS Code proven at scale

**Cons:**

- More nesting in manifest — harder to author
- Two-level structure breaks the simple flat mental model
- Must decide upfront whether a setting belongs in a group vs. at the top level
- Harder to add a single setting without creating a group structure

**Verdict**: Overkill for a single extension's settings. Appropriate if an extension has 15+ settings across fundamentally different domains. Not recommended as the primary pattern.

---

#### Approach C: JSON Schema-Based

```json
{
  "serverCapabilities": {
    "settingsSchema": {
      "type": "object",
      "properties": {
        "refreshInterval": {
          "type": "number",
          "minimum": 10,
          "maximum": 3600,
          "default": 60,
          "description": "Poll frequency in seconds"
        }
      }
    }
  }
}
```

**Pros:**

- Standard format with broad tooling support
- Type validation is already defined
- Integrates with editors that understand JSON Schema

**Cons:**

- Extension authors must know JSON Schema syntax
- `description` vs `title` distinction not obvious
- No first-class `select` type (must use `enum`)
- Placeholder not a JSON Schema concept (needs `uiSchema`)
- Generating good UI from JSON Schema requires more host-side complexity

**Verdict**: Correct for public plugin registries with thousands of plugins and formal tooling. Wrong for DorkOS's persona — small, personal extensions authored by builders who want minimal friction.

---

### Adding `placeholder` to `SecretDeclaration`

The existing `SecretDeclaration` renders:

```tsx
<PasswordInput
  placeholder={secret.key.replace(/_/g, '_')} // ← current: just echoes the key name
/>
```

Adding `placeholder?: string` to the schema lets extension authors provide contextual hints:

```json
{
  "key": "linear_api_key",
  "label": "Linear API Key",
  "description": "Personal API key from Linear settings",
  "placeholder": "lin_api_xxxxxxxxxxxx",
  "required": true
}
```

This is a direct port of Raycast's `placeholder` property. The Grafana pattern calls this `placeholder` as well. VS Code doesn't have an equivalent (settings use input fields with defaults, not placeholder text). This is additive and backward-compatible — no existing manifests are affected.

---

### Grouped Secrets: Design Choices

The task calls for "grouped secrets with collapsible sections for multiple APIs." The canonical use case: a GitHub+Linear integration extension that needs GitHub credentials in one section and Linear credentials in another.

**Option 1: `group` field on each `SecretDeclaration`**

```json
{
  "serverCapabilities": {
    "secrets": [
      { "key": "github_token", "label": "GitHub Token", "group": "GitHub", "required": true },
      { "key": "github_org", "label": "GitHub Organization", "group": "GitHub", "required": false },
      { "key": "linear_api_key", "label": "Linear API Key", "group": "Linear", "required": true }
    ]
  }
}
```

The UI groups by `group` string, rendering each group as a collapsible `FieldCard` with a section header. Secrets without a `group` render ungrouped at the top.

- Backward compatible: existing secrets without `group` just render ungrouped
- Simple to author: one additional optional field
- UI can detect "all secrets have the same group" and skip the collapsible header (single group = no grouping benefit)

**Option 2: Nested `secretGroups` array**

```json
{
  "serverCapabilities": {
    "secretGroups": [
      {
        "title": "GitHub",
        "secrets": [{ "key": "github_token", "label": "GitHub Token", "required": true }]
      }
    ]
  }
}
```

- Breaking change (existing manifests use flat `secrets` array)
- More nesting to author
- No backward compatibility without keeping both `secrets` and `secretGroups`

**Option 3: `title` on first secret in group (Raycast pattern)**

Raycast's approach: set `title` on the first secret of a group, leave title blank on subsequent items in the same group. The UI renders a section header for each non-blank title.

- This repurposes the existing `label` field in a confusing way
- Forces a particular ordering requirement
- Less explicit than a named `group` field

**Verdict: Option 1 (`group` field per secret) is recommended.** It is the most DX-friendly, backward-compatible, and explicit. The UI collapses secrets by `group` value and renders each group as a labeled collapsible section.

---

### How `settings` Relates to `secrets`

The distinction is cleanly analogous to Grafana's `jsonData`/`secureJsonData`:

| Field          | `settings`                                                        | `secrets`                                             |
| -------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Storage        | `extension-settings/{id}.json` (unencrypted or lightly encrypted) | `extension-secrets/{id}.json` (AES-256-GCM encrypted) |
| API visibility | Readable from browser                                             | Never returned to browser after save                  |
| Use cases      | Theme, refresh interval, display toggles, API base URLs           | API keys, passwords, OAuth tokens, webhook secrets    |
| Field types    | text, number, boolean, select                                     | password (implicit)                                   |
| Server access  | Via `serverApi.getSettings()`                                     | Via `serverApi.getSecret(key)`                        |

The `settings` array belongs at the same level as `secrets` inside `serverCapabilities`. Both live under `serverCapabilities` because:

1. Settings values need to be persisted server-side (not in browser localStorage — extensions might run headless)
2. Both are consumed by server-side extension code
3. The `ManifestSecretsPanel` pattern generalizes to a `ManifestSettingsPanel` alongside it

**Alternative**: Put `settings` at the top level of `ExtensionManifest` (not nested in `serverCapabilities`). This would be appropriate if settings needed to be read by the _client_ extension code too. For now, server-side storage is the right default — settings values read from disk by `server.ts` code.

---

## Recommended Schema Extension

### `manifest-schema.ts` changes

```typescript
// --- New: SettingOptionSchema (for select type) ---
const SettingOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().or(z.number()),
});

// --- New: SettingDeclarationSchema ---
const SettingDeclarationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1),
    description: z.string().optional(),
    placeholder: z.string().optional(),
    default: z.string().optional(),
    required: z.boolean().default(false),
    group: z.string().optional(),
  }),
  z.object({
    type: z.literal('number'),
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1),
    description: z.string().optional(),
    placeholder: z.string().optional(),
    default: z.number().optional(),
    required: z.boolean().default(false),
    group: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    type: z.literal('boolean'),
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1),
    description: z.string().optional(),
    default: z.boolean().optional(),
    required: z.boolean().default(false),
    group: z.string().optional(),
  }),
  z.object({
    type: z.literal('select'),
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1),
    description: z.string().optional(),
    default: z.string().or(z.number()).optional(),
    required: z.boolean().default(false),
    group: z.string().optional(),
    options: z.array(SettingOptionSchema).min(1),
  }),
]);
```

**Alternative (simpler): non-discriminated union with type as a plain enum**

```typescript
// Simpler approach — less type-safety but more maintainable for v1
const SettingDeclarationSchema = z.object({
  type: z.enum(['text', 'number', 'boolean', 'select']),
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  description: z.string().optional(),
  placeholder: z.string().optional(), // for text/number only
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  required: z.boolean().default(false),
  group: z.string().optional(),
  options: z.array(SettingOptionSchema).optional(), // for select only
  min: z.number().optional(), // for number only
  max: z.number().optional(), // for number only
});
```

The simpler non-discriminated approach is recommended for v1 — the discriminated union is more correct but the extra Zod complexity isn't worth it until there are genuinely incompatible shapes across types. The form renderer can validate type-specific constraints at render time.

### Updated `SecretDeclarationSchema`

```typescript
const SecretDeclarationSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  description: z.string().optional(),
  placeholder: z.string().optional(), // NEW: hint shown in password input
  required: z.boolean().default(false),
  group: z.string().optional(), // NEW: groups secrets into collapsible sections
});
```

### Updated `ServerCapabilitiesSchema`

```typescript
const ServerCapabilitiesSchema = z.object({
  serverEntry: z.string().default('./server.ts'),
  externalHosts: z.array(z.string().url()).optional(),
  secrets: z.array(SecretDeclarationSchema).optional(),
  settings: z.array(SettingDeclarationSchema).optional(), // NEW
});
```

### Complete example manifest with all new features

```json
{
  "id": "github-linear-sync",
  "name": "GitHub + Linear Sync",
  "version": "1.0.0",
  "description": "Syncs GitHub PRs to Linear issues",
  "serverCapabilities": {
    "serverEntry": "./server.ts",
    "externalHosts": ["https://api.github.com", "https://api.linear.app"],
    "secrets": [
      {
        "key": "github_token",
        "label": "GitHub Token",
        "description": "Personal access token with repo scope",
        "placeholder": "ghp_xxxxxxxxxxxx",
        "required": true,
        "group": "GitHub"
      },
      {
        "key": "github_org",
        "label": "GitHub Organization",
        "description": "Your GitHub organization slug",
        "placeholder": "my-org",
        "required": false,
        "group": "GitHub"
      },
      {
        "key": "linear_api_key",
        "label": "Linear API Key",
        "description": "Generate from Linear > Settings > API",
        "placeholder": "lin_api_xxxxxxxxxxxx",
        "required": true,
        "group": "Linear"
      }
    ],
    "settings": [
      {
        "type": "number",
        "key": "refresh_interval",
        "label": "Refresh Interval",
        "description": "How often to poll for updates (seconds)",
        "default": 300,
        "min": 60,
        "max": 3600
      },
      {
        "type": "boolean",
        "key": "show_merged_prs",
        "label": "Show Merged PRs",
        "description": "Include merged PRs in the dashboard view",
        "default": false
      },
      {
        "type": "select",
        "key": "pr_status_filter",
        "label": "PR Status Filter",
        "description": "Which PR statuses to show",
        "default": "open",
        "options": [
          { "label": "Open only", "value": "open" },
          { "label": "Open and draft", "value": "open_draft" },
          { "label": "All", "value": "all" }
        ]
      },
      {
        "type": "text",
        "key": "label_prefix",
        "label": "Label Prefix",
        "description": "Prefix for auto-created Linear labels",
        "placeholder": "gh:",
        "default": "gh:"
      }
    ]
  }
}
```

---

## UI Architecture: ManifestSettingsPanel

The existing `ManifestSecretsPanel` provides the template for the new `ManifestSettingsPanel`. Key differences:

1. **Settings are readable** — the panel shows current values, not just "Configured/Not configured" indicators
2. **Multiple field types** — the panel renders text inputs, number inputs, toggles, and selects based on `type`
3. **No encryption** — settings values are fetched from `GET /api/extensions/{id}/settings` and shown in the form
4. **Groups** — `ManifestSecretsPanel` needs to be extended to render `group`-based collapsible sections

### Secret grouping in `ManifestSecretsPanel`

```tsx
// Group secrets by their `group` field
const grouped = new Map<string | undefined, SecretDeclaration[]>();
for (const secret of secrets) {
  const key = secret.group;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key)!.push(secret);
}

// Render ungrouped first, then each named group as a collapsible FieldCard
```

If all secrets share the same group name, the collapsible behavior should still render the group header — the group title serves as a meaningful label ("GitHub Credentials") even for a single-group extension.

---

## API Surface Required

The `settings` feature requires new server-side endpoints (parallel to the existing secrets endpoints):

```
GET  /api/extensions/:id/settings        → { key: string, value: string|number|boolean }[]
PUT  /api/extensions/:id/settings/:key   → { value } → 204
DELETE /api/extensions/:id/settings/:key → 204
```

Storage: `{dorkHome}/extension-settings/{extensionId}.json` (JSON object, keys → values, no encryption needed).

The server extension API (`serverApi.getSettings()`) reads from this same file, allowing server-side extension code to access the current settings values.

---

## Implementation Priority

1. **Phase 1 (schema only)**: Add `placeholder` and `group` to `SecretDeclarationSchema`. Update `ManifestSecretsPanel` to support grouping and placeholder. These are purely additive schema changes with no new infrastructure needed.

2. **Phase 2 (settings)**: Add `SettingDeclarationSchema` to `ServerCapabilitiesSchema`. Add storage layer (`extension-settings/{id}.json`). Add server endpoints. Add `ManifestSettingsPanel` component. Expose `serverApi.getSettings()` in the server extension API.

3. **Phase 3 (advanced)**: `group` field on settings (groups mix of settings and secrets in the same section). Password type for settings (rare — most password-like values belong in secrets).

---

## Sources & Evidence

- [Raycast Manifest — Preferences](https://developers.raycast.com/information/manifest) — `preferences` array with `type`, `placeholder`, `data`, `label`; extension-level vs command-level
- [Raycast Preferences API Reference](https://developers.raycast.com/api-reference/preferences) — All preference types documented; inheritance model
- [VS Code Contribution Points — Configuration](https://code.visualstudio.com/api/references/contribution-points) — JSON Schema types, `enum`, `minimum`, `maximum`, scope levels
- [VS Code: Splitting Settings into Multiple Categories](https://www.eliostruyf.com/splitting-vscode-extension-settings-multiple-categories/) — `configuration` as array of `{ title, properties }` objects
- [Grafana: Add Authentication for Data Source Plugins](https://grafana.com/developers/plugin-tools/how-to-guides/data-source-plugins/add-authentication-for-data-source-plugins) — `jsonData`/`secureJsonData` split; `secureJsonFields` boolean map
- [Shopify: Configure App Extensions](https://shopify.dev/docs/apps/build/app-extensions/configure-app-extensions) — `[[settings.fields]]` TOML structure; `key`, `type`, `name`, `description`, `required`
- [react-jsonschema-form uiSchema](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema/) — uiSchema model; collapsible sections require custom field templates
- Cached research: `research/20260329_extension_server_side_capabilities.md` — Grafana, Raycast, Directus secrets models; DorkOS `ExtensionSecretStore` (AES-256-GCM)

---

## Research Gaps & Limitations

- No benchmarks on settings form rendering performance at scale (irrelevant for DorkOS — extensions will have < 20 settings each)
- Shopify's complete field type list was not accessible from the fetched page; the examples confirm the flat array pattern is correct
- No research on whether the settings values should be accessible to the _client-side_ extension code (currently assumed server-only). If client access is needed, the storage model changes (must go through the server endpoint rather than direct file read).

---

## Contradictions & Disputes

None significant. All systems converge on:

- Flat array of typed field declarations is the right DX for simple extension settings
- Secrets and non-secret config should be stored and accessed differently (Grafana's `secureJsonData` vs `jsonData` principle)
- `placeholder` is universally supported and expected by extension authors

The only design tension is where `settings` lives in the manifest:

- **Inside `serverCapabilities`** (recommended): settings are server-side artifacts consumed by `server.ts` code; consistent with how secrets work
- **At top level**: settings could be read by client-side extension code too

Given that the existing `secrets` are inside `serverCapabilities` and the storage/access pattern is server-side, `settings` belongs there too for consistency.

---

## Search Methodology

- Searches performed: 10
- Most productive: "Raycast extension manifest preferences field types", "VS Code contributes.configuration multiple sections categories", "Grafana jsonData secureJsonData split"
- Primary source types: Official documentation (Raycast, VS Code, Grafana), industry pattern articles
