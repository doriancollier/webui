/**
 * Canvas slice — per-session canvas state for the app store.
 *
 * Canvas open/content state is persisted per-session via localStorage using the
 * canvas session helpers in app-store-helpers.ts.
 *
 * @module shared/model/app-store-canvas
 */
import type { StateCreator } from 'zustand';
import type { UiCanvasContent } from '@dorkos/shared/types';
import { readCanvasSession, writeCanvasSession } from './app-store-helpers';
import type { AppState } from './app-store-types';

// ---------------------------------------------------------------------------
// Slice interface
// ---------------------------------------------------------------------------

export interface CanvasSlice {
  canvasOpen: boolean;
  setCanvasOpen: (open: boolean) => void;
  canvasContent: UiCanvasContent | null;
  setCanvasContent: (content: UiCanvasContent | null) => void;
  canvasPreferredWidth: number | null;
  setCanvasPreferredWidth: (width: number | null) => void;
  /** Active session ID for canvas persistence; null until `loadCanvasForSession` is called. */
  canvasSessionId: string | null;
  /** Load canvas state for a session (or reset to defaults if no prior state exists). */
  loadCanvasForSession: (sessionId: string) => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

/** Creates the canvas slice (persisted per-session canvas UI state). */
export const createCanvasSlice: StateCreator<
  AppState,
  [['zustand/devtools', never]],
  [],
  CanvasSlice
> = (set) => ({
  canvasOpen: false,
  setCanvasOpen: (open) =>
    set((s) => {
      if (s.canvasSessionId) {
        writeCanvasSession(s.canvasSessionId, {
          open,
          content: s.canvasContent,
          accessedAt: Date.now(),
        });
      }
      return { canvasOpen: open };
    }),

  canvasContent: null,
  setCanvasContent: (content) =>
    set((s) => {
      if (s.canvasSessionId) {
        writeCanvasSession(s.canvasSessionId, {
          open: s.canvasOpen,
          content,
          accessedAt: Date.now(),
        });
      }
      return { canvasContent: content };
    }),

  canvasPreferredWidth: null,
  setCanvasPreferredWidth: (width) => set({ canvasPreferredWidth: width }),

  canvasSessionId: null,
  loadCanvasForSession: (sessionId) => {
    const entry = readCanvasSession(sessionId);
    if (entry) {
      set({ canvasOpen: entry.open, canvasContent: entry.content, canvasSessionId: sessionId });
    } else {
      set({ canvasOpen: false, canvasContent: null, canvasSessionId: sessionId });
    }
  },
});
