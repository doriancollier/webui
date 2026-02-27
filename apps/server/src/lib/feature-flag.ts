/**
 * Factory for lightweight runtime feature flags.
 *
 * Each flag holds a boolean state that is set once at server startup and
 * queried by the config route to report enabled/disabled status.
 *
 * @module lib/feature-flag
 */

interface FeatureFlag {
  setEnabled: (enabled: boolean) => void;
  isEnabled: () => boolean;
}

/** Create a runtime feature flag with get/set accessors. */
export function createFeatureFlag(): FeatureFlag {
  const state = { enabled: false };
  return {
    setEnabled: (enabled: boolean) => {
      state.enabled = enabled;
    },
    isEnabled: () => state.enabled,
  };
}
