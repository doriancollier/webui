import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ContextFile {
  id: string;
  path: string;
  basename: string;
}

export interface RecentCwd {
  path: string;
  accessedAt: string;
}

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  sessionId: string | null;
  setSessionId: (id: string | null) => void;

  selectedCwd: string | null;
  setSelectedCwd: (cwd: string) => void;

  recentCwds: RecentCwd[];

  devtoolsOpen: boolean;
  toggleDevtools: () => void;

  showTimestamps: boolean;
  setShowTimestamps: (v: boolean) => void;
  expandToolCalls: boolean;
  setExpandToolCalls: (v: boolean) => void;
  autoHideToolCalls: boolean;
  setAutoHideToolCalls: (v: boolean) => void;
  showShortcutChips: boolean;
  setShowShortcutChips: (v: boolean) => void;
  showStatusBarCwd: boolean;
  setShowStatusBarCwd: (v: boolean) => void;
  showStatusBarPermission: boolean;
  setShowStatusBarPermission: (v: boolean) => void;
  showStatusBarModel: boolean;
  setShowStatusBarModel: (v: boolean) => void;
  showStatusBarCost: boolean;
  setShowStatusBarCost: (v: boolean) => void;
  showStatusBarContext: boolean;
  setShowStatusBarContext: (v: boolean) => void;
  showStatusBarGit: boolean;
  setShowStatusBarGit: (v: boolean) => void;
  verboseLogging: boolean;
  setVerboseLogging: (v: boolean) => void;
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (v: 'small' | 'medium' | 'large') => void;
  resetPreferences: () => void;

  contextFiles: ContextFile[];
  addContextFile: (file: Omit<ContextFile, 'id'>) => void;
  removeContextFile: (id: string) => void;
  clearContextFiles: () => void;
}

