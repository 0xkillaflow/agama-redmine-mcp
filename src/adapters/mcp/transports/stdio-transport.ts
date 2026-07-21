/**
 * Stdio transport.
 *
 * The default local, single-user mode: the server speaks JSON-RPC over the
 * process's stdin/stdout using the SDK's `StdioServerTransport`. **stdout carries
 * only JSON-RPC** — every log record goes to stderr via the injected logger, and
 * nothing here writes to stdout directly.
 *
 * Signal handling and process lifecycle live in the bootstrap; this module only
 * connects the transport and returns a handle to disconnect it.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../../../domain/ports/index.js';
import type { TransportHandle } from './transport-handle.js';

/**
 * Connect `server` to stdio and begin serving requests.
 *
 * Returns a {@link TransportHandle} whose `close` disconnects the transport for a
 * graceful shutdown. Readiness is logged to stderr only.
 */
export async function startStdioTransport(
  server: McpServer,
  logger: Logger,
): Promise<TransportHandle> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stderr only — writing this to stdout would corrupt the JSON-RPC stream.
  logger.info('Redmine MCP server ready on stdio transport');

  return {
    // Closing the server disconnects the transport it owns (SDK semantics).
    close: (): Promise<void> => server.close(),
  };
}
