/**
 * Tool registration bridge.
 *
 * Maps a transport-agnostic {@link ToolDefinition} onto
 * `McpServer.registerTool`, wrapping the handler so that per call it: resolves
 * credentials from the request metadata, binds a {@link RedmineClient}, invokes
 * the handler with a scoped context, and formats the outcome into a
 * `CallToolResult`.
 *
 * This is the only place credentials are resolved per request. The client
 * factory decides client lifetime: the stdio wiring hands in a factory that
 * returns one cached client; the future http wiring hands in one that builds a
 * client per request from the inbound bearer token.
 */

import { ZodError, type z } from 'zod';
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestInfo } from '@modelcontextprotocol/sdk/types.js';
import { isRedmineError } from '../../domain/errors/index.js';
import type { CredentialProvider, Logger, RequestMeta } from '../../domain/ports/index.js';
import type { ToolAnnotations, ToolContext } from '../../application/tool-definition.js';
import type { AnyToolDefinition } from '../../application/tool-registry.js';
import type { RedmineClientFactory } from '../redmine/redmine-http-client.js';
import { formatError, formatSuccess } from './result-formatter.js';

/** Collaborators every registered tool shares. */
export interface RegisterToolDeps {
  /** Resolves the credentials for an inbound request (env or header). */
  readonly credentialProvider: CredentialProvider;
  /** Mints a credential-bound {@link RedmineClient} (stdio caches; http per request). */
  readonly clientFactory: RedmineClientFactory;
  /** Base logger; the handler receives a child scoped to the tool. */
  readonly logger: Logger;
}

/**
 * Build the {@link RequestMeta} a {@link CredentialProvider} inspects from the
 * SDK's request extra. stdio calls carry no request info, yielding empty meta;
 * http calls carry headers, normalized to single string values (a repeated
 * header is comma-joined per RFC 7230).
 */
function requestMetaFrom(extra: { readonly requestInfo?: RequestInfo }): RequestMeta {
  const headers = extra.requestInfo?.headers;
  if (headers === undefined) return {};

  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return { headers: normalized };
}

/**
 * Register one {@link ToolDefinition} on the given server.
 *
 * The SDK validates arguments against `def.inputSchema` before the wrapped
 * handler runs, so `handle` receives already-parsed, typed input. A thrown
 * domain error is logged (tool + code, never secrets) and formatted into an
 * `isError` result; unknown errors are logged at `error` and reported generically.
 */
export function registerTool(
  server: McpServer,
  def: AnyToolDefinition,
  deps: RegisterToolDeps,
): void {
  const { credentialProvider, clientFactory, logger } = deps;

  // Built as one object (not a conditional spread) so the SDK can infer the
  // tool's input args from `inputSchema`; `annotations` is set only when present
  // (exactOptionalPropertyTypes forbids assigning `undefined`).
  const config: {
    title: string;
    description: string;
    inputSchema: z.ZodRawShape;
    annotations?: ToolAnnotations;
  } = {
    title: def.title,
    description: def.description,
    inputSchema: def.inputSchema,
  };
  if (def.annotations !== undefined) config.annotations = def.annotations;

  const handler: ToolCallback<z.ZodRawShape> = async (args, extra) => {
    try {
      const credentials = await credentialProvider.resolve(requestMetaFrom(extra));
      const redmine = clientFactory.create(credentials);
      const ctx: ToolContext = { redmine, logger: logger.child({ tool: def.name }) };
      // The SDK-parsed args match the handler's input shape; bridge the SDK's
      // shape-output type to the handler's `objectOutputType` view.
      const output = await def.handle(args as Parameters<typeof def.handle>[0], ctx);
      return formatSuccess(output);
    } catch (err) {
      if (isRedmineError(err)) {
        logger.warn('tool handler failed', { tool: def.name, code: err.code });
      } else if (err instanceof ZodError) {
        // Expected bad input (e.g. a cross-field `superRefine` re-parse), not a
        // server fault — log at warn and let the formatter surface the details.
        logger.warn('tool input rejected', { tool: def.name });
      } else {
        logger.error('tool handler error', { tool: def.name });
      }
      return formatError(err);
    }
  };

  server.registerTool(def.name, config, handler);
}
