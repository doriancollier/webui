---
slug: font-settings
---

# Specification: Font Selection Settings

## 1. Title

**Font Selection Settings** — Curated Google Fonts pairings with localStorage persistence

## 2. Status

**Draft** — Ready for decomposition

## 3. Authors

- Claude Code — 2026-02-13

## 4. Overview

Add a font family selector to the Settings dialog that lets users choose from 8 curated font pairings (sans-serif + monospace). The selected font loads from Google Fonts CDN, applies immediately to all UI text and code blocks, and persists in localStorage across sessions. A new "Appearance" tab in Settings groups visual preferences (theme, font size, font family).

**Default font: Inter + JetBrains Mono** (not system fonts). Inter is the industry standard for modern dev tools, highly readable at all sizes, and pairs perfectly with JetBrains Mono for code.

**Self-documenting system**: The font configuration array is the single source of truth. Adding a new font pairing requires only appending one object to the array — no other file changes. Types, dropdown options, loading logic, and validation are all derived from the config.

## 5. Background / Problem Statement

The app currently uses system fonts (`system-ui, -apple-system, ...` for UI text and `ui-monospace, SF Mono, ...` for code). While system fonts load instantly and feel native, users have no way to personalize the typography. This matters because:

- **Developer identity**: Developers have strong font preferences — many associate specific fonts with their workflow (JetBrains Mono, Fira Code, etc.)
- **Readability varies**: Different users find different fonts easier to read for extended sessions
- **Product differentiation**: A curated font selector elevates the product beyond a generic system-font look

The design system guide states "System fonts. They load instantly, render crisply, and feel native." — system fonts remain the default, but users can opt into Google Fonts pairings.

## 6. Goals

- Default to Inter + JetBrains Mono (not system fonts) for a polished out-of-box experience
- Allow users to select from 8 font pairings (1 system default + 7 Google Fonts)
- Each pairing includes a sans-serif font (UI text) and a monospace font (code blocks)
- Selection persists in localStorage and applies on page reload
- Only the selected font pairing is loaded (not all 7)
- Font changes apply immediately without page refresh
- Group visual settings into a new "Appearance" tab
- **Self-documenting, extensible system**: Adding a new font pairing requires only appending one object to the `FONT_CONFIGS` array — types, UI, loading, and validation all derive from it automatically

## 7. Non-Goals

- Per-element font customization (e.g., different font for sidebar vs chat)
- Custom font upload or arbitrary URL input
- Font weight customization beyond the standard 400/500/600
- Font preview rendering in dropdown (each option shown in its own typeface)
- Italic variants
- Font size changes (already exists, just relocated to Appearance tab)
- Obsidian plugin font override (already uses `--font-interface`)

## 8. Technical Dependencies

- **Google Fonts CDN** — `fonts.googleapis.com` / `fonts.gstatic.com`
  - No npm dependency; loaded via `<link>` tags
  - All 7 font families confirmed available on Google Fonts (including Geist, added 2026)
- **Existing stack**: Zustand, shadcn/ui Select component, Tailwind CSS v4

## 9. Detailed Design

### 9.1 Font Configuration Data

Define a constant array of font configurations. This lives in a new file `apps/client/src/lib/font-config.ts`.

**Design principle**: This array is the **single source of truth** for the entire font system. To add a new font pairing, append one object here. Everything else (types, dropdown options, loader, validation) derives from this array automatically.

