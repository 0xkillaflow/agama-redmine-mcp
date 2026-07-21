import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createRedmineHttpClient,
  createRedmineClientFactory,
} from '../../../src/adapters/redmine/redmine-http-client.js';
import { RedmineNotFoundError } from '../../../src/domain/errors/index.js';
import type { Logger, RedmineClient } from '../../../src/domain/ports/index.js';
import { userFixture } from './resources/support.js';

/** A logger that discards every record. */
const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};

const baseOptions = {
  baseUrl: 'https://redmine.example.com',
  timeoutMs: 1000,
  logger: silentLogger,
};

describe('createRedmineHttpClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const build = (): RedmineClient =>
    createRedmineHttpClient({ ...baseOptions, credentials: { kind: 'apiKey', value: 'k' } });

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes all five resources', () => {
    const client = build();
    expect(Object.keys(client).sort()).toEqual([
      'issues',
      'projects',
      'search',
      'timeEntries',
      'users',
    ]);
  });

  it('delegates a resource call through the requester to fetch', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user: userFixture }), { status: 200 }),
    );
    const client = build();

    const user = await client.users.getCurrent(['groups']);

    expect(user.id).toBe(7);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe('https://redmine.example.com/users/current.json?include=groups');
    expect(init.headers['X-Redmine-API-Key']).toBe('k');
  });

  it('maps a non-2xx response to the matching domain error via the injected mapper', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
    const client = build();

    await expect(client.issues.get(999)).rejects.toBeInstanceOf(RedmineNotFoundError);
  });
});

describe('createRedmineClientFactory', () => {
  it('mints a client per credential set', () => {
    const factory = createRedmineClientFactory(baseOptions);
    const client = factory.create({ kind: 'bearer', value: 'token' });

    // A well-formed RedmineClient with the full resource surface.
    expect(client.issues).toBeDefined();
    expect(client.projects).toBeDefined();
    expect(client.timeEntries).toBeDefined();
    expect(client.users).toBeDefined();
    expect(client.search).toBeDefined();
  });
});
