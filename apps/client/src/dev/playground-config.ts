import {
  Palette,
  TextCursorInput,
  Component,
  MessageSquare,
  Blocks,
  Play,
  Megaphone,
  Terminal,
  Network,
} from 'lucide-react';
import type { PlaygroundSection } from './playground-registry';
import {
  TOKENS_SECTIONS,
  FORMS_SECTIONS,
  COMPONENTS_SECTIONS,
  CHAT_SECTIONS,
  FEATURES_SECTIONS,
  PROMOS_SECTIONS,
  COMMAND_PALETTE_SECTIONS,
  SIMULATOR_SECTIONS,
  TOPOLOGY_SECTIONS,
} from './playground-registry';

/** Navigation group a page belongs to in the sidebar. */
export type PageGroup = 'design-system' | 'features';

/** Centralized metadata for a single playground page. */
export interface PageConfig {
  /** Unique page identifier — matches the `Page` type union. */
  id: string;
  /** Human-readable label for sidebar nav, search headings, and overview cards. */
  label: string;
  /** Short description shown in page headers and overview cards. */
  description: string;
  /** Lucide icon component for sidebar nav and overview cards. */
  icon: React.ComponentType<{ className?: string }>;
  /** Sidebar navigation group. */
  group: PageGroup;
  /** Section registry entries for this page (drives TOC and Cmd+K search). */
  sections: PlaygroundSection[];
  /** URL path segment (e.g. `'tokens'` → `/dev/tokens`). */
  path: string;
}

/**
 * Single source of truth for all playground pages.
 *
 * Adding a new page is a one-line addition here — nav, search, overview,
 * and route parsing all derive from this array.
 */
export const PAGE_CONFIGS: PageConfig[] = [
  // ── Design System ──
  {
    id: 'tokens',
    label: 'Design Tokens',
    description:
      'Color palette, typography, spacing, border radius, and shadow tokens that define the visual language.',
    icon: Palette,
    group: 'design-system',
    sections: TOKENS_SECTIONS,
    path: 'tokens',
  },
  {
    id: 'forms',
    label: 'Forms',
    description:
      'Form primitives and composed input components — inputs, selects, comboboxes, and tag inputs.',
    icon: TextCursorInput,
    group: 'design-system',
    sections: FORMS_SECTIONS,
    path: 'forms',
  },
  {
    id: 'components',
    label: 'Components',
    description:
      'Interactive gallery of shared UI primitives — buttons, overlays, navigation, and feedback.',
    icon: Component,
    group: 'design-system',
    sections: COMPONENTS_SECTIONS,
    path: 'components',
  },
  // ── Features ──
  {
    id: 'chat',
    label: 'Chat',
    description:
      'Visual testing gallery for chat UI — messages, tool calls, input, status indicators, and misc.',
    icon: MessageSquare,
    group: 'features',
    sections: CHAT_SECTIONS,
    path: 'chat',
  },
  {
    id: 'features',
    label: 'Features',
    description: 'Domain-specific components from Relay, Mesh, Pulse, and Onboarding features.',
    icon: Blocks,
    group: 'features',
    sections: FEATURES_SECTIONS,
    path: 'features',
  },
  {
    id: 'topology',
    label: 'Topology',
    description:
      'React Flow custom nodes, edges, and chrome used in the agent mesh topology graph.',
    icon: Network,
    group: 'features',
    sections: TOPOLOGY_SECTIONS,
    path: 'topology',
  },
  {
    id: 'promos',
    label: 'Feature Promos',
    description: 'Promo registry, slot previews, override controls, and dialog previews.',
    icon: Megaphone,
    group: 'features',
    sections: PROMOS_SECTIONS,
    path: 'promos',
  },
  {
    id: 'command-palette',
    label: 'Command Palette',
    description: 'Agent items, search highlighting, sub-menus, keyboard hints, and edge cases.',
    icon: Terminal,
    group: 'features',
    sections: COMMAND_PALETTE_SECTIONS,
    path: 'command-palette',
  },
  {
    id: 'simulator',
    label: 'Simulator',
    description: 'Chat message streaming simulator with scripted playback scenarios.',
    icon: Play,
    group: 'features',
    sections: SIMULATOR_SECTIONS,
    path: 'simulator',
  },
];

// ── Derived lookups ──

/** Human-readable label for each page, keyed by page ID. */
export const PAGE_LABELS: Record<string, string> = Object.fromEntries(
  PAGE_CONFIGS.map((c) => [c.id, c.label])
);

/** Ordered list of page IDs for consistent rendering (e.g. search groups). */
export const PAGE_ORDER: string[] = PAGE_CONFIGS.map((c) => c.id);

/** Pages in the "Design System" sidebar group. */
export const DESIGN_SYSTEM_NAV = PAGE_CONFIGS.filter((c) => c.group === 'design-system');

/** Pages in the "Features" sidebar group. */
export const FEATURES_NAV = PAGE_CONFIGS.filter((c) => c.group === 'features');

/**
 * Resolve the current page from the URL pathname.
 *
 * Falls back to `'overview'` for unrecognized paths.
 */
export function getPageFromPath(pathname: string): string {
  const match = PAGE_CONFIGS.find((c) => pathname.startsWith(`/dev/${c.path}`));
  return match?.id ?? 'overview';
}
