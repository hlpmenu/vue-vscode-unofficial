/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { rm, mkdir } from 'node:fs/promises';

const production = process.argv.includes('--production');

console.log(`Running build in ${production ? 'production' : 'development'} mode...`);

try {
  // Clean and create the dist directory
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });

 

  // Build extension
  const extensionResult = await Bun.build({
    format: 'cjs',
      naming: {
        entry: 'extension.js',
        asset: '[name]-[hash].[ext]',
      },
    target: 'node',
    minify: production,
    sourcemap: production ? 'none' : 'external',
    entrypoints: ['index.ts'],
   outdir: 'dist',
       packages: "bundle",   

    external: ['vscode'],
  });

  // Build language server
  const serverResult = await Bun.build({
    format: 'esm',
    target: 'node',
    naming: {
      entry: 'vue-lsp.js',
      asset: '[name]-[hash].[ext]',
    },
        packages: "bundle",   

    minify: production,
    sourcemap: production ? 'none' : 'external',
    entrypoints: ['src/vue-lsp.ts'],
    outdir: 'dist',
  });

  // Build plugin
  const pluginResult = await Bun.build({
    format: 'esm',
    target: 'node',
    packages: "bundle",   
     naming: {
      entry: 'ts-plugin.js',
      asset: '[name]-[hash].[ext]',
    },  
    minify: production,
    sourcemap: production ? 'none' : 'external',
    entrypoints: ['src/ts-plugin.ts'],
    outdir: 'dist',
  });

  const results = [extensionResult, serverResult, pluginResult];
  let success = true;

  for (const result of results) {
    if (!result.success) {
      success = false;
      console.error("Build failed:");
      for (const message of result.logs) {
        console.error(message);
      }
    }
  }

  if (!success) {
    console.error('Build process failed.');
    process.exit(1);
  }

  console.log('Build successful!');

} catch (error) {
  console.error('An unexpected error occurred during the build process:', error);
  process.exit(1);
}
