// @ts-check
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

/**
 * Flat ESLint config.
 *
 * Two project-specific rules on top of the typescript-eslint recommended set:
 *  1. Hexagonal import boundaries (architecture §4, ADR-0001) via
 *     `import/no-restricted-paths` — dependencies point strictly inward:
 *     domain → (nothing), application → domain only, adapters/config/infra → domain + application.
 *  2. No writes to stdout (`console.log`/`info`/`debug`) — stdout is the JSON-RPC
 *     channel in stdio mode (ADR-0006). `console.warn`/`error` (stderr) are allowed.
 *
 * The TypeScript resolver is required so `import/no-restricted-paths` can resolve
 * NodeNext `.js` specifiers back to their `.ts` source files.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // domain is pure: it may not import from any outer layer.
            {
              target: './src/domain',
              from: ['./src/application', './src/adapters', './src/config', './src/infrastructure'],
              message:
                'domain must not import from outer layers (application/adapters/config/infrastructure).',
            },
            // application depends on domain (ports) only.
            {
              target: './src/application',
              from: ['./src/adapters', './src/config', './src/infrastructure'],
              message:
                'application must depend on domain (ports) only, never on adapters/config/infrastructure.',
            },
          ],
        },
      ],
    },
  },
);
