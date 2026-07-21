/**
 * Environment credential provider.
 *
 * The stdio, single-user provider: it is bound to the single `REDMINE_API_KEY`
 * from the environment and returns it for *every* inbound request, ignoring the
 * request metadata entirely. Multi-user resolution is the http-mode
 * `HeaderCredentialProvider`'s job.
 */

import { RedmineAuthError } from '../../domain/errors/index.js';
import type { CredentialProvider, RedmineCredentials } from '../../domain/ports/index.js';

/**
 * Build a {@link CredentialProvider} that resolves the given API key for all
 * requests. The key is validated eagerly: an empty (or whitespace-only) key is a
 * `RedmineAuthError`, surfaced at construction so a misconfigured server fails
 * before serving any tool call.
 *
 * @param apiKey - The single Redmine API key (from `REDMINE_API_KEY`).
 */
export function createEnvCredentialProvider(apiKey: string): CredentialProvider {
  if (apiKey.trim().length === 0) {
    throw new RedmineAuthError('REDMINE_API_KEY is empty');
  }

  const credentials: RedmineCredentials = { kind: 'apiKey', value: apiKey };

  return {
    // The single-user provider ignores per-request metadata by design, so it
    // takes no argument (a narrower signature still satisfies the port).
    resolve: (): Promise<RedmineCredentials> => Promise.resolve(credentials),
  };
}
