interface PaletteFooterProps {
  /** Current cmdk page (undefined for root) */
  page: string | undefined;
  /** Whether an agent item is currently selected */
  hasAgentSelected: boolean;
}

/**
 * Dynamic keyboard hint bar at the bottom of the command palette.
 *
 * Shows context-appropriate shortcuts based on the current page
 * and selection state.
 *
 * @param page - Current cmdk page name (undefined for root)
 * @param hasAgentSelected - Whether an agent item is currently selected
 */
export function PaletteFooter({ page, hasAgentSelected }: PaletteFooterProps) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac');
  const modKey = isMac ? '\u2318' : 'Ctrl';

  return (
    <div className="border-t px-3 py-1.5 flex items-center gap-4 text-xs text-muted-foreground">
      <span>
        <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">{'\u2191\u2193'}</kbd>{' '}
        Navigate
      </span>
      {!page && hasAgentSelected && (
        <span>
          <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Enter</kbd>{' '}
          Open
        </span>
      )}
      {!page && hasAgentSelected && (
        <span>
          <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">{modKey}+Enter</kbd>{' '}
          New Tab
        </span>
      )}
      {page && (
        <span>
          <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Backspace</kbd>{' '}
          Back
        </span>
      )}
      <span className="ml-auto">
        <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">esc</kbd>{' '}
        Close
      </span>
    </div>
  );
}
