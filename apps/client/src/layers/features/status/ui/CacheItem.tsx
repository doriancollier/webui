import { Zap } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';

interface CacheItemProps {
  /** Tokens read from cache (cost savings). */
  cacheReadTokens: number;
  /** Tokens written to cache. */
  cacheCreationTokens: number;
  /** Total input tokens (uncached). */
  contextTokens?: number;
}

/** Format a token count as a compact human-readable string. */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

/** Status bar item displaying prompt cache hit rate. */
export function CacheItem({ cacheReadTokens, cacheCreationTokens, contextTokens }: CacheItemProps) {
  const totalInput = cacheReadTokens + cacheCreationTokens + (contextTokens ?? 0);
  const hitRate = totalInput > 0 ? Math.round((cacheReadTokens / totalInput) * 100) : 0;
  const colorClass = hitRate >= 70 ? 'text-emerald-500' : hitRate >= 30 ? '' : 'text-amber-500';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('inline-flex cursor-default items-center gap-1', colorClass)}
          aria-label="Prompt cache hit rate"
        >
          <Zap className="size-(--size-icon-xs)" />
          <span>{hitRate}%</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        <div className="space-y-1">
          <div className="text-xs font-medium">Prompt Cache</div>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Cache hits</span>
              <span>{formatTokens(cacheReadTokens)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Cache writes</span>
              <span>{formatTokens(cacheCreationTokens)}</span>
            </div>
            {contextTokens != null && contextTokens > 0 && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Uncached</span>
                <span>{formatTokens(contextTokens)}</span>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
