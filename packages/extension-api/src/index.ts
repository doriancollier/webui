/**
 * Extension API — public contract for DorkOS extensions.
 *
 * Extension authors type against this package. The host provides the implementation.
 *
 * @module @dorkos/extension-api
 */
export {
  ExtensionManifestSchema,
  SettingOptionSchema,
  SettingDeclarationSchema,
} from './manifest-schema.js';
export type {
  ExtensionManifest,
  SecretDeclaration,
  SettingOption,
  SettingDeclaration,
  DataProxyConfig,
  ServerCapabilities,
} from './manifest-schema.js';
export type { ExtensionAPI, ExtensionPointId, ExtensionReadableState } from './extension-api.js';
export type {
  ExtensionStatus,
  ExtensionRecord,
  ExtensionRecordPublic,
  ExtensionModule,
} from './types.js';
export type {
  SecretStore,
  SettingsStore,
  DataProviderContext,
  ServerExtensionRegister,
} from './server-extension-api.js';
