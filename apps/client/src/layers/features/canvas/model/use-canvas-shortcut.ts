import { useEffect } from 'react';
import { useAppStore } from '@/layers/shared/model';

/**
 * Register the `Cmd+.` / `Ctrl+.` key handler that toggles the canvas panel.
 *
 * Follows the same pattern as useShortcutsPanel — a document-level keydown
 * listener that calls the store toggle action.
 */
export function useCanvasShortcut(): void {
  const canvasOpen = useAppStore((s) => s.canvasOpen);
  const setCanvasOpen = useAppStore((s) => s.setCanvasOpen);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setCanvasOpen(!canvasOpen);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [canvasOpen, setCanvasOpen]);
}