```typescript
/**
 * Font Configuration Registry
 *
 * This is the single source of truth for all font pairings.
 * To add a new font:
 *   1. Append a new object to FONT_CONFIGS below
 *   2. That's it. The type, dropdown, loader, and validation all derive from this array.
 *
 * Each entry defines:
 *   - key: Unique identifier, stored in localStorage
 *   - displayName: Shown in the Settings dropdown
 *   - description: Subtitle in dropdown (e.g., "Inter + JetBrains Mono")
 *   - sans: CSS font-family value for UI text
 *   - mono: CSS font-family value for code blocks
 *   - googleFontsUrl: URL for the Google Fonts stylesheet (null = no external load)
 */

export interface FontConfig {
  key: string;
  displayName: string;
  description: string;
  sans: string;
  mono: string;
  googleFontsUrl: string | null;
}

// Using 'as const satisfies' to get both literal types and runtime array
export const FONT_CONFIGS = [
  {
    key: 'system',
    displayName: 'System Default',
    description: 'Native platform fonts',
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace",
    googleFontsUrl: null,
  },
  {
    key: 'inter',
    displayName: 'Inter',
    description: 'Inter + JetBrains Mono',
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono&display=swap',
  },
  {
    key: 'geist',
    displayName: 'Geist',
    description: 'Geist + Geist Mono',
    sans: "'Geist', system-ui, sans-serif",
    mono: "'Geist Mono', ui-monospace, monospace",
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono&display=swap',
  },
  {
    key: 'ibm-plex',
    displayName: 'IBM Plex',
    description: 'IBM Plex Sans + IBM Plex Mono',
    sans: "'IBM Plex Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono&display=swap',
  },
  {
    key: 'roboto',
    displayName: 'Roboto',
    description: 'Roboto + Roboto Mono',
    sans: "'Roboto', system-ui, sans-serif",
    mono: "'Roboto Mono', ui-monospace, monospace",
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono&display=swap',
  },
  {
    key: 'source',
    displayName: 'Source',
    description: 'Source Sans 3 + Source Code Pro',
    sans: "'Source Sans 3', system-ui, sans-serif",
    mono: "'Source Code Pro', ui-monospace, monospace",
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&family=Source+Code+Pro&display=swap',
  },
  {
    key: 'fira',
    displayName: 'Fira',
    description: 'Fira Sans + Fira Code',
    sans: "'Fira Sans', system-ui, sans-serif",
    mono: "'Fira Code', ui-monospace, monospace",
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600&family=Fira+Code&display=swap',
  },
  {
    key: 'space',
    displayName: 'Space',
    description: 'Space Grotesk + Space Mono',
    sans: "'Space Grotesk', system-ui, sans-serif",
    mono: "'Space Mono', ui-monospace, monospace",
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Space+Mono&display=swap',
  },
] as const satisfies readonly FontConfig[];

/** Union type of all valid font keys — derived from the config array */
export type FontFamilyKey = typeof FONT_CONFIGS[number]['key'];

/** Default font key for new users / reset */
export const DEFAULT_FONT: FontFamilyKey = 'inter';

/** Look up a font config by key. Returns default font config if key is invalid. */
export function getFontConfig(key: string): FontConfig {
  return FONT_CONFIGS.find(f => f.key === key) ?? FONT_CONFIGS.find(f => f.key === DEFAULT_FONT)!;
}

/** Check if a string is a valid FontFamilyKey */
export function isValidFontKey(key: string): key is FontFamilyKey {
  return FONT_CONFIGS.some(f => f.key === key);
}
```

### 9.2 Font Loader Utility

A pair of functions to manage the Google Fonts `<link>` element. Lives in `apps/client/src/lib/font-loader.ts`:

```typescript
const LINK_ID = 'google-fonts-link';

export function loadGoogleFont(url: string): void {
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (link) {
    link.href = url;
  } else {
    link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }
}

export function removeGoogleFont(): void {
  document.getElementById(LINK_ID)?.remove();
}

export function applyFontCSS(sans: string, mono: string): void {
  document.documentElement.style.setProperty('font-family', sans);
  document.documentElement.style.setProperty('--font-mono', mono);
}

export function removeFontCSS(): void {
  document.documentElement.style.removeProperty('font-family');
  document.documentElement.style.removeProperty('--font-mono');
}
```

### 9.3 Zustand Store Changes (`apps/client/src/stores/app-store.ts`)

Add to `AppState` interface:

```typescript
fontFamily: FontFamilyKey;
setFontFamily: (key: FontFamilyKey) => void;
```

Add initialization (follows `fontSize` pattern). Note: the default font is `DEFAULT_FONT` ('inter'), not 'system'. On first load with no stored preference, Inter loads automatically.

```typescript
fontFamily: (() => {
  try {
    const stored = localStorage.getItem('gateway-font-family');
    const key = isValidFontKey(stored ?? '') ? stored! : DEFAULT_FONT;
    const config = getFontConfig(key);
    if (config.googleFontsUrl) {
      loadGoogleFont(config.googleFontsUrl);
    }
    if (config.key !== 'system') {
      applyFontCSS(config.sans, config.mono);
    }
    return key as FontFamilyKey;
  } catch {
    return DEFAULT_FONT;
  }
})() as FontFamilyKey,
```

Add setter (applies the font — works for any key including 'system'):

```typescript
setFontFamily: (key) => {
  try { localStorage.setItem('gateway-font-family', key); } catch {}
  const config = getFontConfig(key);
  if (config.googleFontsUrl) {
    loadGoogleFont(config.googleFontsUrl);
  } else {
    removeGoogleFont();
  }
  if (config.key !== 'system') {
    applyFontCSS(config.sans, config.mono);
  } else {
    removeFontCSS();
  }
  set({ fontFamily: key });
},
```

Add to `resetPreferences()` — resets to `DEFAULT_FONT`, not 'system':

```typescript
// In the localStorage cleanup:
localStorage.removeItem('gateway-font-family');

// Apply the default font (Inter):
const defaultConfig = getFontConfig(DEFAULT_FONT);
if (defaultConfig.googleFontsUrl) loadGoogleFont(defaultConfig.googleFontsUrl);
applyFontCSS(defaultConfig.sans, defaultConfig.mono);

// In the state reset:
fontFamily: DEFAULT_FONT,
```

