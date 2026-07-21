/**
 * Composition Root.
 *
 * The single place that constructs adapters together and wires the object graph
 * by hand — no DI container, no service locator, no globals. Everything receives
 * its collaborators as constructor arguments. `buildContainer` is pure: it takes a
 * validated {@link AppConfig}, returns the wired objects, and performs no I/O — it
 * neither reads the environment nor starts a transport. Starting the transport and
 * handling signals is the bootstrap's job (`server.ts`).
 *
 * Read this file top-to-bottom as the "map" of the system: each line is one wire.
 */

import { createConsoleLogger } from './infrastructure/logger/console-logger.js';
import { createRedmineClientFactory } from './adapters/redmine/redmine-http-client.js';
import { createEnvCredentialProvider } from './adapters/credentials/env-credential-provider.js';
import { createHeaderCredentialProvider } from './adapters/credentials/header-credential-provider.js';
import { createToolRegistry } from './application/tool-registry.js';
import { tools } from './application/tools/index.js';
import { createMcpServer } from './adapters/mcp/mcp-server-factory.js';
import { serverInfo } from './adapters/mcp/version.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from './config/index.js';
import type { CredentialProvider, Logger } from './domain/ports/index.js';
import type { RedmineClientFactory } from './adapters/redmine/redmine-http-client.js';

/**
 * The wired object graph the bootstrap needs to start serving.
 *
 * It exposes the ready-to-connect `server` plus the pieces required to start
 * either transport, so the bootstrap can branch on `config.MCP_TRANSPORT` and call
 * the matching starter (stdio needs `server` + `logger`; http additionally needs
 * `config`, `credentialProvider`, and `clientFactory`). Deliberately not a
 * `startTransport()` method: the transport branch lives in the bootstrap so the
 * composition root stays free of lifecycle concerns.
 */
export interface Container {
  /** Fully configured, not-yet-connected MCP server. */
  readonly server: McpServer;
  /** The validated configuration this graph was built from. */
  readonly config: AppConfig;
  /** Base (stderr-only) logger shared across the graph. */
  readonly logger: Logger;
  /** Resolves per-request credentials (env for stdio, header for http). */
  readonly credentialProvider: CredentialProvider;
  /** Mints a credential-bound Redmine client (cached for stdio, per-request for http). */
  readonly clientFactory: RedmineClientFactory;
}

/**
 * Wire the entire application from configuration.
 *
 * Swapping `config.MCP_TRANSPORT` changes only how credentials are resolved (env
 * vs. header) and how clients are scoped (one cached client vs. one per request);
 * every other wire is identical.
 *
 * @param config - Validated application configuration.
 * @returns The wired {@link Container}.
 */
export function buildContainer(config: AppConfig): Container {
  // 1. Logger first — every other adapter is handed this instance (stderr-only).
  const logger = createConsoleLogger({ level: config.LOG_LEVEL });

  // 2. Base client factory: binds base URL, timeout, and logger once, leaving only
  //    the credentials to inject per client.
  const clientFactoryBase = createRedmineClientFactory({
    baseUrl: config.REDMINE_URL,
    timeoutMs: config.REDMINE_TIMEOUT_MS,
    logger,
  });

  // 3. Transport-specific auth seam: this is the *only* thing the transport choice
  //    changes. stdio is single-user (one env key); http is multi-user (per-request
  //    bearer header).
  let credentialProvider: CredentialProvider;
  let clientFactory: RedmineClientFactory;

  if (config.MCP_TRANSPORT === 'stdio') {
    // REDMINE_API_KEY is guaranteed present in stdio mode by config validation.
    const apiKey = config.REDMINE_API_KEY!;
    credentialProvider = createEnvCredentialProvider(apiKey);

    // 4. Single-user optimization: the env provider returns the same credentials
    //    for every request, so build one client up front and reuse it — the
    //    resource clients are never reconstructed per call. Centralizing this
    //    decision here keeps the adapters stateless.
    const cachedClient = clientFactoryBase.create({ kind: 'apiKey', value: apiKey });
    clientFactory = { create: () => cachedClient };
  } else {
    // http: credentials arrive per request; a fresh client is built per token.
    credentialProvider = createHeaderCredentialProvider();
    clientFactory = clientFactoryBase;
  }

  // 5. Collect the tools into the registry the MCP adapter iterates at startup.
  const registry = createToolRegistry([...tools]);

  // 6. Build the MCP server: registers every tool through the register-tool bridge,
  //    sharing the credential provider, client factory, and logger.
  const server = createMcpServer({
    registry,
    credentialProvider,
    clientFactory,
    logger,
    serverInfo,
  });

  return { server, config, logger, credentialProvider, clientFactory };
}
