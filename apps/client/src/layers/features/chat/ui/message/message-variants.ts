import { tv } from 'tailwind-variants';

/**
 * Multi-slot variant definition for MessageItem layout and styling.
 *
 * Slots: root, leading, content, timestamp, divider.
 * Variants: role (user/assistant), position (first/middle/last/only), density (comfortable/compact).
 */
export const messageItem = tv({
  slots: {
    root: 'group relative flex gap-[var(--msg-gap)] px-[var(--msg-padding-x)] transition-colors duration-150',
    leading: 'mt-[3px] w-[var(--msg-leading-width)] flex-shrink-0',
    content: 'max-w-[var(--msg-content-max-width)] min-w-0 flex-1 text-sm',
    timestamp: 'absolute top-1 right-4 hidden text-xs transition-colors duration-150 sm:inline',
    divider: 'absolute inset-x-0 top-0 h-px bg-[var(--msg-divider-color)]',
  },
  variants: {
    role: {
      user: {
        root: 'bg-user-msg hover:bg-user-msg/90',
        content: 'font-[var(--msg-user-font-weight)]',
      },
      assistant: {
        root: 'hover:bg-muted/20',
        content: 'font-[var(--msg-assistant-font-weight)]',
      },
    },
    position: {
      first: { root: 'pt-[var(--msg-padding-y-start)] pb-[var(--msg-padding-y-mid)]' },
      middle: { root: 'pt-[var(--msg-padding-y-mid)] pb-[var(--msg-padding-y-mid)]' },
      last: { root: 'pt-[var(--msg-padding-y-mid)] pb-[var(--msg-padding-y-end)]' },
      only: { root: 'pt-[var(--msg-padding-y-start)] pb-[var(--msg-padding-y-end)]' },
    },
    density: {
      comfortable: {},
      compact: {
        root: 'px-3',
        content: 'text-xs',
      },
    },
  },
  defaultVariants: {
    role: 'assistant',
    position: 'only',
    density: 'comfortable',
  },
});

/**
 * Variant for tool call status icon coloring.
 * Maps tool execution state to semantic status token classes.
 */
export const toolStatus = tv({
  variants: {
    status: {
      pending: 'text-status-pending',
      running: 'text-status-info',
      complete: 'text-status-success',
      error: 'text-status-error',
    },
  },
});

/**
 * Variant for tool approval state styling.
 * Maps approval lifecycle state to semantic border/background/text classes.
 */
export const approvalState = tv({
  variants: {
    state: {
      pending: 'border-status-warning-border bg-status-warning-bg',
      approved: 'border-status-success-border bg-status-success-bg text-status-success-fg',
      denied: 'border-status-error-border bg-status-error-bg text-status-error-fg',
    },
  },
});
