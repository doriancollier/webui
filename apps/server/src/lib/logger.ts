import { createConsola, type LogObject } from 'consola';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Central logger module for DorkOS server.
 *
 * Provides a singleton logger backed by consola. Before `initLogger()` is called,
 * the logger outputs to console only at info level. After `initLogger()`, it also
 * appends structured NDJSON entries to `{DORK_HOME}/logs/dorkos.log` with automatic
 * daily rotation and configurable size-based rotation.
 *
 * @module lib/logger
 */

const DEFAULT_MAX_LOG_SIZE = 500 * 1024; // 500KB
const DEFAULT_MAX_LOG_FILES = 14;

// Module-scoped mutable state, set by initLogger()
let logDir: string | undefined;
let logFile: string | undefined;
let maxLogSize = DEFAULT_MAX_LOG_SIZE;
let maxLogFiles = DEFAULT_MAX_LOG_FILES;

/**
 * Create an NDJSON file reporter that appends structured log entries to disk.
 */
function createFileReporter() {
  return {
    log(logObj: LogObject) {
      if (!logFile) return;

      // Separate structured context objects from string message parts
      let context: Record<string, unknown> | undefined;
      const msgParts: string[] = [];
      for (const arg of logObj.args) {
        if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
          context = arg as Record<string, unknown>;
        } else {
          msgParts.push(String(arg));
        }
      }

      const entry = JSON.stringify({
        level: logObj.type,
        time: logObj.date.toISOString(),
        msg: msgParts.join(' '),
        tag: logObj.tag || undefined,
        ...context,
      });
      fs.appendFileSync(logFile, entry + '\n');
    },
  };
}

/** Format a date as YYYY-MM-DD. */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Rotate log file using dual triggers: date change and size threshold.
 *
 * - If `dorkos.log` mtime is from a previous day, rename to `dorkos.YYYY-MM-DD.log`
 * - If `dorkos.log` exceeds maxLogSize, rename to `dorkos.YYYY-MM-DD.N.log`
 * - Cleanup: delete rotated files beyond maxLogFiles
 *
 * Errors during rotation are silently ignored to avoid crashing on startup.
 */
function rotateIfNeeded(): void {
  if (!logDir || !logFile) return;

  try {
    const stat = fs.statSync(logFile);
    const today = formatDate(new Date());
    const fileDate = formatDate(stat.mtime);
    let rotated = false;

    if (fileDate !== today) {
      // Date rotation: file is from a previous day
      const target = path.join(logDir, `dorkos.${fileDate}.log`);
      if (!fs.existsSync(target)) {
        fs.renameSync(logFile, target);
      } else {
        // Date file exists — find next sequence number
        const seq = nextSequenceNumber(fileDate);
        fs.renameSync(logFile, path.join(logDir, `dorkos.${fileDate}.${seq}.log`));
      }
      rotated = true;
    } else if (stat.size > maxLogSize) {
      // Size rotation within same day
      const seq = nextSequenceNumber(today);
      fs.renameSync(logFile, path.join(logDir, `dorkos.${today}.${seq}.log`));
      rotated = true;
    }

    if (rotated) {
      cleanupOldFiles();
    }
  } catch {
    // File doesn't exist yet or rotation failed — continue
  }
}

/** Find the next sequence number for a given date's rotated files. */
function nextSequenceNumber(date: string): number {
  if (!logDir) return 1;
  try {
    const files = fs.readdirSync(logDir);
    const pattern = new RegExp(`^dorkos\\.${date}\\.(\\d+)\\.log$`);
    let max = 0;
    for (const f of files) {
      const m = f.match(pattern);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
  } catch {
    return 1;
  }
}

/** Delete rotated log files beyond maxLogFiles. */
function cleanupOldFiles(): void {
  if (!logDir) return;
  try {
    const files = fs
      .readdirSync(logDir)
      .filter((f) => /^dorkos\.\d{4}-\d{2}-\d{2}(\.\d+)?\.log$/.test(f))
      .sort()
      .reverse();
    for (const old of files.slice(maxLogFiles)) {
      fs.unlinkSync(path.join(logDir, old));
    }
  } catch {
    // Cleanup failure is non-fatal
  }
}

/** Default logger instance (console-only until initLogger is called). */
export let logger = createConsola({
  level: 3, // info
});

/**
 * Initialize the logger with file persistence and configured log level.
 * Call once at server startup after config is loaded.
 *
 * @param options - Optional configuration
 * @param options.level - Numeric log level (0=fatal … 5=trace). Defaults to 4 (debug) in dev, 3 (info) in production.
 * @param options.logDir - Log directory path. Defaults to `{DORK_HOME}/logs`.
 * @param options.maxLogSize - Max log file size in bytes before rotation. Defaults to 500KB.
 * @param options.maxLogFiles - Max number of rotated log files to retain. Defaults to 14.
 */
export function initLogger(options?: {
  level?: number;
  logDir?: string;
  maxLogSize?: number;
  maxLogFiles?: number;
}): void {
  logDir = options?.logDir ?? path.join(process.env.DORK_HOME ?? path.join(os.homedir(), '.dork'), 'logs');
  logFile = path.join(logDir, 'dorkos.log');
  maxLogSize = options?.maxLogSize ?? DEFAULT_MAX_LOG_SIZE;
  maxLogFiles = options?.maxLogFiles ?? DEFAULT_MAX_LOG_FILES;

  fs.mkdirSync(logDir, { recursive: true });
  rotateIfNeeded();

  const level = options?.level ?? (process.env.NODE_ENV === 'production' ? 3 : 4);

  logger = createConsola({ level });
  logger.addReporter(createFileReporter());
}

/** Get the resolved log directory path. Returns undefined if initLogger hasn't been called. */
export function getLogDir(): string | undefined {
  return logDir;
}

/** Create a child logger with a consistent component tag for NDJSON `tag` field. */
export function createTaggedLogger(tag: string) {
  return logger.withTag(tag);
}

/** Extract structured error fields for consistent NDJSON logging. */
export function logError(err: unknown): { error: string; stack?: string } {
  if (err instanceof Error) return { error: err.message, stack: err.stack };
  return { error: String(err) };
}
