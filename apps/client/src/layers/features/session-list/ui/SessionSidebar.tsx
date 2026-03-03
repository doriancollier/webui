import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTransport, useAppStore, useIsMobile } from '@/layers/shared/model';
import { groupSessionsByTime, TIMING, updateTabBadge } from '@/layers/shared/lib';
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from '@/layers/shared/ui';
import { usePulseEnabled, useCompletedRunBadge } from '@/layers/entities/pulse';
import { toast } from 'sonner';
import { useSessions, useDirectoryState } from '@/layers/entities/session';
import { SessionItem } from './SessionItem';
import { AgentHeader } from './AgentHeader';
import { AgentContextChips } from './AgentContextChips';
import { SidebarFooterBar } from './SidebarFooterBar';
import { Plus } from 'lucide-react';
import { ProgressCard, useOnboarding } from '@/layers/features/onboarding';
import type { Session } from '@dorkos/shared/types';

export function SessionSidebar() {
  const transport = useTransport();
  const queryClient = useQueryClient();
  const { sessions, activeSessionId, setActiveSession } = useSessions();
  const { setSidebarOpen, setPulseOpen, setPickerOpen, setAgentDialogOpen, setOnboardingStep } =
    useAppStore();
  const isMobile = useIsMobile();
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [selectedCwd] = useDirectoryState();
  const pulseEnabled = usePulseEnabled();
  const { unviewedCount, clearBadge } = useCompletedRunBadge(pulseEnabled);
  const enablePulseNotifications = useAppStore((s) => s.enablePulseNotifications);
  const { shouldShowOnboarding, dismiss: dismissOnboarding } = useOnboarding();
  const pulseOpen = useAppStore((s) => s.pulseOpen);

  // Auto-select most recent session when directory changes and no session is active
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    }
  }, [activeSessionId, sessions, setActiveSession]);

  const createMutation = useMutation({
    mutationFn: () =>
      transport.createSession({ permissionMode: 'default', cwd: selectedCwd ?? undefined }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', selectedCwd] });
      setActiveSession(session.id);
      setJustCreatedId(session.id);
      setTimeout(() => setJustCreatedId(null), TIMING.NEW_SESSION_HIGHLIGHT_MS);
      if (isMobile) setTimeout(() => setSidebarOpen(false), TIMING.SIDEBAR_AUTO_CLOSE_MS);
    },
  });

  const handleSessionClick = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId);
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile, setActiveSession, setSidebarOpen]
  );

  // Clear completion badge when Pulse panel opens
  useEffect(() => {
    if (pulseOpen) clearBadge();
  }, [pulseOpen, clearBadge]);

  // Toast on new run completions
  const prevUnviewedRef = useRef(0);
  useEffect(() => {
    if (!enablePulseNotifications) return;
    if (unviewedCount > prevUnviewedRef.current) {
      toast('Pulse run completed', {
        description: 'A scheduled run has finished.',
        duration: 6000,
        action: {
          label: 'View history',
          onClick: () => setPulseOpen(true),
        },
      });
    }
    prevUnviewedRef.current = unviewedCount;
  }, [unviewedCount, enablePulseNotifications, setPulseOpen]);

  // Tab title badge for background tab awareness
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        updateTabBadge(unviewedCount);
      } else {
        updateTabBadge(0);
      }
    };
    if (document.hidden && unviewedCount > 0) {
      updateTabBadge(unviewedCount);
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      updateTabBadge(0);
    };
  }, [unviewedCount]);

  const groupedSessions = useMemo(() => groupSessionsByTime(sessions), [sessions]);

  return (
    <>
      <SidebarHeader className="border-b p-3">
        {selectedCwd && (
          <AgentHeader
            cwd={selectedCwd}
            onOpenPicker={() => setPickerOpen(true)}
            onOpenAgentDialog={() => setAgentDialogOpen(true)}
          />
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all duration-100 active:scale-[0.98] disabled:opacity-50"
            >
              <Plus className="size-(--size-icon-sm)" />
              New session
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent data-testid="session-list">
        {groupedSessions.length > 0 ? (
          <>
            {groupedSessions.map((group) => {
              const hideHeader = groupedSessions.length === 1 && group.label === 'Today';
              return (
                <SidebarGroup key={group.label}>
                  {!hideHeader && (
                    <SidebarGroupLabel className="text-2xs text-muted-foreground/70 font-medium tracking-wider uppercase">
                      {group.label}
                    </SidebarGroupLabel>
                  )}
                  <SidebarMenu>
                    {group.sessions.map((session: Session) => (
                      <SidebarMenuItem key={session.id}>
                        <SessionItem
                          session={session}
                          isActive={session.id === activeSessionId}
                          isNew={session.id === justCreatedId}
                          onClick={() => handleSessionClick(session.id)}
                        />
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              );
            })}
          </>
        ) : (
          <div className="flex h-32 items-center justify-center">
            <p className="text-muted-foreground/60 text-sm">No conversations yet</p>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        {shouldShowOnboarding && (
          <div className="mb-2">
            <ProgressCard
              onStepClick={(stepIndex) => setOnboardingStep(stepIndex)}
              onDismiss={dismissOnboarding}
            />
          </div>
        )}
        <AgentContextChips />
        <SidebarFooterBar />
      </SidebarFooter>

      <SidebarRail />
    </>
  );
}
