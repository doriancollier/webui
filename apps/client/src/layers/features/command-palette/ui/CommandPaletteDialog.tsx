import { useState, useCallback } from 'react';
import { useAppStore } from '@/layers/shared/model';
import { useTheme } from '@/layers/shared/model';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/layers/shared/ui';
import { useDirectoryState } from '@/layers/entities/session';
import { usePaletteItems } from '../model/use-palette-items';
import { useAgentFrecency } from '../model/use-agent-frecency';
import { useGlobalPalette } from '../model/use-global-palette';
import { AgentCommandItem } from './AgentCommandItem';
import { Clock, Radio, Globe, Settings, Plus, Search, FolderOpen, Moon } from 'lucide-react';
import type { AgentPathEntry } from '@dorkos/shared/mesh-schemas';

const ICON_MAP: Record<string, React.ElementType> = {
  Clock,
  Radio,
  Globe,
  Settings,
  Plus,
  Search,
  FolderOpen,
  Moon,
};

/**
 * Global command palette dialog.
 *
 * Rendered at the app root (App.tsx). Activated via Cmd+K / Ctrl+K.
 * Uses ResponsiveDialog (Dialog on desktop, Drawer on mobile).
 * Content powered by usePaletteItems() which assembles all groups.
 *
 * The `@` prefix activates agent-only mode, hiding all non-agent groups.
 */
export function CommandPaletteDialog() {
  const { globalPaletteOpen, setGlobalPaletteOpen } = useGlobalPalette();
  const [search, setSearch] = useState('');
  const [selectedCwd, setDir] = useDirectoryState();
  const { recordUsage } = useAgentFrecency();
  const { setTheme, theme } = useTheme();

  const { recentAgents, allAgents, features, commands, quickActions } = usePaletteItems(selectedCwd);

  const setPulseOpen = useAppStore((s) => s.setPulseOpen);
  const setRelayOpen = useAppStore((s) => s.setRelayOpen);
  const setMeshOpen = useAppStore((s) => s.setMeshOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setPickerOpen = useAppStore((s) => s.setPickerOpen);

  const isAtMode = search.startsWith('@');

  const closePalette = useCallback(() => {
    setGlobalPaletteOpen(false);
    setSearch('');
  }, [setGlobalPaletteOpen]);

  const handleAgentSelect = useCallback(
    (agent: AgentPathEntry) => {
      recordUsage(agent.id);
      setDir(agent.projectPath);
      closePalette();
    },
    [recordUsage, setDir, closePalette],
  );

  const handleFeatureAction = useCallback(
    (action: string) => {
      closePalette();
      switch (action) {
        case 'openPulse':
          setPulseOpen(true);
          break;
        case 'openRelay':
          setRelayOpen(true);
          break;
        case 'openMesh':
          setMeshOpen(true);
          break;
        case 'openSettings':
          setSettingsOpen(true);
          break;
        default:
          break;
      }
    },
    [closePalette, setPulseOpen, setRelayOpen, setMeshOpen, setSettingsOpen],
  );

  const handleQuickAction = useCallback(
    (action: string) => {
      closePalette();
      switch (action) {
        case 'discoverAgents':
          setMeshOpen(true);
          break;
        case 'browseFilesystem':
          setPickerOpen(true);
          break;
        case 'toggleTheme':
          setTheme(theme === 'dark' ? 'light' : 'dark');
          break;
        default:
          break;
      }
    },
    [closePalette, setMeshOpen, setPickerOpen, setTheme, theme],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setGlobalPaletteOpen(open);
      if (!open) setSearch('');
    },
    [setGlobalPaletteOpen],
  );

  return (
    <ResponsiveDialog open={globalPaletteOpen} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="overflow-hidden p-0">
        <Command
          loop
          filter={(value, search) => {
            const term = search.startsWith('@') ? search.slice(1) : search;
            if (!term) return 1;
            return value.toLowerCase().includes(term.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder="Search agents, features, commands..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            {/* Recent Agents — hidden in @ mode */}
            {!isAtMode && recentAgents.length > 0 && (
              <CommandGroup heading="Recent Agents">
                {recentAgents.map((agent) => (
                  <AgentCommandItem
                    key={agent.id}
                    agent={agent}
                    isActive={agent.projectPath === selectedCwd}
                    onSelect={() => handleAgentSelect(agent)}
                  />
                ))}
              </CommandGroup>
            )}

            {/* All Agents — shown in @ mode or when searching */}
            {(isAtMode || search.length > 0) && allAgents.length > 0 && (
              <CommandGroup heading="All Agents">
                {allAgents.map((agent) => (
                  <AgentCommandItem
                    key={agent.id}
                    agent={agent}
                    isActive={agent.projectPath === selectedCwd}
                    onSelect={() => handleAgentSelect(agent)}
                  />
                ))}
              </CommandGroup>
            )}

            {/* Features — hidden in @ mode */}
            {!isAtMode && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Features">
                  {features.map((f) => {
                    const Icon = ICON_MAP[f.icon];
                    return (
                      <CommandItem
                        key={f.id}
                        value={f.label}
                        onSelect={() => handleFeatureAction(f.action)}
                      >
                        {Icon && <Icon className="size-4" />}
                        <span>{f.label}</span>
                        {f.shortcut && (
                          <span className="text-muted-foreground ml-auto text-xs">{f.shortcut}</span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}

            {/* Commands — hidden in @ mode, shown only when searching */}
            {!isAtMode && commands.length > 0 && search.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Commands">
                  {commands.map((cmd) => (
                    <CommandItem key={cmd.name} value={cmd.name}>
                      <span className="font-mono text-xs">{cmd.name}</span>
                      {cmd.description && (
                        <span className="text-muted-foreground ml-2 text-xs">{cmd.description}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Quick Actions — hidden in @ mode */}
            {!isAtMode && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Quick Actions">
                  {quickActions.map((qa) => {
                    const Icon = ICON_MAP[qa.icon];
                    return (
                      <CommandItem
                        key={qa.id}
                        value={qa.label}
                        onSelect={() => handleQuickAction(qa.action)}
                      >
                        {Icon && <Icon className="size-4" />}
                        <span>{qa.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