### 9.4 CSS Changes (`apps/client/src/index.css`)

Add a `--font-mono` CSS variable to `:root` so the monospace stack can be overridden:

```css
:root {
  /* existing variables... */
  --font-mono: ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace;
}
```

Update any existing monospace references (e.g., in `code`, `pre` blocks) to use `var(--font-mono)` instead of hardcoded stacks. The body `font-family` is overridden via `document.documentElement.style` inline, which takes precedence over the CSS rule. When removed (system mode), the CSS rule in `body { font-family: system-ui, ... }` serves as fallback.

### 9.5 HTML Changes (`apps/client/index.html`)

Add Google Fonts preconnect hints in `<head>` (before the theme script):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

These are static — they only establish the connection. The actual font stylesheet is loaded dynamically by the store.

Additionally, add an inline script (similar to the existing theme script) to apply the font before React mounts, preventing FOUT on reload:

```html
<script>
  (function() {
    var f = localStorage.getItem('gateway-font-family');
    // Font application happens in the Zustand store init,
    // but preconnect hints ensure the CDN connection starts early.
  })();
</script>
```

Note: The actual font CSS injection happens in the Zustand store's IIFE initializer, which runs when `app-store.ts` is first imported (before first render). The preconnect hints in HTML just give a head start on the network connection.

### 9.6 Settings Dialog Changes (`apps/client/src/components/settings/SettingsDialog.tsx`)

**New "Appearance" tab:**

1. Change the tab grid from `grid-cols-3` to `grid-cols-4`
2. Add "Appearance" tab trigger (first position)
3. Move Theme and Font Size selectors from "Preferences" into "Appearance"
4. Add Font Family selector in "Appearance"

The Appearance tab content:

```tsx
<TabsContent value="appearance" className="mt-0 space-y-4">
  <SettingRow label="Theme" description="Choose your preferred color scheme">
    <Select value={theme} onValueChange={setTheme}>
      {/* ... existing theme selector ... */}
    </Select>
  </SettingRow>

  <SettingRow label="Font family" description="Choose the typeface for the interface">
    <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as FontFamilyKey)}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FONT_CONFIGS.map((font) => (
          <SelectItem key={font.key} value={font.key}>
            <div className="flex flex-col">
              <span>{font.displayName}</span>
              <span className="text-xs text-muted-foreground">{font.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </SettingRow>

  <SettingRow label="Font size" description="Adjust the text size across the interface">
    {/* ... existing font size selector ... */}
  </SettingRow>
</TabsContent>
```

The Preferences tab retains all non-visual settings (timestamps, tool calls, shortcut chips, dev tools, verbose logging).

### 9.7 Data Flow

```
User selects "Inter" in Settings dropdown
  → setFontFamily('inter') called
  → localStorage.setItem('gateway-font-family', 'inter')
  → loadGoogleFont('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono&display=swap')
    → <link id="google-fonts-link" rel="stylesheet" href="..."> injected/updated in <head>
  → applyFontCSS("'Inter', system-ui, sans-serif", "'JetBrains Mono', ui-monospace, monospace")
    → document.documentElement.style.fontFamily = "'Inter', system-ui, sans-serif"
    → document.documentElement.style.setProperty('--font-mono', "'JetBrains Mono', ...")
  → Zustand state: fontFamily = 'inter'
  → All text re-renders with Inter; code blocks use JetBrains Mono
```

On page reload:

```
Store initializes
  → Reads 'gateway-font-family' from localStorage
  → If valid key found → use it; otherwise → use DEFAULT_FONT ('inter')
  → If font has googleFontsUrl → inject <link>
  → If font !== 'system' → set CSS properties
  → Return key as initial state
```

First visit (no localStorage):

```
Store initializes
  → No 'gateway-font-family' in localStorage
  → Falls back to DEFAULT_FONT ('inter')
  → Loads Inter + JetBrains Mono from Google Fonts
  → Sets CSS properties
  → User sees Inter immediately (with brief FOUT from system fonts)
```

### 9.8 File Organization

| File | Action |
|------|--------|
| `apps/client/src/lib/font-config.ts` | **Create** — Font configuration data + types |
| `apps/client/src/lib/font-loader.ts` | **Create** — DOM manipulation for font loading |
| `apps/client/src/stores/app-store.ts` | **Modify** — Add fontFamily state + setter + reset |
| `apps/client/src/components/settings/SettingsDialog.tsx` | **Modify** — Add Appearance tab, relocate theme/font-size |
| `apps/client/index.html` | **Modify** — Add preconnect hints |
| `apps/client/src/index.css` | **Modify** — Add --font-mono CSS variable |

## 10. User Experience

### Discovery
Users access font settings via Settings (gear icon) → Appearance tab. The Appearance tab is the first tab, making it immediately visible.

