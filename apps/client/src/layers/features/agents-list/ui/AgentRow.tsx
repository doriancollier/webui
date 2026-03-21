import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AgentManifest, AgentHealthStatus } from '@dorkos/shared/mesh-schemas';
import { useUnregisterAgent } from '@/layers/entities/mesh';
import { Badge } from '@/layers/shared/ui/badge';
import { Button } from '@/layers/shared/ui/button';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/layers/shared/ui/collapsible';
import { cn } from '@/layers/shared/lib';
import { AgentDialog } from '@/layers/features/agent-settings';
import { SessionLaunchPopover } from './SessionLaunchPopover';

/** Maximum capability badges shown in collapsed state before overflow. */
const MAX_VISIBLE_CAPS = 3;

/** Derive the last 2 path segments for a compact display. */
function truncatePath(fullPath: string): string {
  const segments = fullPath.split('/').filter(Boolean);
  return segments.length <= 2 ? fullPath : segments.slice(-2).join('/');
}

interface AgentRowProps {
  agent: AgentManifest;
  /** Filesystem path of the agent's project directory. */
  projectPath: string;
  sessionCount: number;
  healthStatus: AgentHealthStatus;
  lastActive: string | null;
}

const healthDotClass: Record<AgentHealthStatus, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-amber-500',
  stale: 'bg-muted-foreground/30',
  unreachable: 'bg-red-500',
};

/**
 * Expandable agent row for the fleet management list.
 * Collapsed: health dot, name, runtime badge, path, capabilities preview, session action.
 * Expanded: full description, all capabilities, behavior/budget config, and management actions.
 */
export function AgentRow({
  agent,
  projectPath,
  sessionCount,
  healthStatus,
  lastActive,
}: AgentRowProps) {
  const [open, setOpen] = useState(false);
  const [confirmUnregister, setConfirmUnregister] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mutate: unregister } = useUnregisterAgent();

  const visibleCaps = agent.capabilities.slice(0, MAX_VISIBLE_CAPS);
  const overflowCount = agent.capabilities.length - MAX_VISIBLE_CAPS;

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="hover:bg-accent/50 rounded-xl border px-4 py-3 transition-colors">
          <CollapsibleTrigger asChild>
            <div className="flex cursor-pointer items-center gap-3">
              {/* Health dot */}
              <span
                className={cn('size-2 shrink-0 rounded-full', healthDotClass[healthStatus])}
                aria-label={`Status: ${healthStatus}`}
              />

              {/* Name */}
              <span className="text-sm font-medium">{agent.name}</span>

              {/* Runtime badge */}
              <Badge variant="secondary">{agent.runtime}</Badge>

              {/* Project path */}
              <span className="text-muted-foreground max-w-[200px] truncate font-mono text-xs">
                {truncatePath(projectPath)}
              </span>

              {/* Active session count */}
              {sessionCount > 0 && <Badge variant="outline">{sessionCount} active</Badge>}

              {/* Capability badges */}
              <div className="flex flex-wrap gap-1">
                {visibleCaps.map((cap) => (
                  <Badge key={cap} variant="outline" className="text-xs">
                    {cap}
                  </Badge>
                ))}
                {overflowCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    +{overflowCount} more
                  </Badge>
                )}
              </div>

              {/* Last active */}
              {lastActive && (
                <span className="text-muted-foreground ml-auto text-xs">{lastActive}</span>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Session action — stop propagation so clicking doesn't toggle row */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Event boundary only, not interactive itself */}
              <div onClick={(e) => e.stopPropagation()}>
                <SessionLaunchPopover projectPath={projectPath} />
              </div>

              {/* Chevron */}
              <ChevronDown
                className={cn(
                  'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
                  open && 'rotate-180'
                )}
              />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-3 px-0 pt-3 pb-2">
              {/* Full description */}
              {agent.description && (
                <p className="text-muted-foreground text-sm">{agent.description}</p>
              )}

              {/* All capabilities */}
              {agent.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.map((cap) => (
                    <Badge key={cap} variant="outline" className="text-xs">
                      {cap}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Behavior config */}
              {agent.behavior && (
                <div className="text-muted-foreground text-xs">
                  <span className="font-medium">Response mode:</span> {agent.behavior.responseMode}
                  {agent.behavior.escalationThreshold != null && (
                    <span> · Escalation threshold: {agent.behavior.escalationThreshold}</span>
                  )}
                </div>
              )}

              {/* Budget */}
              {agent.budget && (
                <div className="text-muted-foreground text-xs">
                  <span className="font-medium">Budget:</span> max {agent.budget.maxHopsPerMessage}{' '}
                  hops · {agent.budget.maxCallsPerHour} calls/hr
                </div>
              )}

              {/* Namespace */}
              {agent.namespace && (
                <div className="text-muted-foreground text-xs">Namespace: {agent.namespace}</div>
              )}

              {/* Registration info */}
              <div className="text-muted-foreground text-xs">
                Registered {new Date(agent.registeredAt).toLocaleDateString()} by{' '}
                {agent.registeredBy}
              </div>

              {/* Management actions */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                  Edit
                </Button>
                {confirmUnregister ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Are you sure?</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        unregister(agent.id);
                        setConfirmUnregister(false);
                      }}
                    >
                      Confirm
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmUnregister(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setConfirmUnregister(true)}
                  >
                    Unregister
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <AgentDialog projectPath={projectPath} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
