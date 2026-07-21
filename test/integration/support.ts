/**
 * Shared plumbing for the opt-in integration suite.
 *
 * These tests run the *real* `RedmineHttpClient` against the Dockerized Redmine
 * from `docker-compose.yml`, driven through the in-memory MCP client so the full
 * protocol path is exercised end-to-end. They are gated on `RUN_INTEGRATION=1`
 * and read connection details from the environment (see
 * `scripts/redmine-up.sh` / `test/integration/README.md`).
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createRedmineHttpClient } from '../../src/adapters/redmine/redmine-http-client.js';
import type { RedmineClient } from '../../src/domain/ports/index.js';
import { connectInMemoryMcp, type InMemoryMcp } from '../support/in-memory-mcp.js';
import { silentLogger } from '../support/silent-logger.js';

/** True only when the suite is explicitly opted into. Gate every suite on this. */
export const runIntegration = process.env.RUN_INTEGRATION === '1';

/** Identifier of the project seeded by `scripts/redmine-up.sh`. */
export const testProjectIdentifier = process.env.REDMINE_TEST_PROJECT ?? 'mcp-int-test';

/** Read a required environment variable, failing loudly if it is missing. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `${name} is not set. Run scripts/redmine-up.sh and source test/integration/redmine.env.`,
    );
  }
  return value;
}

/** Build the real HTTP client bound to the seeded admin key (from the environment). */
export function realRedmineClient(): RedmineClient {
  return createRedmineHttpClient({
    baseUrl: requireEnv('REDMINE_URL'),
    credentials: { kind: 'apiKey', value: requireEnv('REDMINE_API_KEY') },
    timeoutMs: 30000,
    logger: silentLogger(),
  });
}

/** Connect the in-memory MCP client to the real HTTP client. */
export function connectRealMcp(): Promise<InMemoryMcp> {
  return connectInMemoryMcp({ redmine: realRedmineClient() });
}

/**
 * Assert a tool call succeeded and return its `structuredContent` typed as `T`.
 * Fails with the returned error text when the call came back as an MCP error.
 */
export function expectStructured<T = Record<string, unknown>>(result: CallToolResult): T {
  if (result.isError) {
    const text = result.content.map((block) => (block.type === 'text' ? block.text : '')).join(' ');
    throw new Error(`Tool call failed: ${text || '(no message)'}`);
  }
  return result.structuredContent as T;
}
