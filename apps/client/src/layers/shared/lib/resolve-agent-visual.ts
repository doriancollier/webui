import { hashToHslColor, hashToEmoji } from './favicon-utils';

/** Minimal shape needed to resolve agent visual identity. */
export interface AgentVisualSource {
  id: string;
  color?: string | null;
  icon?: string | null;
}

/** Resolved visual identity for an agent. */
export interface AgentVisual {
  /** CSS color string (HSL or user override) */
  color: string;
  /** Single emoji character */
  emoji: string;
}

/**
 * Resolve agent visual identity from overrides or deterministic hash fallback.
 *
 * Priority: agent.color/icon override -> hash from agent.id.
 * Pure function — no React dependency. Use directly in non-hook contexts
 * (topology builders, command palette items, pickers, etc.).
 */
export function resolveAgentVisual(agent: AgentVisualSource): AgentVisual {
  return {
    color: agent.color ?? hashToHslColor(agent.id),
    emoji: agent.icon ?? hashToEmoji(agent.id),
  };
}
