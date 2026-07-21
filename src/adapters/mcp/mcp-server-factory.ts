/**
 * MCP server factory.
 *
 * Builds the high-level `McpServer`, declares the `tools` capability, and
 * registers every tool from the registry through the {@link registerTool}
 * bridge. The result is transport-agnostic: it is fully configured but not yet
 * connected — the stdio/http transports (see `./transports/`) attach it to a
 * concrete channel.
 *
 * This factory owns only construction and registration; it contains no transport
 * or credential-resolution logic. Registration is eager, so a wiring mistake
 * (an empty registry, a tool that fails to register) fails fast at startup rather
 * than on the first tool call.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CredentialProvider, Logger } from '../../domain/ports/index.js';
import type { ToolRegistry } from '../../application/tool-registry.js';
import type { RedmineClientFactory } from '../redmine/redmine-http-client.js';
import { registerTool } from './register-tool.js';
import type { ServerInfo } from './version.js';

/** Everything the factory needs to build and populate an `McpServer`. */
export interface CreateMcpServerDeps {
  /** The collected tools to expose. */
  readonly registry: ToolRegistry;
  /** Resolves per-request credentials (shared by every registered tool). */
  readonly credentialProvider: CredentialProvider;
  /** Mints a credential-bound {@link RedmineClient} per call. */
  readonly clientFactory: RedmineClientFactory;
  /** Base logger; each tool receives a child scoped to its name. */
  readonly logger: Logger;
  /** Server name/version advertised in the MCP handshake. */
  readonly serverInfo: ServerInfo;
}

/**
 * Build a configured `McpServer` with every registry tool registered.
 *
 * @throws Error if the registry is empty — a server with no tools is a wiring
 * mistake, never intentional.
 * @throws whatever {@link registerTool} throws if a registration fails.
 */
export function createMcpServer(deps: CreateMcpServerDeps): McpServer {
  const { registry, credentialProvider, clientFactory, logger, serverInfo } = deps;

  const tools = registry.list();
  if (tools.length === 0) {
    throw new Error('Cannot build an MCP server with an empty tool registry.');
  }

  const server = new McpServer(
    { name: serverInfo.name, version: serverInfo.version },
    { capabilities: { tools: {} } },
  );

  for (const def of tools) {
    registerTool(server, def, { credentialProvider, clientFactory, logger });
  }

  return server;
}
