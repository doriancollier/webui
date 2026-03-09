import { getPlatform } from '@/layers/shared/lib';
import { useAppStore } from '@/layers/shared/model';
import { useQueryState } from 'nuqs';

/**
 * Dual-mode session ID hook.
 *
 * - **Standalone (web):** reads/writes the `?session=` URL query parameter via
 *   nuqs with `history: 'push'`, so the browser back button navigates between
 *   previously viewed sessions.
 * - **Embedded (Obsidian):** reads/writes the Zustand store directly, since
 *   Obsidian's webview has no meaningful URL bar.
 *
 * Both stores are subscribed unconditionally to satisfy React's rules of hooks.
 */
export function useSessionId(): [string | null, (id: string | null) => void] {
  const platform = getPlatform();

  // In Obsidian: use Zustand store
  const storeId = useAppStore((s) => s.sessionId);
  const setStoreId = useAppStore((s) => s.setSessionId);

  // In standalone: use URL params (pushState enables browser back/forward)
  const [urlId, setUrlId] = useQueryState('session', { history: 'push' });

  if (platform.isEmbedded) {
    return [storeId, setStoreId];
  }
  return [urlId, setUrlId];
}
