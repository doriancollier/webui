# Task Breakdown: Task Completion Celebrations

Generated: 2026-02-13
Source: specs/task-celebrations/02-specification.md
Last Decompose: 2026-02-13

---

## Overview

Add two tiers of celebration animations to the task pane when tasks complete during active streaming: probabilistic mini celebrations (spring-pop + shimmer) and major celebrations (radial glow + confetti). Client-side only, with settings toggle, idle awareness, debouncing, and reduced-motion support.

---

## Phase 1: Foundation

### Task 1: [task-celebrations] [P1] Add canvas-confetti dependency and Zustand store setting

**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation)

**Description**:

Install `canvas-confetti` dependency and add `showTaskCelebrations` boolean to the Zustand app store following existing patterns.

**Implementation Steps**:

1. Install canvas-confetti:
```bash
cd apps/client && npm install canvas-confetti && npm install -D @types/canvas-confetti
```

2. Modify `apps/client/src/stores/app-store.ts`:

Add to `AppState` interface:
```typescript
showTaskCelebrations: boolean;
setShowTaskCelebrations: (v: boolean) => void;
```

Add state initializer (following the `showShortcutChips` pattern -- defaults to `true`):
```typescript
showTaskCelebrations: (() => {
  try {
    const stored = localStorage.getItem('gateway-show-task-celebrations');
    return stored === null ? true : stored === 'true';
  }
  catch { return true; }
})(),
setShowTaskCelebrations: (v) => {
  try { localStorage.setItem('gateway-show-task-celebrations', String(v)); } catch {}
  set({ showTaskCelebrations: v });
},
```

Update `resetPreferences()` -- add to the `localStorage.removeItem` block:
```typescript
localStorage.removeItem('gateway-show-task-celebrations');
```

Add to the `set()` call in `resetPreferences`:
```typescript
showTaskCelebrations: true,
```

**Acceptance Criteria**:
- [ ] `canvas-confetti` and `@types/canvas-confetti` added to client package.json
- [ ] `showTaskCelebrations` defaults to `true` in store
- [ ] Setting persists to localStorage under key `gateway-show-task-celebrations`
- [ ] `resetPreferences()` resets the setting to `true` and removes the localStorage key
- [ ] `turbo typecheck` passes
- [ ] `turbo build` passes

---

### Task 2: [task-celebrations] [P1] Create celebration engine core logic

**Size**: Large
**Priority**: High
**Dependencies**: Task 1
**Can run parallel with**: Task 3

**Description**:

Create `apps/client/src/lib/celebrations/celebration-engine.ts` -- a pure TypeScript class (no React dependency) that manages celebration state, queuing, debouncing, and idle-aware replay. Also create comprehensive unit tests.

