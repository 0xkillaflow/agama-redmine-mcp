import { describe, it, expect, vi, afterEach } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../src/config/index.js';
import type { Container } from '../src/container.js';
import type { Logger } from '../src/domain/ports/index.js';
import type { TransportHandle } from '../src/adapters/mcp/transports/transport-handle.js';

// Shared mock functions, hoisted so the vi.mock factories below can reference them.
const h = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  buildContainer: vi.fn(),
  startStdioTransport: vi.fn(),
  startHttpTransport: vi.fn(),
}));

// Keep the real ConfigError (needed for the friendly-message branch); mock loadConfig only.
vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/index.js')>();
  return { ...actual, loadConfig: h.loadConfig };
});
vi.mock('../src/container.js', () => ({ buildContainer: h.buildContainer }));
vi.mock('../src/adapters/mcp/transports/stdio-transport.js', () => ({
  startStdioTransport: h.startStdioTransport,
}));
vi.mock('../src/adapters/mcp/transports/http-transport.js', () => ({
  startHttpTransport: h.startHttpTransport,
}));

import { main } from '../src/server.js';
import { ConfigError } from '../src/config/index.js';

function fakeLogger(): Logger {
  const logger: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

function makeConfig(transport: AppConfig['MCP_TRANSPORT']): AppConfig {
  return {
    REDMINE_URL: 'https://redmine.example.com',
    REDMINE_API_KEY: 'secret-key',
    MCP_TRANSPORT: transport,
    REDMINE_TIMEOUT_MS: 30000,
    LOG_LEVEL: 'info',
    HTTP_PORT: 3000,
  } as AppConfig;
}

function fakeContainer(transport: AppConfig['MCP_TRANSPORT']): Container {
  return {
    server: {} as McpServer,
    config: makeConfig(transport),
    logger: fakeLogger(),
    credentialProvider: { resolve: vi.fn() },
    clientFactory: { create: vi.fn() },
  };
}

/** Mock `process.exit` to throw a sentinel so `main` stops at the exit call. */
function mockExitThrows(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as never);
}

/** Mock `process.exit` to record without terminating (for post-`main` shutdown). */
function mockExitRecords(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(process, 'exit').mockImplementation(((): undefined => undefined) as never);
}

/** Flush pending microtasks/timers so promise-chained exits are observable. */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('main (server bootstrap)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });

  it('exits 1 with a friendly message (no stack) on invalid config', async () => {
    h.loadConfig.mockImplementation(() => {
      throw new ConfigError(['REDMINE_URL: REDMINE_URL is required']);
    });
    mockExitThrows();
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await expect(main()).rejects.toThrow('exit:1');

    expect(stderr).toHaveBeenCalledTimes(1);
    const printed = String(stderr.mock.calls[0]?.[0]);
    expect(printed).toContain('REDMINE_URL is required');
    expect(printed).not.toMatch(/\bat\b.*\.ts/); // no stack frames
    expect(stdout).not.toHaveBeenCalled();
    expect(h.buildContainer).not.toHaveBeenCalled();
  });

  it('starts the stdio transport for a stdio config', async () => {
    const container = fakeContainer('stdio');
    h.loadConfig.mockReturnValue(container.config);
    h.buildContainer.mockReturnValue(container);
    const handle: TransportHandle = { close: vi.fn(async () => {}) };
    h.startStdioTransport.mockResolvedValue(handle);

    await main();

    expect(h.startStdioTransport).toHaveBeenCalledWith(container.server, container.logger);
    expect(h.startHttpTransport).not.toHaveBeenCalled();
  });

  it('starts the http transport for an http config', async () => {
    const container = fakeContainer('http');
    h.loadConfig.mockReturnValue(container.config);
    h.buildContainer.mockReturnValue(container);
    const handle: TransportHandle = { close: vi.fn(async () => {}) };
    h.startHttpTransport.mockResolvedValue(handle);

    await main();

    expect(h.startHttpTransport).toHaveBeenCalledWith(container.server, {
      config: container.config,
      credentialProvider: container.credentialProvider,
      clientFactory: container.clientFactory,
      logger: container.logger,
    });
    expect(h.startStdioTransport).not.toHaveBeenCalled();
  });

  it('exits 1 with the transport message when http is not implemented', async () => {
    const container = fakeContainer('http');
    h.loadConfig.mockReturnValue(container.config);
    h.buildContainer.mockReturnValue(container);
    h.startHttpTransport.mockImplementation(() => {
      throw new Error('The http transport (MCP_TRANSPORT=http) is not implemented yet.');
    });
    mockExitThrows();
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await expect(main()).rejects.toThrow('exit:1');
    expect(String(stderr.mock.calls[0]?.[0])).toContain('not implemented yet');
  });

  it('shuts down cleanly and exits 0 on SIGINT', async () => {
    const container = fakeContainer('stdio');
    h.loadConfig.mockReturnValue(container.config);
    h.buildContainer.mockReturnValue(container);
    const close = vi.fn(async () => {});
    h.startStdioTransport.mockResolvedValue({ close });
    const exit = mockExitRecords();

    await main();
    process.emit('SIGINT');
    await flush();

    expect(close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
