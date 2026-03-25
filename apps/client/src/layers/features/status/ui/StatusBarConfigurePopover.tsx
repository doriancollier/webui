import * as React from 'react';
import {
  ResponsivePopover,
  ResponsivePopoverTrigger,
  ResponsivePopoverContent,
  ResponsivePopoverTitle,
} from '@/layers/shared/ui';
import { StatusBarConfigureContent } from './StatusBarConfigureContent';

interface StatusBarConfigurePopoverProps {
  /** The trigger element that opens the popover. */
  children: React.ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Callback when open state changes. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Responsive configure popover for status bar item visibility management.
 *
 * Opens as a `Popover` (anchored top-end) on desktop, or a bottom `Drawer` on mobile.
 * The toggle content is delegated to `StatusBarConfigureContent`.
 */
function StatusBarConfigurePopover({
  children,
  open,
  onOpenChange,
}: StatusBarConfigurePopoverProps) {
  return (
    <ResponsivePopover open={open} onOpenChange={onOpenChange}>
      <ResponsivePopoverTrigger asChild>{children}</ResponsivePopoverTrigger>
      <ResponsivePopoverContent
        side="top"
        align="end"
        className="w-72 p-3"
        aria-label="Status bar configuration"
      >
        <ResponsivePopoverTitle>Configure Status Bar</ResponsivePopoverTitle>
        <StatusBarConfigureContent />
      </ResponsivePopoverContent>
    </ResponsivePopover>
  );
}

StatusBarConfigurePopover.displayName = 'StatusBarConfigurePopover';

export { StatusBarConfigurePopover };
export type { StatusBarConfigurePopoverProps };
