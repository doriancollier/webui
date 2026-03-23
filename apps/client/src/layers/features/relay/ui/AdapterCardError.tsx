import { AlertTriangle, ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/layers/shared/ui/collapsible';
import type { CatalogInstance } from '@dorkos/shared/relay-schemas';

interface AdapterCardErrorProps {
  instance: CatalogInstance;
}

/** Renders the adapter error indicator with a collapsible full error message. */
export function AdapterCardError({ instance }: AdapterCardErrorProps) {
  const { errorCount, lastError } = instance.status;

  if (!errorCount && !lastError) return null;

  return (
    <div className="mt-3 pl-[18px]">
      {errorCount > 0 && !lastError && (
        <div className="flex items-center gap-1 text-xs text-red-500">
          <AlertTriangle className="size-3" />
          <span>
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </span>
        </div>
      )}
      {lastError && (
        <Collapsible>
          <div className="flex items-center gap-1">
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                aria-label="Toggle full error message"
              >
                <ChevronRight className="size-3 transition-transform data-[state=open]:rotate-90" />
                {errorCount > 0 && <AlertTriangle className="size-3" />}
                <span className="max-w-[200px] truncate">
                  {errorCount > 0
                    ? `${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`
                    : lastError}
                </span>
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="mt-1 rounded-md bg-red-50 p-2 font-mono text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              {lastError}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
