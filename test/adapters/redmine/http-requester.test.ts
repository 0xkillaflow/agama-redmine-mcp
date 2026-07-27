import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createHttpRequester,
  type HttpErrorContext,
  type HttpRequesterOptions,
} from '../../../src/adapters/redmine/http-requester.js';
import { RedmineNotFoundError, RedmineTransportError } from '../../../src/domain/errors/index.js';
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

  it('issues a DELETE with the API key and no body, resolving undefined on 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { requester } = build();

    await expect(requester.del('/issues/42.json')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe('https://redmine.example.com/issues/42.json');
    expect(init.method).toBe('DELETE');
    expect(init.headers['X-Redmine-API-Key']).toBe(API_KEY);
    expect(init.body).toBeUndefined();
  });

  it('routes a 404 DELETE through the error mapper', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
    const mapError = vi.fn((): never => {
      throw new RedmineNotFoundError();
    });
    const { requester } = build({ mapError });

    await expect(requester.del('/issues/999.json')).rejects.toBeInstanceOf(RedmineNotFoundError);
    expect(mapError).toHaveBeenCalledWith({ status: 404, body: {} });
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

  describe('postBinary', () => {
    it('sends raw bytes as octet-stream with the API key and filename query', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ upload: { id: 7, token: 'tok' } }), { status: 201 }),
      );
      const { requester } = build();
      const bytes = new Uint8Array([0x00, 0xff, 0x10, 0x42]);

      const result = await requester.postBinary('/uploads.json', bytes, 'filename=log.txt');

      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        'https://redmine.example.com/uploads.json?filename=log.txt',
      );
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit & {
        headers: Record<string, string>;
      };
      expect(init.headers['Content-Type']).toBe('application/octet-stream');
      expect(init.headers['X-Redmine-API-Key']).toBe(API_KEY);
      // The exact bytes, not a JSON-stringified view of them.
      expect(init.body).toBe(bytes);
      expect(result).toEqual({ upload: { id: 7, token: 'tok' } });
    });

    it('does not leave the JSON verbs sending octet-stream', async () => {
      // A fresh Response per call: a body can only be read once.
      fetchMock.mockImplementation(() => Promise.resolve(new Response('{}', { status: 201 })));
      const { requester } = build();

      await requester.postBinary('/uploads.json', new Uint8Array([1]));
      await requester.post('/issues.json', { subject: 'hi' });

      const init = fetchMock.mock.calls[1]?.[1] as RequestInit & {
        headers: Record<string, string>;
      };
      expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('never logs the request body', async () => {
      fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));
      const { requester, records } = build();

      await requester.postBinary('/uploads.json', new TextEncoder().encode('top secret payload'));

      expect(JSON.stringify(records)).not.toContain('top secret');
    });
  });

  describe('getBinary', () => {
    it('returns the exact bytes and content type, sending Accept: */*', async () => {
      const payload = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      fetchMock.mockResolvedValue(
        new Response(payload, { status: 200, headers: { 'content-type': 'image/png' } }),
      );
      const { requester } = build();

      const result = await requester.getBinary('/attachments/download/7/logo.png');

      expect(Array.from(result.bytes)).toEqual(Array.from(payload));
      expect(result.contentType).toBe('image/png');
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit & {
        headers: Record<string, string>;
      };
      expect(init.headers['Accept']).toBe('*/*');
      expect(init.headers['X-Redmine-API-Key']).toBe(API_KEY);
    });

    it('does not attempt a JSON decode of a non-JSON body', async () => {
      // Binary content is not valid JSON; the JSON verbs would raise here.
      fetchMock.mockResolvedValue(new Response(new Uint8Array([0x00, 0x01]), { status: 200 }));
      const { requester } = build();

      const result = await requester.getBinary('/attachments/download/7/blob.bin');

      expect(Array.from(result.bytes)).toEqual([0x00, 0x01]);
    });

    it('routes a 404 through the injected error mapper', async () => {
      fetchMock.mockResolvedValue(new Response('not found', { status: 404 }));
      const mapError = vi.fn((): never => {
        throw new RedmineNotFoundError();
      });
      const { requester } = build({ mapError });

      await expect(requester.getBinary('/attachments/download/9/x.bin')).rejects.toBeInstanceOf(
        RedmineNotFoundError,
      );
      expect(mapError).toHaveBeenCalledWith({ status: 404, body: 'not found' });
    });
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