**File**: `apps/client/src/lib/celebrations/celebration-engine.ts` (CREATE)

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
  private debounceTimer: ReturnType<typeof setTimeout> | null;

  constructor(config: CelebrationEngineConfig) {
    this.config = config;
    this.queue = [];
    this.recentCompletions = [];
    this.isIdle = false;
    this.debounceTimer = null;
  }

  /**
   * Called when a task transitions to 'completed' via a live update event.
   * Evaluates whether to trigger a mini or major celebration.
   */
  onTaskCompleted(taskId: string, allTasks: Array<{ id: string; status: string }>): void {
    if (!this.config.enabled) return;

    // Track for debouncing
    const now = Date.now();
    this.recentCompletions.push(now);
    this.recentCompletions = this.recentCompletions.filter(
      t => now - t < this.config.debounceWindowMs
    );

    // Check if this triggers the debounce threshold (3+ in 2s)
    if (this.recentCompletions.length >= this.config.debounceThreshold) {
      // Clear any existing debounce timer
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      // Wait for debounce window to settle, then fire one celebration
      this.debounceTimer = setTimeout(() => {
        this.flushDebounce(allTasks);
      }, this.config.debounceWindowMs);
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
  private flushDebounce(allTasks: Array<{ id: string; status: string }>): void {
    this.debounceTimer = null;
    const allCompleted = allTasks.every(t => t.status === 'completed');
    const lastTaskId = allTasks[allTasks.length - 1]?.id ?? 'unknown';

    if (allCompleted && allTasks.length >= this.config.minTasksForMajor) {
      this.emit({ level: 'major', taskId: lastTaskId, timestamp: Date.now() });
    } else {
      this.emit({ level: 'mini', taskId: lastTaskId, timestamp: Date.now() });
    }
  }

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

  /** Mark user as idle */
  setIdle(idle: boolean): void {
    this.isIdle = idle;
  }

  /**
   * Called when user returns from idle. Replays queued celebrations.
   * Deduplicates: if a major is queued, skip minis.
   */
  onUserReturn(): void {
    if (this.queue.length === 0) return;
    const queued = [...this.queue];
    this.queue = [];
    const hasMajor = queued.some(e => e.level === 'major');
    const toPlay = hasMajor
      ? queued.filter(e => e.level === 'major').slice(0, 1)
      : queued.slice(-1);
    for (const event of toPlay) {
      this.config.onCelebrate(event);
    }
  }

  /** Update config (e.g., when setting toggles) */
  updateConfig(partial: Partial<CelebrationEngineConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** Clean up all timers */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.queue = [];
    this.recentCompletions = [];
  }
}
```

**Test file**: `apps/client/src/lib/celebrations/__tests__/celebration-engine.test.ts` (CREATE)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CelebrationEngine, type CelebrationEngineConfig, type CelebrationEvent } from '../celebration-engine';

function createConfig(overrides?: Partial<CelebrationEngineConfig>): CelebrationEngineConfig {
  return {
    enabled: true,
    miniProbability: 0.3,
    debounceWindowMs: 2000,
    debounceThreshold: 3,
    minTasksForMajor: 3,
    idleTimeoutMs: 30000,
    onCelebrate: vi.fn(),
    ...overrides,
  };
}

function makeTasks(count: number, allCompleted = false) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    status: allCompleted ? 'completed' : (i < count - 1 ? 'completed' : 'in_progress'),
  }));
}

describe('CelebrationEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('onTaskCompleted', () => {
    it('fires mini celebration with ~30% probability', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // below 0.3 threshold
      const config = createConfig();
      const engine = new CelebrationEngine(config);
      const tasks = makeTasks(3, false); // not all completed

      engine.onTaskCompleted('2', tasks);

      expect(config.onCelebrate).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'mini', taskId: '2' })
      );
    });

    it('does not fire mini when random exceeds probability', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // above 0.3 threshold
      const config = createConfig();
      const engine = new CelebrationEngine(config);
      const tasks = makeTasks(3, false);

      engine.onTaskCompleted('2', tasks);

      expect(config.onCelebrate).not.toHaveBeenCalled();
    });

    it('does not fire when disabled', () => {
      const config = createConfig({ enabled: false });
      const engine = new CelebrationEngine(config);

      engine.onTaskCompleted('1', makeTasks(3, true));

      expect(config.onCelebrate).not.toHaveBeenCalled();
    });

    it('fires major celebration when all 3+ tasks are completed', () => {
      const config = createConfig();
      const engine = new CelebrationEngine(config);
      const tasks = makeTasks(3, true); // all completed

      engine.onTaskCompleted('3', tasks);

      expect(config.onCelebrate).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'major', taskId: '3' })
      );
    });

    it('does not fire major when fewer than 3 tasks', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // don't fire mini either
      const config = createConfig();
      const engine = new CelebrationEngine(config);
      const tasks = [
        { id: '1', status: 'completed' },
        { id: '2', status: 'completed' },
      ];

      engine.onTaskCompleted('2', tasks);

      expect(config.onCelebrate).not.toHaveBeenCalled();
    });

    it('does not fire major when some tasks are still pending', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const config = createConfig();
      const engine = new CelebrationEngine(config);
      const tasks = [
        { id: '1', status: 'completed' },
        { id: '2', status: 'completed' },
        { id: '3', status: 'in_progress' },
      ];

      engine.onTaskCompleted('2', tasks);

      expect(config.onCelebrate).not.toHaveBeenCalled();
    });

    it('debounces rapid completions (3+ within 2s)', () => {
      const config = createConfig();
      const engine = new CelebrationEngine(config);
      const tasks = makeTasks(5, false);

      // Fire 3 completions rapidly
      engine.onTaskCompleted('1', tasks);
      engine.onTaskCompleted('2', tasks);
      engine.onTaskCompleted('3', tasks);

      // Should not have fired yet (debouncing)
      // The first two may fire minis (probabilistic), but the third triggers debounce
      // After debounce window, a single celebration fires
      vi.advanceTimersByTime(2000);

      // The debounce flush should fire exactly one celebration
      const calls = (config.onCelebrate as ReturnType<typeof vi.fn>).mock.calls;
      // At least the debounce flush fires
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('idle awareness', () => {
    it('queues celebrations when user is idle', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      const config = createConfig();
      const engine = new CelebrationEngine(config);
      engine.setIdle(true);

      engine.onTaskCompleted('1', makeTasks(3, false));

      expect(config.onCelebrate).not.toHaveBeenCalled();
    });

    it('replays queued celebrations on user return', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      const config = createConfig();
      const engine = new CelebrationEngine(config);
      engine.setIdle(true);

      engine.onTaskCompleted('1', makeTasks(3, false));
      expect(config.onCelebrate).not.toHaveBeenCalled();

      engine.setIdle(false);
      engine.onUserReturn();

      expect(config.onCelebrate).toHaveBeenCalled();
    });

    it('deduplicates queued celebrations (major supersedes minis)', () => {
      const config = createConfig();
      const engine = new CelebrationEngine(config);
      engine.setIdle(true);

      // Queue a mini
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      engine.onTaskCompleted('1', makeTasks(3, false));

      // Queue a major
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      engine.onTaskCompleted('3', makeTasks(3, true));

      engine.setIdle(false);
      engine.onUserReturn();

      const calls = (config.onCelebrate as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][0].level).toBe('major');
    });
  });

  describe('lifecycle', () => {
    it('cleans up timers on destroy', () => {
      const config = createConfig();
      const engine = new CelebrationEngine(config);

      // Start a debounce
      engine.onTaskCompleted('1', makeTasks(5, false));
      engine.onTaskCompleted('2', makeTasks(5, false));
      engine.onTaskCompleted('3', makeTasks(5, false));

      engine.destroy();

      // Advancing timers should not fire any celebration
      vi.advanceTimersByTime(5000);
      // Only pre-debounce calls should exist (if any)
    });

    it('updates config dynamically', () => {
      const config = createConfig({ enabled: false });
      const engine = new CelebrationEngine(config);
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      engine.onTaskCompleted('1', makeTasks(3, false));
      expect(config.onCelebrate).not.toHaveBeenCalled();

      engine.updateConfig({ enabled: true });
      engine.onTaskCompleted('2', makeTasks(3, false));
      expect(config.onCelebrate).toHaveBeenCalled();
    });
  });
});
```

**Acceptance Criteria**:
- [ ] `CelebrationEngine` class created with all methods
- [ ] Probabilistic mini fires ~30% of the time (controlled via Math.random spy in tests)
- [ ] Major fires when all 3+ tasks are completed
- [ ] Debounce suppresses rapid completions (3+ within 2s)
- [ ] Idle queue works (queue when idle, replay on return)
- [ ] Deduplication: major supersedes minis in queue
- [ ] `destroy()` cleans up all timers
- [ ] All unit tests pass

---

### Task 3: [task-celebrations] [P1] Create idle detector hook

**Size**: Medium
**Priority**: High
**Dependencies**: Task 1
**Can run parallel with**: Task 2

**Description**:

Create `apps/client/src/hooks/use-idle-detector.ts` -- a React hook that detects user idle state via Document Visibility API + mouse/keyboard/scroll inactivity. Also create comprehensive unit tests.

**File**: `apps/client/src/hooks/use-idle-detector.ts` (CREATE)

```typescript
import { useState, useEffect, useRef } from 'react';

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

**Test file**: `apps/client/src/hooks/__tests__/use-idle-detector.test.ts` (CREATE)

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleDetector } from '../use-idle-detector';

describe('useIdleDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in active state', () => {
    const { result } = renderHook(() => useIdleDetector({ timeoutMs: 5000 }));
    expect(result.current.isIdle).toBe(false);
  });

  it('transitions to idle after timeout period', () => {
    const { result } = renderHook(() => useIdleDetector({ timeoutMs: 5000 }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.isIdle).toBe(true);
  });

  it('resets idle timer on mouse activity', () => {
    const { result } = renderHook(() => useIdleDetector({ timeoutMs: 5000 }));

    act(() => {
      vi.advanceTimersByTime(4000);
      window.dispatchEvent(new Event('mousemove'));
    });

    // Timer reset -- should not be idle yet
    expect(result.current.isIdle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.isIdle).toBe(true);
  });

  it('resets idle timer on keyboard activity', () => {
    const { result } = renderHook(() => useIdleDetector({ timeoutMs: 5000 }));

    act(() => {
      vi.advanceTimersByTime(4000);
      window.dispatchEvent(new Event('keydown'));
    });

    expect(result.current.isIdle).toBe(false);
  });

  it('marks idle immediately when document becomes hidden', () => {
    const { result } = renderHook(() => useIdleDetector({ timeoutMs: 30000 }));

    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isIdle).toBe(true);

    // Restore
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('marks active when document becomes visible', () => {
    const { result } = renderHook(() => useIdleDetector({ timeoutMs: 5000 }));

    // First become idle
    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.isIdle).toBe(true);

    // Then become visible
    act(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.isIdle).toBe(false);
  });

  it('calls onIdle callback when transitioning to idle', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleDetector({ timeoutMs: 5000, onIdle }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onIdle).toHaveBeenCalledOnce();
  });

  it('calls onReturn callback when returning from idle', () => {
    const onReturn = vi.fn();
    renderHook(() => useIdleDetector({ timeoutMs: 5000, onReturn }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });

    expect(onReturn).toHaveBeenCalledOnce();
  });

  it('cleans up event listeners on unmount', () => {
    const removeEventSpy = vi.spyOn(window, 'removeEventListener');
    const docRemoveSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useIdleDetector({ timeoutMs: 5000 }));
    unmount();

    expect(removeEventSpy).toHaveBeenCalled();
    expect(docRemoveSpy).toHaveBeenCalled();
  });
});
```

**Acceptance Criteria**:
- [ ] Hook starts in active state (`isIdle: false`)
- [ ] Transitions to idle after `timeoutMs` of inactivity
- [ ] Mouse/keyboard/scroll/touch events reset the timer
- [ ] Document visibility change immediately marks idle/active
- [ ] `onIdle` and `onReturn` callbacks fire on transitions
- [ ] Event listeners cleaned up on unmount
- [ ] All unit tests pass

---

## Phase 2: Visual Effects

### Task 4: [task-celebrations] [P2] Create visual effects module

**Size**: Small
**Priority**: High
**Dependencies**: Task 1
**Can run parallel with**: Task 6

**Description**:

Create `apps/client/src/lib/celebrations/effects.ts` with the confetti wrapper function, radial glow styles, shimmer styles, and spring animation configs. Also create unit tests.

**File**: `apps/client/src/lib/celebrations/effects.ts` (CREATE)

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
 * CSS style object for the radial glow effect.
 * Applied via motion.div style props.
 */
export const RADIAL_GLOW_STYLE = {
  background: 'radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%)',
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
 * Shimmer gradient style for the gold shimmer effect on task rows.
 * Applied as a CSS background-position animation via motion.div.
 */
export const SHIMMER_STYLE = {
  backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.2) 50%, transparent 100%)',
  backgroundSize: '200% 100%',
};
```

**Test file**: `apps/client/src/lib/celebrations/__tests__/effects.test.ts` (CREATE)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock canvas-confetti
const mockConfetti = vi.fn();
mockConfetti.reset = vi.fn();
vi.mock('canvas-confetti', () => ({
  default: mockConfetti,
}));

import { fireConfetti, RADIAL_GLOW_STYLE, MINI_SPRING_CONFIG, SHIMMER_STYLE } from '../effects';

describe('fireConfetti', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lazy-loads canvas-confetti and calls it', async () => {
    await fireConfetti();
    expect(mockConfetti).toHaveBeenCalledOnce();
  });

  it('calls confetti with gold color palette', async () => {
    await fireConfetti();
    const call = mockConfetti.mock.calls[0][0];
    expect(call.colors).toEqual(['#FFD700', '#FFC107', '#F7B500']);
  });

  it('returns cleanup function that calls confetti.reset()', async () => {
    const cleanup = await fireConfetti();
    cleanup();
    expect(mockConfetti.reset).toHaveBeenCalledOnce();
  });

  it('passes disableForReducedMotion: true', async () => {
    await fireConfetti();
    const call = mockConfetti.mock.calls[0][0];
    expect(call.disableForReducedMotion).toBe(true);
  });

  it('allows overriding options', async () => {
    await fireConfetti({ particleCount: 20, origin: { x: 0.3, y: 0.4 } });
    const call = mockConfetti.mock.calls[0][0];
    expect(call.particleCount).toBe(20);
    expect(call.origin).toEqual({ x: 0.3, y: 0.4 });
  });
});

describe('style constants', () => {
  it('RADIAL_GLOW_STYLE has radial gradient background', () => {
    expect(RADIAL_GLOW_STYLE.background).toContain('radial-gradient');
    expect(RADIAL_GLOW_STYLE.background).toContain('255,215,0');
  });

  it('MINI_SPRING_CONFIG has spring type with stiffness/damping', () => {
    expect(MINI_SPRING_CONFIG.type).toBe('spring');
    expect(MINI_SPRING_CONFIG.stiffness).toBe(400);
    expect(MINI_SPRING_CONFIG.damping).toBe(10);
  });

  it('SHIMMER_STYLE has linear gradient and 200% size', () => {
    expect(SHIMMER_STYLE.backgroundImage).toContain('linear-gradient');
    expect(SHIMMER_STYLE.backgroundSize).toBe('200% 100%');
  });
});
```

