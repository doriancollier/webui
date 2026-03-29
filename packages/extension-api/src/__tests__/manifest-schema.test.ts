import { describe, it, expect } from 'vitest';
import { ExtensionManifestSchema } from '../manifest-schema.js';

describe('ExtensionManifestSchema', () => {
  // --- Valid manifests ---

  it('parses a complete valid manifest', () => {
    const manifest = {
      id: 'github-prs',
      name: 'GitHub PR Dashboard',
      version: '1.0.0',
      description: 'Shows pending PR reviews',
      author: 'dorkbot',
      minHostVersion: '0.1.0',
      contributions: { 'dashboard.sections': true },
      permissions: ['storage'],
    };
    const result = ExtensionManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it('parses a minimal manifest (only required fields)', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'hello-world',
      name: 'Hello World',
      version: '0.1.0',
    });
    expect(result.success).toBe(true);
  });

  it('parses an id with numbers', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'my-plugin-v2',
      name: 'My Plugin V2',
      version: '2.0.0',
    });
    expect(result.success).toBe(true);
  });

  it('parses a single-word lowercase id', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'analytics',
      name: 'Analytics',
      version: '1.0.0',
    });
    expect(result.success).toBe(true);
  });

  // --- Invalid IDs ---

  it('rejects an ID with uppercase letters', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'MyPlugin',
      name: 'My Plugin',
      version: '1.0.0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an ID with spaces', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'my plugin',
      name: 'My Plugin',
      version: '1.0.0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty string ID', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: '',
      name: 'No ID',
      version: '1.0.0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an ID starting with a hyphen', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: '-my-plugin',
      name: 'My Plugin',
      version: '1.0.0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an ID with special characters', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'my_plugin',
      name: 'My Plugin',
      version: '1.0.0',
    });
    expect(result.success).toBe(false);
  });

  // --- Invalid versions ---

  it('rejects a non-semver version string "latest"', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'test',
      name: 'Test',
      version: 'latest',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a version with "v" prefix', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'test',
      name: 'Test',
      version: 'v1.0.0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a version with only two parts', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'test',
      name: 'Test',
      version: '1.0',
    });
    expect(result.success).toBe(false);
  });

  // --- Missing required fields ---

  it('rejects when required field id is missing', () => {
    const result = ExtensionManifestSchema.safeParse({
      name: 'No ID',
      version: '1.0.0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when required field name is missing', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'no-name',
      version: '1.0.0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when required field version is missing', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'no-version',
      name: 'No Version',
    });
    expect(result.success).toBe(false);
  });

  // --- Optional fields ---

  it('treats description as optional', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      description: 'A description',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('A description');
    }
  });

  it('treats author as optional', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      author: 'Alice',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author).toBe('Alice');
    }
  });

  it('treats minHostVersion as optional', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      minHostVersion: '0.2.0',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minHostVersion).toBe('0.2.0');
    }
  });

  // --- Contributions record ---

  it('parses a contributions record correctly', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'dashboard-ext',
      name: 'Dashboard Extension',
      version: '1.0.0',
      contributions: { 'dashboard.sections': true, 'sidebar.footer': false },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contributions).toEqual({
        'dashboard.sections': true,
        'sidebar.footer': false,
      });
    }
  });

  // --- Permissions array ---

  it('parses a permissions array correctly', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'network-ext',
      name: 'Network Extension',
      version: '1.0.0',
      permissions: ['storage', 'network'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.permissions).toEqual(['storage', 'network']);
    }
  });

  it('parses an empty permissions array', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'minimal-ext',
      name: 'Minimal Extension',
      version: '1.0.0',
      permissions: [],
    });
    expect(result.success).toBe(true);
  });

  // --- Backward compatibility ---

  it('parses existing manifests without serverCapabilities or dataProxy', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'legacy-ext',
      name: 'Legacy Extension',
      version: '1.0.0',
      description: 'No server fields',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serverCapabilities).toBeUndefined();
      expect(result.data.dataProxy).toBeUndefined();
    }
  });

  // --- serverCapabilities ---

  it('parses a manifest with valid serverCapabilities and secrets', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'data-provider',
      name: 'Data Provider',
      version: '1.0.0',
      serverCapabilities: {
        serverEntry: './server.ts',
        externalHosts: ['https://api.example.com'],
        secrets: [
          { key: 'api_key', label: 'API Key', required: true },
          { key: 'webhook_secret', label: 'Webhook Secret', description: 'For verifying webhooks' },
        ],
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serverCapabilities).toBeDefined();
      expect(result.data.serverCapabilities!.serverEntry).toBe('./server.ts');
      expect(result.data.serverCapabilities!.secrets).toHaveLength(2);
      expect(result.data.serverCapabilities!.secrets![0].key).toBe('api_key');
      expect(result.data.serverCapabilities!.secrets![0].required).toBe(true);
      expect(result.data.serverCapabilities!.secrets![1].required).toBe(false);
    }
  });

  it('applies default serverEntry when serverCapabilities is provided without it', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'default-entry',
      name: 'Default Entry',
      version: '1.0.0',
      serverCapabilities: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serverCapabilities!.serverEntry).toBe('./server.ts');
    }
  });

  it('rejects serverCapabilities.secrets with uppercase key', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'bad-secret-key',
      name: 'Bad Secret Key',
      version: '1.0.0',
      serverCapabilities: {
        secrets: [{ key: 'ApiKey', label: 'API Key' }],
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects serverCapabilities.secrets with key starting with a number', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'numeric-key',
      name: 'Numeric Key',
      version: '1.0.0',
      serverCapabilities: {
        secrets: [{ key: '9key', label: 'Bad Key' }],
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects serverCapabilities.secrets with empty label', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'empty-label',
      name: 'Empty Label',
      version: '1.0.0',
      serverCapabilities: {
        secrets: [{ key: 'valid_key', label: '' }],
      },
    });
    expect(result.success).toBe(false);
  });

  // --- dataProxy ---

  it('parses a manifest with valid dataProxy', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'proxy-ext',
      name: 'Proxy Extension',
      version: '1.0.0',
      dataProxy: {
        baseUrl: 'https://api.linear.app',
        authSecret: 'linear_api_key',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataProxy).toBeDefined();
      expect(result.data.dataProxy!.baseUrl).toBe('https://api.linear.app');
      expect(result.data.dataProxy!.authSecret).toBe('linear_api_key');
      expect(result.data.dataProxy!.authHeader).toBe('Authorization');
      expect(result.data.dataProxy!.authType).toBe('Bearer');
    }
  });

  it('parses dataProxy with all fields specified', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'full-proxy',
      name: 'Full Proxy',
      version: '1.0.0',
      dataProxy: {
        baseUrl: 'https://api.github.com',
        authHeader: 'X-Api-Key',
        authType: 'Token',
        authSecret: 'github_token',
        pathRewrite: { '/v1/': '/v2/' },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataProxy!.authHeader).toBe('X-Api-Key');
      expect(result.data.dataProxy!.authType).toBe('Token');
      expect(result.data.dataProxy!.pathRewrite).toEqual({ '/v1/': '/v2/' });
    }
  });

  it('rejects dataProxy with invalid baseUrl', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'bad-proxy',
      name: 'Bad Proxy',
      version: '1.0.0',
      dataProxy: {
        baseUrl: 'not-a-url',
        authSecret: 'some_key',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects dataProxy with missing authSecret', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'no-auth-secret',
      name: 'No Auth Secret',
      version: '1.0.0',
      dataProxy: {
        baseUrl: 'https://api.example.com',
      },
    });
    expect(result.success).toBe(false);
  });

  it('only accepts valid authType values', () => {
    for (const validType of ['Bearer', 'Basic', 'Token', 'Custom']) {
      const result = ExtensionManifestSchema.safeParse({
        id: 'auth-type-test',
        name: 'Auth Type Test',
        version: '1.0.0',
        dataProxy: {
          baseUrl: 'https://api.example.com',
          authType: validType,
          authSecret: 'key',
        },
      });
      expect(result.success).toBe(true);
    }

    const invalidResult = ExtensionManifestSchema.safeParse({
      id: 'auth-type-test',
      name: 'Auth Type Test',
      version: '1.0.0',
      dataProxy: {
        baseUrl: 'https://api.example.com',
        authType: 'OAuth',
        authSecret: 'key',
      },
    });
    expect(invalidResult.success).toBe(false);
  });

  // --- Combined serverCapabilities and dataProxy ---

  it('parses a manifest with both serverCapabilities and dataProxy', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'full-server-ext',
      name: 'Full Server Extension',
      version: '1.0.0',
      serverCapabilities: {
        serverEntry: './src/server.ts',
        externalHosts: ['https://api.linear.app'],
        secrets: [{ key: 'api_key', label: 'Linear API Key', required: true }],
      },
      dataProxy: {
        baseUrl: 'https://api.linear.app',
        authSecret: 'api_key',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serverCapabilities).toBeDefined();
      expect(result.data.dataProxy).toBeDefined();
    }
  });
});
