/**
 * Header credential provider.
 *
 * The multi-user, http-mode provider: it reads a per-request
 * `Authorization: Bearer <token>` header and returns that token as `bearer`
 * credentials, so a single server instance can serve many Redmine users each
 * with their own token. Functional and unit-tested today, it is only wired once
 * the http transport exists.
 *
 * It is free of transport specifics beyond {@link RequestMeta}: it inspects only
 * request headers.
 */

import { RedmineAuthError } from '../../domain/errors/index.js';
import type {
  CredentialProvider,
  RedmineCredentials,
  RequestMeta,
} from '../../domain/ports/index.js';

/** The `Bearer ` scheme prefix, matched case-insensitively. */
const BEARER_PREFIX = 'bearer ';

/**
 * Find a header value by name, case-insensitively (HTTP header names are
 * case-insensitive; a client may send `Authorization` or `authorization`).
 */
function findHeader(headers: Record<string, string | undefined>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

/**
 * Build a {@link CredentialProvider} that extracts a bearer token from each
 * request's `Authorization` header.
 *
 * `resolve` throws a `RedmineAuthError` when the header is missing or does not
 * carry a non-empty `Bearer <token>` value.
 */
export function createHeaderCredentialProvider(): CredentialProvider {
  return {
    resolve: (meta: RequestMeta): Promise<RedmineCredentials> => {
      const raw = meta.headers ? findHeader(meta.headers, 'authorization') : undefined;
      if (raw === undefined) {
        return Promise.reject(new RedmineAuthError('Missing Authorization header'));
      }

      const value = raw.trim();
      if (!value.toLowerCase().startsWith(BEARER_PREFIX)) {
        return Promise.reject(
          new RedmineAuthError('Authorization header must use the Bearer scheme'),
        );
      }

      const token = value.slice(BEARER_PREFIX.length).trim();
      if (token.length === 0) {
        return Promise.reject(new RedmineAuthError('Bearer token is empty'));
      }

      return Promise.resolve({ kind: 'bearer', value: token });
    },
  };
}