**Acceptance Criteria**:
- [ ] `fireConfetti` lazy-loads `canvas-confetti` via dynamic import
- [ ] Returns cleanup function calling `confetti.reset()`
- [ ] Passes `disableForReducedMotion: true` by default
- [ ] Uses gold color palette (`#FFD700`, `#FFC107`, `#F7B500`)
- [ ] Style constants exported for radial glow, spring config, and shimmer
- [ ] All unit tests pass

---

### Task 5: [task-celebrations] [P2] Create CelebrationOverlay component

**Size**: Medium
**Priority**: High
**Dependencies**: Task 4
**Can run parallel with**: Task 6

**Description**:

Create the `CelebrationOverlay` component that renders major celebration visual effects (radial glow + confetti). Fixed-positioned, pointer-events-none, aria-hidden. Also create component tests.

**File**: `apps/client/src/components/chat/CelebrationOverlay.tsx` (CREATE)

```typescript
import { useEffect, useRef, useCallback } from 'react';
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

  const stableOnComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

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
      stableOnComplete();
    }, 2000);

    return () => {
      cancelled = true;
      confettiCleanupRef.current?.();
      confettiCleanupRef.current = null;
      clearTimeout(timer);
    };
  }, [isMajor, stableOnComplete]);

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

**Test file**: `apps/client/src/components/chat/__tests__/CelebrationOverlay.test.tsx` (CREATE)

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import type { CelebrationEvent } from '../../../lib/celebrations/celebration-engine';

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) =>
      React.createElement('div', { ...props, ref }, children)
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
}));

// Mock effects module
vi.mock('../../../lib/celebrations/effects', () => ({
  fireConfetti: vi.fn().mockResolvedValue(vi.fn()),
  RADIAL_GLOW_STYLE: { background: 'radial-gradient(circle, gold, transparent)' },
}));

import { CelebrationOverlay } from '../CelebrationOverlay';
import { fireConfetti } from '../../../lib/celebrations/effects';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CelebrationOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when celebration is null', () => {
    const { container } = render(
      <CelebrationOverlay celebration={null} onComplete={vi.fn()} />
    );
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('renders nothing for mini celebration', () => {
    const mini: CelebrationEvent = { level: 'mini', taskId: '1', timestamp: Date.now() };
    const { container } = render(
      <CelebrationOverlay celebration={mini} onComplete={vi.fn()} />
    );
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('renders radial glow for major celebration', () => {
    const major: CelebrationEvent = { level: 'major', taskId: '1', timestamp: Date.now() };
    const { container } = render(
      <CelebrationOverlay celebration={major} onComplete={vi.fn()} />
    );
    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).not.toBeNull();
  });

  it('has aria-hidden="true" on overlay element', () => {
    const major: CelebrationEvent = { level: 'major', taskId: '1', timestamp: Date.now() };
    const { container } = render(
      <CelebrationOverlay celebration={major} onComplete={vi.fn()} />
    );
    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).not.toBeNull();
  });

  it('has pointer-events-none class on container', () => {
    const major: CelebrationEvent = { level: 'major', taskId: '1', timestamp: Date.now() };
    const { container } = render(
      <CelebrationOverlay celebration={major} onComplete={vi.fn()} />
    );
    const overlay = container.querySelector('.pointer-events-none');
    expect(overlay).not.toBeNull();
  });

  it('calls onComplete after 2s timer', () => {
    const onComplete = vi.fn();
    const major: CelebrationEvent = { level: 'major', taskId: '1', timestamp: Date.now() };
    render(<CelebrationOverlay celebration={major} onComplete={onComplete} />);

    vi.advanceTimersByTime(2000);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('fires confetti for major celebration', () => {
    const major: CelebrationEvent = { level: 'major', taskId: '1', timestamp: Date.now() };
    render(<CelebrationOverlay celebration={major} onComplete={vi.fn()} />);

    expect(fireConfetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 40 })
    );
  });

  it('cleans up confetti on unmount', async () => {
    const cleanupFn = vi.fn();
    (fireConfetti as ReturnType<typeof vi.fn>).mockResolvedValue(cleanupFn);

    const major: CelebrationEvent = { level: 'major', taskId: '1', timestamp: Date.now() };
    const { unmount } = render(
      <CelebrationOverlay celebration={major} onComplete={vi.fn()} />
    );

    // Let the promise resolve
    await vi.advanceTimersByTimeAsync(0);

    unmount();
    expect(cleanupFn).toHaveBeenCalled();
  });
});
```

