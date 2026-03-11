/** Frequency options for the simple schedule builder. */
export type Frequency = '15m' | 'hourly' | 'daily' | 'weekly' | 'monthly';

/** Configuration for the simple schedule mode. */
export interface SimpleConfig {
  frequency: Frequency;
  /** Hour of the day (0-23). */
  hour: number;
  /** Days of the week (0=Sun, 1=Mon, ..., 6=Sat) — used for weekly. */
  days: number[];
  /** Day of the month (1-31) — used for monthly. */
  dayOfMonth: number;
}

const DEFAULT_CONFIG: SimpleConfig = {
  frequency: 'daily',
  hour: 9,
  days: [1, 2, 3, 4, 5],
  dayOfMonth: 1,
};

/**
 * @internal Exported for testing only.
 * Parse a cron expression into a SimpleConfig, or null if not representable.
 */
export function parseCronToSimple(cron: string): SimpleConfig | null {
  const trimmed = cron.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Month must be wildcard for simple mode
  if (month !== '*') return null;

  // Every 15 minutes: */15 * * * *
  if (minute === '*/15' && hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
    return { ...DEFAULT_CONFIG, frequency: '15m' };
  }

  // All other simple patterns require minute=0
  if (minute !== '0') return null;

  // Hourly: 0 * * * *
  if (hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
    return { ...DEFAULT_CONFIG, frequency: 'hourly' };
  }

  // Hour must be a single number for remaining patterns
  const h = Number(hour);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;

  // Monthly: 0 H D * *
  if (dayOfMonth !== '*' && dayOfWeek === '*') {
    const dom = Number(dayOfMonth);
    if (!Number.isInteger(dom) || dom < 1 || dom > 31) return null;
    return { ...DEFAULT_CONFIG, frequency: 'monthly', hour: h, dayOfMonth: dom };
  }

  // Daily: 0 H * * *
  if (dayOfMonth === '*' && dayOfWeek === '*') {
    return { ...DEFAULT_CONFIG, frequency: 'daily', hour: h };
  }

  // Weekly: 0 H * * D,D,... or 0 H * * D-D
  if (dayOfMonth === '*' && dayOfWeek !== '*') {
    const days = parseDayOfWeek(dayOfWeek);
    if (!days) return null;
    return { ...DEFAULT_CONFIG, frequency: 'weekly', hour: h, days };
  }

  return null;
}

/** Parse day-of-week field into sorted array of day numbers, or null if invalid. */
function parseDayOfWeek(field: string): number[] | null {
  const days: number[] = [];

  for (const part of field.split(',')) {
    const rangeMatch = part.match(/^(\d)-(\d)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start > 6 || end > 6 || start > end) return null;
      for (let i = start; i <= end; i++) days.push(i);
    } else {
      const d = Number(part);
      if (!Number.isInteger(d) || d < 0 || d > 6) return null;
      days.push(d);
    }
  }

  return days.length > 0 ? days.sort((a, b) => a - b) : null;
}

/**
 * @internal Exported for testing only.
 * Build a cron expression from a SimpleConfig.
 */
export function buildCron(config: SimpleConfig): string {
  switch (config.frequency) {
    case '15m':
      return '*/15 * * * *';
    case 'hourly':
      return '0 * * * *';
    case 'daily':
      return `0 ${config.hour} * * *`;
    case 'weekly':
      return `0 ${config.hour} * * ${config.days.join(',')}`;
    case 'monthly':
      return `0 ${config.hour} ${config.dayOfMonth} * *`;
  }
}

/**
 * @internal Exported for testing only.
 * Format a 24-hour number as a 12-hour time string.
 */
export function formatHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 || 12;
  return `${h}:00 ${period}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

/** Format an ordinal number (1st, 2nd, 3rd, 4th, ..., 11th, 12th, 21st, etc.) */
function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/** Check if two sorted arrays are equal. */
function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * @internal Exported for testing only.
 * Generate a human-readable preview of a SimpleConfig.
 */
export function getSimplePreview(config: SimpleConfig): string {
  const time = formatHour(config.hour);

  switch (config.frequency) {
    case '15m':
      return 'Runs every 15 minutes';
    case 'hourly':
      return 'Runs every hour, on the hour';
    case 'daily':
      return `Runs every day at ${time}`;
    case 'weekly': {
      const sorted = [...config.days].sort((a, b) => a - b);
      if (arraysEqual(sorted, WEEKDAYS)) return `Runs every weekday at ${time}`;
      if (arraysEqual(sorted, WEEKEND)) {
        return `Runs every Saturday and Sunday at ${time}`;
      }
      // Sort in display order: Mon(1)→Sun(0) — put 0 at the end
      const displayOrder = sorted.filter((d) => d !== 0).concat(sorted.includes(0) ? [0] : []);
      const names = displayOrder.map((d) => DAY_NAMES[d]);
      if (names.length === 1) return `Runs every ${names[0]} at ${time}`;
      if (names.length === 2) return `Runs every ${names[0]} and ${names[1]} at ${time}`;
      const last = names.pop()!;
      return `Runs every ${names.join(', ')}, and ${last} at ${time}`;
    }
    case 'monthly':
      return `Runs on the ${ordinal(config.dayOfMonth)} of every month at ${time}`;
  }
}
