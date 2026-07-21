import { defineConfig } from 'tsup';

/**
 * Build config (ADR-0013). Bundles the single CLI entry to ESM in `dist/`.
 * The `banner` prepends the shebang so `dist/index.js` runs directly via the
 * bin shim npm creates on install/link.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  dts: true,
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