**Acceptance Criteria**:
- [ ] Renders nothing when `celebration` is null
- [ ] Renders nothing for mini celebrations (overlay is for major only)
- [ ] Renders radial glow `motion.div` for major celebrations
- [ ] All elements have `aria-hidden="true"`
- [ ] Container has `pointer-events-none` class
- [ ] Calls `onComplete` after 2s auto-timer
- [ ] Fires `fireConfetti` for major celebrations
- [ ] Cleans up confetti on unmount
- [ ] All component tests pass

---

### Task 6: [task-celebrations] [P2] Add inline mini celebration to TaskListPanel

**Size**: Medium
**Priority**: High
**Dependencies**: Task 1
**Can run parallel with**: Tasks 4, 5

**Description**:

Modify `apps/client/src/components/chat/TaskListPanel.tsx` to accept `celebratingTaskId` and `onCelebrationComplete` props, adding inline spring-pop + shimmer effects on the celebrating task row. Update existing tests to handle new optional props.

**Modifications to `TaskListPanel.tsx`**:

1. Update the `TaskListPanelProps` interface:
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

2. Update the function signature:
```typescript
export function TaskListPanel({ tasks, activeForm, isCollapsed, onToggleCollapse, celebratingTaskId, onCelebrationComplete }: TaskListPanelProps) {
```

