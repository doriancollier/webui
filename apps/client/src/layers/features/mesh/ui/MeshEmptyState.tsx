import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/layers/shared/ui';

interface MeshEmptyStateProps {
  icon: LucideIcon;
  headline: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional faded preview element rendered above the headline. */
  preview?: ReactNode;
}

/** Reusable empty state for Mesh panel tabs — icon, headline, description, optional preview, and optional CTA. */
export function MeshEmptyState({
  icon: Icon,
  headline,
  description,
  action,
  preview,
}: MeshEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      {preview && (
        <div className="mb-4 w-full max-w-sm select-none opacity-40 pointer-events-none">
          {preview}
        </div>
      )}
      <div className="rounded-xl bg-muted/50 p-3">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{headline}</p>
        <p className="max-w-[280px] text-xs text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button size="sm" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}

/** Mini faded topology preview for the agents empty state. */
export function TopologyPreview() {
  return (
    <div className="flex items-center justify-center gap-6">
      {/* Node 1 */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
          <span className="text-sm">A</span>
        </div>
        <span className="text-[10px] text-muted-foreground">frontend</span>
      </div>
      {/* Edge */}
      <div className="h-px w-8 bg-border" />
      {/* Node 2 */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
          <span className="text-sm">B</span>
        </div>
        <span className="text-[10px] text-muted-foreground">backend</span>
      </div>
      {/* Edge */}
      <div className="h-px w-8 bg-border" />
      {/* Node 3 */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
          <span className="text-sm">C</span>
        </div>
        <span className="text-[10px] text-muted-foreground">shared</span>
      </div>
    </div>
  );
}
