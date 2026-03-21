/**
 * Format an ISO timestamp as a compact relative time string.
 *
 * @param iso - ISO 8601 timestamp string
 * @returns Relative time like "5m", "2h", or "3d"
 */
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