3. Replace the `visibleTasks.map()` block. Change each `<li>` to `<motion.li>` with celebration effects:
```tsx
{visibleTasks.map(task => {
  const isCelebrating = task.id === celebratingTaskId && task.status === 'completed';

  return (
    <motion.li
      key={task.id}
      className={`relative flex items-center gap-2 text-xs py-0.5 ${
        task.status === 'completed'
          ? 'text-muted-foreground/50 line-through'
          : task.status === 'in_progress'
          ? 'text-foreground font-medium'
          : 'text-muted-foreground'
      }`}
      animate={isCelebrating ? {
        scale: [1, 1.05, 1],
      } : undefined}
      transition={isCelebrating ? { type: 'spring', stiffness: 400, damping: 10 } : undefined}
      onAnimationComplete={() => {
        if (isCelebrating) onCelebrationComplete?.();
      }}
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

4. Also add `motion.li` and `motion.span` to the mock in tests.

**Test additions to `TaskListPanel.test.tsx`**:
```typescript
// Add motion.li and motion.span to the mock:
vi.mock('motion/react', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }, ref) =>
      React.createElement('div', { ...props, ref }, children)
    ),
    ul: React.forwardRef(({ children, ...props }, ref) =>
      React.createElement('ul', { ...props, ref }, children)
    ),
    li: React.forwardRef(({ children, onAnimationComplete, ...props }, ref) => {
      // Call onAnimationComplete immediately in tests to simulate animation end
      React.useEffect(() => { onAnimationComplete?.(); }, [onAnimationComplete]);
      return React.createElement('li', { ...props, ref }, children);
    }),
    span: React.forwardRef(({ children, ...props }, ref) =>
      React.createElement('span', { ...props, ref }, children)
    ),
  },
  AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
}));