export const useAppStore = create<AppState>()(devtools((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),

  selectedCwd: null,
  setSelectedCwd: (cwd) =>
    set((s) => {
      const entry: RecentCwd = { path: cwd, accessedAt: new Date().toISOString() };
      const recents = [entry, ...s.recentCwds.filter((r) => r.path !== cwd)].slice(0, 10);
      try { localStorage.setItem('gateway-recent-cwds', JSON.stringify(recents)); } catch {}
      return { selectedCwd: cwd, recentCwds: recents };
    }),

  recentCwds: (() => {
    try {
      const raw: unknown[] = JSON.parse(localStorage.getItem('gateway-recent-cwds') || '[]');
      return raw.map((item) =>
        typeof item === 'string'
          ? { path: item, accessedAt: new Date().toISOString() }
          : item as RecentCwd,
      );
    } catch { return []; }
  })(),

  devtoolsOpen: false,
  toggleDevtools: () => set((s) => ({ devtoolsOpen: !s.devtoolsOpen })),

  showTimestamps: (() => {
    try { return localStorage.getItem('gateway-show-timestamps') === 'true'; }
    catch { return false; }
  })(),
  setShowTimestamps: (v) => {
    try { localStorage.setItem('gateway-show-timestamps', String(v)); } catch {}
    set({ showTimestamps: v });
  },

  expandToolCalls: (() => {
    try { return localStorage.getItem('gateway-expand-tool-calls') === 'true'; }
    catch { return false; }
  })(),
  setExpandToolCalls: (v) => {
    try { localStorage.setItem('gateway-expand-tool-calls', String(v)); } catch {}
    set({ expandToolCalls: v });
  },

  autoHideToolCalls: (() => {
    try {
      const stored = localStorage.getItem('gateway-auto-hide-tool-calls');
      return stored === null ? true : stored === 'true';
    }
    catch { return true; }
  })(),
  setAutoHideToolCalls: (v) => {
    try { localStorage.setItem('gateway-auto-hide-tool-calls', String(v)); } catch {}
    set({ autoHideToolCalls: v });
  },

  showShortcutChips: (() => {
    try {
      const stored = localStorage.getItem('gateway-show-shortcut-chips');
      return stored === null ? true : stored === 'true';
    }
    catch { return true; }
  })(),
  setShowShortcutChips: (v) => {
    try { localStorage.setItem('gateway-show-shortcut-chips', String(v)); } catch {}
    set({ showShortcutChips: v });
  },

  showStatusBarCwd: (() => {
    try { return localStorage.getItem('gateway-show-status-bar-cwd') !== 'false'; }
    catch { return true; }
  })(),
  setShowStatusBarCwd: (v) => {
    try { localStorage.setItem('gateway-show-status-bar-cwd', String(v)); } catch {}
    set({ showStatusBarCwd: v });
  },

  showStatusBarPermission: (() => {
    try { return localStorage.getItem('gateway-show-status-bar-permission') !== 'false'; }
    catch { return true; }
  })(),
  setShowStatusBarPermission: (v) => {
    try { localStorage.setItem('gateway-show-status-bar-permission', String(v)); } catch {}
    set({ showStatusBarPermission: v });
  },

  showStatusBarModel: (() => {
    try { return localStorage.getItem('gateway-show-status-bar-model') !== 'false'; }
    catch { return true; }
  })(),
  setShowStatusBarModel: (v) => {
    try { localStorage.setItem('gateway-show-status-bar-model', String(v)); } catch {}
    set({ showStatusBarModel: v });
  },

  showStatusBarCost: (() => {
    try { return localStorage.getItem('gateway-show-status-bar-cost') !== 'false'; }
    catch { return true; }
  })(),
  setShowStatusBarCost: (v) => {
    try { localStorage.setItem('gateway-show-status-bar-cost', String(v)); } catch {}
    set({ showStatusBarCost: v });
  },

  showStatusBarContext: (() => {
    try { return localStorage.getItem('gateway-show-status-bar-context') !== 'false'; }
    catch { return true; }
  })(),
  setShowStatusBarContext: (v) => {
    try { localStorage.setItem('gateway-show-status-bar-context', String(v)); } catch {}
    set({ showStatusBarContext: v });
  },

  showStatusBarGit: (() => {
    try { return localStorage.getItem('gateway-show-status-bar-git') !== 'false'; }
    catch { return true; }
  })(),
  setShowStatusBarGit: (v) => {
    try { localStorage.setItem('gateway-show-status-bar-git', String(v)); } catch {}
    set({ showStatusBarGit: v });
  },

  verboseLogging: (() => {
    try { return localStorage.getItem('gateway-verbose-logging') === 'true'; }
    catch { return false; }
  })(),
  setVerboseLogging: (v) => {
    try { localStorage.setItem('gateway-verbose-logging', String(v)); } catch {}
    set({ verboseLogging: v });
  },

  fontSize: (() => {
    try {
      const stored = localStorage.getItem('gateway-font-size');
      if (stored === 'small' || stored === 'medium' || stored === 'large') {
        const scaleMap = { small: '0.9', medium: '1', large: '1.15' };
        document.documentElement.style.setProperty('--user-font-scale', scaleMap[stored]);
        return stored;
      }
    } catch {}
    return 'medium';
  })() as 'small' | 'medium' | 'large',
  setFontSize: (v) => {
    try { localStorage.setItem('gateway-font-size', v); } catch {}
    const scaleMap = { small: '0.9', medium: '1', large: '1.15' };
    document.documentElement.style.setProperty('--user-font-scale', scaleMap[v]);
    set({ fontSize: v });
  },

  resetPreferences: () => {
    try {
      localStorage.removeItem('gateway-show-timestamps');
      localStorage.removeItem('gateway-expand-tool-calls');
      localStorage.removeItem('gateway-auto-hide-tool-calls');
      localStorage.removeItem('gateway-show-shortcut-chips');
      localStorage.removeItem('gateway-verbose-logging');
      localStorage.removeItem('gateway-font-size');
      localStorage.removeItem('gateway-show-status-bar-cwd');
      localStorage.removeItem('gateway-show-status-bar-permission');
      localStorage.removeItem('gateway-show-status-bar-model');
      localStorage.removeItem('gateway-show-status-bar-cost');
      localStorage.removeItem('gateway-show-status-bar-context');
      localStorage.removeItem('gateway-show-status-bar-git');
    } catch {}
    document.documentElement.style.setProperty('--user-font-scale', '1');
    set({
      showTimestamps: false,
      expandToolCalls: false,
      autoHideToolCalls: true,
      showShortcutChips: true,
      verboseLogging: false,
      devtoolsOpen: false,
      fontSize: 'medium',
      showStatusBarCwd: true,
      showStatusBarPermission: true,
      showStatusBarModel: true,
      showStatusBarCost: true,
      showStatusBarContext: true,
      showStatusBarGit: true,
    });
  },

  contextFiles: [],
  addContextFile: (file) =>
    set((s) => {
      if (s.contextFiles.some((f) => f.path === file.path)) return s;
      return { contextFiles: [...s.contextFiles, { ...file, id: crypto.randomUUID() }] };
    }),
  removeContextFile: (id) =>
    set((s) => ({ contextFiles: s.contextFiles.filter((f) => f.id !== id) })),
  clearContextFiles: () => set({ contextFiles: [] }),
}), { name: 'app-store' }));
