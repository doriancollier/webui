import { useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { Button } from '@/layers/shared/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/layers/shared/ui/responsive-dialog';
import { DiscoveryView } from '@/layers/features/mesh';
import { CommandPaletteTrigger } from './CommandPaletteTrigger';

/** Page header for the /agents route — title, scan trigger, and command palette. */
export function AgentsHeader() {
  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  return (
    <>
      <span className="text-sm font-medium">Agents</span>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => setDiscoveryOpen(true)}
        >
          <ScanSearch className="size-3.5" />
          Scan for Agents
        </Button>
        <CommandPaletteTrigger />
      </div>
      <ResponsiveDialog open={discoveryOpen} onOpenChange={setDiscoveryOpen}>
        <ResponsiveDialogContent className="max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Discover Agents</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <DiscoveryView />
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
