import { useAutoRelativeTime } from '../model/use-auto-relative-time';

/** Auto-updating relative time display with semantic HTML and full timestamp tooltip. */
export function RelativeTime({ dateStr }: { dateStr: string }) {
  const relativeLabel = useAutoRelativeTime(dateStr);
  const date = new Date(dateStr);

  return (
    <time
      dateTime={date.toISOString()}
      title={date.toLocaleString()}
      className="text-muted-foreground text-xs"
    >
      {relativeLabel}
    </time>
  );
}
