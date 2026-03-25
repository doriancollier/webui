import { SidebarMenuItem, SidebarMenuButton } from '@/layers/shared/ui';
import { useAgentVisual, AgentIdentity } from '@/layers/entities/agent';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';

interface RecentAgentItemProps {
  path: string;
  agent: AgentManifest | null;
  onClick: () => void;
}

/**
 * Single agent row in the dashboard sidebar's recent agents list.
 * Shows agent avatar, emoji, and name. Falls back to path basename when no manifest.
 */
export function RecentAgentItem({ path, agent, onClick }: RecentAgentItemProps) {
  const visual = useAgentVisual(agent, path);
  const displayName = agent?.name ?? path.split('/').pop() ?? 'Agent';

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={onClick}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-100 active:scale-[0.98]"
      >
        <AgentIdentity {...visual} name={displayName} size="xs" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
