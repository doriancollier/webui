import { PanelRight, PanelRightClose } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppStore } from '@/layers/shared/model';
import { isMac } from '@/layers/shared/lib';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/layers/shared/ui';
import { Kbd } from '@/layers/shared/ui/kbd';

/** Toggle button for the agent canvas panel. */
export function CanvasToggle() {
  const canvasOpen = useAppStore((s) => s.canvasOpen);
  const canvasContent = useAppStore((s) => s.canvasContent);
  const setCanvasOpen = useAppStore((s) => s.setCanvasOpen);

  const Icon = canvasOpen ? PanelRightClose : PanelRight;
  const ariaLabel = canvasOpen ? 'Close canvas' : 'Open canvas';
  const shortcutLabel = isMac ? '⌘.' : 'Ctrl+.';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          aria-label={ariaLabel}
          className="text-muted-foreground hover:text-foreground relative flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          onClick={() => setCanvasOpen(!canvasOpen)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        >
          <Icon className="size-4" />
          {!canvasOpen && canvasContent !== null && (
            <span className="bg-primary absolute top-1 right-1 size-1.5 rounded-full" />
          )}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>
        <span>Toggle canvas</span>
        <Kbd>{shortcutLabel}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
