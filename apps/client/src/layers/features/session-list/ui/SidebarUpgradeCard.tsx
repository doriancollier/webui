import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowUp, Clipboard, Check, ExternalLink, X } from 'lucide-react';
import { cn } from '@/layers/shared/lib';
import { TIMING } from '@/layers/shared/lib/constants';

interface SidebarUpgradeCardProps {
  currentVersion: string;
  latestVersion: string;
  isFeature: boolean;
  onDismiss: (version: string) => void;
}

const UPDATE_COMMAND = 'npm update -g dorkos';
const RELEASES_URL = 'https://github.com/dork-labs/dorkos/releases';

/**
 * Dismissible upgrade notification card for the sidebar footer.
 *
 * Renders above the footer bar when a newer version is available.
 * Feature updates use amber accent styling; patch updates use muted styling.
 */
export function SidebarUpgradeCard({
  currentVersion,
  latestVersion,
  isFeature,
  onDismiss,
}: SidebarUpgradeCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(UPDATE_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'mx-2 mb-1 rounded-md border p-3',
        isFeature ? 'border-amber-500/20 bg-amber-500/5' : 'border-border bg-muted/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <ArrowUp className="size-3.5" />
          <span>
            v{currentVersion} &rarr; v{latestVersion}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(latestVersion)}
          className="text-muted-foreground hover:text-foreground -mt-0.5 shrink-0 transition-colors"
          aria-label="Dismiss upgrade notification"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <p className="text-muted-foreground mt-1 text-xs">
        {isFeature ? 'New features available' : 'Patch update available'}
      </p>

      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
          aria-label="Copy update command"
        >
          {copied ? (
            <Check className="size-3 text-emerald-500" />
          ) : (
            <Clipboard className="size-3" />
          )}
          Copy command
        </button>

        {isFeature && (
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
          >
            <ExternalLink className="size-3" />
            What&apos;s new
          </a>
        )}
      </div>
    </motion.div>
  );
}
