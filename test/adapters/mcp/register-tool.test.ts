import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { registerTool } from '../../../src/adapters/mcp/register-tool.js';
import { defineTool } from '../../../src/application/tool-definition.js';
import type { AnyToolDefinition } from '../../../src/application/tool-registry.js';
import { RedmineNotFoundError } from '../../../src/domain/errors/index.js';
import type {
  CredentialProvider,
  Logger,
  RedmineClient,
  RedmineCredentials,
  RequestMeta,
} from '../../../src/domain/ports/index.js';
import type { RedmineClientFactory } from '../../../src/adapters/redmine/redmine-http-client.js';

/** A captured `registerTool(name, config, handler)` call. */
interface Capture {
  name: string;
  config: { title: string; description: string; inputSchema: unknown; annotations?: unknown };
  handler: (args: unknown, extra: unknown) => Promise<CallToolResult>;
}

/** A fake `McpServer` that records registrations. */
function fakeServer(): { server: McpServer; calls: Capture[] } {
  const calls: Capture[] = [];
  const server = {
    registerTool: (name: string, config: Capture['config'], handler: Capture['handler']) => {
      calls.push({ name, config, handler });
      return {};
    },
  };
  return { server: server as unknown as McpServer, calls };
}

/** A fake logger recording warn/error and returning itself as its own child. */
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

/** A distinct sentinel used to prove the created client reaches the handler. */
const sentinelClient = { marker: 'redmine-client' } as unknown as RedmineClient;

function makeDeps(
  overrides: {
    resolve?: (meta: RequestMeta) => Promise<RedmineCredentials>;
  } = {},
): {
  credentialProvider: CredentialProvider;
  clientFactory: RedmineClientFactory;
  logger: Logger;
  resolve: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
} {
  const resolve = vi.fn(
    overrides.resolve ??
      (async (): Promise<RedmineCredentials> => ({ kind: 'apiKey', value: 'k' })),
  );
  const create = vi.fn((): RedmineClient => sentinelClient);
  return {
    credentialProvider: { resolve },
    clientFactory: { create },
    logger: fakeLogger(),
    resolve,
    create,
  };
}

/** A read tool that echoes its input and records the client it received. */
function echoTool(seen: { redmine?: RedmineClient }): AnyToolDefinition {
  return defineTool({
    name: 'redmine_echo',
    title: 'Echo',
    description: 'Echoes the input.',
    inputSchema: { value: z.string() },
    annotations: { readOnlyHint: true },
    handle: async (input, ctx) => {
      seen.redmine = ctx.redmine;
      return { echoed: input.value };
    },
  });
}

describe('registerTool', () => {
  it('registers the tool with its name, metadata, schema and annotations', () => {
    const { server, calls } = fakeServer();
    registerTool(server, echoTool({}), makeDeps());

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.name).toBe('redmine_echo');
    expect(call.config.title).toBe('Echo');
    expect(call.config.description).toBe('Echoes the input.');
    expect(call.config.inputSchema).toHaveProperty('value');
    expect(call.config.annotations).toEqual({ readOnlyHint: true });
  });

  it('resolves credentials, builds a client, and returns a success result', async () => {
    const { server, calls } = fakeServer();
    const seen: { redmine?: RedmineClient } = {};
    const deps = makeDeps();
    registerTool(server, echoTool(seen), deps);

    const result = await calls[0]!.handler(
      { value: 'hello' },
      { requestInfo: { headers: { authorization: 'Bearer t', 'x-multi': ['a', 'b'] } } },
    );

    // Credentials resolved from the normalized request meta.
    expect(deps.resolve).toHaveBeenCalledWith({
      headers: { authorization: 'Bearer t', 'x-multi': 'a, b' },
    });
    // Client built from the resolved credentials and handed to the handler.
    expect(deps.create).toHaveBeenCalledWith({ kind: 'apiKey', value: 'k' });
    expect(seen.redmine).toBe(sentinelClient);

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ echoed: 'hello' });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: JSON.stringify({ echoed: 'hello' }),
    });
  });

  it('passes empty meta for a stdio call (no request info)', async () => {
    const { server, calls } = fakeServer();
    const deps = makeDeps();
    registerTool(server, echoTool({}), deps);

    await calls[0]!.handler({ value: 'hi' }, {});
    expect(deps.resolve).toHaveBeenCalledWith({});
  });

  it('formats a thrown domain error into an isError result and logs a warning', async () => {
    const { server, calls } = fakeServer();
    const deps = makeDeps();
    const throwing = defineTool({
      name: 'redmine_boom',
      title: 'Boom',
      description: 'Throws.',
      inputSchema: {},
      handle: async () => {
        throw new RedmineNotFoundError();
      },
    });
    registerTool(server, throwing, deps);

    const result = await calls[0]!.handler({}, {});
    expect(result.isError).toBe(true);
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'tool handler failed',
      expect.objectContaining({ tool: 'redmine_boom', code: 'REDMINE_NOT_FOUND' }),
    );
  });

  it('formats an unknown error generically and logs at error', async () => {
    const { server, calls } = fakeServer();
    const deps = makeDeps();
    const throwing = defineTool({
      name: 'redmine_kaboom',
      title: 'Kaboom',
      description: 'Throws a plain error.',
      inputSchema: {},
      handle: async () => {
        throw new Error('internal detail');
      },
    });
    registerTool(server, throwing, deps);

    const result = await calls[0]!.handler({}, {});
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: 'text' });
    expect((result.content[0] as { text: string }).text).not.toContain('internal detail');
    expect(deps.logger.error).toHaveBeenCalledWith(
      'tool handler error',
      expect.objectContaining({ tool: 'redmine_kaboom' }),
    );
  });

  it('formats a thrown ZodError as an error result and logs input rejection at warn', async () => {
    const { server, calls } = fakeServer();
    const deps = makeDeps();
    const throwing = defineTool({
      name: 'redmine_xor',
      title: 'Xor',
      description: 'Enforces a cross-field rule via a superRefine re-parse.',
      inputSchema: {},
      handle: async () => {
        const schema = z.object({}).superRefine((_value, ctx) => {
          ctx.addIssue({
            code: 'custom',
            message: 'Provide exactly one of issue_id or project_id.',
            path: ['issue_id'],
          });
        });
        return schema.parse({});
      },
    });
    registerTool(server, throwing, deps);

    const result = await calls[0]!.handler({}, {});
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'Provide exactly one of issue_id or project_id.',
    );
    // Expected bad input → warn, never the error-level "server fault" path.
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'tool input rejected',
      expect.objectContaining({ tool: 'redmine_xor' }),
    );
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('formats a credential-resolution failure as an error result', async () => {
    const { server, calls } = fakeServer();
    const deps = makeDeps({
      resolve: async () => {
        throw new RedmineNotFoundError();
      },
    });
    registerTool(server, echoTool({}), deps);

    const result = await calls[0]!.handler({ value: 'x' }, {});
    expect(result.isError).toBe(true);
    expect(deps.create).not.toHaveBeenCalled();
  });
});
