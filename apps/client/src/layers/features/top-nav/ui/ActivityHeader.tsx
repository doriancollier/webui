import { CommandPaletteTrigger } from './CommandPaletteTrigger';
import { ActivityFilterBar } from '@/layers/features/activity-feed-page';

/**
 * Activity route header — page title and category filter bar.
 * Rendered in the AppShell top bar when the /activity route is active.
 */
export function ActivityHeader() {
  return (
    <>
      <span className="text-sm font-medium">Activity</span>
      <div className="ml-4 flex-1">
        <ActivityFilterBar />
      </div>
      <CommandPaletteTrigger />
    </>
  );
}
