import { usePulseEnabled, useSchedules } from '@/layers/entities/pulse';
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
 * Agent-Settings connections tab showing Pulse, Relay, and Mesh subsystem status
 * with real data and deep-link navigation to each subsystem panel.
 */
export function ConnectionsTab({ agent }: ConnectionsTabProps) {
  const pulseEnabled = usePulseEnabled();
  const relayEnabled = useRelayEnabled();
  const { data: health } = useMeshAgentHealth(agent.id);
  const { data: schedules = [] } = useSchedules(pulseEnabled);
  const { data: bindings = [] } = useBindings();
  const { setAgentDialogOpen, setRelayOpen, openPulseForAgent } = useAppStore();

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
      {/* Pulse */}
      <SubsystemRow
        label="Pulse Schedules"
        enabled={pulseEnabled}
        summary={
          pulseEnabled
            ? agentScheduleCount > 0
              ? `${agentScheduleCount} ${agentScheduleCount === 1 ? 'schedule' : 'schedules'}`
              : 'No schedules'
            : undefined
        }
        action={
          pulseEnabled
            ? {
                label: 'View in Pulse',
                onClick: () => navigateTo(() => openPulseForAgent(agent.id)),
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