### Selection Flow
1. Open Settings → Appearance tab is shown
2. See "Font family" row with a dropdown showing current selection
3. Click dropdown → see 8 options, each with display name and subtitle (e.g., "Inter" / "Inter + JetBrains Mono")
4. Select a font → text throughout the app changes immediately
5. Close settings → font persists

### Edge Cases
- **Offline/CDN failure**: `display=swap` ensures system fonts show immediately. If Google Fonts CDN is unreachable, the app degrades gracefully to system fonts via the CSS fallback stack.
- **Invalid stored value**: If localStorage contains an unrecognized font key, falls back to `DEFAULT_FONT` ('inter').
- **First visit**: No localStorage value → loads Inter + JetBrains Mono by default. Brief FOUT (system → Inter) is acceptable.
- **Reset**: "Reset to defaults" button reverts font to Inter (the default), not System Default.

## 11. Testing Strategy

### Unit Tests

**`apps/client/src/lib/__tests__/font-config.test.ts`**:
- `getFontConfig` returns correct config for each valid key
- `getFontConfig` returns system config for unknown key
- All FONT_CONFIGS have unique keys
- All non-system configs have a googleFontsUrl

**`apps/client/src/lib/__tests__/font-loader.test.ts`**:
- `loadGoogleFont` creates a link element with correct attributes
- `loadGoogleFont` updates existing link instead of creating duplicate
- `removeGoogleFont` removes the link element
- `applyFontCSS` sets inline styles on documentElement
- `removeFontCSS` removes inline styles

**`apps/client/src/stores/__tests__/app-store.test.ts`** (extend existing):
- `fontFamily` defaults to `DEFAULT_FONT` ('inter')
- `setFontFamily` persists to localStorage
- `setFontFamily('space')` stores 'space' in localStorage
- `setFontFamily('system')` removes Google Fonts link and CSS overrides
- `resetPreferences` resets fontFamily to `DEFAULT_FONT` ('inter')
- `resetPreferences` removes 'gateway-font-family' from localStorage

**`apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx`** (extend existing):
- Appearance tab renders font family selector
- Font family dropdown shows all 8 options
- Selecting a font calls `setFontFamily`
- Theme and font size selectors appear in Appearance tab (not Preferences)

### Mocking Strategy

For font-loader tests, mock `document.getElementById`, `document.createElement`, `document.head.appendChild`, and `document.documentElement.style.setProperty`.

For store tests, the existing `vi.resetModules()` + dynamic import pattern handles localStorage isolation.

## 12. Performance Considerations

- **Lazy loading**: Only the selected font pairing loads (not all 7). Each pairing is ~50-150KB depending on whether it uses variable fonts.
- **Preconnect**: Static `<link rel="preconnect">` hints in HTML reduce DNS/TLS latency for Google Fonts CDN.
- **`display=swap`**: Prevents invisible text during font load. System fonts show instantly, then swap once the Google Font arrives.
- **No bundle impact**: Fonts are loaded via CDN link tags, not npm packages. The only bundle additions are ~2KB of config/loader code.
- **Cache**: Google Fonts CDN serves with long cache headers. Repeat visits load from browser cache.

## 13. Security Considerations

- **External CDN**: Google Fonts CSS loads from `fonts.googleapis.com`, font files from `fonts.gstatic.com`. These are trusted Google domains.
- **No user input in URLs**: Font URLs are hardcoded in the config. No user-supplied data is interpolated into URLs.
- **CSP**: If Content-Security-Policy is added in the future, `fonts.googleapis.com` and `fonts.gstatic.com` need to be in `style-src` and `font-src` respectively.

## 14. Documentation

- Update `guides/design-system.md` Typography section to document the font selection feature and list available pairings.

## 15. Implementation Phases

### Phase 1: Core (MVP)

1. Create `font-config.ts` with all 8 font configurations
2. Create `font-loader.ts` with DOM manipulation utilities
3. Add `fontFamily` state + setter to Zustand store with localStorage persistence
4. Add preconnect hints to `index.html`
5. Add `--font-mono` CSS variable to `index.css`
6. Add "Appearance" tab to Settings with font family selector
7. Relocate theme and font-size selectors from Preferences to Appearance
8. Update `resetPreferences()` to reset font
9. Write tests for all new code

### Phase 2: Polish (Deferred)

- Font preview in dropdown (render each option in its typeface)
- Font size selector could show a live preview
- "Try font" tooltip on hover before committing

## 16. Open Questions

None — all decisions resolved during ideation.

## 17. References

- **Ideation document**: `specs/font-settings/01-ideation.md`
- **Design system**: `guides/design-system.md`
- **Google Fonts**: https://fonts.google.com
- **Existing patterns**: `app-store.ts` fontSize, `SettingsDialog.tsx` tab structure
