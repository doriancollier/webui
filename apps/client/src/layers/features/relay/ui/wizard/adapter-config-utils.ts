/**
 * Re-exports adapter configuration utilities from the model layer.
 *
 * The canonical source is `model/use-adapter-setup-form.ts`. This file
 * exists for backward compatibility with wizard-internal imports.
 */
export {
  unflattenConfig,
  initializeValues,
  generateDefaultId,
} from '../../model/use-adapter-setup-form';
