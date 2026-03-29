import { z } from 'zod';

/** Declares a secret an extension needs (e.g., an API key). */
const SecretDeclarationSchema = z.object({
  /** Secret key name (lowercase snake_case). */
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  /** Human-readable label for the settings UI. */
  label: z.string().min(1),
  /** Help text shown in the settings UI. */
  description: z.string().optional(),
  /** Whether the extension cannot function without this secret. */
  required: z.boolean().default(false),
});

/** Declarative proxy configuration for zero-code API passthrough (Tier 1). */
const DataProxySchema = z.object({
  /** Base URL of the upstream API. */
  baseUrl: z.string().url(),
  /** HTTP header name for the auth credential. */
  authHeader: z.string().default('Authorization'),
  /** How the secret value is formatted in the header. */
  authType: z.enum(['Bearer', 'Basic', 'Token', 'Custom']).default('Bearer'),
  /** Key name in the extension's secret store to use for auth. */
  authSecret: z.string(),
  /** Optional path rewriting rules (from -> to). */
  pathRewrite: z.record(z.string(), z.string()).optional(),
});

/** Server-side capability declarations for data-provider extensions. */
const ServerCapabilitiesSchema = z.object({
  /** Path to the server entry point relative to extension directory. */
  serverEntry: z.string().default('./server.ts'),
  /** Allowlisted external hosts this extension will contact. */
  externalHosts: z.array(z.string().url()).optional(),
  /** Secrets this extension requires (drives auto-generated settings UI). */
  secrets: z.array(SecretDeclarationSchema).optional(),
});

/** Zod schema for `extension.json` manifest files. */
export const ExtensionManifestSchema = z.object({
  /** Unique extension identifier (kebab-case). Used as directory name and registry key. */
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  /** Human-readable display name. */
  name: z.string().min(1),
  /** Semver version string. */
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** Short description shown in settings UI. */
  description: z.string().optional(),
  /** Author name or identifier. */
  author: z.string().optional(),
  /** Minimum DorkOS version required (semver). If host is older, extension cannot be enabled. */
  minHostVersion: z.string().optional(),
  /** Declares which slots this extension contributes to. Informational only — not enforced. */
  contributions: z.record(z.string(), z.boolean()).optional(),
  /** Reserved for future permission model. */
  permissions: z.array(z.string()).optional(),
  /** Server-side capability declarations. Present if the extension has server.ts. */
  serverCapabilities: ServerCapabilitiesSchema.optional(),
  /** Declarative proxy config for zero-code API passthrough. */
  dataProxy: DataProxySchema.optional(),
});

export type ExtensionManifest = z.infer<typeof ExtensionManifestSchema>;
export type SecretDeclaration = z.infer<typeof SecretDeclarationSchema>;
export type DataProxyConfig = z.infer<typeof DataProxySchema>;
export type ServerCapabilities = z.infer<typeof ServerCapabilitiesSchema>;
