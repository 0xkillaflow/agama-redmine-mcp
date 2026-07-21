import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectRealMcp, expectStructured, runIntegration } from './support.js';
import type { InMemoryMcp } from '../support/in-memory-mcp.js';

/** `redmine_get_current_user` returns the seeded admin the API key belongs to. */
describe.skipIf(!runIntegration)('integration: current user', () => {
  let mcp: InMemoryMcp;

  beforeAll(async () => {
    mcp = await connectRealMcp();
  });

  afterAll(async () => {
    await mcp?.close();
  });

  it('identifies the seeded admin user', async () => {
    const user = expectStructured<{ login?: string; admin?: boolean }>(
      await mcp.callTool('redmine_get_current_user', {}),
    );

    expect(user.login).toBe('admin');
    expect(user.admin).toBe(true);
  });
});
