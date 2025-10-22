/**
 * @license
 * Copyright HLMPN AB
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, rm } from 'node:fs/promises';
import { $ } from 'bun';
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

  // const vueLspResult = await Bun.build({
  //   entrypoints: ['src/vue-lsp.ts'],
  //   format: 'cjs',
  //   target: 'node',
  //   outdir: 'dist',
  //   packages: 'bundle',
  //   naming: {
  //     entry: 'vue-lsp.js',
  //     asset: '[name]-[hash].[ext]',
  //   },
  //   minify: production,
  //   sourcemap: production ? 'none' : 'external',
  // });

  // if (!vueLspResult.success) {
  //   console.error('Vue language server build failed:');
  //   for (const message of vueLspResult.logs) {
  //     console.error(message);
  //   }
  //   process.exit(1);
  // }

  // Ensure dist/node_modules contains runtime deps for shims
  try {
    const genDepsRes = await $`bun run generate:deps`.env(process.env).quiet();
    if (genDepsRes.exitCode !== 0) {
      console.error(genDepsRes.stderr);
      process.exit(1);
    }
    Bun.stdout.write("--- Dependencies generated successfully! ---\n");
  } catch (e) {
    if (e instanceof $.ShellError) {
      console.error(e.stderr);
      process.exit(1);
    }
    throw e;
  }

  // // Write CJS shim for Vue language server
  // await writeFile(
  //   path.join('dist', 'vue-lsp.js'),
  //   "module.exports = require('./node_modules/@vue/language-server/index.js');\n",
  //   'utf8',
  // );

  // // Write CJS shim for Vue TypeScript plugin
  // await writeFile(
  //   path.join('dist', 'ts-plugin.js'),
  //   "module.exports = require('./node_modules/@vue/typescript-plugin/index.js');\n",
  //   'utf8',
  // );

  console.log('Build successful!');

} catch (error) {
  console.error('An unexpected error occurred during the build process:', error);
  process.exit(1);
}