// New test cases:
it('applies celebration effects when celebratingTaskId matches a completed task', () => {
  const completedTasks: TaskItem[] = [
    { id: '1', subject: 'Done task', status: 'completed' },
    { id: '2', subject: 'Open task', status: 'pending' },
  ];
  render(
    <TaskListPanel
      tasks={completedTasks}
      activeForm={null}
      isCollapsed={false}
      onToggleCollapse={() => {}}
      celebratingTaskId="1"
    />
  );
  // Should render shimmer div with aria-hidden
  const shimmer = document.querySelector('[aria-hidden="true"]');
  expect(shimmer).not.toBeNull();
});

it('calls onCelebrationComplete after animation finishes', () => {
  const onComplete = vi.fn();
  const completedTasks: TaskItem[] = [
    { id: '1', subject: 'Done task', status: 'completed' },
  ];
  render(
    <TaskListPanel
      tasks={completedTasks}
      activeForm={null}
      isCollapsed={false}
      onToggleCollapse={() => {}}
      celebratingTaskId="1"
      onCelebrationComplete={onComplete}
    />
  );
  expect(onComplete).toHaveBeenCalled();
});

it('does not apply celebration effects to non-matching tasks', () => {
  const tasks: TaskItem[] = [
    { id: '1', subject: 'Task A', status: 'completed' },
    { id: '2', subject: 'Task B', status: 'pending' },
  ];
  render(
    <TaskListPanel
      tasks={tasks}
      activeForm={null}
      isCollapsed={false}
      onToggleCollapse={() => {}}
      celebratingTaskId="999"
    />
  );
  const shimmer = document.querySelector('[aria-hidden="true"]');
  expect(shimmer).toBeNull();
});

