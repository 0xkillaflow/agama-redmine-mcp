/**
 * A no-op {@link Logger} for tests: every level discards its message and `child`
 * returns the same instance. Tools and adapters under test can log freely without
 * polluting test output or requiring assertions on log calls.
 */

import type { Logger } from '../../src/domain/ports/index.js';

/** Build a silent {@link Logger} that ignores everything it is given. */
export function silentLogger(): Logger {
  const logger: Logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => logger,
  };
  return logger;
}
