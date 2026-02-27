import type { LucideIcon } from 'lucide-react';

interface FeatureDisabledStateProps {
  icon: LucideIcon;
  name: string;
  description: string;
  command: string;
}

/** Empty state shown when a subsystem feature flag is not enabled. */
export function FeatureDisabledState({
  icon: Icon,
  name,
  description,
  command,
}: FeatureDisabledStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <Icon className="size-8 text-muted-foreground/50" />
      <div>
        <p className="font-medium">{name} is not enabled</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <code className="mt-2 rounded-md bg-muted px-3 py-1.5 font-mono text-sm">{command}</code>
    </div>
  );
}
