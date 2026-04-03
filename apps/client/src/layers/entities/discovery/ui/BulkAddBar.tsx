import { Button } from '@/layers/shared/ui';

interface BulkAddBarProps {
  count: number;
  onAddAll: () => void;
  disabled?: boolean;
}

/**
 * Inline bar showing the count of new projects with an "Add All" action.
 *
 * @param count - Number of pending (unacted) candidates
 * @param onAddAll - Called when the user clicks "Add All"
 * @param disabled - Disables the button during bulk registration
 */
export function BulkAddBar({ count, onAddAll, disabled }: BulkAddBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground text-sm font-medium">
        {count} new project{count === 1 ? '' : 's'}
      </span>
      <Button variant="outline" size="sm" onClick={onAddAll} disabled={disabled}>
        Add All
      </Button>
    </div>
  );
}