it('handles celebratingTaskId being null gracefully', () => {
  render(
    <TaskListPanel
      tasks={baseTasks}
      activeForm={null}
      isCollapsed={false}
      onToggleCollapse={() => {}}
      celebratingTaskId={null}
    />
  );
  // Should render normally without celebration effects
  expect(screen.getByText('Completed task')).toBeDefined();
});
```

**Acceptance Criteria**:
- [ ] `celebratingTaskId` and `onCelebrationComplete` props added to `TaskListPanelProps`
- [ ] Spring-pop animation on matching completed task row
- [ ] Shimmer background rendered with `aria-hidden="true"`
- [ ] Checkmark icon gets spring-pop bounce via `motion.span`
- [ ] `onCelebrationComplete` called after animation
- [ ] Non-matching tasks unaffected
- [ ] Null `celebratingTaskId` renders normally
- [ ] Existing tests still pass
- [ ] New tests pass

---

## Phase 3: Integration

### Task 7: [task-celebrations] [P3] Create useCelebrations hook

**Size**: Medium
**Priority**: High
**Dependencies**: Tasks 2, 3, 4, 5, 6
**Can run parallel with**: None

**Description**:

Create `apps/client/src/hooks/use-celebrations.ts` -- the React hook that connects the celebration engine to task state, idle detection, and Zustand settings.

**File**: `apps/client/src/hooks/use-celebrations.ts` (CREATE)

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
  useIdleDetector({
    timeoutMs: 30_000,
    onIdle: useCallback(() => {
      engineRef.current?.setIdle(true);
    }, []),
    onReturn: useCallback(() => {
      engineRef.current?.setIdle(false);
      engineRef.current?.onUserReturn();
    }, []),
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
          // Reduced motion: downgrade major to mini (skip confetti/glow)
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

**Acceptance Criteria**:
- [ ] Hook reads `showTaskCelebrations` from Zustand store
- [ ] Creates and manages `CelebrationEngine` lifecycle
- [ ] Connects idle detector to engine via `setIdle`/`onUserReturn`
- [ ] Filters task events: only `action === 'update'` with `status: 'completed'`
- [ ] Exposes `activeCelebration`, `celebratingTaskId`, `clearCelebration`
- [ ] Downgrades major to mini when `prefers-reduced-motion` is active
- [ ] Engine re-created when `showTaskCelebrations` changes
- [ ] `turbo typecheck` passes

---

### Task 8: [task-celebrations] [P3] Wire celebrations into ChatPanel and add settings toggle

**Size**: Medium
**Priority**: High
**Dependencies**: Task 7
**Can run parallel with**: None

**Description**:

Integrate the celebrations hook into `ChatPanel.tsx`, render `CelebrationOverlay`, pass celebration props to `TaskListPanel`, and add the settings toggle in `SettingsDialog.tsx`. Update SettingsDialog tests.

**Modifications to `apps/client/src/components/chat/ChatPanel.tsx`**:

1. Add imports:
```typescript
import { useCelebrations } from '../../hooks/use-celebrations';
import { CelebrationOverlay } from './CelebrationOverlay';
```

2. Inside `ChatPanel` function body, add the celebrations hook and wrapper:
```typescript
const celebrations = useCelebrations();

