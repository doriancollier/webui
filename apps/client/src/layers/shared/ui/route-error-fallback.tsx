import { useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

/**
 * Default error fallback for route-level errors.
 *
 * Renders inside the app shell — sidebar and header remain visible.
 * Uses `router.invalidate()` for retry (not `reset()`) because `reset()`
 * does not re-run loaders. See TanStack/router#2539.
 */
export function RouteErrorFallback({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <AlertTriangle className="text-muted-foreground size-10" />
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-foreground text-lg font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground max-w-md text-sm">{error.message}</p>
      </div>

      {import.meta.env.DEV && error.stack && (
        <details className="border-border/50 max-w-2xl rounded-md border px-4 py-2">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            Stack trace (dev only)
          </summary>
          <pre className="text-muted-foreground mt-2 overflow-x-auto text-xs whitespace-pre-wrap">
            {error.stack}
          </pre>
        </details>
      )}

      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={() => router.invalidate()}>
          Retry
        </Button>
        <Button variant="ghost" size="sm" onClick={() => router.navigate({ to: '/' })}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
