/**
 * The Redmine HTTP requester.
 *
 * A minimal, credential-bound `fetch` wrapper: it joins the base URL, sets the
 * auth and JSON headers, applies a timeout via `AbortController`, and decodes
 * the response. It is deliberately free of resource knowledge (no issue/project
 * specifics) — resource clients build paths and queries and feed them here.
 *
 * On failure it stays out of the policy business: network/timeout problems
 * become a {@link RedmineTransportError}, and any non-2xx response is handed to
 * the injected error mapper, which throws the appropriate domain error. The
 * mapper is injected (rather than imported) so the requester is decoupled from,
 * and testable without, the HTTP → domain error mapping.
 *
 * Uses Node 20 globals (`fetch`, `AbortController`, `Response`).
 */

import { RedmineTransportError } from '../../domain/errors/index.js';
import type { Logger, RedmineCredentials } from '../../domain/ports/index.js';

/** The `{ status, body }` pair handed to the error mapper for a non-2xx response. */
export interface HttpErrorContext {
  readonly status: number;
  /** Best-effort decoded body: parsed JSON, raw text, or `undefined` when empty. */
  readonly body: unknown;
}

/**
 * Maps a non-2xx Redmine response to a thrown domain error. Never returns
 * normally. The concrete implementation lives in the error-mapper module and is
 * injected here.
 */
export type HttpErrorMapper = (context: HttpErrorContext) => never;

/** Construction options for {@link createHttpRequester}. */
export interface HttpRequesterOptions {
  /** Base URL of the Redmine instance (trailing slash optional). */
  readonly baseUrl: string;
  /** Credentials bound to every request (sent as `X-Redmine-API-Key`). */
  readonly credentials: RedmineCredentials;
  /** Per-request timeout in milliseconds. */
  readonly timeoutMs: number;
  /** Structured logger; requests are logged at `debug` (never the API key). */
  readonly logger: Logger;
  /** Maps a non-2xx response to a thrown domain error. */
  readonly mapError: HttpErrorMapper;
}

/**
 * The low-level Redmine transport. Each method returns the parsed JSON body
 * (`unknown`) for a 2xx response that has one, or `undefined` for `204 No
 * Content`. Paths are given by resource clients (e.g. `/issues.json`); `query`
 * is an already-serialized query string (see the request builder).
 */
export interface HttpRequester {
  get(path: string, query?: string): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  put(path: string, body?: unknown): Promise<unknown>;
  del(path: string): Promise<unknown>;
}

/** Join a base URL and a path, tolerating a trailing/leading slash on either. */
function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const rel = path.startsWith('/') ? path : `/${path}`;
  return `${base}${rel}`;
}

/**
 * Decode a successful response body as JSON. An empty body yields `undefined`;
 * malformed JSON is a transport-level failure.
 */
async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new RedmineTransportError('Received malformed JSON from Redmine', {
      status: response.status,
      cause,
    });
  }
}

/**
 * Best-effort decode of an error response body: parsed JSON when possible,
 * otherwise the raw text, or `undefined` when empty. Never throws — the error
 * mapper decides what the failure means.
 */
async function readErrorBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Create a credential-bound Redmine HTTP requester.
 *
 * @param options - Base URL, credentials, timeout, logger, and error mapper.
 */
export function createHttpRequester(options: HttpRequesterOptions): HttpRequester {
  const { baseUrl, credentials, timeoutMs, logger, mapError } = options;

  // Auth header carries the credential value for both `apiKey` and `bearer`
  // kinds — Redmine accepts an API key or a user token here.
  const headers: Record<string, string> = {
    'X-Redmine-API-Key': credentials.value,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  async function request(
    method: string,
    path: string,
    init: { query?: string | undefined; body?: unknown } = {},
  ): Promise<unknown> {
    const target = joinUrl(baseUrl, path);
    const url = init.query ? `${target}?${init.query}` : target;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });
    } catch (cause) {
      // An aborted signal means we hit the timeout; anything else is a network
      // error. Both surface as a transport error carrying the original cause.
      throw controller.signal.aborted
        ? new RedmineTransportError(`Redmine request timed out after ${timeoutMs}ms`, { cause })
        : new RedmineTransportError('Network error communicating with Redmine', { cause });
    } finally {
      clearTimeout(timer);
    }

    // Log the outcome — method, path, status, duration — but never the API key.
    logger.debug('redmine request', {
      method,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    if (!response.ok) {
      // Delegates to the injected mapper, which throws a domain error.
      mapError({ status: response.status, body: await readErrorBody(response) });
    }

    if (response.status === 204) return undefined;
    return readJsonBody(response);
  }

  return {
    get: (path, query) => request('GET', path, { query }),
    post: (path, body) => request('POST', path, { body }),
    put: (path, body) => request('PUT', path, { body }),
    del: (path) => request('DELETE', path),
  };
}
