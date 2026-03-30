/**
 * Lightweight task feature state registry.
 *
 * Holds the runtime enabled/disabled state of the Task scheduler so that
 * the config route can report it without a circular dependency on index.ts.
 * Set once during server startup by `index.ts` when the scheduler is
 * initialized.
 *
 * @module services/task-state
 */
import { createFeatureFlag } from '../../lib/feature-flag.js';

const taskFlag = createFeatureFlag();

/** Mark the Task scheduler as enabled or disabled. */
export const setTasksEnabled = taskFlag.setEnabled;

/** Return whether the Task scheduler is currently enabled. */
export const isTasksEnabled = taskFlag.isEnabled;

/** Record why Tasks failed to initialize. */
export const setTasksInitError = taskFlag.setInitError;

/** Return the initialization error message, if any. */
export const getTasksInitError = taskFlag.getInitError;
