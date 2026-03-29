/**
 * Static configuration for the Claude Code runtime — model catalog and capability flags.
 *
 * @module services/runtimes/claude-code/runtime-constants
 */
import type { ModelOption } from '@dorkos/shared/types';
import type { RuntimeCapabilities } from '@dorkos/shared/agent-runtime';

/** Default model options when the SDK hasn't reported its catalog yet. */
export const DEFAULT_MODELS: ModelOption[] = [
  {
    value: 'claude-sonnet-4-5-20250929',
    displayName: 'Sonnet 4.5',
    description: 'Fast, intelligent model for everyday tasks',
    supportsEffort: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
  },
  {
    value: 'claude-haiku-4-5-20251001',
    displayName: 'Haiku 4.5',
    description: 'Fastest, most compact model',
    supportsEffort: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
  },
  {
    value: 'claude-opus-4-6',
    displayName: 'Opus 4.6',
    description: 'Most capable model for complex tasks',
    supportsEffort: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'max'],
  },
];

/** Static Claude Code capabilities — all features are supported. */
export const CLAUDE_CODE_CAPABILITIES: RuntimeCapabilities = {
  type: 'claude-code',
  supportsPermissionModes: true,
  supportedPermissionModes: ['default', 'plan', 'acceptEdits', 'bypassPermissions'],
  supportsToolApproval: true,
  supportsCostTracking: true,
  supportsResume: true,
  supportsMcp: true,
  supportsQuestionPrompt: true,
};
