import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';

const clientRoot = path.resolve(__dirname, '../client');
const sharedSrc = path.resolve(__dirname, '../../packages/shared/src');

/**
 * Build alias entries for @dorkos/shared subpath exports.
 *
 * electron-vite runs from apps/desktop/ with root set to apps/client/.
 * In CI, pnpm's strict module isolation prevents Rollup from resolving
 * workspace subpath exports across this directory boundary. We resolve
 * them directly to TypeScript source files instead.
 */
function sharedSubpathAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  const files = fs.readdirSync(sharedSrc).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
  for (const file of files) {
    const name = file.replace(/\.ts$/, '');
    aliases[`@dorkos/shared/${name}`] = path.resolve(sharedSrc, file);
  }
  return aliases;
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        external: ['better-sqlite3', '@anthropic-ai/claude-agent-sdk'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
    },
  },
  renderer: {
    root: clientRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(clientRoot, 'src'),
        ...sharedSubpathAliases(),
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'dist/renderer'),
      rollupOptions: {
        input: path.resolve(clientRoot, 'index.html'),
        // @dorkos/shared/manifest uses Node.js built-ins (fs, path, crypto).
        // It's only imported by DirectTransport (not used in Electron renderer).
        external: ['@dorkos/shared/manifest'],
      },
    },
  },
});
