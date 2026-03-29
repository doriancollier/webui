import { Button } from '@/layers/shared/ui';
import { motion } from 'motion/react';
import { cn } from '@/layers/shared/lib';
import type { AttentionItem as AttentionItemType } from '../model/use-attention-items';
import { formatRelativeTime } from '../lib/format-relative-time';

const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
} as const;

interface AttentionItemProps {
  item: AttentionItemType;
}

/** Single attention row with icon, description, relative timestamp, and action button. */
export function AttentionItemRow({ item }: AttentionItemProps) {
  const Icon = item.icon;
  const relativeTime = formatRelativeTime(item.timestamp);

  return (
    <motion.div
      variants={staggerItem}
      className="hover:bg-accent/50 flex min-w-0 items-center gap-2.5 rounded-md px-2 py-1 transition-colors"
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          item.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'
        )}
      />
      <Icon
        className={cn(
          'size-3.5 shrink-0',
          item.severity === 'error' ? 'text-red-500/70' : 'text-amber-500/70'
        )}
      />
      <span className="text-foreground/90 min-w-0 flex-1 truncate text-xs">{item.description}</span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{relativeTime}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 px-2 text-xs"
        onClick={item.action.onClick}
      >
        {item.action.label}
      </Button>
    </motion.div>
  );
}
