import { usePulseEnabled, useActiveRunCount, useCompletedRunBadge } from '@/layers/entities/pulse';
import { useRelayEnabled } from '@/layers/entities/relay';
import { useRegisteredAgents } from '@/layers/entities/mesh';
import { useAppStore } from '@/layers/shared/model';
import { cn } from '@/layers/shared/lib';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/layers/shared/ui';
import { icons } from '@dorkos/icons/registry';

/**
 * Compact row of status chips showing Pulse/Relay/Mesh status at a glance.
 * Each chip opens its respective panel dialog on click via Zustand actions.
 *
 * Design principles:
 * - Tooltip-first: status details shown in tooltips, not inline labels
 * - Muted disabled states: visually de-emphasizes disabled features without hiding them
 * - Status dots: animated green for active Pulse runs, amber for unviewed, blue for Mesh agents
 */
export function AgentContextChips() {
  const pulseEnabled = usePulseEnabled();
  const { data: activeRunCount = 0 } = useActiveRunCount(pulseEnabled);
  const { unviewedCount } = useCompletedRunBadge(pulseEnabled);
  const relayEnabled = useRelayEnabled();
  const { data: agentsData } = useRegisteredAgents();
  const agents = agentsData?.agents ?? [];
  const { setPulseOpen, setRelayOpen, setMeshOpen } = useAppStore();

  const pulseTooltip = getPulseTooltip(pulseEnabled, activeRunCount, unviewedCount);
  const relayTooltip = relayEnabled ? 'Relay messaging' : 'Relay is disabled';
  const meshTooltip =
    agents.length > 0
      ? `${agents.length} agent${agents.length > 1 ? 's' : ''} registered`
      : 'No agents registered';

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setPulseOpen(true)}
            className={cn(
              'relative rounded-md p-1.5 transition-colors duration-150',
              pulseEnabled
                ? 'text-muted-foreground/50 hover:text-muted-foreground'
                : 'text-muted-foreground/25 hover:text-muted-foreground/40'
            )}
            aria-label="Pulse scheduler"
          >
            <icons.pulse className="size-(--size-icon-sm)" />
            {activeRunCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-green-500" />
            )}
            {activeRunCount === 0 && unviewedCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{pulseTooltip}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setRelayOpen(true)}
            className={cn(
              'relative rounded-md p-1.5 transition-colors duration-150',
              relayEnabled
                ? 'text-muted-foreground/50 hover:text-muted-foreground'
                : 'text-muted-foreground/25 hover:text-muted-foreground/40'
            )}
            aria-label="Relay messaging"
          >
            <icons.relay className="size-(--size-icon-sm)" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{relayTooltip}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setMeshOpen(true)}
            className="relative rounded-md p-1.5 text-muted-foreground/50 transition-colors duration-150 hover:text-muted-foreground"
            aria-label="Mesh discovery"
          >
            <icons.mesh className="size-(--size-icon-sm)" />
            {agents.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-blue-500" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{meshTooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Build the Pulse chip tooltip text based on enabled state and run counts. */
function getPulseTooltip(enabled: boolean, activeRuns: number, unviewed: number): string {
  if (!enabled) return 'Pulse is disabled';
  if (activeRuns > 0) return `${activeRuns} run${activeRuns > 1 ? 's' : ''} active`;
  if (unviewed > 0) return `${unviewed} completed run${unviewed > 1 ? 's' : ''} unviewed`;
  return 'Pulse — no active runs';
}
