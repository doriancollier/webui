import { useState, useEffect, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import QRCode from 'react-qr-code';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  Switch,
} from '@/layers/shared/ui';
import { useTransport } from '@/layers/shared/model';
import { cn, TIMING } from '@/layers/shared/lib';

type TunnelState = 'off' | 'starting' | 'connected' | 'stopping' | 'error';

const START_TIMEOUT_MS = 15_000;

interface TunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Dialog for managing ngrok tunnel connections with QR code sharing. */
export function TunnelDialog({ open, onOpenChange }: TunnelDialogProps) {
  const transport = useTransport();
  const queryClient = useQueryClient();
  const { data: serverConfig } = useQuery({
    queryKey: ['config'],
    queryFn: () => transport.getConfig(),
    staleTime: 5 * 60 * 1000,
  });

  const tunnel = serverConfig?.tunnel;
  const [state, setState] = useState<TunnelState>('off');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync state from server config
  useEffect(() => {
    if (tunnel?.connected && tunnel?.url) {
      setState('connected');
      setUrl(tunnel.url);
    } else if (state !== 'starting' && state !== 'stopping') {
      setState('off');
      setUrl(null);
    }
  }, [tunnel?.connected, tunnel?.url]);

  const handleToggle = useCallback(
    async (checked: boolean) => {
      if (checked) {
        // Start — pessimistic UI
        setState('starting');
        setError(null);
        const timeout = setTimeout(() => {
          setState('error');
          setError('Connection timed out after 15 seconds');
        }, START_TIMEOUT_MS);

        try {
          const result = await transport.startTunnel();
          clearTimeout(timeout);
          setState('connected');
          setUrl(result.url);
          queryClient.invalidateQueries({ queryKey: ['config'] });
        } catch (err) {
          clearTimeout(timeout);
          setState('error');
          setError(err instanceof Error ? err.message : 'Failed to start tunnel');
        }
      } else {
        // Stop — optimistic UI
        setState('off');
        setUrl(null);
        setError(null);
        try {
          await transport.stopTunnel();
          queryClient.invalidateQueries({ queryKey: ['config'] });
        } catch (err) {
          setState('error');
          setError(err instanceof Error ? err.message : 'Failed to stop tunnel');
        }
      }
    },
    [transport, queryClient],
  );

  const handleSaveToken = useCallback(async () => {
    try {
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tunnel: { authtoken: authToken } }),
      });
      setAuthToken('');
      queryClient.invalidateQueries({ queryKey: ['config'] });
    } catch {
      // Token save failed silently
    }
  }, [authToken, queryClient]);

  const handleCopyUrl = useCallback(() => {
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  }, [url]);

  const isTransitioning = state === 'starting' || state === 'stopping';
  const isChecked = state === 'connected' || state === 'starting';

  const dotColor = {
    off: 'bg-gray-400',
    starting: 'bg-amber-400',
    connected: 'bg-green-500',
    stopping: 'bg-gray-400',
    error: 'bg-red-500',
  }[state];

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2 text-sm font-medium">
            <span
              className={cn(
                'inline-block size-2 rounded-full',
                dotColor,
                state === 'starting' && 'animate-pulse',
              )}
            />
            Tunnel
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4 px-4 pb-4">
          {/* Toggle row */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Enable tunnel</span>
            <Switch checked={isChecked} onCheckedChange={handleToggle} disabled={isTransitioning} />
          </div>

          {/* Auth token section — only when no token configured */}
          {tunnel && !tunnel.tokenConfigured && state !== 'connected' && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                Enter your ngrok auth token to connect.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="ngrok auth token"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex-1 rounded-md border px-3 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-1"
                />
                <button
                  onClick={handleSaveToken}
                  disabled={!authToken.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Connected section with URL + QR */}
          {state === 'connected' && url && (
            <div className="space-y-3">
              <button
                onClick={handleCopyUrl}
                className="text-muted-foreground hover:text-foreground w-full truncate text-left font-mono text-xs transition-colors"
                title="Click to copy"
              >
                {copied ? 'Copied!' : url}
              </button>
              <div className="flex justify-center rounded-lg bg-white p-3">
                <QRCode value={url} size={200} level="M" />
              </div>
              <p className="text-muted-foreground text-center text-xs">Scan to open on mobile</p>
            </div>
          )}

          {/* Error section */}
          {state === 'error' && error && (
            <div className="space-y-2">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                className="border-input hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md border bg-transparent px-3 py-1.5 text-sm font-medium shadow-sm transition-colors"
                onClick={() => {
                  setState('off');
                  setError(null);
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
