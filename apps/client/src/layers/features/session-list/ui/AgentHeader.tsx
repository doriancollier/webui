import { useCurrentAgent, useCreateAgent, useAgentVisual } from '@/layers/entities/agent';
import { PathBreadcrumb, Skeleton } from '@/layers/shared/ui';
import { Settings, FolderOpen } from 'lucide-react';

interface AgentHeaderProps {
  /** Current working directory */
  cwd: string;
  /** Callback to open the directory picker */
  onOpenPicker: () => void;
  /** Callback to open the Agent Settings Dialog */
  onOpenAgentDialog: () => void;
}

/**
 * Sidebar header showing agent identity or directory path.
 *
 * When an agent is registered: colored dot + emoji + name + description + gear icon.
 * When no agent: folder icon + path breadcrumb + '+ Agent' CTA.
 */
export function AgentHeader({ cwd, onOpenPicker, onOpenAgentDialog }: AgentHeaderProps) {
  const { data: agent, isLoading } = useCurrentAgent(cwd);
  const createAgent = useCreateAgent();
  const visual = useAgentVisual(agent ?? null, cwd);

  const handleQuickCreate = async () => {
    try {
      await createAgent.mutateAsync({ path: cwd });
      onOpenAgentDialog();
    } catch {
      // Toast error handled by mutation
    }
  };

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (agent) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex min-w-0 items-start gap-2 px-2 py-1.5">
          {/* Colored dot */}
          <span
            className="mt-1 size-2.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: visual.color }}
          />
          {/* Agent info — clickable to open dialog */}
          <button
            onClick={onOpenAgentDialog}
            className="hover:bg-accent min-w-0 flex-1 rounded-md px-1 py-0.5 text-left"
            aria-label={`Agent settings for ${agent.name}`}
          >
            <div className="flex items-center gap-1">
              <span className="text-sm">{visual.emoji}</span>
              <span className="truncate text-sm font-semibold">{agent.name}</span>
            </div>
            {agent.description && (
              <p className="text-muted-foreground truncate text-xs">{agent.description}</p>
            )}
          </button>
          {/* Settings gear */}
          <button
            onClick={onOpenAgentDialog}
            className="hover:bg-accent text-muted-foreground hover:text-foreground flex-shrink-0 rounded-md p-1 transition-colors duration-150"
            aria-label="Agent settings"
          >
            <Settings className="size-(--size-icon-sm)" />
          </button>
        </div>
        {/* Secondary path line */}
        <button
          onClick={onOpenPicker}
          className="text-muted-foreground hover:text-foreground truncate px-2 text-left text-xs transition-colors duration-150"
          title={cwd}
          aria-label="Change working directory"
        >
          <PathBreadcrumb path={cwd} maxSegments={3} size="sm" />
        </button>
      </div>
    );
  }

  // Unregistered directory: current behavior + subtle CTA
  return (
    <div className="flex min-w-0 items-center gap-1 px-2 py-1.5">
      <button
        onClick={onOpenPicker}
        className="hover:bg-accent flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 transition-colors duration-150"
        title={cwd}
        aria-label="Change working directory"
      >
        <FolderOpen className="text-muted-foreground size-(--size-icon-sm) flex-shrink-0" />
        <PathBreadcrumb path={cwd} maxSegments={3} size="sm" />
      </button>
      <button
        onClick={handleQuickCreate}
        disabled={createAgent.isPending}
        className="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs transition-colors duration-150 disabled:opacity-50"
        aria-label="Create agent for this directory"
      >
        + Agent
      </button>
    </div>
  );
}
