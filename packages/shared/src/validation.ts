/**
 * Shared validation utilities for agent names and identifiers.
 *
 * @module shared/validation
 */

/**
 * Regex for valid agent names: kebab-case, 1-64 chars, starts with a letter.
 *
 * Rules:
 * - Lowercase letters, digits, and hyphens only
 * - Must start with a lowercase letter
 * - Must end with a lowercase letter or digit (unless single char)
 * - 1-64 characters
 * - Prevents path traversal (no `.`, `/`, `\`, `_`)
 */
export const AGENT_NAME_REGEX = /^[a-z][a-z0-9-]{0,62}[a-z0-9]$|^[a-z]$/;

/**
 * Validate an agent name string and return a structured result.
 *
 * @param name - The candidate agent name to validate
 * @returns Object with `valid` boolean and optional `error` message
 */
export function validateAgentName(name: string): { valid: boolean; error?: string } {
  if (!name) return { valid: false, error: 'Name is required' };
  if (name.length > 64) return { valid: false, error: 'Name must be 64 characters or less' };
  if (!AGENT_NAME_REGEX.test(name)) {
    return {
      valid: false,
      error: 'Lowercase letters, numbers, and hyphens only. Must start with a letter.',
    };
  }
  return { valid: true };
}
