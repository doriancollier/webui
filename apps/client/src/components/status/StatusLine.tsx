import React from 'react';
import { useSessionStatus } from '../../hooks/use-session-status';
import { useAppStore } from '../../stores/app-store';
import { CwdItem } from './CwdItem';
import { PermissionModeItem } from './PermissionModeItem';
import { ModelItem } from './ModelItem';
import { CostItem } from './CostItem';
import { ContextItem } from './ContextItem';
import type { SessionStatusEvent } from '@lifeos/shared/types';

interface StatusLineProps {
  sessionId: string;
  sessionStatus: SessionStatusEvent | null;
  isStreaming: boolean;
}

export function StatusLine({ sessionId, sessionStatus, isStreaming }: StatusLineProps) {
  const status = useSessionStatus(sessionId, sessionStatus, isStreaming);
  const {
    showStatusBarCwd,
    showStatusBarPermission,
    showStatusBarModel,
    showStatusBarCost,
    showStatusBarContext,
  } = useAppStore();

  const items: React.ReactNode[] = [];

  if (showStatusBarCwd && status.cwd) {
    items.push(<CwdItem key="cwd" cwd={status.cwd} />);
  }
  if (showStatusBarPermission) {
    items.push(
      <PermissionModeItem
        key="permission"
        mode={status.permissionMode}
        onChangeMode={(mode) => status.updateSession({ permissionMode: mode })}
      />
    );
  }
  if (showStatusBarModel) {
    items.push(
      <ModelItem
        key="model"
        model={status.model}
        onChangeModel={(model) => status.updateSession({ model })}
      />
    );
  }
  if (showStatusBarCost && status.costUsd !== null) {
    items.push(<CostItem key="cost" costUsd={status.costUsd} />);
  }
  if (showStatusBarContext && status.contextPercent !== null) {
    items.push(<ContextItem key="context" percent={status.contextPercent} />);
  }

  if (items.length === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Session status"
      aria-live="polite"
      className="flex flex-wrap items-center justify-center sm:justify-start gap-2 px-1 pt-2 text-xs text-muted-foreground whitespace-nowrap"
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Separator />}
          {item}
        </React.Fragment>
      ))}
    </div>
  );
}

function Separator() {
  return (
    <span className="text-muted-foreground/30" aria-hidden="true">
      &middot;
    </span>
  );
}
