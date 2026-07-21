import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createHttpRequester,
  type HttpErrorContext,
  type HttpRequesterOptions,
} from '../../../src/adapters/redmine/http-requester.js';
import { RedmineTransportError } from '../../../src/domain/errors/index.js';
import type { Logger, LogMeta } from '../../../src/domain/ports/index.js';

/** A logger that records every emitted record for later inspection. */
function recordingLogger(): { logger: Logger; records: { msg: string; meta?: LogMeta }[] } {
  const records: { msg: string; meta?: LogMeta }[] = [];
  const push = (msg: string, meta?: LogMeta): void => {
    records.push(meta !== undefined ? { msg, meta } : { msg });
  };
  const logger: Logger = {
    debug: push,
    info: push,
    warn: push,
    error: push,
    child: () => logger,
  };
  return { logger, records };
}

const API_KEY = 'super-secret-key';

describe('createHttpRequester', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const build = (
    overrides: Partial<HttpRequesterOptions> = {},
  ): {
    requester: ReturnType<typeof createHttpRequester>;
    records: { msg: string; meta?: LogMeta }[];
  } => {
    const { logger, records } = recordingLogger();
    const requester = createHttpRequester({
      baseUrl: 'https://redmine.example.com/',
      credentials: { kind: 'apiKey', value: API_KEY },
      timeoutMs: 50,
      logger,
      mapError: (ctx: HttpErrorContext) => {
        throw new Error(`mapped:${ctx.status}`);
      },
      ...overrides,
    });
    return { requester, records };
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a 2xx JSON body and joins base URL with path', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { requester } = build();

    const result = await requester.get('/issues/1.json');

    expect(result).toEqual({ id: 1 });
    // No double slash despite the base URL's trailing slash.
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://redmine.example.com/issues/1.json');
  });

  it('appends a query string to GET requests', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const { requester } = build();

    await requester.get('/issues.json', 'status_id=1,2');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://redmine.example.com/issues.json?status_id=1,2',
    );
  });

  it('returns undefined for a 204 response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { requester } = build();

    await expect(requester.put('/issues/1.json', { subject: 'x' })).resolves.toBeUndefined();
  });

  it('sends the API key and JSON headers, and serializes the body', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));
    const { requester } = build();

    await requester.post('/issues.json', { subject: 'hi' });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { headers: Record<string, string> };
    expect(init.headers['X-Redmine-API-Key']).toBe(API_KEY);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Accept']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ subject: 'hi' }));
  });

  it('throws a transport error when the request times out', async () => {
    // Never resolve; reject only when the abort signal fires.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    const { requester } = build({ timeoutMs: 10 });

    await expect(requester.get('/issues.json')).rejects.toBeInstanceOf(RedmineTransportError);
  });

  it('wraps a network failure in a transport error carrying the cause', async () => {
    const cause = new Error('ECONNREFUSED');
    fetchMock.mockRejectedValue(cause);
    const { requester } = build();

    const error = await requester.get('/issues.json').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RedmineTransportError);
    expect((error as RedmineTransportError).cause).toBe(cause);
  });

  it('routes a non-2xx response through the error mapper with status and body', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: ['boom'] }), { status: 422 }),
    );
    const mapError = vi.fn((): never => {
      throw new Error('mapped');
    });
    const { requester } = build({ mapError });

    await expect(requester.get('/issues.json')).rejects.toThrow('mapped');
    expect(mapError).toHaveBeenCalledWith({ status: 422, body: { errors: ['boom'] } });
  });

  it('raises a transport error on malformed 2xx JSON', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    const { requester } = build();

    await expect(requester.get('/issues.json')).rejects.toBeInstanceOf(RedmineTransportError);
  });

  it('logs the request without leaking the API key', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const { requester, records } = build();

    await requester.get('/issues.json', 'q=1');

    expect(JSON.stringify(records)).not.toContain(API_KEY);
    const metas = records.map((r) => r.meta ?? {});
    expect(metas).toContainEqual(
      expect.objectContaining({ method: 'GET', path: '/issues.json', status: 200 }),
    );
  });
});
