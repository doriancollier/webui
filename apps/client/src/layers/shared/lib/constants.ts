/** Client-only constants — localStorage keys, font scales, and UI limits. */

export const STORAGE_KEYS = {
  FONT_SIZE: 'dorkos-font-size',
  FONT_FAMILY: 'dorkos-font-family',
  RECENT_CWDS: 'dorkos-recent-cwds',
  PICKER_VIEW: 'dorkos-picker-view',
  GESTURE_HINT_COUNT: 'dorkos-gesture-hint-count',
} as const;

export const FONT_SCALE_MAP: Record<'small' | 'medium' | 'large', string> = {
  small: '0.9',
  medium: '1',
  large: '1.15',
};

export const MAX_RECENT_CWDS = 10;
