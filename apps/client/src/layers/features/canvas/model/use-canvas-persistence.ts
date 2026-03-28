import { useEffect } from 'react';
import { useAppStore } from '@/layers/shared/model';

/**
 * Hydrate canvas state from localStorage when the active session changes.
 *
 * Calls `loadCanvasForSession` on mount and whenever `sessionId` changes,
 * restoring the persisted open/closed state and content for that session.
 * When `sessionId` is undefined (no active session), this hook is a no-op.
 *
 * @param sessionId - The current session UUID from URL search params
 */
export function useCanvasPersistence(sessionId: string | null | undefined): void {
  const loadCanvasForSession = useAppStore((s) => s.loadCanvasForSession);

  useEffect(() => {
    if (sessionId) {
      loadCanvasForSession(sessionId);
    }
  }, [sessionId, loadCanvasForSession]);
}
