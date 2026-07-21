/**
 * The credential-resolution port.
 *
 * This is the seam that lets the same tool code run in single-user (stdio/env)
 * and multi-user (http/header) modes. A {@link CredentialProvider} turns the
 * metadata of an inbound request into the {@link RedmineCredentials} to bind a
 * {@link RedmineClient} to.
 *
 * The port depends only on `domain/models`/`domain/errors` — no SDK, no Node HTTP.
 */

import type { RedmineCredentials } from './redmine-client.js';

/**
 * The slice of an inbound request a provider may inspect. Only headers are
 * needed today (to extract an `Authorization` bearer token in http mode); the
 * stdio provider ignores this entirely and returns a constant key.
 */
export interface RequestMeta {
  readonly headers?: Record<string, string | undefined>;
}

/**
 * Resolves the credentials to use for a given inbound request.
 *
 * Implementations may throw `RedmineAuthError` when no usable credential is
 * present (e.g. a missing or malformed `Authorization` header in http mode).
 */
export interface CredentialProvider {
  resolve(meta: RequestMeta): Promise<RedmineCredentials>;
}
