import { useCallback } from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFullscreenToggle,
} from '@/layers/shared/ui';
import type { PromoDefinition } from '../model/promo-types';

interface PromoDialogShellProps {
  /** The promo whose dialog to show. */
  promo: PromoDefinition;
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when dialog open state changes. */
  onOpenChange: (open: boolean) => void;
}

/**
 * Thin wrapper around ResponsiveDialog for promo dialog content.
 * Renders the promo's action.component inside ResponsiveDialogBody.
 * Dialog on desktop (with fullscreen toggle), Drawer on mobile.
 */
export function PromoDialog({ promo, open, onOpenChange }: PromoDialogShellProps) {
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Only render if action is dialog type
  if (promo.action.type !== 'dialog') return null;

  const DialogContent = promo.action.component;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[85vh] max-w-lg gap-0 p-0">
        <ResponsiveDialogFullscreenToggle />
        <ResponsiveDialogHeader className="p-4 pb-0">
          <ResponsiveDialogTitle className="text-sm font-medium">
            {promo.content.title}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            {promo.content.shortDescription}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="p-4">
          <DialogContent onClose={handleClose} />
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
