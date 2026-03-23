import { create } from 'zustand';

interface AgentCreationState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/** Global dialog state for the Create Agent dialog. */
export const useAgentCreationStore = create<AgentCreationState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
