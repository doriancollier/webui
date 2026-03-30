import { useTasksEnabled, useTasks } from '@/layers/entities/tasks';
import { useRelayEnabled } from '@/layers/entities/relay';
import { useMeshAgentHealth } from '@/layers/entities/mesh';
import { useBindings } from '@/layers/entities/binding';
import { useAppStore } from '@/layers/shared/model';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';
import { SubsystemRow } from './SubsystemRow';

interface ConnectionsTabProps {
  agent: AgentManifest;
}

/**
 * Agent-Settings connections tab showing Tasks, Relay, and Mesh subsystem status
 * with real data and deep-link navigation to each subsystem panel.
 */
export function ConnectionsTab({ agent }: ConnectionsTabProps) {
  const tasksEnabled = useTasksEnabled();
  const relayEnabled = useRelayEnabled();
  const { data: health } = useMeshAgentHealth(agent.id);
  const { data: schedules = [] } = useTasks(tasksEnabled);
  const { data: bindings = [] } = useBindings();
  const { setAgentDialogOpen, setRelayOpen, openTasksForAgent } = useAppStore();

  const agentScheduleCount = schedules.filter((s) => s.agentId === agent.id).length;
  const agentBindingCount = bindings.filter((b) => b.agentId === agent.id).length;

  /** Close the agent dialog then open the target panel after the close animation completes. */
  const navigateTo = (open: () => void) => {
    setAgentDialogOpen(false);
    // Small delay to let dialog close animation complete before opening new panel
    requestAnimationFrame(() => open());
  };

  return (
    <div className="space-y-6">
      {/* Tasks */}
      <SubsystemRow
        label="Tasks Schedules"
        enabled={tasksEnabled}
        summary={
          tasksEnabled
            ? agentScheduleCount > 0
              ? `${agentScheduleCount} ${agentScheduleCount === 1 ? 'schedule' : 'schedules'}`
              : 'No schedules'
            : undefined
        }
        action={
          tasksEnabled
            ? {
                label: 'View in Tasks',
                onClick: () => navigateTo(() => openTasksForAgent(agent.id)),
              }
            : undefined
        }
      />

      {/* Relay */}
      <SubsystemRow
        label="Relay Bindings"
        enabled={relayEnabled}
        summary={
          relayEnabled
            ? agentBindingCount > 0
              ? `${agentBindingCount} ${agentBindingCount === 1 ? 'binding' : 'bindings'}`
              : 'No bindings'
            : undefined
        }
        action={
          relayEnabled
            ? {
                label: 'View in Relay',
                onClick: () => navigateTo(() => setRelayOpen(true)),
              }
            : undefined
        }
      />

      {/* Mesh */}
      <SubsystemRow
        label="Mesh Health"
        enabled={true}
        status={
          health
            ? {
                state: health.status,
                lastSeenAt: health.lastSeenAt,
              }
            : undefined
        }
        loading={!health}
      />
    </div>
  );
}
