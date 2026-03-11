export interface PlatformAdapter {
  /** Whether running inside Obsidian */
  isEmbedded: boolean;
  /** Open a file by path (no-op in standalone) */
  openFile: (path: string) => Promise<void>;
}

// Default: standalone web adapter
const webAdapter: PlatformAdapter = {
  isEmbedded: false,
  openFile: async () => {},
};

let currentAdapter: PlatformAdapter = webAdapter;

export function setPlatformAdapter(adapter: PlatformAdapter) {
  currentAdapter = adapter;
}

export function getPlatform(): PlatformAdapter {
  return currentAdapter;
}

/** Whether the current platform is macOS/iOS (used for shortcut display). */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
