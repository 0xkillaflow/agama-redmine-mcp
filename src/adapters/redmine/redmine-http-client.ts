/**
 * Redmine HTTP client assembly.
 *
 * Composes the resource clients over a single credential-bound
 * {@link HttpRequester} into the `RedmineClient` port. The HTTP → domain error
 * mapper is adapted here from its total, returning form ({@link mapHttpError})
 * to the throwing `HttpErrorMapper` the requester expects.
 *
 * A {@link RedmineClientFactory} binds base URL, timeout, and logger (from
 * `AppConfig`) once and mints a client per credential set — the stdio transport
 * caches one; the future http transport builds one per request from a bearer
 * token.
 */

import { createHttpRequester } from './http-requester.js';
import { mapHttpError } from './error-mapper.js';
import { createIssuesResource } from './resources/issues.js';
import { createIssueRelationsResource } from './resources/issue-relations.js';
import { createProjectsResource } from './resources/projects.js';
import { createTimeEntriesResource } from './resources/time-entries.js';
import { createUsersResource } from './resources/users.js';
import { createSearchResource } from './resources/search.js';
import { createReferenceDataResource } from './resources/reference-data.js';
import { createAttachmentsResource } from './resources/attachments.js';
import type { Logger, RedmineClient, RedmineCredentials } from '../../domain/ports/index.js';

/** Everything needed to build one credential-bound {@link RedmineClient}. */
export interface RedmineHttpClientOptions {
  /** Base URL of the Redmine instance. */
  readonly baseUrl: string;
  /** Credentials bound to every request this client makes. */
  readonly credentials: RedmineCredentials;
  /** Per-request timeout in milliseconds. */
  readonly timeoutMs: number;
  /** Structured logger. */
  readonly logger: Logger;
}

/**
 * Build a `RedmineClient` bound to the given credentials: one requester, one
 * resource client per port group, nothing more than the port surface.
 */
export function createRedmineHttpClient(options: RedmineHttpClientOptions): RedmineClient {
  const http = createHttpRequester({
    baseUrl: options.baseUrl,
    credentials: options.credentials,
    timeoutMs: options.timeoutMs,
    logger: options.logger,
    // Adapt the returning mapper to the requester's throwing contract.
    mapError: (context) => {
      throw mapHttpError(context);
    },
  });

  return {
    issues: createIssuesResource(http),
    issueRelations: createIssueRelationsResource(http),
    projects: createProjectsResource(http),
    timeEntries: createTimeEntriesResource(http),
    users: createUsersResource(http),
    search: createSearchResource(http),
    referenceData: createReferenceDataResource(http),
    attachments: createAttachmentsResource(http),
  };
}

/**
 * Mints a {@link RedmineClient} for a given credential set. The seam the MCP
 * transports use: stdio creates one client up front; http builds one per request
 * from the inbound bearer token.
 */
export interface RedmineClientFactory {
  create(credentials: RedmineCredentials): RedmineClient;
}

/** Config-derived settings shared by every client a factory produces. */
export interface RedmineClientFactoryOptions {
  /** Base URL of the Redmine instance. */
  readonly baseUrl: string;
  /** Per-request timeout in milliseconds. */
  readonly timeoutMs: number;
  /** Structured logger. */
  readonly logger: Logger;
}

/**
 * Build a {@link RedmineClientFactory} that binds base URL, timeout, and logger,
 * leaving only the credentials to be injected per client.
 */
export function createRedmineClientFactory(
  options: RedmineClientFactoryOptions,
): RedmineClientFactory {
  return {
    create: (credentials: RedmineCredentials): RedmineClient =>
      createRedmineHttpClient({ ...options, credentials }),
  };
}
