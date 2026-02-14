# Task Completion Celebrations

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-13
**Slug:** task-celebrations

---

## Table of Contents

1. [Overview](#1-overview)
2. [Background / Problem Statement](#2-background--problem-statement)
3. [Goals](#3-goals)
4. [Non-Goals](#4-non-goals)
5. [Technical Dependencies](#5-technical-dependencies)
6. [Detailed Design](#6-detailed-design)
7. [User Experience](#7-user-experience)
8. [Testing Strategy](#8-testing-strategy)
9. [Performance Considerations](#9-performance-considerations)
10. [Security Considerations](#10-security-considerations)
11. [Implementation Phases](#11-implementation-phases)
12. [Open Questions](#12-open-questions)
13. [References](#13-references)

---

## 1. Overview

Add two tiers of celebration animations to the task pane when tasks complete during active streaming:

- **Mini celebration** (~30% probabilistic): Inline spring-pop checkmark bounce + brief gold shimmer on the completing task row. Triggered only on live `action: 'update'` completions (not history/snapshot replay).
- **Major celebration** (all tasks done, 3+ tasks required): Golden radial glow ripple emanating from the task pane across the viewport + subtle gold confetti shower (30-50 particles via `canvas-confetti`).

Celebrations are toggleable in settings (on by default), idle-aware (queued when user is away, replayed when they return), and respect `prefers-reduced-motion`. Rapid completions (3+ within 2s) debounce into a single mini celebration instead of rapid-fire animations.

**Key design choices:**
- Client-side only -- no server changes, no transport changes, no shared type changes
- `canvas-confetti` (~28KB) lazy-loaded via dynamic import for code-splitting
- `motion/react` (already installed) handles orchestration animations (spring physics, AnimatePresence)
- Event-driven architecture: task state hook emits celebration events, celebration engine orchestrates timing and effects
- Idle detection via Document Visibility API + 30s mouse/keyboard/scroll inactivity timer

---

## 2. Background / Problem Statement

The task pane (`TaskListPanel`) currently displays task status with static icons -- a spinning `Loader2` for in-progress, a green `CheckCircle2` for completed. When tasks complete, the icon simply swaps with no visual fanfare. This misses an opportunity to provide positive reinforcement and delight when Claude finishes work.

**Why celebrations matter:**
- Task completions are meaningful milestones in a coding session (unlike, say, checkboxes in a todo app where celebrations can feel trivial)
- Subtle positive feedback reinforces the sense of progress and keeps the user engaged
- Premium-feeling micro-interactions differentiate the product and build emotional connection

**Current task completion flow:**
1. Server streams `task_update` SSE event with `action: 'update'` and `status: 'completed'`
2. `useChatSession` dispatches to `onTaskEvent` callback
3. `useTaskState.handleTaskEvent()` merges the updated task into the Map
4. `TaskListPanel` re-renders -- the icon changes from `Loader2`/`Circle` to `CheckCircle2`
5. No animation, no celebration, nothing memorable

**The gap:** There is no visual feedback that distinguishes a task completing from any other re-render. The user may not even notice individual completions during a long-running session.

---

## 3. Goals

1. Provide delightful, non-intrusive visual feedback when tasks complete during active streaming
2. Reserve major celebrations for meaningful milestones (all tasks done, 3+ tasks)
3. Avoid celebration fatigue by making mini celebrations probabilistic (~30%) and debouncing rapid completions
4. Ensure celebrations never block user interaction or degrade performance
5. Respect user preferences (settings toggle) and accessibility needs (`prefers-reduced-motion`)
6. Handle idle users gracefully -- queue celebrations and replay on return
7. Maintain 60fps during all celebration animations

---

## 4. Non-Goals

- Sound effects or audio feedback
- Custom celebration themes or skins
- Celebration sharing or social features
- Per-task-type celebration variants (all tasks get the same celebration)
- Celebrations for non-task events (session completion, tool approvals, etc.)
- Server-side changes or shared type modifications
- Obsidian plugin support (standalone web client only -- DirectTransport unaffected)

---

## 5. Technical Dependencies

### Existing Dependencies (No Changes)

| Package | Version | Usage |
|---------|---------|-------|
| `motion/react` | ^12.33.0 | Spring animations, AnimatePresence, motion.div for inline effects |
| `zustand` | existing | Settings toggle persistence |
| `react` | ^19 | Hooks, refs, effects |

### New Dependencies

| Package | Version | Size | Usage |
|---------|---------|------|-------|
| `canvas-confetti` | ^1.9 | ~28KB | Gold confetti particle shower for major celebrations |

`canvas-confetti` is lazy-loaded via `import()` so it does not affect initial bundle size. It is only downloaded when the first major celebration fires.

---

## 6. Detailed Design

### 6.1 Architecture Overview

```
Task SSE Event Flow (existing):
  Server -> task_update SSE -> useChatSession -> useTaskState.handleTaskEvent()

Celebration Event Flow (new):
  useTaskState.handleTaskEvent()
    -> detects status transition to 'completed' (action === 'update' only)
    -> calls onTaskCompleted(taskId) callback
    -> useCelebrations hook receives completion event
       -> celebration-engine evaluates:
          - Is setting enabled?
          - Is this a snapshot/history replay? (skip)
          - Debounce check (3+ in 2s window?)
          - Probabilistic mini check (~30%)
          - All-tasks-done major check (3+ total, all completed)
       -> queues CelebrationEvent (mini or major)
       -> if user is idle: queue for later replay
       -> if user is active: execute immediately
          - Mini: spring-pop + shimmer on task row (motion.div)
          - Major: radial glow (CSS/motion) + confetti (canvas-confetti)
```

### 6.2 Celebration Engine

**File:** `apps/client/src/lib/celebrations/celebration-engine.ts` (CREATE)

The engine is a pure TypeScript class (no React dependency) that manages celebration state, queuing, debouncing, and idle-aware replay. It is instantiated by the `useCelebrations` hook and cleaned up on unmount.

```typescript
export type CelebrationLevel = 'mini' | 'major';

export interface CelebrationEvent {
  level: CelebrationLevel;
  taskId: string;
  timestamp: number;
}

export interface CelebrationEngineConfig {
  enabled: boolean;
  miniProbability: number;       // 0.3 (30%)
  debounceWindowMs: number;      // 2000
  debounceThreshold: number;     // 3 completions within window
  minTasksForMajor: number;      // 3
  idleTimeoutMs: number;         // 30000
  onCelebrate: (event: CelebrationEvent) => void;
}

export class CelebrationEngine {
  private config: CelebrationEngineConfig;
  private queue: CelebrationEvent[];
  private recentCompletions: number[];  // timestamps for debounce
  private isIdle: boolean;
  private idleTimer: ReturnType<typeof setTimeout> | null;
  private activityListeners: (() => void)[];

  constructor(config: CelebrationEngineConfig) { ... }

  /**
   * Called when a task transitions to 'completed' via a live update event.
   * Evaluates whether to trigger a mini or major celebration.
   */
  onTaskCompleted(taskId: string, allTasks: TaskItem[]): void {
    if (!this.config.enabled) return;

    // Track for debouncing
    const now = Date.now();
    this.recentCompletions.push(now);
    this.recentCompletions = this.recentCompletions.filter(
      t => now - t < this.config.debounceWindowMs
    );

    // Check if this triggers the debounce threshold (3+ in 2s)
    // If so, skip individual minis -- a single debounced celebration fires later
    if (this.recentCompletions.length >= this.config.debounceThreshold) {
      // Wait for debounce window to settle, then fire one mini
      // (The major check below may supersede this)
      return;
    }

    // Check for major celebration: all tasks completed, 3+ total
    const allCompleted = allTasks.every(t => t.status === 'completed');
    if (allCompleted && allTasks.length >= this.config.minTasksForMajor) {
      this.emit({ level: 'major', taskId, timestamp: now });
      return;
    }

    // Probabilistic mini celebration (~30%)
    if (Math.random() < this.config.miniProbability) {
      this.emit({ level: 'mini', taskId, timestamp: now });
    }
  }

  /**
   * Called at the end of a debounce window when 3+ tasks completed rapidly.
   * Fires a single mini celebration (or major if all done).
   */
  private flushDebounce(allTasks: TaskItem[]): void { ... }

  /**
   * Emit a celebration event. If user is idle, queue it for later.
   */
  private emit(event: CelebrationEvent): void {
    if (this.isIdle) {
      this.queue.push(event);
      return;
    }
    this.config.onCelebrate(event);
  }

  /**
   * Called when user returns from idle. Replays queued celebrations
   * with a brief stagger (500ms between each).
   */
  onUserReturn(): void {
    if (this.queue.length === 0) return;
    const queued = [...this.queue];
    this.queue = [];
    // Deduplicate: if a major is queued, skip minis
    const hasMajor = queued.some(e => e.level === 'major');
    const toPlay = hasMajor ? queued.filter(e => e.level === 'major').slice(0, 1) : queued.slice(-1);
    for (const event of toPlay) {
      this.config.onCelebrate(event);
    }
  }

  /** Start idle detection (Document Visibility + activity tracking) */
  startIdleDetection(): void { ... }

  /** Stop idle detection and clean up listeners */
  stopIdleDetection(): void { ... }

  /** Update config (e.g., when setting toggles) */
  updateConfig(partial: Partial<CelebrationEngineConfig>): void { ... }

  /** Clean up all timers and listeners */
  destroy(): void { ... }
}
```

**Debounce behavior:** When 3+ tasks complete within a 2s window, individual mini celebrations are suppressed. After the debounce window settles (no new completions for 2s), a single mini celebration fires for the batch. If all tasks happen to be completed at that point, a major celebration fires instead.

### 6.3 Visual Effects

**File:** `apps/client/src/lib/celebrations/effects.ts` (CREATE)

Implements the visual effect functions. Each effect is a standalone function that can be called imperatively.

```typescript
/**
 * Trigger a confetti burst from canvas-confetti.
 * Lazy-loads the library on first call.
 * Returns a cleanup function to cancel the animation.
 */
export async function fireConfetti(options?: {
  origin?: { x: number; y: number };
  particleCount?: number;
  colors?: string[];
}): Promise<() => void> {
  const confetti = (await import('canvas-confetti')).default;

  const defaults = {
    particleCount: 40,
    spread: 70,
    origin: { x: 0.5, y: 0.6 },
    colors: ['#FFD700', '#FFC107', '#F7B500'],
    ticks: 120,
    gravity: 1.2,
    scalar: 0.9,
    drift: 0,
    disableForReducedMotion: true,
  };

  const merged = { ...defaults, ...options };
  confetti(merged);

  return () => confetti.reset();
}

/**
 * CSS keyframe class names for the radial glow effect.
 * Applied via motion.div style props -- no separate CSS file needed.
 */
export const RADIAL_GLOW_STYLE = {
  background: 'radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%)',
  // Animated via motion.div scale + opacity
};

/**
 * Spring animation config for the mini celebration checkmark bounce.
 * Used with motion.div animate={{ scale: [1, 1.4, 1] }}.
 */
export const MINI_SPRING_CONFIG = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 10,
  mass: 0.8,
};

/**
 * Shimmer gradient keyframes for the gold shimmer effect on task rows.
 * Applied as a CSS background-position animation via motion.div.
 */
export const SHIMMER_STYLE = {
  backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.2) 50%, transparent 100%)',
  backgroundSize: '200% 100%',
};
```

### 6.4 Idle Detection Hook

**File:** `apps/client/src/hooks/use-idle-detector.ts` (CREATE)

Detects user idle state via Document Visibility API + mouse/keyboard/scroll inactivity.

```typescript
export interface IdleDetectorOptions {
  timeoutMs?: number;  // Default: 30000 (30s)
  onIdle?: () => void;
  onReturn?: () => void;
}

export interface IdleDetectorState {
  isIdle: boolean;
}

export function useIdleDetector(options: IdleDetectorOptions = {}): IdleDetectorState {
  const { timeoutMs = 30_000, onIdle, onReturn } = options;
  const [isIdle, setIsIdle] = useState(false);
  const isIdleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  const onReturnRef = useRef(onReturn);

  // Keep callback refs current
  useEffect(() => { onIdleRef.current = onIdle; }, [onIdle]);
  useEffect(() => { onReturnRef.current = onReturn; }, [onReturn]);

  useEffect(() => {
    const markIdle = () => {
      if (!isIdleRef.current) {
        isIdleRef.current = true;
        setIsIdle(true);
        onIdleRef.current?.();
      }
    };

    const markActive = () => {
      if (isIdleRef.current) {
        isIdleRef.current = false;
        setIsIdle(false);
        onReturnRef.current?.();
      }
      resetTimer();
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(markIdle, timeoutMs);
    };

    // Document Visibility API
    const handleVisibilityChange = () => {
      if (document.hidden) {
        markIdle();
      } else {
        markActive();
      }
    };

    // Activity events
    const activityEvents = ['mousemove', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => markActive();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    for (const event of activityEvents) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      for (const event of activityEvents) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [timeoutMs]);

  return { isIdle };
}
```

### 6.5 Celebrations Hook

**File:** `apps/client/src/hooks/use-celebrations.ts` (CREATE)

React hook that connects the celebration engine to task state and Zustand settings. This is the primary integration point.

```typescript
import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '../stores/app-store';
import { useIdleDetector } from './use-idle-detector';
import { CelebrationEngine, type CelebrationEvent } from '../lib/celebrations/celebration-engine';
import type { TaskItem, TaskUpdateEvent } from '@dorkos/shared/types';

export interface CelebrationsAPI {
  /** Wraps useTaskState.handleTaskEvent to intercept completions */
  handleTaskEvent: (event: TaskUpdateEvent, allTasks: TaskItem[]) => void;
  /** Currently active celebration (for rendering) */
  activeCelebration: CelebrationEvent | null;
  /** ID of task currently celebrating (for inline mini effects) */
  celebratingTaskId: string | null;
  /** Clear the active celebration after animation completes */
  clearCelebration: () => void;
}

export function useCelebrations(): CelebrationsAPI {
  const showTaskCelebrations = useAppStore((s) => s.showTaskCelebrations);
  const [activeCelebration, setActiveCelebration] = useState<CelebrationEvent | null>(null);
  const [celebratingTaskId, setCelebratingTaskId] = useState<string | null>(null);
  const engineRef = useRef<CelebrationEngine | null>(null);
  const prefersReducedMotion = useRef(false);

  // Check prefers-reduced-motion on mount
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mql.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Idle detection
  const { isIdle } = useIdleDetector({
    timeoutMs: 30_000,
    onReturn: () => {
      engineRef.current?.onUserReturn();
    },
  });

  // Initialize celebration engine
  useEffect(() => {
    const engine = new CelebrationEngine({
      enabled: showTaskCelebrations,
      miniProbability: 0.3,
      debounceWindowMs: 2000,
      debounceThreshold: 3,
      minTasksForMajor: 3,
      idleTimeoutMs: 30_000,
      onCelebrate: (event) => {
        if (prefersReducedMotion.current && event.level === 'major') {
          // Reduced motion: skip confetti/glow, show subtle opacity fade
          setActiveCelebration({ ...event, level: 'mini' });
        } else {
          setActiveCelebration(event);
        }
        if (event.level === 'mini') {
          setCelebratingTaskId(event.taskId);
        }
      },
    });

    engineRef.current = engine;
    return () => engine.destroy();
  }, [showTaskCelebrations]);

  // Sync idle state to engine
  useEffect(() => {
    if (engineRef.current) {
      // Engine tracks idle state internally via the hook's onReturn callback
    }
  }, [isIdle]);

  const handleTaskEvent = useCallback(
    (event: TaskUpdateEvent, allTasks: TaskItem[]) => {
      // Only celebrate live update transitions to 'completed'
      if (
        event.action === 'update' &&
        event.task.status === 'completed' &&
        event.task.id
      ) {
        engineRef.current?.onTaskCompleted(event.task.id, allTasks);
      }
    },
    [],
  );

  const clearCelebration = useCallback(() => {
    setActiveCelebration(null);
    setCelebratingTaskId(null);
  }, []);

  return {
    handleTaskEvent,
    activeCelebration,
    celebratingTaskId,
    clearCelebration,
  };
}
```

### 6.6 Celebration Overlay Component

**File:** `apps/client/src/components/chat/CelebrationOverlay.tsx` (CREATE)

Renders major celebration visual effects. Fixed-positioned, pointer-events-none, aria-hidden. Manages its own cleanup lifecycle.

```typescript
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fireConfetti, RADIAL_GLOW_STYLE } from '../../lib/celebrations/effects';
import type { CelebrationEvent } from '../../lib/celebrations/celebration-engine';

interface CelebrationOverlayProps {
  celebration: CelebrationEvent | null;
  onComplete: () => void;
}

export function CelebrationOverlay({ celebration, onComplete }: CelebrationOverlayProps) {
  const confettiCleanupRef = useRef<(() => void) | null>(null);
  const isMajor = celebration?.level === 'major';

  useEffect(() => {
    if (!isMajor) return;

    let cancelled = false;

    // Fire confetti
    fireConfetti({
      particleCount: 40,
      origin: { x: 0.5, y: 0.6 },
      colors: ['#FFD700', '#FFC107', '#F7B500'],
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      confettiCleanupRef.current = cleanup;
    });

    // Auto-complete after 2s
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => {
      cancelled = true;
      confettiCleanupRef.current?.();
      confettiCleanupRef.current = null;
      clearTimeout(timer);
    };
  }, [isMajor, onComplete]);

  return (
    <AnimatePresence>
      {isMajor && (
        <motion.div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-50"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={RADIAL_GLOW_STYLE}
        />
      )}
    </AnimatePresence>
  );
}
```

### 6.7 Inline Mini Celebration in TaskListPanel

**File:** `apps/client/src/components/chat/TaskListPanel.tsx` (MODIFY)

Add inline celebration effects to individual task rows. The `celebratingTaskId` prop triggers a spring-pop + shimmer on the matching row.

**New props added to `TaskListPanelProps`:**

```typescript
interface TaskListPanelProps {
  tasks: TaskItem[];
  activeForm: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  celebratingTaskId?: string | null;  // NEW
  onCelebrationComplete?: () => void; // NEW
}
```

**Task row modification** (within the `visibleTasks.map()` block):

```tsx
{visibleTasks.map(task => {
  const isCelebrating = task.id === celebratingTaskId && task.status === 'completed';

  return (
    <motion.li
      key={task.id}
      className={`flex items-center gap-2 text-xs py-0.5 ${
        task.status === 'completed'
          ? 'text-muted-foreground/50 line-through'
          : task.status === 'in_progress'
          ? 'text-foreground font-medium'
          : 'text-muted-foreground'
      }`}
      animate={isCelebrating ? {
        scale: [1, 1.05, 1],
        transition: { type: 'spring', stiffness: 400, damping: 10 }
      } : undefined}
      onAnimationComplete={() => {
        if (isCelebrating) onCelebrationComplete?.();
      }}
      aria-hidden={isCelebrating ? 'true' : undefined}
    >
      {/* Shimmer background for celebrating row */}
      {isCelebrating && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 rounded"
          initial={{ backgroundPosition: '-200% 0' }}
          animate={{ backgroundPosition: '200% 0' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.2) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
        />
      )}

      {/* Checkmark spring-pop */}
      {isCelebrating ? (
        <motion.span
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ type: 'spring', stiffness: 400, damping: 10 }}
        >
          {STATUS_ICON[task.status]}
        </motion.span>
      ) : (
        STATUS_ICON[task.status]
      )}

      <span className="truncate">{task.subject}</span>
    </motion.li>
  );
})}
```

### 6.8 Zustand Store Extension

**File:** `apps/client/src/stores/app-store.ts` (MODIFY)

Add `showTaskCelebrations` boolean following the existing pattern (`showShortcutChips`, `autoHideToolCalls`, etc.).

**New state fields:**

| Field | Type | Storage Key | Default |
|-------|------|------------|---------|
| `showTaskCelebrations` | `boolean` | `gateway-show-task-celebrations` | `true` |

**Getter pattern:**
```typescript
showTaskCelebrations: (() => {
  try { return localStorage.getItem('gateway-show-task-celebrations') !== 'false'; }
  catch { return true; }
})(),
```

**Setter pattern:**
```typescript
setShowTaskCelebrations: (v) => {
  try { localStorage.setItem('gateway-show-task-celebrations', String(v)); } catch {}
  set({ showTaskCelebrations: v });
},
```

**Update `resetPreferences()`:**
```typescript
resetPreferences: () => {
  try {
    // ... existing removeItem calls ...
    localStorage.removeItem('gateway-show-task-celebrations');
  } catch {}
  set({
    // ... existing reset values ...
    showTaskCelebrations: true,
  });
},
```

### 6.9 Settings Dialog Toggle

**File:** `apps/client/src/components/settings/SettingsDialog.tsx` (MODIFY)

Add a new `SettingRow` in the Preferences tab, grouped with other behavioral toggles:

```tsx
<SettingRow label="Task celebrations" description="Show animations when tasks complete">
  <Switch
    checked={showTaskCelebrations}
    onCheckedChange={setShowTaskCelebrations}
  />
</SettingRow>
```

**Store access addition:**
```typescript
const {
  // ... existing destructuring ...
  showTaskCelebrations, setShowTaskCelebrations,
} = useAppStore();
```

### 6.10 ChatPanel Integration

**File:** `apps/client/src/components/chat/ChatPanel.tsx` (MODIFY)

Wire the celebrations hook into the existing task event pipeline.

**New imports:**
```typescript
import { useCelebrations } from '../../hooks/use-celebrations';
import { CelebrationOverlay } from './CelebrationOverlay';
```

**Hook wiring (inside `ChatPanel` function body):**
```typescript
const celebrations = useCelebrations();

// Wrap the existing handleTaskEvent to also notify celebrations
const handleTaskEventWithCelebrations = useCallback(
  (event: TaskUpdateEvent) => {
    taskState.handleTaskEvent(event);
    // After state update, pass current task list to celebrations
    const allTasks = taskState.tasks;
    celebrations.handleTaskEvent(event, allTasks);
  },
  [taskState, celebrations],
);
```

**Update the `useChatSession` call:**
```typescript
const { ... } = useChatSession(sessionId, {
  transformContent,
  onTaskEvent: handleTaskEventWithCelebrations,  // Changed from taskState.handleTaskEvent
  onSessionIdChange: setSessionId,
});
```

**Render celebration components:**
```tsx
{/* Celebration overlay for major celebrations */}
<CelebrationOverlay
  celebration={celebrations.activeCelebration}
  onComplete={celebrations.clearCelebration}
/>

{/* Pass celebrating task ID to TaskListPanel */}
<TaskListPanel
  tasks={taskState.tasks}
  activeForm={taskState.activeForm}
  isCollapsed={taskState.isCollapsed}
  onToggleCollapse={taskState.toggleCollapse}
  celebratingTaskId={celebrations.celebratingTaskId}
  onCelebrationComplete={celebrations.clearCelebration}
/>
```

### 6.11 Task State Completion Detection

**File:** `apps/client/src/hooks/use-task-state.ts` (MODIFY)

The existing `handleTaskEvent` already processes `action: 'update'` events and merges status changes. No modifications are needed to the task state hook itself -- the celebration detection happens in the `useCelebrations` hook which receives the raw `TaskUpdateEvent` and current task list from `ChatPanel`.

The key distinction is:
- `action === 'snapshot'` = historical/replay data (loaded on session open) -- **no celebrations**
- `action === 'create'` = new task created -- **no celebrations**
- `action === 'update'` with `status: 'completed'` = live completion -- **celebrate**

This filtering happens in `useCelebrations.handleTaskEvent()`.

### 6.12 Reduced Motion Support

When `prefers-reduced-motion: reduce` is active:

| Effect | Normal behavior | Reduced motion behavior |
|--------|----------------|------------------------|
| Mini spring-pop | scale [1, 1.4, 1] with spring physics | opacity [0.5, 1] fade (100ms) |
| Mini shimmer | Sliding gold gradient | No shimmer |
| Major radial glow | Scale + opacity animation | Subtle opacity fade (0 -> 0.1 -> 0, 300ms) |
| Major confetti | 30-50 canvas particles | Disabled entirely (`disableForReducedMotion: true`) |

The `motion/react` library respects `<MotionConfig reducedMotion="user">` (already configured in `App.tsx`). This automatically converts spring/complex animations to simple opacity transitions. The `canvas-confetti` library has its own `disableForReducedMotion` flag which is set to `true`.

### 6.13 Data Flow Diagram

```
User sends message
  |
  v
Server processes with Claude SDK
  |
  v
Server streams task_update SSE events
  |
  v
useChatSession receives event (line ~447)
  |
  v
ChatPanel.handleTaskEventWithCelebrations()
  |
  ├──> taskState.handleTaskEvent()     // Updates task Map (existing)
  |     |
  |     v
  |    TaskListPanel re-renders         // Icon changes (existing)
  |
  └──> celebrations.handleTaskEvent()   // Evaluates celebration (NEW)
        |
        v
      CelebrationEngine.onTaskCompleted()
        |
        ├── enabled check
        ├── snapshot/history filter (action !== 'update' -> skip)
        ├── debounce check (3+ in 2s -> batch)
        ├── all-tasks-done check (3+ total, all completed -> major)
        ├── probabilistic mini check (~30%)
        |
        v
      CelebrationEvent emitted
        |
        ├── isIdle? -> queue for later
        |
        └── isActive? -> render immediately
              |
              ├── Mini: celebratingTaskId -> TaskListPanel
              |         spring-pop + shimmer on task row
              |
              └── Major: activeCelebration -> CelebrationOverlay
                         radial glow + canvas-confetti burst
```

---

## 7. User Experience

### Happy Path: Individual Task Completion

1. User is watching tasks update during a streaming session
2. A task transitions from `in_progress` to `completed`
3. ~30% of the time: the checkmark icon does a quick spring-pop bounce (scale 1 -> 1.4 -> 1), and a subtle gold shimmer sweeps across the task row (~400ms total)
4. The other ~70%: the icon simply changes to a green checkmark (existing behavior)
5. The animation is brief and non-blocking -- user can continue scrolling or typing

### Happy Path: All Tasks Complete

1. User has 4 tasks, 3 already completed
2. The final task transitions to `completed`
3. A golden radial glow ripple emanates from the center of the viewport (~600ms)
4. 30-50 gold confetti particles shower down (~2s, gravity-based physics)
5. Both effects are pointer-events-none and aria-hidden -- user can interact freely throughout

### Rapid Completions

1. Claude completes 5 tasks within 1.5 seconds
2. Instead of 5 rapid mini celebrations, the debounce window batches them
3. A single mini celebration fires after the 2s debounce window settles
4. If all tasks are now complete, a major celebration fires instead

### User Was Away

1. User switches to another browser tab while tasks are running
2. 3 tasks complete while the user is away
3. Celebrations are queued (not fired while tab is hidden)
4. User returns to the tab
5. After a 500ms delay, the most significant queued celebration replays
6. If a major was queued, only the major plays (minis are deduplicated)

### Settings Toggle

1. User opens Settings > Preferences tab
2. "Task celebrations" toggle is ON by default
3. User toggles it OFF
4. No more celebration animations fire (immediate effect, no page reload)
5. Setting persists across sessions via localStorage

### Edge Cases

- **Zero tasks or 1-2 tasks all completed:** No major celebration (requires 3+ tasks)
- **Task added after all were complete:** Major celebration does not re-fire when the new task later completes (only fires when transitioning from "not all done" to "all done")
- **Session loaded from history:** `action: 'snapshot'` events are ignored -- no celebrations on page load
- **Celebrations disabled mid-stream:** In-flight celebrations complete, no new ones fire
- **Multiple rapid major triggers:** Only one major celebration can be active at a time

---

## 8. Testing Strategy

### Unit Tests -- Celebration Engine

**File:** `apps/client/src/lib/celebrations/__tests__/celebration-engine.test.ts` (CREATE)

```typescript
describe('CelebrationEngine', () => {
  describe('onTaskCompleted', () => {
    it('fires mini celebration with ~30% probability');
    it('does not fire when disabled');
    it('fires major celebration when all 3+ tasks are completed');
    it('does not fire major when fewer than 3 tasks');
    it('does not fire major when some tasks are still pending');
    it('debounces rapid completions (3+ within 2s)');
    it('fires single celebration after debounce window settles');
  });

  describe('idle awareness', () => {
    it('queues celebrations when user is idle');
    it('replays queued celebrations on user return');
    it('deduplicates queued celebrations (major supersedes minis)');
    it('replays with stagger delay between celebrations');
  });

  describe('lifecycle', () => {
    it('cleans up timers on destroy');
    it('updates config dynamically');
  });
});
```

**Testing probabilistic behavior:** Seed `Math.random` via `vi.spyOn(Math, 'random')` to control the 30% threshold deterministically.

### Unit Tests -- Idle Detector Hook

**File:** `apps/client/src/hooks/__tests__/use-idle-detector.test.ts` (CREATE)

```typescript
describe('useIdleDetector', () => {
  it('starts in active state');
  it('transitions to idle after timeout period');
  it('resets idle timer on mouse/keyboard activity');
  it('marks idle immediately when document becomes hidden');
  it('marks active when document becomes visible');
  it('calls onIdle callback when transitioning to idle');
  it('calls onReturn callback when returning from idle');
  it('cleans up event listeners on unmount');
});
```

**Pattern:** Use `vi.useFakeTimers()` for timeout testing. Fire `visibilitychange` events via `document.dispatchEvent()`. Simulate mouse/keyboard via `window.dispatchEvent()`.

### Unit Tests -- Effects

**File:** `apps/client/src/lib/celebrations/__tests__/effects.test.ts` (CREATE)

```typescript
describe('fireConfetti', () => {
  it('lazy-loads canvas-confetti on first call');
  it('calls confetti with gold color palette');
  it('returns cleanup function that calls confetti.reset()');
  it('passes disableForReducedMotion: true');
});
```

**Pattern:** Mock `canvas-confetti` via `vi.mock('canvas-confetti')`.

### Component Tests -- CelebrationOverlay

**File:** `apps/client/src/components/chat/__tests__/CelebrationOverlay.test.tsx` (CREATE)

```typescript
describe('CelebrationOverlay', () => {
  it('renders nothing when celebration is null');
  it('renders radial glow for major celebration');
  it('has aria-hidden="true" on all elements');
  it('has pointer-events-none on container');
  it('calls onComplete after animation duration');
  it('cleans up confetti on unmount');
});
```

**Pattern:** Mock `motion/react` to render plain elements (existing project pattern). Mock `canvas-confetti`.

### Component Tests -- TaskListPanel (Celebration Props)

**File:** `apps/client/src/components/chat/__tests__/TaskListPanel.test.tsx` (CREATE or MODIFY if exists)

```typescript
describe('TaskListPanel celebration props', () => {
  it('applies spring-pop animation when celebratingTaskId matches a task');
  it('shows shimmer background on celebrating task row');
  it('calls onCelebrationComplete after animation finishes');
  it('does not apply celebration effects to non-matching tasks');
  it('handles celebratingTaskId being null gracefully');
});
```

### Integration Tests -- Settings Toggle

**File:** `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx` (MODIFY)

```typescript
it('shows task celebrations toggle in Preferences tab', async () => {
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper });
  expect(screen.getByText(/task celebrations/i)).toBeDefined();
});

it('toggles task celebrations setting', async () => {
  const user = userEvent.setup();
  render(<SettingsDialog open={true} onOpenChange={vi.fn()} />, { wrapper });
  // Find the switch and toggle it
  // Verify store was updated
});
```

### Store Tests -- app-store

Verify the new setting follows the persistence pattern:

```typescript
it('persists showTaskCelebrations to localStorage');
it('resets showTaskCelebrations in resetPreferences');
it('defaults showTaskCelebrations to true');
```

### All Phases

- All existing tests must pass without modification
- `turbo test`, `turbo typecheck`, and `turbo build` must all succeed

---

## 9. Performance Considerations

### Animation Performance

- **GPU-only properties:** All animations use `opacity`, `scale`, and `backgroundPosition` -- no layout-triggering properties (width, height, top, left). This keeps animations on the compositor thread.
- **Spring physics via motion.dev:** The `motion/react` library handles animation frame scheduling efficiently. Spring animations are calculated in JS but applied via `transform: scale()` which is GPU-composited.
- **Canvas confetti:** `canvas-confetti` renders particles on a `<canvas>` element, which is GPU-accelerated and does not trigger DOM reflows. The 30-50 particle count is well within the 60fps budget.

### Bundle Impact

- **canvas-confetti (~28KB):** Lazy-loaded via `import('canvas-confetti')` on first major celebration. Not included in the initial bundle. Cached by the browser after first load.
- **New code:** The celebration engine, effects module, idle detector hook, celebrations hook, and overlay component add approximately 3-4KB of minified code (included in the main bundle).

### Memory

- **CelebrationEngine:** Holds a queue array (typically 0-3 items), a recent-completions array (capped by time window), and a few timers. Negligible memory footprint (~200 bytes).
- **Canvas cleanup:** The `confetti.reset()` function is called on unmount and when celebrations complete, freeing the canvas and all particle state.
- **Event listeners:** The idle detector adds 4 passive event listeners (mousemove, keydown, scroll, touchstart) and 1 visibility change listener. All are cleaned up on unmount.

### Runtime Cost

- **Per task completion:** One function call to `CelebrationEngine.onTaskCompleted()` which performs: array filter (debounce check), array comparison (all-tasks-done check), and `Math.random()` call. Total: sub-microsecond.
- **Mini celebration:** One `motion.div` animation (spring scale + background-position sweep). No canvas, no particle system. ~400ms total.
- **Major celebration:** One `motion.div` animation (radial glow) + one `canvas-confetti` call (30-50 particles for ~2s). Canvas is automatically cleaned up.
- **60fps target:** Verified by keeping particle count low (30-50, not hundreds) and using GPU-composited properties exclusively.

### Debounce Optimization

When tasks complete rapidly (common during batch operations), the debounce mechanism prevents N individual animations from firing. Instead, a single celebration fires after the 2s debounce window settles. This is both a UX improvement (less visual noise) and a performance optimization (one animation instead of many).

---

## 10. Security Considerations

- No security impact. This feature is entirely client-side visual effects.
- No user data is collected, stored, or transmitted.
- No new network requests are made.
- The `canvas-confetti` dependency is a well-maintained, widely-used library (5M+ weekly npm downloads) with no known vulnerabilities.
- All celebration elements use `pointer-events-none` so they cannot intercept user clicks or interactions.

---

## 11. Implementation Phases

### Phase 1: Foundation (Celebration Engine + Settings)

**Estimated effort:** 1 day

1. Add `canvas-confetti` dependency to `apps/client/package.json`
2. Add `showTaskCelebrations` boolean to `apps/client/src/stores/app-store.ts` (state + setter + localStorage + resetPreferences)
3. Add settings toggle in `apps/client/src/components/settings/SettingsDialog.tsx`
4. Create `apps/client/src/lib/celebrations/celebration-engine.ts` (core logic: event types, queue, debounce, probabilistic mini, major detection, idle-aware replay)
5. Create `apps/client/src/hooks/use-idle-detector.ts` (Document Visibility API + activity tracking)
6. Write tests for celebration engine and idle detector
7. Verify: `turbo test`, `turbo typecheck`, `turbo build`

### Phase 2: Visual Effects

**Estimated effort:** 1 day

1. Create `apps/client/src/lib/celebrations/effects.ts` (confetti wrapper, radial glow styles, shimmer styles, spring configs)
2. Create `apps/client/src/components/chat/CelebrationOverlay.tsx` (major celebration rendering: radial glow + confetti canvas)
3. Modify `apps/client/src/components/chat/TaskListPanel.tsx` (add `celebratingTaskId` / `onCelebrationComplete` props, inline spring-pop + shimmer on celebrating task row)
4. Write tests for effects module, CelebrationOverlay, and TaskListPanel celebration props
5. Verify reduced motion behavior (motion.dev config + canvas-confetti flag)
6. Verify: `turbo test`, `turbo typecheck`, `turbo build`

### Phase 3: Integration and Polish

**Estimated effort:** 1 day

1. Create `apps/client/src/hooks/use-celebrations.ts` (connects engine to task state, manages lifecycle, reads Zustand settings)
2. Modify `apps/client/src/components/chat/ChatPanel.tsx` (wire celebrations hook, wrap handleTaskEvent, render CelebrationOverlay, pass props to TaskListPanel)
3. Write integration tests for the full pipeline (task event -> celebration engine -> visual effect)
4. Verify idle-aware replay end-to-end (queue while hidden, replay on return)
5. Verify debounce behavior with rapid completions
6. Manual testing: light theme, dark theme, reduced motion, settings toggle, idle/return
7. Verify: `turbo test`, `turbo typecheck`, `turbo build`

---

## 12. Open Questions

None -- all decisions were resolved during ideation:

1. **Trigger scope:** Live completions only + debounced batch (resolved)
2. **Mini intensity:** Probabilistic ~30% (resolved)
3. **Min tasks for major:** 3+ (resolved)
4. **Idle detection:** Document Visibility API + 30s activity timeout (resolved)
5. **Visual style:** Inline spring-pop + shimmer for mini, radial glow + confetti for major (resolved)
6. **Dependency approval:** canvas-confetti ~28KB approved (resolved)

---

## 13. References

### Files Created

| File | Purpose |
|------|---------|
| `apps/client/src/lib/celebrations/celebration-engine.ts` | Core orchestration: event types, queue, debounce, probabilistic mini, major detection |
| `apps/client/src/lib/celebrations/effects.ts` | Visual effect implementations: confetti wrapper, glow styles, shimmer styles |
| `apps/client/src/hooks/use-idle-detector.ts` | Idle detection: Document Visibility API + activity tracking |
| `apps/client/src/hooks/use-celebrations.ts` | React hook connecting engine to task state and Zustand settings |
| `apps/client/src/components/chat/CelebrationOverlay.tsx` | Major celebration rendering: radial glow + confetti |
| `apps/client/src/lib/celebrations/__tests__/celebration-engine.test.ts` | Engine unit tests |
| `apps/client/src/lib/celebrations/__tests__/effects.test.ts` | Effects unit tests |
| `apps/client/src/hooks/__tests__/use-idle-detector.test.ts` | Idle detector hook tests |
| `apps/client/src/components/chat/__tests__/CelebrationOverlay.test.tsx` | Overlay component tests |

### Files Modified

| File | Change |
|------|--------|
| `apps/client/package.json` | Add `canvas-confetti` dependency |
| `apps/client/src/stores/app-store.ts` | Add `showTaskCelebrations` boolean + setter + localStorage + resetPreferences |
| `apps/client/src/components/settings/SettingsDialog.tsx` | Add celebration toggle in Preferences tab |
| `apps/client/src/components/chat/TaskListPanel.tsx` | Add `celebratingTaskId` prop, inline spring-pop + shimmer |
| `apps/client/src/components/chat/ChatPanel.tsx` | Wire celebrations hook, render overlay, pass props |
| `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx` | Add celebration toggle test |

### Key Context Files (Not Modified)

| File | Relevance |
|------|-----------|
| `apps/client/src/hooks/use-task-state.ts` | Task state management -- celebration detection reads from here |
| `apps/client/src/hooks/use-chat-session.ts` | SSE event pipeline -- `onTaskEvent` callback interface |
| `packages/shared/src/schemas.ts` | `TaskUpdateEventSchema` -- `action: 'update'` vs `'snapshot'` distinction |
| `guides/design-system.md` | Timing specs, animation guidelines, color palette |

### Ideation Document

`specs/task-celebrations/01-ideation.md`

### Acceptance Criteria Summary

| # | Criterion |
|---|-----------|
| 1 | Mini celebration (spring-pop + shimmer) appears ~30% of time on individual task completions |
| 2 | Major celebration (radial glow + confetti) appears when all 3+ tasks reach completed status |
| 3 | No celebrations on history/snapshot replay (only live `action: 'update'` transitions) |
| 4 | Rapid completions (3+ within 2s) debounce into a single celebration |
| 5 | Settings toggle in Preferences tab, on by default |
| 6 | Celebrations queue when user is away (tab hidden or 30s idle), replay on return |
| 7 | `prefers-reduced-motion` disables particles/animations entirely (subtle opacity fade only) |
| 8 | `aria-hidden="true"` on all celebration elements |
| 9 | Canvas cleanup on unmount (cancelAnimationFrame, clear particles) |
| 10 | 60fps during celebrations, no main thread blocking |
| 11 | Celebration is non-blocking -- user can continue interacting during animation |
| 12 | Reset preferences clears celebration setting |
| 13 | Works in both light and dark themes |
| 14 | canvas-confetti lazy-loaded (code-split) |
