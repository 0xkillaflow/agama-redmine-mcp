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
  // tsup's dts worker injects `baseUrl: "."` on its own; TypeScript 6.0 raises
  // the deprecated option as an error (TS5101, removed in 7.0). Scope the
  // sanctioned bridge flag to the dts build only, keeping `npm run typecheck`
  // free of it. Drop when tsup stops defaulting `baseUrl` (tsup dist/rollup.js).
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0',
    },
  },
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
