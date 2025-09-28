import { $ } from 'bun';

const projectRoot = '/var/web_dev/tools/volar-vue-ext';
const tsserverPath = '/var/web_dev/tools/volar-vue-ext/node_modules/typescript/lib/tsserver.js';
const vuePluginLocation = '/var/web_dev/tools/volar-vue-ext/node_modules/@vue/typescript-plugin';

// Correct command with global plugins
const serverCommand = [
  'bun', 
  tsserverPath, 
  '--stdio', 
  '--logVerbosity', 'verbose',
  '--globalPlugins', '@vue/typescript-plugin',
  '--pluginProbeLocations', vuePluginLocation
];



// Optional: Set logging environment for additional debugging
const env = {
  ...process.env,
  TSS_LOG: "-level verbose -file /tmp/tsserver.log"
};


await $`${serverCommand}`.nothrow().env(env).cwd(projectRoot);
