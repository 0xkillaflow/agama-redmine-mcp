import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildContainer } from '../src/container.js';
import { tools } from '../src/application/tools/index.js';
import type { AppConfig } from '../src/config/index.js';

/** A minimal valid config; each test overrides the fields it cares about. */
function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    REDMINE_URL: 'https://redmine.example.com',
    REDMINE_API_KEY: 'secret-key',
    MCP_TRANSPORT: 'stdio',
    REDMINE_TIMEOUT_MS: 30000,
    LOG_LEVEL: 'info',
    HTTP_PORT: 3000,
    ...overrides,
  } as AppConfig;
}

/** Capture `registerTool` calls so we can count the tools wired onto the server. */
function spyRegister(): string[] {
  const names: string[] = [];
  vi.spyOn(McpServer.prototype, 'registerTool').mockImplementation((name: string) => {
    names.push(name);
    return {} as ReturnType<McpServer['registerTool']>;
  });
  return names;
}

describe('buildContainer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wires a fully populated server for stdio with an env credential provider', async () => {
    const names = spyRegister();
    const container = buildContainer(makeConfig({ MCP_TRANSPORT: 'stdio' }));

    // A server with all 10 tools registered.
    expect(container.server).toBeInstanceOf(McpServer);
    expect(names).toHaveLength(tools.length);
    expect(names).toEqual(tools.map((t) => t.name));

    // The env provider ignores request metadata and returns the single API key.
    await expect(container.credentialProvider.resolve({})).resolves.toEqual({
      kind: 'apiKey',
      value: 'secret-key',
    });

    // Single-user optimization: the factory returns one cached client instance.
    const first = container.clientFactory.create({ kind: 'apiKey', value: 'x' });
    const second = container.clientFactory.create({ kind: 'apiKey', value: 'y' });
    expect(first).toBe(second);
  });

  it('swaps only the credential provider for http (header-based)', async () => {
    spyRegister();
    // http mode resolves credentials per request, so no API key is required.
    const container = buildContainer(
      makeConfig({ MCP_TRANSPORT: 'http', REDMINE_API_KEY: undefined }),
    );

    expect(container.server).toBeInstanceOf(McpServer);

    // The header provider rejects a request that carries no Authorization header.
    await expect(container.credentialProvider.resolve({})).rejects.toThrow(/authorization/i);
  });

  it('exposes the config it was built from', () => {
    spyRegister();
    const config = makeConfig();
    const container = buildContainer(config);
    expect(container.config).toBe(config);
  });
});
