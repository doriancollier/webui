import { CommandPaletteTrigger } from './CommandPaletteTrigger';
import { SystemHealthDot } from './SystemHealthDot';
import { useSystemHealth } from '../model/use-system-health';

/** Dashboard route header — title, health dot, and command palette trigger. */
export function DashboardHeader() {
  const healthState = useSystemHealth();

  return (
    <>
      <span className="text-muted-foreground text-sm font-medium">Dashboard</span>
      <SystemHealthDot state={healthState} />
      <div className="flex-1" />
      <CommandPaletteTrigger />
    </>
  );
}
