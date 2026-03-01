import { create } from 'zustand';

interface AgentDialogState {
  open: boolean;
  projectPath: string | null;
  /** Open the agent settings dialog for a specific working directory. */
  openDialog: (path: string) => void;
  /** Close the agent settings dialog and clear the path. */
  closeDialog: () => void;
}

/**
 * Zustand store for agent dialog open/close state.
 */
export const useAgentDialog = create<AgentDialogState>((set) => ({
  open: false,
  projectPath: null,
  openDialog: (path: string) => set({ open: true, projectPath: path }),
  closeDialog: () => set({ open: false, projectPath: null }),
}));
