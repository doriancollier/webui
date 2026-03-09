import { useEffect } from 'react';
import { getPlatform } from '@/layers/shared/lib';
import { useAppStore } from '@/layers/shared/model';
import { useQueryState } from 'nuqs';
import { useSessionId } from './use-session-id';

/** Options for the directory setter returned by {@link useDirectoryState}. */
export interface SetDirOptions {
  /**
   * When true, skip clearing the active session ID on directory change.
   * Use this when you intend to set a new session immediately after switching
   * directories (e.g. navigating to a Pulse run in a different CWD).
   */
  preserveSession?: boolean;
}

/**
 * Dual-mode working-directory hook.
 *
 * - **Standalone (web):** The `?dir=` URL query parameter is the source of
 *   truth. A one-way `useEffect` syncs URL → Zustand so store consumers
 *   (e.g. `useSessions`) see the correct CWD. When no `?dir=` is present the
 *   getter falls back to Zustand, which holds the server default CWD set by
 *   {@link useDefaultCwd} — this keeps URLs clean.
 * - **Embedded (Obsidian):** Zustand is the sole store; URL is unused.
 *
 * Both stores are subscribed unconditionally to satisfy React's rules of hooks.
 */
export function useDirectoryState(): [
  string | null,
  (dir: string | null, opts?: SetDirOptions) => void,
] {
  const platform = getPlatform();

  // Zustand state (used in embedded mode + sync target)
  const storeDir = useAppStore((s) => s.selectedCwd);
  const setStoreDir = useAppStore((s) => s.setSelectedCwd);

  // URL state (standalone mode)
  const [urlDir, setUrlDir] = useQueryState('dir');

  // Session clearing on directory change
  const [, setSessionId] = useSessionId();

  // Sync URL -> Zustand on initial load (standalone only)
  useEffect(() => {
    if (!platform.isEmbedded && urlDir && urlDir !== storeDir) {
      setStoreDir(urlDir);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: one-way sync URL → store on URL change only
  }, [urlDir]);

  if (platform.isEmbedded) {
    return [
      storeDir,
      (dir, opts) => {
        if (dir) {
          setStoreDir(dir);
          if (!opts?.preserveSession) setSessionId(null);
        }
      },
    ];
  }

  // Standalone: URL is source of truth, sync to Zustand
  return [
    urlDir ?? storeDir, // Fall back to Zustand (for default cwd set by useDefaultCwd)
    (dir, opts) => {
      if (dir) {
        setUrlDir(dir);
        setStoreDir(dir); // Sync to Zustand for localStorage + consumers
        if (!opts?.preserveSession) setSessionId(null);
      } else {
        setUrlDir(null); // Remove from URL
      }
    },
  ];
}
