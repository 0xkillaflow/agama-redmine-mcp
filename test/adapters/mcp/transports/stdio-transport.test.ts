import { describe, it, expect, vi, afterEach } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { startStdioTransport } from '../../../../src/adapters/mcp/transports/stdio-transport.js';
import type { Logger } from '../../../../src/domain/ports/index.js';

/** A logger that records its calls and returns itself as its own child. */
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

/** A fake server capturing connect/close, standing in for the SDK `McpServer`. */
function fakeServer(): {
  server: McpServer;
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  const connect = vi.fn(async () => {});
  const close = vi.fn(async () => {});
  return { server: { connect, close } as unknown as McpServer, connect, close };
}

describe('startStdioTransport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects the server and returns a close handle — without writing to stdout', async () => {
    const { server, connect, close } = fakeServer();
    const logger = fakeLogger();
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    const handle = await startStdioTransport(server, logger);

    // The server was attached to a transport, and readiness went to the logger
    // (stderr), never to stdout.
    expect(connect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(stdoutWrite).not.toHaveBeenCalled();

    // The handle disconnects the transport by closing the server.
    await handle.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
