/**
 * In-memory MCP harness (architecture §12, ADR-0012).
 *
 * Builds the real `McpServer` — every tool registered through the production
 * register→validate→handle→format path — and connects it to an MCP `Client` over
 * the SDK's linked in-memory transport pair. No subprocess, no stdio, no network:
 * the full protocol path is exercised in-process against a supplied
 * {@link RedmineClient} (a fake for unit e2e, the real HTTP client for
 * integration tests).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../../src/adapters/mcp/mcp-server-factory.js';
import type { RedmineClientFactory } from '../../src/adapters/redmine/redmine-http-client.js';
import { createToolRegistry } from '../../src/application/tool-registry.js';
import { tools } from '../../src/application/tools/index.js';
import type { CredentialProvider, Logger, RedmineClient } from '../../src/domain/ports/index.js';
import { fakeRedmineClient } from './fake-redmine-client.js';
import { silentLogger } from './silent-logger.js';

/** Options for {@link connectInMemoryMcp}; every field has a test-friendly default. */
export interface InMemoryMcpOptions {
  /** The client every tool call is served by (defaults to a {@link fakeRedmineClient}). */
  readonly redmine?: RedmineClient;
  /** Logger handed to the server (defaults to a {@link silentLogger}). */
  readonly logger?: Logger;
  /** Filesystem allowlist for the attachment tools (defaults to empty = no access). */
  readonly allowedDirectories?: readonly string[];
}

/** A connected in-memory MCP client plus ergonomic helpers. */
export interface InMemoryMcp {
  /** The connected MCP client — use it for `listTools`, `callTool`, etc. */
  readonly client: Client;
  /** Call a tool by name and return its raw {@link CallToolResult}. */
  callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult>;
  /** Disconnect the client and shut down the server. */
  close(): Promise<void>;
}

/** A credential provider that resolves a constant key — auth is out of scope here. */
const constantCredentials: CredentialProvider = {
  resolve: () => Promise.resolve({ kind: 'apiKey', value: 'test-key' }),
};

/**
 * Build the server, wire it to an in-memory client, and connect both ends.
 *
 * The server is the production `McpServer` from {@link createMcpServer}; only the
 * outbound {@link RedmineClient} is substituted, so tool registration, input
 * validation, handler dispatch, and result formatting are the real code paths.
 */
export async function connectInMemoryMcp(options: InMemoryMcpOptions = {}): Promise<InMemoryMcp> {
  const redmine = options.redmine ?? fakeRedmineClient();
  const logger = options.logger ?? silentLogger();

  // The factory always returns the one supplied client — the harness models the
  // stdio single-client scope, not per-request minting.
  const clientFactory: RedmineClientFactory = { create: () => redmine };

  const server = createMcpServer({
    registry: createToolRegistry([...tools]),
    credentialProvider: constantCredentials,
    clientFactory,
    logger,
    serverInfo: { name: 'redmine-mcp-test', version: '0.0.0-test' },
    allowedDirectories: options.allowedDirectories ?? [],
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'redmine-mcp-test-client', version: '0.0.0-test' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    callTool: (name, args = {}) =>
      client.callTool({ name, arguments: args }) as Promise<CallToolResult>,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
