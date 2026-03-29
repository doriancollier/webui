import { useCallback, useRef } from 'react';

/**
 * Keyboard navigation for the activity timeline.
 *
 * Manages Arrow Up/Down to move focus between `[data-activity-row]` elements,
 * and Escape to blur the currently focused row.
 *
 * @param itemCount - Total number of activity items (used as dependency for
 *   callback stability when the list length changes).
 */
export function useActivityKeyboardNav(itemCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const focusableRows = container.querySelectorAll<HTMLElement>('[data-activity-row]');
      const currentIndex = Array.from(focusableRows).findIndex(
        (row) => row === document.activeElement || row.contains(document.activeElement)
      );

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const next = Math.min(currentIndex + 1, focusableRows.length - 1);
          focusableRows[next]?.focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prev = Math.max(currentIndex - 1, 0);
          focusableRows[prev]?.focus();
          break;
        }
        case 'Escape': {
          (document.activeElement as HTMLElement)?.blur();
          break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-create when item count changes
    [itemCount]
  );

  return { containerRef, handleKeyDown };
}
