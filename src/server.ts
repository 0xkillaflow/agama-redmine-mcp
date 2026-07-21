/**
 * Server bootstrap.
 *
 * The executable's runtime: load configuration, build the container, start the
 * selected transport, and shut down cleanly on a termination signal.
 *
 * Two hard rules hold throughout:
 *  - **Nothing writes to stdout.** In stdio mode stdout is the JSON-RPC channel;
 *    even fatal errors go to stderr.
 *  - **No stack traces on expected failures.** Invalid config or the not-yet-built
 *    http transport abort with a readable message and exit code 1.
 */

import { loadConfig, ConfigError, type AppConfig } from './config/index.js';
import { buildContainer, type Container } from './container.js';
import { startStdioTransport } from './adapters/mcp/transports/stdio-transport.js';
import { startHttpTransport } from './adapters/mcp/transports/http-transport.js';
import type { TransportHandle } from './adapters/mcp/transports/transport-handle.js';
import type { Logger } from './domain/ports/index.js';

/** How long a graceful shutdown may take before the process is forced down. */
const SHUTDOWN_TIMEOUT_MS = 5000;

/** Write a single line to stderr (the only stream the bootstrap ever uses). */
function printErr(message: string): void {
  process.stderr.write(`${message}\n`);
}

/** The human-readable message of an unknown thrown value. */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Start the transport the configuration selects. stdio needs only the server and
 * logger; the http placeholder additionally receives the auth/client seam (and
 * throws {@link NotImplementedError} until implemented — caught by {@link main}).
 */
function startTransport(container: Container): Promise<TransportHandle> {
  const { server, config, logger, credentialProvider, clientFactory } = container;

  if (config.MCP_TRANSPORT === 'http') {
    return startHttpTransport(server, { config, credentialProvider, clientFactory, logger });
  } else {
    return startStdioTransport(server, logger);
  }
}

/**
 * Register `SIGINT`/`SIGTERM` handlers that close the transport gracefully and
 * exit 0. A hard-exit timer guarantees the process terminates even if `close()`
 * hangs, so shutdown never wedges. The handler is guarded so a second signal
 * during shutdown is ignored.
 */
function installSignalHandlers(handle: TransportHandle, logger: Logger): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down', { signal });

    // Force-exit guard: if close() hangs, bring the process down rather than
    // leaving it wedged. `unref` so the timer itself never keeps us alive.
    const timer = setTimeout(() => {
      logger.error('shutdown timed out; forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    handle.close().then(
      () => {
        clearTimeout(timer);
        process.exit(0);
      },
      (err: unknown) => {
        clearTimeout(timer);
        logger.error('error during shutdown', { message: messageOf(err) });
        process.exit(1);
      },
    );
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

/**
 * Bootstrap entry point: configure, wire, start, and arm shutdown.
 *
 * Exits 1 (with a stderr message, no stack) on invalid configuration or any
 * bootstrap failure — including the http transport's `NotImplemented` placeholder.
 * On success it resolves; the process then stays alive serving the transport until
 * a signal triggers graceful shutdown.
 */
export async function main(): Promise<void> {
  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (err) {
    // Invalid configuration aborts before anything is wired. ConfigError's message
    // is already a friendly, aggregated list; never print a stack trace.
    printErr(err instanceof ConfigError ? err.message : messageOf(err));
    process.exit(1);
  }

  try {
    const container = buildContainer(config);
    const handle = await startTransport(container);
    installSignalHandlers(handle, container.logger);
  } catch (err) {
    // Any bootstrap failure (e.g. the http-transport NotImplemented placeholder)
    // aborts with a readable message on stderr — never stdout, never a stack.
    printErr(messageOf(err));
    process.exit(1);
  }
}
