/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

const production = process.argv.includes('--production');

console.log(`Running build in ${production ? 'production' : 'development'} mode...`);

try {
  // Clean and create the dist directory
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });

  // Build extension entrypoint only
  const extensionResult = await Bun.build({
    entrypoints: ['index.ts'],
    format: 'cjs',
    target: 'node',
    outdir: 'dist',
    packages: 'bundle',
    naming: {
      entry: 'extension.js',
      asset: '[name]-[hash].[ext]',
    },
    minify: production,
    sourcemap: production ? 'none' : 'external',
    external: ['vscode'],
  });

  if (!extensionResult.success) {
    console.error('Build failed:');
    for (const message of extensionResult.logs) {
      console.error(message);
    }
    process.exit(1);
  }

  // Ensure dist/node_modules contains runtime deps for shims
  await cp('node_modules', 'dist/node_modules', { recursive: true });

  // Write CJS shim for Vue language server
  await writeFile(
    path.join('dist', 'vue-lsp.js'),
    "module.exports = require('./node_modules/@vue/language-server/index.js');\n",
    'utf8',
  );

  // Write CJS shim for Vue TypeScript plugin
  await writeFile(
    path.join('dist', 'ts-plugin.js'),
    "module.exports = require('./node_modules/@vue/typescript-plugin/index.js');\n",
    'utf8',
  );

  console.log('Build successful!');

} catch (error) {
  console.error('An unexpected error occurred during the build process:', error);
  process.exit(1);
}
