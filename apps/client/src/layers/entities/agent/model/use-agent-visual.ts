import { useMemo } from 'react';
import { hashToHslColor, hashToEmoji } from '@/layers/shared/lib/favicon-utils';
import type { AgentManifest } from '@dorkos/shared/mesh-schemas';

export interface AgentVisual {
  /** CSS color string (HSL or user override) */
  color: string;
  /** Single emoji character */
  emoji: string;
}

/**
 * Single source of truth for agent visual identity.
 *
 * Priority:
 * 1. Agent has color/icon override -> use override
 * 2. Agent exists (no override) -> hash from agent.id (stable across CWD renames)
 * 3. No agent -> hash from CWD (current behavior, unchanged)
 *
 * @param agent - Agent manifest, or null/undefined if unregistered directory
 * @param cwd - Current working directory (fallback hash source)
 */
export function useAgentVisual(agent: AgentManifest | null | undefined, cwd: string): AgentVisual {
  return useMemo(() => {
    if (agent) {
      const hashSource = agent.id;
      return {
        color: agent.color ?? hashToHslColor(hashSource),
        emoji: agent.icon ?? hashToEmoji(hashSource),
      };
    }
    return {
      color: hashToHslColor(cwd),
      emoji: hashToEmoji(cwd),
    };
  }, [agent, cwd]);
}
