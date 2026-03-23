import { useState, useMemo, useCallback } from 'react';
import type { AdapterManifest, CatalogInstance } from '@dorkos/shared/relay-schemas';

/**
 * Converts a flat object with dot-notation keys into a nested object.
 *
 * @param flat - Object with dot-notation keys, e.g. `{'inbound.subject': 'x'}`
 * @returns Nested object, e.g. `{inbound: {subject: 'x'}}`
 */
export function unflattenConfig(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

/** Resolves a dot-notation key from a potentially nested config object. */
function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Initializes form values from manifest defaults or existing config. */
export function initializeValues(
  manifest: AdapterManifest,
  existingConfig?: Record<string, unknown>
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of manifest.configFields) {
    const existing = existingConfig ? getNestedValue(existingConfig, field.key) : undefined;
    if (existing !== undefined && field.type !== 'password') {
      values[field.key] = existing;
    } else if (
      field.type === 'password' &&
      existingConfig &&
      getNestedValue(existingConfig, field.key) !== undefined
    ) {
      // Use sentinel so edit mode shows "Saved" placeholder instead of blank.
      values[field.key] = '***';
    } else if (field.default !== undefined) {
      values[field.key] = field.default;
    } else {
      values[field.key] = field.type === 'boolean' ? false : '';
    }
  }
  return values;
}

/**
 * Generates a non-colliding default adapter ID.
 *
 * Returns `{type}` if unused, otherwise `{type}-2`, `{type}-3`, etc.
 */
export function generateDefaultId(manifest: AdapterManifest, existingIds: string[] = []): string {
  const base = manifest.type;
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Manages all form state for the AdapterSetupWizard configure step. */
export function useAdapterSetupForm(
  manifest: AdapterManifest,
  existingInstance?: CatalogInstance & { config?: Record<string, unknown> },
  existingAdapterIds?: string[]
) {
  const [adapterId] = useState(
    () => existingInstance?.id ?? generateDefaultId(manifest, existingAdapterIds)
  );
  const [label, setLabel] = useState(
    () => (existingInstance?.config?.label as string | undefined) ?? ''
  );
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    initializeValues(manifest, existingInstance?.config)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [setupStepIndex, setSetupStepIndex] = useState(0);
  const [botUsername, setBotUsername] = useState('');

  const hasSetupSteps = manifest.setupSteps && manifest.setupSteps.length > 0;

  const visibleFields = useMemo(() => {
    if (!hasSetupSteps || !manifest.setupSteps) return manifest.configFields;
    const currentStep = manifest.setupSteps[setupStepIndex];
    if (!currentStep) return manifest.configFields;
    return manifest.configFields.filter((f) => currentStep.fields.includes(f.key));
  }, [manifest.configFields, manifest.setupSteps, hasSetupSteps, setupStepIndex]);

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validate = useCallback(
    (fieldsToValidate: typeof manifest.configFields): boolean => {
      const newErrors: Record<string, string> = {};
      for (const field of fieldsToValidate) {
        if (field.showWhen) {
          const depValue = values[field.showWhen.field];
          if (depValue !== field.showWhen.equals) continue;
        }
        if (field.required) {
          const val = values[field.key];
          if (val === undefined || val === null || val === '') {
            newErrors[field.key] = `${field.label} is required`;
          }
        }
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [values]
  );

  const reset = useCallback(() => {
    setValues(initializeValues(manifest, existingInstance?.config));
    setErrors({});
    setLabel((existingInstance?.config?.label as string | undefined) ?? '');
    setSetupStepIndex(0);
    setBotUsername('');
  }, [manifest, existingInstance]);

  return {
    values,
    errors,
    label,
    setLabel,
    adapterId,
    setupStepIndex,
    setSetupStepIndex,
    botUsername,
    setBotUsername,
    visibleFields,
    hasSetupSteps,
    handleFieldChange,
    validate,
    unflattenConfig: () => unflattenConfig(values as Record<string, unknown>),
    reset,
  };
}
