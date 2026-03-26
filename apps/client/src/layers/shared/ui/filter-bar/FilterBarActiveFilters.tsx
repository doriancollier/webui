import { useState } from 'react';
import { FilterIcon, XIcon } from 'lucide-react';
import { cn } from '@/layers/shared/lib/utils';
import { isEnumFilter } from '@/layers/shared/lib/filter-engine';
import { useIsMobile } from '@/layers/shared/model';
import { Button } from '@/layers/shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/layers/shared/ui/sheet';
import { useFilterBar } from './FilterBarContext';

interface FilterBarActiveFiltersProps {
  className?: string;
}

/** Renders active filter chips on desktop, or a badge + sheet on mobile. */
function FilterBarActiveFilters({ className }: FilterBarActiveFiltersProps) {
  const { schema, values, activeCount, isFiltered, clear, clearAll } = useFilterBar();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!isFiltered) return null;

  // Build active filter entries
  const activeEntries = Object.entries(schema.definitions)
    .filter(([name, def]) => {
      const value = (values as Record<string, unknown>)[name];
      return def.isActive(value);
    })
    .map(([name, def]) => {
      const value = (values as Record<string, unknown>)[name];
      const label = def.label ?? name;
      let displayValue: string;

      if (def.type === 'text') {
        displayValue = String(value);
      } else if (isEnumFilter(def) && def.labels) {
        const resolveLabel = (v: string) => def.labels?.[v] ?? v;
        displayValue = Array.isArray(value)
          ? (value as string[]).map(resolveLabel).join(', ')
          : resolveLabel(value as string);
      } else if (Array.isArray(value)) {
        displayValue = (value as unknown[]).join(', ');
      } else {
        displayValue = String(value);
      }

      return { name, label, displayValue };
    });

  // ── Mobile: badge button + sheet ────────────────────────────
  if (isMobile) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger
          data-slot="filter-bar-active-filters"
          className={cn(
            'border-primary/50 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs',
            className
          )}
        >
          <FilterIcon className="size-3" />
          {activeCount}
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Active filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 p-4">
            {activeEntries.map(({ name, label, displayValue }) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span>
                  {label}: {displayValue}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  responsive={false}
                  onClick={() => clear(name)}
                  aria-label={`Remove ${label} filter`}
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="xs"
              responsive={false}
              className="mt-2 self-start"
              onClick={() => {
                clearAll();
                setSheetOpen(false);
              }}
            >
              Clear all
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Desktop: inline chips ───────────────────────────────────
  return (
    <div
      data-slot="filter-bar-active-filters"
      className={cn('flex flex-wrap items-center gap-1', className)}
    >
      {activeEntries.map(({ name, label, displayValue }) => (
        <span
          key={name}
          className="border-muted bg-muted/50 inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs"
        >
          {label}: {displayValue}
          <button
            type="button"
            onClick={() => clear(name)}
            className="hover:text-foreground text-muted-foreground -mr-0.5 rounded-full p-0.5"
            aria-label={`Remove ${label} filter`}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export { FilterBarActiveFilters };
