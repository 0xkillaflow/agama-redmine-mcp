/**
 * HTTP → domain error mapper.
 *
 * Translates a failed Redmine response (status + best-effort body) into the
 * correct typed {@link RedmineError}. This is the single place that knows how
 * Redmine signals each failure class, keeping the requester and resource clients
 * free of status-code policy.
 *
 * Two entry points:
 *  - {@link mapHttpError} — a non-2xx response → the matching domain error.
 *  - {@link mapSchemaError} — a 2xx body that fails Zod validation in a resource
 *    client → a {@link RedmineTransportError} ("unexpected response shape").
 *
 * The mapper is total and defensive: it never throws, degrading malformed or
 * empty bodies to a generic error rather than propagating a parse failure.
 * Returned errors carry `status`, a secret-free `details` subset of the body,
 * and the originating `cause` when available.
 */

import type { ZodError } from 'zod';
import { RedmineErrorsBodySchema } from '../../domain/models/index.js';
import {
  RedmineAuthError,
  RedmineForbiddenError,
  RedmineNotFoundError,
  RedmineRateLimitError,
  RedmineTransportError,
  RedmineValidationError,
  type RedmineError,
} from '../../domain/errors/index.js';

/** The failed-response context handed to {@link mapHttpError}. */
export interface HttpErrorInput {
  /** The response status code. */
  readonly status: number;
  /** Best-effort decoded body: parsed JSON, raw text, or `undefined` when empty. */
  readonly body: unknown;
  /**
   * Response headers, when the caller can supply them. Only `Retry-After` is
   * consulted (for `429`); a `Headers`-like `get` is all that is required.
   */
  readonly headers?: Pick<Headers, 'get'>;
  /** The underlying error, when the failure originated from a thrown cause. */
  readonly cause?: unknown;
}

/** Cap on how much raw text (e.g. an HTML 500 page) we retain in `details`. */
const MAX_DETAIL_TEXT = 500;

/**
 * A secret-free subset of the body, safe to expose as `details`. Structured
 * JSON (Redmine's own error envelopes) passes through unchanged; long free text
 * is truncated so an HTML error page never balloons the error.
 */
function safeDetails(body: unknown): unknown {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') {
    return body.length > MAX_DETAIL_TEXT ? `${body.slice(0, MAX_DETAIL_TEXT)}…` : body;
  }
  return body;
}

/**
 * Parse a `Retry-After` header value. Redmine sends the delta-seconds form; a
 * non-negative integer is honoured and anything else (e.g. the HTTP-date form)
 * is ignored.
 */
function parseRetryAfter(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const seconds = Number(raw.trim());
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined;
}

/**
 * Map a non-2xx Redmine response to the matching domain error.
 *
 * Status drives the mapping: `401/403/404` are direct; `422` extracts Redmine's
 * `errors[]` into the validation error's `messages`; `429` reports the
 * `Retry-After` delay when present. Everything else — `5xx`, unrecognised
 * statuses, non-JSON bodies — degrades to a {@link RedmineTransportError}.
 */
export function mapHttpError(input: HttpErrorInput): RedmineError {
  const { status, body, cause } = input;
  const details = safeDetails(body);

  switch (status) {
    case 401:
      return new RedmineAuthError('Authentication failed', { details, cause });
    case 403:
      return new RedmineForbiddenError('Access forbidden', { details, cause });
    case 404:
      return new RedmineNotFoundError('Resource not found', { details, cause });
    // `406` is Redmine's rejection code for a refused upload (a file over
    // `attachment_max_size`, a disallowed type). It carries the same `errors`
    // envelope as a `422`, so it is a validation failure the agent can act on —
    // not the "unexpected response" the default branch would report.
    case 406:
    case 422: {
      // Parse Redmine's `{ errors: string[] }` envelope defensively; a body that
      // does not match yields an empty message list and the error's generic text.
      const parsed = RedmineErrorsBodySchema.safeParse(body);
      const messages = parsed.success ? parsed.data.errors : [];
      return new RedmineValidationError(messages, { status, details, cause });
    }
    case 429: {
      const retryAfter = parseRetryAfter(input.headers?.get('retry-after'));
      return new RedmineRateLimitError('Rate limit exceeded', {
        details,
        cause,
        ...(retryAfter !== undefined ? { retryAfter } : {}),
      });
    }
    default:
      return new RedmineTransportError(
        status >= 500
          ? `Redmine server error (HTTP ${status})`
          : `Unexpected Redmine response (HTTP ${status})`,
        { status, details, cause },
      );
  }
}

/**
 * Map a Zod validation failure on an otherwise successful (2xx) response to a
 * {@link RedmineTransportError}. Used by resource clients when a body does not
 * match its expected schema. `context` names the operation
 * (e.g. `list issues`) and is carried, with a compact issue summary, in
 * `details`; the {@link ZodError} is preserved as the cause.
 */
export function mapSchemaError(error: ZodError, context: string): RedmineTransportError {
  return new RedmineTransportError('Unexpected response shape from Redmine', {
    details: {
      context,
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    cause: error,
  });
}
