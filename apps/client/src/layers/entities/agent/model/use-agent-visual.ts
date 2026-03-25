import { useMemo } from 'react';
import { hashToHslColor, hashToEmoji } from '@/layers/shared/lib/favicon-utils';
import {
  resolveAgentVisual,
  type AgentVisualSource,
  type AgentVisual,
} from '@/layers/shared/lib/resolve-agent-visual';

// Re-export so consumers can import types from this module or the entity barrel.
export { resolveAgentVisual, type AgentVisual, type AgentVisualSource };

/**
 * React hook wrapper for {@link resolveAgentVisual} with memoization.
 *
 * When an agent is present, resolves from agent overrides/id.
 * When no agent is registered (null/undefined), falls back to hashing from cwd.
 *
 * @param agent - Agent data, or null/undefined if unregistered directory
 * @param cwd - Current working directory (fallback hash source when no agent)
 */
export function useAgentVisual(
  agent: AgentVisualSource | null | undefined,
  cwd: string
): AgentVisual {
  return useMemo(() => {
    if (agent) {
      return resolveAgentVisual(agent);
    }
    return {
      color: hashToHslColor(cwd),
      emoji: hashToEmoji(cwd),
    };
  }, [agent, cwd]);
}
