import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpServer } from '../../../src/adapters/mcp/mcp-server-factory.js';
import { createToolRegistry } from '../../../src/application/tool-registry.js';
import { tools } from '../../../src/application/tools/index.js';
import type { ServerInfo } from '../../../src/adapters/mcp/version.js';
import type { CredentialProvider, Logger, RedmineClient } from '../../../src/domain/ports/index.js';
import type { RedmineClientFactory } from '../../../src/adapters/redmine/redmine-http-client.js';

/** A captured `McpServer.registerTool(name, config, …)` invocation. */
interface Capture {
  name: string;
  config: { annotations?: unknown };
}

/** A logger that records nothing and returns itself as its own child. */
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

const serverInfo: ServerInfo = { name: 'redmine-mcp', version: '9.9.9' };

function makeDeps(registryTools = tools): {
  registry: ReturnType<typeof createToolRegistry>;
  credentialProvider: CredentialProvider;
  clientFactory: RedmineClientFactory;
  logger: Logger;
  serverInfo: ServerInfo;
} {
  return {
    registry: createToolRegistry([...registryTools]),
    credentialProvider: { resolve: vi.fn() },
    clientFactory: { create: vi.fn((): RedmineClient => ({}) as RedmineClient) },
    logger: fakeLogger(),
    serverInfo,
  };
}

/** Spy on `registerTool`, capturing calls without really mutating the server. */
function spyRegister(): Capture[] {
  const calls: Capture[] = [];
  vi.spyOn(McpServer.prototype, 'registerTool').mockImplementation(
    (name: string, config: Capture['config']) => {
      calls.push({ name, config });
      return {} as ReturnType<McpServer['registerTool']>;
    },
  );
  return calls;
}

describe('createMcpServer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an McpServer with every registry tool registered exactly once', () => {
    const calls = spyRegister();
    const server = createMcpServer(makeDeps());

    expect(server).toBeInstanceOf(McpServer);

    // One registration per tool, and no duplicates.
    expect(calls).toHaveLength(tools.length);
    const registered = calls.map((c) => c.name);
    expect(new Set(registered).size).toBe(tools.length);
    expect(registered).toEqual(tools.map((t) => t.name));
  });

  it('forwards each tool’s annotations to registerTool', () => {
    const calls = spyRegister();
    createMcpServer(makeDeps());

    for (const tool of tools) {
      const call = calls.find((c) => c.name === tool.name);
      expect(call).toBeDefined();
      expect(call!.config.annotations).toEqual(tool.annotations);
    }
  });

  it('throws when the registry is empty (a wiring mistake)', () => {
    spyRegister();
    expect(() => createMcpServer(makeDeps([]))).toThrow(/empty tool registry/i);
  });
});
