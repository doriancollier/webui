/**
 * Shared helpers, types, and localStorage configuration for the app store.
 *
 * @module shared/model/app-store-helpers
 */

/** Read a boolean from localStorage with try/catch safety. */
export function readBool(key: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return stored === 'true';
  } catch {
    return defaultValue;
  }
}

/** Write a boolean to localStorage with try/catch safety. */
export function writeBool(key: string, v: boolean): void {
  try {
    localStorage.setItem(key, String(v));
  } catch {}
}

export interface ContextFile {
  id: string;
  path: string;
  basename: string;
}

export interface RecentCwd {
  path: string;
  accessedAt: string;
}

/** localStorage keys for all persisted boolean settings. */
export const BOOL_KEYS = {
  sidebarOpen: 'dorkos-sidebar-open',
  showTimestamps: 'dorkos-show-timestamps',
  expandToolCalls: 'dorkos-expand-tool-calls',
  autoHideToolCalls: 'dorkos-auto-hide-tool-calls',
  showShortcutChips: 'dorkos-show-shortcut-chips',
  showStatusBarCwd: 'dorkos-show-status-bar-cwd',
  showStatusBarPermission: 'dorkos-show-status-bar-permission',
  showStatusBarModel: 'dorkos-show-status-bar-model',
  showStatusBarCost: 'dorkos-show-status-bar-cost',
  showStatusBarContext: 'dorkos-show-status-bar-context',
  showStatusBarGit: 'dorkos-show-status-bar-git',
  showTaskCelebrations: 'dorkos-show-task-celebrations',
  enableNotificationSound: 'dorkos-enable-notification-sound',
  enablePulseNotifications: 'dorkos-enable-pulse-notifications',
  showStatusBarSound: 'dorkos-show-status-bar-sound',
  showStatusBarTunnel: 'dorkos-show-status-bar-tunnel',
  showStatusBarSync: 'dorkos-show-status-bar-sync',
  showStatusBarPolling: 'dorkos-show-status-bar-polling',
  enableCrossClientSync: 'dorkos-enable-cross-client-sync',
  enableMessagePolling: 'dorkos-enable-message-polling',
  promoEnabled: 'dorkos-promo-enabled',
} as const;

/** Default values for each persisted boolean. */
export const BOOL_DEFAULTS: Record<keyof typeof BOOL_KEYS, boolean> = {
  sidebarOpen: false,
  showTimestamps: false,
  expandToolCalls: false,
  autoHideToolCalls: true,
  showShortcutChips: true,
  showStatusBarCwd: true,
  showStatusBarPermission: true,
  showStatusBarModel: true,
  showStatusBarCost: true,
  showStatusBarContext: true,
  showStatusBarGit: true,
  showTaskCelebrations: true,
  enableNotificationSound: true,
  enablePulseNotifications: true,
  showStatusBarSound: true,
  showStatusBarTunnel: true,
  showStatusBarSync: true,
  showStatusBarPolling: true,
  enableCrossClientSync: false,
  enableMessagePolling: false,
  promoEnabled: true,
};