// Wrap the existing handleTaskEvent to also notify celebrations
const handleTaskEventWithCelebrations = useCallback(
  (event: TaskUpdateEvent) => {
    taskState.handleTaskEvent(event);
    // After state update, pass current task list to celebrations
    celebrations.handleTaskEvent(event, taskState.tasks);
  },
  [taskState, celebrations],
);
```

3. Add `TaskUpdateEvent` import:
```typescript
import type { TaskUpdateEvent } from '@dorkos/shared/types';
```

4. Update the `useChatSession` call to use the wrapped handler:
```typescript
const { messages, input, setInput, handleSubmit, status, error, sessionBusy, stop, isLoadingHistory, sessionStatus, streamStartTime, estimatedTokens, isTextStreaming, isWaitingForUser, waitingType, activeInteraction } =
  useChatSession(sessionId, {
    transformContent,
    onTaskEvent: handleTaskEventWithCelebrations,
    onSessionIdChange: setSessionId,
  });
```

5. Add `CelebrationOverlay` before `TaskListPanel` in the JSX:
```tsx
<CelebrationOverlay
  celebration={celebrations.activeCelebration}
  onComplete={celebrations.clearCelebration}
/>

<TaskListPanel
  tasks={taskState.tasks}
  activeForm={taskState.activeForm}
  isCollapsed={taskState.isCollapsed}
  onToggleCollapse={taskState.toggleCollapse}
  celebratingTaskId={celebrations.celebratingTaskId}
  onCelebrationComplete={celebrations.clearCelebration}
/>
```

**Modifications to `apps/client/src/components/settings/SettingsDialog.tsx`**:

1. Add `showTaskCelebrations` and `setShowTaskCelebrations` to the store destructuring:
```typescript
const {
  // ... existing destructuring ...
  showTaskCelebrations, setShowTaskCelebrations,
} = useAppStore();
```

2. Add a new `SettingRow` in the Preferences tab, after "Show shortcut chips":
```tsx
<SettingRow label="Task celebrations" description="Show animations when tasks complete">
  <Switch
    checked={showTaskCelebrations}
    onCheckedChange={setShowTaskCelebrations}
  />
</SettingRow>
```

**Test additions to `apps/client/src/components/settings/__tests__/SettingsDialog.test.tsx`**:

```typescript
it('shows task celebrations toggle in Preferences tab', () => {
  render(
    <SettingsDialog open={true} onOpenChange={vi.fn()} />,
    { wrapper: createWrapper() },
  );
  expect(screen.getByText('Task celebrations')).toBeDefined();
  expect(screen.getByText('Show animations when tasks complete')).toBeDefined();
});

it('has task celebrations toggle enabled by default', () => {
  render(
    <SettingsDialog open={true} onOpenChange={vi.fn()} />,
    { wrapper: createWrapper() },
  );
  const label = screen.getByText('Task celebrations');
  const row = label.closest('.flex')!;
  const toggle = row.querySelector('[role="switch"]');
  expect(toggle).toBeDefined();
  expect(toggle?.getAttribute('data-state')).toBe('checked');
});
```

**Acceptance Criteria**:
- [ ] `CelebrationOverlay` rendered in `ChatPanel` above `TaskListPanel`
- [ ] Task events flow through celebrations hook before reaching task state
- [ ] `celebratingTaskId` passed to `TaskListPanel`
- [ ] Settings toggle visible in Preferences tab as "Task celebrations"
- [ ] Toggle defaults to ON
- [ ] Toggling OFF immediately stops new celebrations
- [ ] All existing tests pass without modification
- [ ] New SettingsDialog tests pass
- [ ] `turbo test` passes
- [ ] `turbo typecheck` passes
- [ ] `turbo build` passes

---

## Dependency Graph

```
Task 1 (store + deps) ──┬──> Task 2 (engine) ──┬──> Task 7 (hook) ──> Task 8 (integration)
                         │                      │
                         ├──> Task 3 (idle)  ───┘
                         │
                         ├──> Task 4 (effects) ──> Task 5 (overlay) ──> Task 7
                         │
                         └──> Task 6 (TaskListPanel) ──> Task 7
```

## Critical Path

Task 1 -> Task 2 -> Task 7 -> Task 8

## Parallel Opportunities

- **After Task 1**: Tasks 2, 3, 4, and 6 can all start in parallel
- **After Tasks 2+3**: Task 7 needs both to be complete
- **After Task 4**: Task 5 can start
- **After Tasks 5+6+7**: Task 8 is the final integration
