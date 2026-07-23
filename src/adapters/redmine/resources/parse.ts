/**
 * Response-parsing helpers shared by every resource client.
 *
 * A successful (2xx) Redmine body is still untrusted: it must match its domain
 * model. These helpers Zod-parse it and, on a mismatch, convert the failure into
 * a {@link mapSchemaError | transport error} carrying the operation `context` —
 * so a shape drift surfaces as a clean domain error rather than a raw throw.
 */

import { z } from 'zod';
import { mapSchemaError } from '../error-mapper.js';

/**
 * Parse a full 2xx body against `schema`. A shape mismatch becomes a
 * {@link RedmineTransportError} tagged with `context` (e.g. `list issues`).
 */
export function parseBody<Schema extends z.ZodTypeAny>(
  schema: Schema,
  body: unknown,
  context: string,
): z.infer<Schema> {
  const result = schema.safeParse(body);
  if (!result.success) throw mapSchemaError(result.error, context);
  return result.data;
}

/**
 * Parse a single-object envelope — Redmine wraps a resource under a named key
 * (`{ issue }`, `{ project }`, `{ user }`, …) — and return the unwrapped value.
 * A shape mismatch (including a missing key) becomes a transport error.
 *
 * @param key - The envelope property holding the resource (e.g. `'issue'`).
 * @param schema - Schema for the wrapped resource.
 */
export function parseEnvelope<Schema extends z.ZodTypeAny>(
  key: string,
  schema: Schema,
  body: unknown,
  context: string,
): z.infer<Schema> {
  const parsed = parseBody(z.object({ [key]: schema }), body, context);
  // The envelope parse guarantees `key` exists; assert past the index signature.
  return (parsed as Record<string, z.infer<Schema>>)[key] as z.infer<Schema>;
}
