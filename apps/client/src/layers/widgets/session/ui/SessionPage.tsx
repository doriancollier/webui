import { Panel, PanelGroup } from 'react-resizable-panels';
import { ChatPanel } from '@/layers/features/chat';
import { AgentCanvas, useCanvasPersistence } from '@/layers/features/canvas';
import { useSessionId } from '@/layers/entities/session';

/**
 * Session route page — wraps ChatPanel with route-derived session ID.
 *
 * Renders a horizontal `PanelGroup` so that `AgentCanvas` can open as a
 * resizable right-hand panel alongside the chat. When the canvas is closed
 * it returns null and the chat panel expands to fill the full width.
 *
 * Canvas state (open/closed, content) is persisted per-session in localStorage
 * and hydrated on mount or session change via `useCanvasPersistence`. Panel
 * width is also per-session via a session-scoped `autoSaveId`.
 */
export function SessionPage() {
  const [activeSessionId] = useSessionId();
  useCanvasPersistence(activeSessionId);

  // Session-scoped panel size persistence — each session gets its own layout key
  const autoSaveId = activeSessionId ? `agent-canvas-${activeSessionId}` : 'agent-canvas';

  return (
    <PanelGroup direction="horizontal" autoSaveId={autoSaveId}>
      <Panel id="chat" order={1} minSize={30} defaultSize={100}>
        <ChatPanel sessionId={activeSessionId} />
      </Panel>
      <AgentCanvas />
    </PanelGroup>
  );
}
