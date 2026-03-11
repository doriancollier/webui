/** Tailwind class map for adapter category badges. */
export const ADAPTER_CATEGORY_COLORS: Record<string, string> = {
  messaging: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  automation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  internal: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  custom: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

/**
 * Returns the Tailwind badge classes for a given adapter category.
 * Falls back to empty string for unknown categories.
 *
 * @param category - Adapter category string
 */
export function getCategoryColorClasses(category: string): string {
  return ADAPTER_CATEGORY_COLORS[category] ?? '';
}
