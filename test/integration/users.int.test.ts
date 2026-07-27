import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectRealMcp, expectStructured, runIntegration } from './support.js';
import type { InMemoryMcp } from '../support/in-memory-mcp.js';

/** `redmine_get_current_user` returns the seeded admin the API key belongs to. */
describe.skipIf(!runIntegration)('integration: users', () => {
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

  it('lists users, or reports a permission error on a non-admin key', async () => {
    // `GET /users.json` is admin-only on a default Redmine. The seeded key is an
    // admin's, but a differently-provisioned instance must not fail the suite —
    // assert on either the page or the formatted permission error.
    const result = await mcp.callTool('redmine_list_users', { name: 'admin' });

    if (result.isError === true) {
      const text = result.content.map((b) => (b.type === 'text' ? b.text : '')).join(' ');
      expect(text).toMatch(/permission/i);
      return;
    }

    const page = result.structuredContent as { items: Array<{ id: number; login?: string }> };
    expect(page.items.map((user) => user.login)).toContain('admin');
  });
});
