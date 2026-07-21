/**
 * Typed domain error hierarchy.
 *
 * Outbound adapters throw these; the MCP adapter is the single place that formats
 * them into protocol-level tool results. No raw exceptions or HTTP concepts leak
 * into the application: a status code is carried as data, not as a type. Each
 * error exposes a stable machine-readable {@link RedmineError.code}.
 *
 * The HTTP → error mapping and the error → MCP-result mapping live in the adapters;
 * this file defines the types only.
 *
 * Note: startup configuration failures use `ConfigError` from `config/`, which is
 * deliberately *not* part of this hierarchy — config errors abort the process
 * before any Redmine call and are handled by the bootstrap, not the MCP layer.
 */

/** Common construction options shared by every {@link RedmineError}. */
export interface RedmineErrorOptions {
  /** Originating HTTP status, when the error came from a Redmine response. */
  readonly status?: number;
  /** Arbitrary structured context (e.g. the raw error body). Never a secret. */
  readonly details?: unknown;
  /** The underlying error, preserved via the native `Error` cause chain. */
  readonly cause?: unknown;
}

/**
 * Base class for all errors that represent a failed interaction with Redmine.
 *
 * Subclasses set a stable `code` and a human-readable `name`. The prototype chain
 * is restored in the constructor so `instanceof` is reliable when targeting ES2022
 * under TypeScript/ESM.
 */
export abstract class RedmineError extends Error {
  /** Stable, machine-readable identifier (e.g. `REDMINE_NOT_FOUND`). */
  abstract readonly code: string;

  /** Originating HTTP status, when applicable. */
  readonly status?: number;

  /** Arbitrary structured context. Free of secrets. */
  readonly details?: unknown;

  constructor(message: string, options: RedmineErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'RedmineError';
    if (options.status !== undefined) this.status = options.status;
    if (options.details !== undefined) this.details = options.details;
    // Restore the prototype chain for reliable `instanceof` across the hierarchy.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 401 — missing or invalid API key / token. */
export class RedmineAuthError extends RedmineError {
  readonly code = 'REDMINE_AUTH';

  constructor(message = 'Authentication failed', options: RedmineErrorOptions = {}) {
    super(message, { status: 401, ...options });
    this.name = 'RedmineAuthError';
  }
}

/** 403 — authenticated but not permitted to perform the action. */
export class RedmineForbiddenError extends RedmineError {
  readonly code = 'REDMINE_FORBIDDEN';

  constructor(message = 'Access forbidden', options: RedmineErrorOptions = {}) {
    super(message, { status: 403, ...options });
    this.name = 'RedmineForbiddenError';
  }
}

/** 404 — the requested resource does not exist. */
export class RedmineNotFoundError extends RedmineError {
  readonly code = 'REDMINE_NOT_FOUND';

  constructor(message = 'Resource not found', options: RedmineErrorOptions = {}) {
    super(message, { status: 404, ...options });
    this.name = 'RedmineNotFoundError';
  }
}

/**
 * 422 — Redmine rejected the request payload. Carries Redmine's `errors` array
 * (see the core `errors` schema) as {@link RedmineValidationError.messages}.
 */
export class RedmineValidationError extends RedmineError {
  readonly code = 'REDMINE_VALIDATION';

  /** The human-readable validation messages returned by Redmine. */
  readonly messages: string[];

  constructor(messages: string[], options: RedmineErrorOptions = {}) {
    super(messages.length > 0 ? messages.join('; ') : 'Validation failed', {
      status: 422,
      ...options,
    });
    this.name = 'RedmineValidationError';
    this.messages = messages;
  }
}

/** Options for {@link RedmineRateLimitError}. */
export interface RateLimitErrorOptions extends RedmineErrorOptions {
  /** Seconds to wait before retrying, from a `Retry-After` header if present. */
  readonly retryAfter?: number;
}

/** 429 — too many requests. Optionally reports a retry delay. */
export class RedmineRateLimitError extends RedmineError {
  readonly code = 'REDMINE_RATE_LIMIT';

  /** Suggested seconds to wait before retrying, when Redmine provides it. */
  readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', options: RateLimitErrorOptions = {}) {
    super(message, { status: 429, ...options });
    this.name = 'RedmineRateLimitError';
    if (options.retryAfter !== undefined) this.retryAfter = options.retryAfter;
  }
}

/**
 * Transport-level failure: network error, timeout, 5xx response, malformed JSON,
 * or a response that did not match its expected schema. No
 * fixed status — a 5xx status may be supplied via {@link RedmineErrorOptions}.
 */
export class RedmineTransportError extends RedmineError {
  readonly code = 'REDMINE_TRANSPORT';

  constructor(
    message = 'Transport error communicating with Redmine',
    options: RedmineErrorOptions = {},
  ) {
    super(message, options);
    this.name = 'RedmineTransportError';
  }
}

/**
 * Marks a deliberately unimplemented seam — currently the http transport
 * placeholder. It is intentionally *not* a {@link RedmineError}: it signals a
 * server-side capability gap, not a failed Redmine interaction, so
 * {@link isRedmineError} does not narrow to it.
 */
export class NotImplementedError extends Error {
  readonly code = 'NOT_IMPLEMENTED';

  constructor(message = 'Not implemented', options: { cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'NotImplementedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Type guard narrowing an unknown value to the {@link RedmineError} hierarchy. */
export function isRedmineError(value: unknown): value is RedmineError {
  return value instanceof RedmineError;
}
