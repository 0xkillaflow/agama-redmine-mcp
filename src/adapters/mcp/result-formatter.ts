/**
 * Tool result formatter.
 *
 * The single place where a handler's plain domain value becomes an MCP success
 * result, and a thrown domain error becomes an MCP `isError` result. Keeping the
 * SDK's `CallToolResult` type isolated here is what lets `application/` stay
 * SDK-free.
 *
 * Error mapping is agent-facing: each {@link RedmineError} subtype yields a
 * clear, actionable message. Unknown errors collapse to a generic message so no
 * stack trace or secret ever leaks to the client. {@link FileAccessError} is the
 * one non-Redmine error handled here, because a refused local path is something
 * the agent is expected to correct.
 */

import { ZodError } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  FileAccessError,
  RedmineAuthError,
  RedmineForbiddenError,
  RedmineNotFoundError,
  RedmineRateLimitError,
  RedmineTransportError,
  RedmineValidationError,
  isRedmineError,
} from '../../domain/errors/index.js';

/** A non-null, non-array object — the only shape that may become `structuredContent`. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Format a handler's return value as a successful tool result: the value is
 * JSON-serialized into a text content block, and — when it is a plain object —
 * also surfaced as `structuredContent` so clients that understand structured
 * output can consume it directly.
 */
export function formatSuccess(value: unknown): CallToolResult {
  const result: CallToolResult = {
    content: [{ type: 'text', text: JSON.stringify(value) }],
  };
  if (isPlainObject(value)) {
    result.structuredContent = value;
  }
  return result;
}

/**
 * Render a {@link ZodError} from a tool's input validation as one readable
 * sentence. Only each issue's `path` and `message` are surfaced — never the raw
 * error object — so nothing internal leaks. This covers the cross-field checks a
 * raw `inputSchema` cannot express (e.g. the create-time-entry issue/project
 * XOR), which tools enforce with a `superRefine` re-parse in the handler.
 */
function inputErrorMessage(err: ZodError): string {
  const details = err.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
  return `Invalid input: ${details.length > 0 ? details : 'validation failed'}.`;
}

/**
 * Detect Redmine's cascading "blank" 422 that appears when a create/update names
 * a `project_id` Redmine cannot resolve: the missing project knocks out the
 * dependent required fields, yielding
 * "Project cannot be blank; Tracker cannot be blank; Status cannot be blank".
 */
function mentionsBlankProject(messages: readonly string[]): boolean {
  return messages.some((message) => /project cannot be blank/i.test(message));
}

/**
 * Turn a domain error into an agent-actionable message. Each {@link RedmineError}
 * subtype maps to a distinct, useful sentence; the validation error carries
 * Redmine's own field messages. A tool-input {@link ZodError} becomes a clear
 * "Invalid input" message. Anything outside these is treated as an internal
 * fault and reported generically, never leaking its message.
 */
function errorMessage(err: unknown): string {
  if (err instanceof ZodError) {
    return inputErrorMessage(err);
  }
  if (err instanceof FileAccessError) {
    // Surfaced verbatim: the guard's message is written to be agent-facing and
    // secret-free, and the agent can only correct the path if it is told why the
    // path was refused.
    return err.message;
  }
  if (err instanceof RedmineAuthError) {
    return 'Authentication with Redmine failed. Verify the configured API key or bearer token.';
  }
  if (err instanceof RedmineForbiddenError) {
    return 'Redmine denied this action: the authenticated user lacks the required permission.';
  }
  if (err instanceof RedmineNotFoundError) {
    return 'The requested Redmine resource was not found. Check the id or identifier.';
  }
  if (err instanceof RedmineValidationError) {
    const details = err.messages.length > 0 ? err.messages.join('; ') : 'no details provided';
    // Enrich the cascading "blank" 422 with the likely root cause so the agent
    // fixes the project reference rather than chasing the dependent fields.
    const hint = mentionsBlankProject(err.messages)
      ? ' The project id may be missing, invalid, or not accessible — verify project_id.'
      : '';
    return `Redmine rejected the request as invalid: ${details}.${hint}`;
  }
  if (err instanceof RedmineRateLimitError) {
    const retry =
      err.retryAfter !== undefined ? ` Retry after ${err.retryAfter}s.` : ' Retry later.';
    return `Redmine rate limit exceeded.${retry}`;
  }
  if (err instanceof RedmineTransportError) {
    return `Could not communicate with Redmine: ${err.message}`;
  }
  if (isRedmineError(err)) {
    // Defensive default for any future RedmineError subtype not enumerated above.
    return `Redmine request failed: ${err.message}`;
  }
  // Unknown, non-domain error: report generically without leaking internals.
  return 'An internal error occurred while handling the tool call.';
}

/**
 * Format any thrown error as an MCP error result. The result carries a single
 * text block with the agent-facing message and sets `isError`.
 */
export function formatError(err: unknown): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: errorMessage(err) }],
  };
}
