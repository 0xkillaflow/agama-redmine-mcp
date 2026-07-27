/**
 * The application/adapter tool contract.
 *
 * A {@link ToolDefinition} is a transport-agnostic description of one MCP tool.
 * The MCP adapter (`adapters/mcp`) translates it into `McpServer.registerTool`;
 * nothing in `application/` imports the SDK — this module depends only on `zod`
 * and the domain ports.
 *
 * Handlers return a plain domain value; the adapter serializes it into MCP
 * `content`/`structuredContent`. Handlers never build MCP envelopes and never
 * touch `isError` — they either return a value or throw a domain error.
 */

import type { z } from 'zod';
import type { Logger, RedmineClient } from '../domain/ports/index.js';

/**
 * The collaborators a tool handler receives per call. `redmine` is already
 * authenticated for this request (the MCP adapter resolves credentials and binds
 * the client before invoking the handler); `logger` is scoped to the tool.
 *
 * `allowedDirectories` is the filesystem allowlist the attachment tools must
 * validate every caller-supplied path against (see
 * {@link ../application/file-access.ts}). It is carried on the context rather
 * than read from the environment because tool definitions are module-level
 * constants: configuration can only reach a handler at call time. An empty list
 * — the default — means no local file access at all.
 */
export interface ToolContext {
  readonly redmine: RedmineClient;
  readonly logger: Logger;
  readonly allowedDirectories: readonly string[];
}

/**
 * Behavioural hints mirroring the MCP tool annotations, declared here so
 * `application/` stays free of the SDK. The MCP adapter forwards these verbatim
 * to `registerTool` so clients can reason about a tool's safety.
 */
export interface ToolAnnotations {
  /** The tool does not modify its environment. */
  readonly readOnlyHint?: boolean;
  /** The tool may perform destructive updates (only meaningful when not read-only). */
  readonly destructiveHint?: boolean;
  /** Repeated calls with the same arguments have no additional effect. */
  readonly idempotentHint?: boolean;
  /** The tool interacts with an open, external world (e.g. a remote API). */
  readonly openWorldHint?: boolean;
}

/**
 * A single MCP tool: its identity, agent-facing metadata, input shape, and
 * handler.
 *
 * `inputSchema` is a **ZodRawShape** (a plain object of Zod types), not a
 * `ZodObject`, because `McpServer.registerTool` expects a raw shape. `handle`
 * receives the already-parsed, typed input — the SDK validates arguments against
 * `inputSchema` before the handler runs.
 *
 * @typeParam InputShape - The tool's Zod raw shape.
 * @typeParam Output - The plain domain value the handler resolves to; the adapter
 * serializes whatever it returns.
 */
export interface ToolDefinition<InputShape extends z.ZodRawShape, Output = unknown> {
  /** Stable tool name, e.g. `redmine_list_issues`. */
  readonly name: string;
  /** Human-readable title. */
  readonly title: string;
  /** Agent-facing description of what the tool does and when to use it. */
  readonly description: string;
  /** The input shape (a Zod raw shape) the SDK validates arguments against. */
  readonly inputSchema: InputShape;
  /** Optional behavioural hints (read-only, destructive, …). */
  readonly annotations?: ToolAnnotations;
  /** Execute the tool against a resolved {@link ToolContext}. */
  // zod v4 removed `objectOutputType`; infer the parsed shape via `ZodObject`.
  handle(input: z.infer<z.ZodObject<InputShape>>, ctx: ToolContext): Promise<Output>;
}

/**
 * Identity helper that exists purely for inference ergonomics: it lets a tool
 * author write `defineTool({ … })` and have `handle`'s `input` parameter typed
 * from `inputSchema` without restating the generic parameters.
 */
export function defineTool<InputShape extends z.ZodRawShape, Output>(
  def: ToolDefinition<InputShape, Output>,
): ToolDefinition<InputShape, Output> {
  return def;
}
