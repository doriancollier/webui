import { useMemo, useState } from 'react';
import { Activity, ChevronRight, MoreVertical, Settings, Trash2 } from 'lucide-react';
import { Badge } from '@/layers/shared/ui/badge';
import { Button } from '@/layers/shared/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/layers/shared/ui/collapsible';
import { Switch } from '@/layers/shared/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/layers/shared/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/layers/shared/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/layers/shared/ui/sheet';
import { cn } from '@/layers/shared/lib';
import type { AdapterManifest, CatalogInstance } from '@dorkos/shared/relay-schemas';
import { useBindings } from '@/layers/entities/binding';
import { useRegisteredAgents } from '@/layers/entities/mesh';
import { getCategoryColorClasses } from '../lib/category-colors';
import { getStatusBorderColor } from '../lib/status-colors';
import { AdapterEventLog } from './AdapterEventLog';

interface AdapterCardProps {
  instance: CatalogInstance;
  manifest: AdapterManifest;
  onToggle: (enabled: boolean) => void;
  onConfigure: () => void;
  onRemove: () => void;
  /** Optional callback invoked when the user clicks "Bind" in the no-bindings amber state. */
  onBindClick?: () => void;
}

/** Displays a configured adapter instance with status, toggle, and kebab menu actions. */
export function AdapterCard({ instance, manifest, onToggle, onConfigure, onRemove, onBindClick }: AdapterCardProps) {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [eventsSheetOpen, setEventsSheetOpen] = useState(false);
  const borderColor = getStatusBorderColor(instance.status.state);
  const isBuiltinClaude = manifest.type === 'claude-code' && manifest.builtin;

  // Prefer custom label as primary display name, fall back to status displayName or id.
  const primaryName = instance.label || instance.status.displayName || instance.id;
  // When a custom label exists, show the manifest type name as secondary context.
  const secondaryName = instance.label ? (instance.status.displayName || manifest.displayName) : null;

  const { data: allBindings = [] } = useBindings();
  const { data: agentsData } = useRegisteredAgents();

  const adapterBindings = useMemo(
    () => allBindings.filter((b) => b.adapterId === instance.id),
    [allBindings, instance.id],
  );

  const boundAgents = useMemo(() => {
    const agents = agentsData?.agents ?? [];
    return adapterBindings.map((b) => {
      const agent = agents.find((a) => a.id === b.agentId);
      return { agentId: b.agentId, agentName: agent?.name ?? b.agentId };
    });
  }, [adapterBindings, agentsData]);

  const hasBindings = adapterBindings.length > 0;
  const isConnected = instance.status.state === 'connected';

  // Status dot color: green when connected + bindings, amber when connected + no bindings,
  // red for errors, pulsing blue for transitional states, gray otherwise.
  const statusDotClass = cn(
    'size-2 shrink-0 rounded-full',
    instance.status.state === 'error' && 'bg-red-500',
    instance.status.state === 'connected' && hasBindings && 'bg-green-500',
    instance.status.state === 'connected' && !hasBindings && 'animate-pulse bg-amber-500',
    instance.status.state === 'disconnected' && 'bg-gray-400',
    instance.status.state === 'starting' && 'animate-pulse bg-blue-400',
    instance.status.state === 'stopping' && 'animate-pulse bg-gray-400',
    !['error', 'connected', 'disconnected', 'starting', 'stopping'].includes(instance.status.state) && 'bg-gray-400',
  );

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between rounded-lg border border-l-2 p-3',
          'transition-shadow hover:shadow-sm',
          borderColor,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* Status dot */}
          <div className={statusDotClass} aria-hidden />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {manifest.iconEmoji && (
                <span className="text-sm" role="img" aria-hidden>
                  {manifest.iconEmoji}
                </span>
              )}
              <span className="text-sm font-medium">{primaryName}</span>
              <Badge
                variant="secondary"
                className={getCategoryColorClasses(manifest.category)}
              >
                {manifest.category}
              </Badge>
              {isBuiltinClaude && (
                <Badge variant="outline" className="text-xs">
                  System
                </Badge>
              )}
            </div>
            {secondaryName && (
              <p className="text-xs text-muted-foreground">{secondaryName}</p>
            )}
            {isBuiltinClaude && !secondaryName && (
              <p className="text-xs text-muted-foreground">
                Handles: Chat messages, Pulse jobs
              </p>
            )}

            {/* Bound agents display */}
            {hasBindings ? (
              <p className="truncate text-xs text-muted-foreground">
                {'\u2192 '}{boundAgents.map((a) => a.agentName).join(', ')}
              </p>
            ) : isConnected ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-amber-600">No agent bound</span>
                {onBindClick && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs"
                    onClick={onBindClick}
                  >
                    Bind
                  </Button>
                )}
              </div>
            ) : null}

            <div className="text-xs text-muted-foreground/70">
              In: {instance.status.messageCount.inbound} | Out: {instance.status.messageCount.outbound}
              {instance.status.errorCount > 0 && ` | Errors: ${instance.status.errorCount}`}
            </div>
            {instance.status.lastError && (
              <Collapsible>
                <div className="mt-1 flex items-center gap-1">
                  <CollapsibleTrigger asChild>
                    <button
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                      aria-label="Toggle full error message"
                    >
                      <ChevronRight className="size-3 transition-transform data-[state=open]:rotate-90" />
                      <span className="max-w-[200px] truncate">
                        {instance.status.lastError}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="mt-1 rounded-md bg-red-50 p-2 font-mono text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                    {instance.status.lastError}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={instance.enabled} onCheckedChange={onToggle} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-7 p-0" aria-label="Adapter actions">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEventsSheetOpen(true)}>
                <Activity className="mr-2 size-3.5" />
                Events
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onConfigure}>
                <Settings className="mr-2 size-3.5" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setRemoveDialogOpen(true)}
                disabled={isBuiltinClaude}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 size-3.5" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove adapter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{primaryName}&quot;? This will stop the adapter
              and remove its configuration. Messages to its subjects will no longer be delivered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemove}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={eventsSheetOpen} onOpenChange={setEventsSheetOpen}>
        <SheetContent className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Events: {primaryName}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <AdapterEventLog adapterId={instance.id} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
