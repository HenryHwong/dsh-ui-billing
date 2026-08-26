import { defineConfig } from 'tsdown'

/**
 * Standalone build of the node half: tsc (tsconfig.build.json) emits
 * lib/types/*.js + d.ts, then this bundles the two host entries into
 * lib/index.js and lib/invariant.js. The browser half (lib/client.js) is a
 * client-face artifact built with the harness clientBundle preset and shipped
 * unchanged.
 */
export default defineConfig({
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})
