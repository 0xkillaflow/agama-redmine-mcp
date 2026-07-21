/**
 * HTTP transport — documented placeholder.
 *
 * This is the seam for the future multi-user cloud mode, selected by
 * `MCP_TRANSPORT=http`. It is intentionally non-functional today: calling it
 * throws {@link NotImplementedError} so startup fails fast with a clear message.
 * The signature is kept parallel to {@link startStdioTransport} so wiring the real
 * implementation later is additive, not a refactor.
 *
 * Intended implementation:
 *  - Stand up the SDK's Streamable HTTP server transport and listen on
 *    `config.HTTP_PORT`.
 *  - For each inbound request, extract the `Authorization: Bearer <token>` header
 *    into a {@link RequestMeta} and let {@link createHeaderCredentialProvider}
 *    (the http-mode `CredentialProvider`) resolve it to `bearer` credentials.
 *  - Build a per-request {@link RedmineClient} via `clientFactory.create(...)` —
 *    one client per user token — and connect the same `McpServer` to the request.
 *  - Everything from tool dispatch onward is identical to stdio; only credential
 *    resolution and client lifetime differ. No new HTTP framework
 *    dependency is added until this is built.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { NotImplementedError } from '../../../domain/errors/index.js';
import type { AppConfig } from '../../../config/index.js';
import type { CredentialProvider, Logger } from '../../../domain/ports/index.js';
import type { RedmineClientFactory } from '../../redmine/redmine-http-client.js';
import type { TransportHandle } from './transport-handle.js';

/** Collaborators the http transport will need once implemented. */
export interface HttpTransportDeps {
  /** Validated configuration (provides `HTTP_PORT`, base URL, timeout). */
  readonly config: AppConfig;
  /** Resolves per-request bearer credentials from the `Authorization` header. */
  readonly credentialProvider: CredentialProvider;
  /** Mints a per-request {@link RedmineClient} from the resolved token. */
  readonly clientFactory: RedmineClientFactory;
  /** Structured logger (stderr). */
  readonly logger: Logger;
}

/**
 * Placeholder for the http transport. Always throws {@link NotImplementedError}
 * with a pointer to the roadmap and the intended per-request auth path.
 *
 * @throws NotImplementedError always — the http transport is not built yet.
 */
export function startHttpTransport(
  server: McpServer,
  deps: HttpTransportDeps,
): Promise<TransportHandle> {
  void server;
  void deps;
  throw new NotImplementedError(
    'The http transport (MCP_TRANSPORT=http) is not implemented yet. Use the default ' +
      'stdio transport (unset MCP_TRANSPORT or set it to "stdio"). The multi-user cloud ' +
      'mode will use the SDK Streamable HTTP ' +
      'transport with per-request "Authorization: Bearer <token>" credentials resolved by ' +
      'HeaderCredentialProvider.',
  );
}
