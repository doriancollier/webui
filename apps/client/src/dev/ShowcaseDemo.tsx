import { cn } from '@/layers/shared/lib';

interface ShowcaseDemoProps {
  children: React.ReactNode;
  className?: string;
}

/** Subtle inset wrapper that visually separates a component demo from its surrounding documentation. */
export function ShowcaseDemo({ children, className }: ShowcaseDemoProps) {
  return (
    <div className={cn('rounded-lg border border-dashed border-border/50 bg-muted/30 p-4', className)}>
      {children}
    </div>
  );
}
