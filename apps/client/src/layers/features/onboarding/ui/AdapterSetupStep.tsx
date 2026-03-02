import { useState } from 'react';
import { Button } from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';
import { useRelayEnabled } from '@/layers/entities/relay';
import { useAdapterCatalog } from '@/layers/entities/relay';
import type { CatalogEntry } from '@dorkos/shared/relay-schemas';

/** Fallback adapter types shown when the catalog API is unavailable. */
const PLACEHOLDER_ADAPTERS = [
  {
    type: 'telegram',
    displayName: 'Telegram',
    description: 'Receive agent messages and reply via Telegram bot.',
    iconEmoji: '✈',
    category: 'messaging' as const,
  },
  {
    type: 'webhook',
    displayName: 'Webhook',
    description: 'Send agent output to any HTTP endpoint.',
    iconEmoji: '🔗',
    category: 'automation' as const,
  },
  {
    type: 'slack',
    displayName: 'Slack',
    description: 'Connect agents to Slack channels and DMs.',
    iconEmoji: '💬',
    category: 'messaging' as const,
  },
  {
    type: 'claude-code',
    displayName: 'Claude Code',
    description: 'Built-in adapter for Claude Code agent sessions.',
    iconEmoji: '🤖',
    category: 'internal' as const,
  },
];

export interface AdapterSetupStepProps {
  onStepComplete: () => void;
}

/**
 * Step 3 of onboarding — connecting communication adapters.
 *
 * Shows available adapter types as a card grid. If the Relay feature is
 * enabled, it fetches the real adapter catalog; otherwise, placeholder
 * cards are displayed for illustration.
 *
 * @param onStepComplete - Called when the user proceeds past this step
 */
export function AdapterSetupStep({ onStepComplete }: AdapterSetupStepProps) {
  const relayEnabled = useRelayEnabled();
  const { data: catalog, isLoading } = useAdapterCatalog(relayEnabled);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  const adapters: Array<{
    type: string;
    displayName: string;
    description: string;
    iconEmoji?: string;
    category: string;
  }> = catalog?.length
    ? catalog.map((entry: CatalogEntry) => entry.manifest)
    : PLACEHOLDER_ADAPTERS;

  const toggleAdapter = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Want your agents to reach you?
        </h2>
        <p className="text-sm text-muted-foreground">
          Adapters let your agents send messages through Telegram, Slack,
          webhooks, and more. You can always configure these later.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border bg-muted/30"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {adapters.map((adapter) => {
            const isSelected = selectedTypes.has(adapter.type);
            return (
              <button
                key={adapter.type}
                type="button"
                onClick={() => toggleAdapter(adapter.type)}
                className={cn(
                  'flex min-h-11 flex-col items-start gap-2 rounded-lg border p-4 text-left transition',
                  'hover:bg-accent/50',
                  isSelected && 'border-primary/40 bg-accent/30'
                )}
              >
                <div className="flex items-center gap-2">
                  {adapter.iconEmoji && (
                    <span className="text-lg" role="img" aria-hidden>
                      {adapter.iconEmoji}
                    </span>
                  )}
                  <span className="text-sm font-medium">
                    {adapter.displayName}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {adapter.description}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {!relayEnabled && (
        <p className="text-center text-xs text-muted-foreground">
          Relay is not enabled. Enable it in settings to use adapters.
        </p>
      )}

      <div className="flex items-center justify-center gap-3 pt-2">
        <Button variant="ghost" onClick={onStepComplete}>
          Skip
        </Button>
        <Button onClick={onStepComplete}>Continue</Button>
      </div>
    </div>
  );
}
