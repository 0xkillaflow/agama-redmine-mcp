/**
 * The Redmine HTTP requester.
 *
 * A minimal, credential-bound `fetch` wrapper: it joins the base URL, sets the
 * auth header and the per-verb content negotiation, applies a timeout via
 * `AbortController`, and decodes the response. It is deliberately free of
 * resource knowledge (no issue/project specifics) — resource clients build paths
 * and queries and feed them here. Headers are assembled per request rather than
 * shared and mutated, so the binary verbs cannot affect the JSON ones.
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

/** A raw (non-JSON) response body, as returned by {@link HttpRequester.getBinary}. */
export interface BinaryResponse {
  /** The response body's exact bytes. */
  readonly bytes: Uint8Array;
  /** The `Content-Type` header, when the response carried one. */
  readonly contentType?: string;
}

/**
 * The low-level Redmine transport. The JSON verbs return the parsed body
 * (`unknown`) for a 2xx response that has one, or `undefined` for `204 No
 * Content`. Paths are given by resource clients (e.g. `/issues.json`); `query`
 * is an already-serialized query string (see the request builder).
 *
 * The two binary verbs exist for Redmine's attachment endpoints, which are the
 * only ones that are not JSON in both directions: `/uploads.json` takes a raw
 * `application/octet-stream` body, and `/attachments/download/…` returns raw
 * bytes with no envelope.
 */
export interface HttpRequester {
  get(path: string, query?: string): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  put(path: string, body?: unknown): Promise<unknown>;
  del(path: string): Promise<unknown>;
  /** POST raw bytes as `application/octet-stream`; the response is JSON. */
  postBinary(path: string, body: Uint8Array, query?: string): Promise<unknown>;
  /** GET a raw body; nothing is JSON-decoded. */
  getBinary(path: string, query?: string): Promise<BinaryResponse>;
}

/**
 * The two body forms this requester ever sends: a serialized JSON string, or the
 * raw bytes of an upload.
 */
type RequestBody = string | Uint8Array;

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
  // kinds — Redmine accepts an API key or a user token here. Every request
  // *copies* this into its own header set: the binary verbs need different
  // content negotiation, and mutating one shared object would leak that across
  // requests.
  const authHeader: Readonly<Record<string, string>> = {
    'X-Redmine-API-Key': credentials.value,
  };

  /**
   * Issue one request and return the raw {@link Response} for a 2xx result.
   * Owns everything shared by all verbs — URL join, timeout, network-error
   * translation, outcome logging, and non-2xx mapping — and decides nothing
   * about how the body is encoded or decoded. Request bodies are never logged.
   */
  async function send(
    method: string,
    path: string,
    init: {
      query?: string | undefined;
      body?: RequestBody | undefined;
      headers: Readonly<Record<string, string>>;
    },
  ): Promise<Response> {
    const target = joinUrl(baseUrl, path);
    const url = init.query ? `${target}?${init.query}` : target;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: init.headers,
        signal: controller.signal,
        ...(init.body !== undefined ? { body: init.body } : {}),
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

    return response;
  }

  /** A JSON request/response round trip: the default for every Redmine endpoint. */
  async function requestJson(
    method: string,
    path: string,
    init: { query?: string | undefined; body?: unknown } = {},
  ): Promise<unknown> {
    const response = await send(method, path, {
      query: init.query,
      headers: { ...authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });

    if (response.status === 204) return undefined;
    return readJsonBody(response);
  }

  return {
    get: (path, query) => requestJson('GET', path, { query }),
    post: (path, body) => requestJson('POST', path, { body }),
    put: (path, body) => requestJson('PUT', path, { body }),
    del: (path) => requestJson('DELETE', path),

    // Raw upload: the body goes out verbatim as octet-stream (overriding the
    // JSON content type), while the response is still Redmine's JSON envelope.
    postBinary: async (path, body, query) => {
      const response = await send('POST', path, {
        query,
        body,
        headers: {
          ...authHeader,
          'Content-Type': 'application/octet-stream',
          Accept: 'application/json',
        },
      });
      if (response.status === 204) return undefined;
      return readJsonBody(response);
    },

    // Raw download: `Accept: */*` because an attachment is any media type, and
    // no JSON decode — the body is the file.
    getBinary: async (path, query) => {
      const response = await send('GET', path, {
        query,
        headers: { ...authHeader, Accept: '*/*' },
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get('content-type');
      return contentType !== null ? { bytes, contentType } : { bytes };
    },
  };
}
