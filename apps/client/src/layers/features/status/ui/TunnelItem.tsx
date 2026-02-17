import { useState } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/layers/shared/lib';
import { TunnelDialog } from '@/layers/features/settings';
import type { ServerConfig } from '@dorkos/shared/types';

interface TunnelItemProps {
  tunnel: ServerConfig['tunnel'];
}

export function TunnelItem({ tunnel }: TunnelItemProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const dotColor = tunnel.connected ? 'bg-green-500' : 'bg-gray-400';
  const hostname = tunnel.url ? new URL(tunnel.url).hostname : null;

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="hover:text-foreground inline-flex items-center gap-1 transition-colors duration-150"
        aria-label={tunnel.connected ? `Tunnel connected: ${hostname}` : 'Tunnel disconnected'}
        title={tunnel.connected ? `Tunnel: ${tunnel.url}` : 'Tunnel: disconnected'}
      >
        <span className={cn('inline-block size-1.5 rounded-full', dotColor)} />
        <Globe className="size-(--size-icon-xs)" />
        {tunnel.connected && hostname && (
          <span className="max-w-24 truncate">{hostname}</span>
        )}
        {!tunnel.connected && <span>Tunnel</span>}
      </button>
      <TunnelDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
