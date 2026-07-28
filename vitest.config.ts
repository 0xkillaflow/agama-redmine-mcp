import { defineConfig } from 'vitest/config';

/**
 * Vitest config. Node environment; v8 coverage over `src/**`.
 * Coverage thresholds are scoped to the core layers (domain/application/adapters)
 * — see architecture §12. They are enforced only when running with `--coverage`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        'src/domain/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
        'src/application/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
        'src/adapters/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
      },
    },
  },
});
