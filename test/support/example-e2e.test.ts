import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fakeRedmineClient } from './fake-redmine-client.js';
import { connectInMemoryMcp, type InMemoryMcp } from './in-memory-mcp.js';

/**
 * Template: an end-to-end test over the in-memory MCP client. It drives the real
 * protocol path (register → validate → handle → format) against a fake Redmine
 * client, and reads the formatted `CallToolResult`. Copy this shape for new e2e
 * tests.
 */
describe('example e2e test (in-memory MCP client)', () => {
  const redmine = fakeRedmineClient();
  let mcp: InMemoryMcp;

  beforeAll(async () => {
    mcp = await connectInMemoryMcp({ redmine });
  });

  afterAll(async () => {
    await mcp.close();
  });

  it('lists the registered tools over the protocol', async () => {
    const { tools } = await mcp.client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('redmine_get_current_user');
  });

  it('calls redmine_get_current_user and receives a formatted result', async () => {
    // Act
    const result = await mcp.callTool('redmine_get_current_user', {});

    // Assert — the fixture user is surfaced as both text and structured content.
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ id: 7, login: 'jane' });
    expect(redmine.users.getCurrent.calls).toHaveLength(1);
  });
});
