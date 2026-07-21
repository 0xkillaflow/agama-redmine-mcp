/**
 * The tool registry.
 *
 * Collects every {@link ToolDefinition} the server exposes into one list the MCP
 * adapter iterates over at startup. Names must be unique — a duplicate is a
 * wiring mistake, so it is rejected eagerly (at build time) rather than surfacing
 * as a confusing runtime override.
 */

import type { z } from 'zod';
import type { ToolDefinition } from './tool-definition.js';

/**
 * A tool of any concrete input shape. The registry is heterogeneous — it holds
 * tools with differing schemas — so it erases the per-tool generics to the
 * widest bounds.
 */
export type AnyToolDefinition = ToolDefinition<z.ZodRawShape, unknown>;

/** The collected set of tools, iterated by the MCP adapter at registration. */
export interface ToolRegistry {
  /** All registered tools, in insertion order. */
  list(): readonly AnyToolDefinition[];
}

/**
 * Build a {@link ToolRegistry} from the given tools, rejecting duplicate names.
 *
 * @param tools - The assembled tool definitions.
 * @throws Error if two tools share a `name`.
 */
export function createToolRegistry(tools: AnyToolDefinition[]): ToolRegistry {
  const seen = new Set<string>();
  for (const tool of tools) {
    if (seen.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    seen.add(tool.name);
  }

  return {
    list: (): readonly AnyToolDefinition[] => tools,
  };
}
