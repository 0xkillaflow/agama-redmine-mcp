import { describe, it, expect, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  startHttpTransport,
  type HttpTransportDeps,
} from '../../../../src/adapters/mcp/transports/http-transport.js';
import { NotImplementedError } from '../../../../src/domain/errors/index.js';
import type { AppConfig } from '../../../../src/config/index.js';
import type { Logger, RedmineClient } from '../../../../src/domain/ports/index.js';

const server = {} as McpServer;

const deps: HttpTransportDeps = {
  config: { MCP_TRANSPORT: 'http', HTTP_PORT: 3000 } as AppConfig,
  credentialProvider: { resolve: vi.fn() },
  clientFactory: { create: vi.fn((): RedmineClient => ({}) as RedmineClient) },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger,
};

describe('startHttpTransport', () => {
  it('fails fast with a NotImplementedError (the http seam is not built yet)', () => {
    expect(() => startHttpTransport(server, deps)).toThrow(NotImplementedError);
  });

  it('points to stdio and the intended per-request bearer auth in its message', () => {
    expect(() => startHttpTransport(server, deps)).toThrow(/stdio/i);
    expect(() => startHttpTransport(server, deps)).toThrow(/Bearer/i);
  });
});
