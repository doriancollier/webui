/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  parseCronToSimple,
  buildCron,
  formatHour,
  getSimplePreview,
} from '../ui/ScheduleBuilder';

describe('parseCronToSimple', () => {
  it('parses every-15-minutes cron', () => {
    expect(parseCronToSimple('*/15 * * * *')).toEqual({
      frequency: '15m',
      hour: 9,
      days: [1, 2, 3, 4, 5],
      dayOfMonth: 1,
    });
  });

  it('parses hourly cron', () => {
    expect(parseCronToSimple('0 * * * *')).toEqual({
      frequency: 'hourly',
      hour: 9,
      days: [1, 2, 3, 4, 5],
      dayOfMonth: 1,
    });
  });

  it('parses daily cron at specific hour', () => {
    expect(parseCronToSimple('0 14 * * *')).toEqual({
      frequency: 'daily',
      hour: 14,
      days: [1, 2, 3, 4, 5],
      dayOfMonth: 1,
    });
  });

  it('parses weekly cron with comma-separated days', () => {
    expect(parseCronToSimple('0 9 * * 1,3,5')).toEqual({
      frequency: 'weekly',
      hour: 9,
      days: [1, 3, 5],
      dayOfMonth: 1,
    });
  });

  it('parses weekly cron with day range', () => {
    expect(parseCronToSimple('0 9 * * 1-5')).toEqual({
      frequency: 'weekly',
      hour: 9,
      days: [1, 2, 3, 4, 5],
      dayOfMonth: 1,
    });
  });

  it('parses monthly cron', () => {
    expect(parseCronToSimple('0 9 15 * *')).toEqual({
      frequency: 'monthly',
      hour: 9,
      days: [1, 2, 3, 4, 5],
      dayOfMonth: 15,
    });
  });

  it('returns null for non-simple frequencies', () => {
    expect(parseCronToSimple('0 */6 * * *')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCronToSimple('')).toBeNull();
  });

  it('returns null for expressions with too many fields', () => {
    expect(parseCronToSimple('0 9 * * 1-5 extra')).toBeNull();
  });

  it('returns null for step values in minute field', () => {
    expect(parseCronToSimple('*/5 * * * *')).toBeNull();
  });

  it('returns null when month field is not wildcard', () => {
    expect(parseCronToSimple('0 9 * 6 *')).toBeNull();
  });
});

describe('buildCron', () => {
  it('builds 15m cron', () => {
    expect(buildCron({ frequency: '15m', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 1 }))
      .toBe('*/15 * * * *');
  });

  it('builds hourly cron', () => {
    expect(buildCron({ frequency: 'hourly', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 1 }))
      .toBe('0 * * * *');
  });

  it('builds daily cron at specific hour', () => {
    expect(buildCron({ frequency: 'daily', hour: 14, days: [1, 2, 3, 4, 5], dayOfMonth: 1 }))
      .toBe('0 14 * * *');
  });

  it('builds weekly cron with specific days', () => {
    expect(buildCron({ frequency: 'weekly', hour: 9, days: [1, 3, 5], dayOfMonth: 1 }))
      .toBe('0 9 * * 1,3,5');
  });

  it('builds monthly cron', () => {
    expect(buildCron({ frequency: 'monthly', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 15 }))
      .toBe('0 9 15 * *');
  });
});

describe('formatHour', () => {
  it('formats midnight as 12:00 AM', () => {
    expect(formatHour(0)).toBe('12:00 AM');
  });

  it('formats morning hour', () => {
    expect(formatHour(9)).toBe('9:00 AM');
  });

  it('formats noon as 12:00 PM', () => {
    expect(formatHour(12)).toBe('12:00 PM');
  });

  it('formats afternoon hour', () => {
    expect(formatHour(13)).toBe('1:00 PM');
  });

  it('formats late night hour', () => {
    expect(formatHour(23)).toBe('11:00 PM');
  });
});

describe('getSimplePreview', () => {
  it('previews 15m frequency', () => {
    expect(getSimplePreview({ frequency: '15m', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 1 }))
      .toBe('Runs every 15 minutes');
  });

  it('previews hourly frequency', () => {
    expect(getSimplePreview({ frequency: 'hourly', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 1 }))
      .toBe('Runs every hour, on the hour');
  });

  it('previews daily frequency', () => {
    expect(getSimplePreview({ frequency: 'daily', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 1 }))
      .toBe('Runs every day at 9:00 AM');
  });

  it('previews weekly Mon-Fri as weekday', () => {
    expect(getSimplePreview({ frequency: 'weekly', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 1 }))
      .toBe('Runs every weekday at 9:00 AM');
  });

  it('previews weekly Sat-Sun as weekend', () => {
    expect(getSimplePreview({ frequency: 'weekly', hour: 10, days: [0, 6], dayOfMonth: 1 }))
      .toBe('Runs every Saturday and Sunday at 10:00 AM');
  });

  it('previews weekly with specific days', () => {
    expect(getSimplePreview({ frequency: 'weekly', hour: 9, days: [1, 3, 5], dayOfMonth: 1 }))
      .toBe('Runs every Monday, Wednesday, and Friday at 9:00 AM');
  });

  it('previews monthly with ordinal suffix st', () => {
    expect(getSimplePreview({ frequency: 'monthly', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 1 }))
      .toBe('Runs on the 1st of every month at 9:00 AM');
  });

  it('previews monthly with ordinal suffix nd', () => {
    expect(getSimplePreview({ frequency: 'monthly', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 2 }))
      .toBe('Runs on the 2nd of every month at 9:00 AM');
  });

  it('previews monthly with ordinal suffix rd', () => {
    expect(getSimplePreview({ frequency: 'monthly', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 3 }))
      .toBe('Runs on the 3rd of every month at 9:00 AM');
  });

  it('previews monthly with ordinal suffix th for teens', () => {
    expect(getSimplePreview({ frequency: 'monthly', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 11 }))
      .toBe('Runs on the 11th of every month at 9:00 AM');
  });

  it('previews monthly 21st with ordinal suffix st', () => {
    expect(getSimplePreview({ frequency: 'monthly', hour: 9, days: [1, 2, 3, 4, 5], dayOfMonth: 21 }))
      .toBe('Runs on the 21st of every month at 9:00 AM');
  });
});
