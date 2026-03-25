import { Globe, Smartphone, Laptop } from 'lucide-react';
import { Button } from '@/layers/shared/ui';
import type { PromoDialogProps } from '../../model/promo-types';

/** Dialog content for the Remote Access promo. */
export function RemoteAccessDialog({ onClose }: PromoDialogProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10">
          <Globe className="size-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-medium">Access your agents from anywhere</h3>
          <p className="text-muted-foreground text-xs">Phone, tablet, or another computer</p>
        </div>
      </div>

      <div className="bg-muted/50 space-y-3 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="text-muted-foreground mt-0.5 size-4" />
          <div>
            <p className="text-xs font-medium">Mobile access</p>
            <p className="text-muted-foreground text-xs">
              Check on your agents while away from your desk
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Laptop className="text-muted-foreground mt-0.5 size-4" />
          <div>
            <p className="text-xs font-medium">Multi-device</p>
            <p className="text-muted-foreground text-xs">Same sessions, same state, any browser</p>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Enable remote access in Settings &rarr; Server to expose DorkOS on your network or via a
        secure tunnel.
      </p>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Dismiss
        </Button>
        <Button size="sm" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}
