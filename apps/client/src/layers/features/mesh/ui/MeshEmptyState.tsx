import type { LucideIcon } from 'lucide-react';

interface MeshEmptyStateProps {
  icon: LucideIcon;
  headline: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/** Reusable empty state for Mesh panel tabs — icon, headline, description, and optional CTA. */
export function MeshEmptyState({ icon: Icon, headline, description, action }: MeshEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="rounded-xl bg-muted/50 p-3">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{headline}</p>
        <p className="max-w-[280px] text-xs text-muted-foreground">{description}</p>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
