import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  connectRealMcp,
  expectStructured,
  runIntegration,
  testProjectIdentifier,
} from './support.js';
import type { InMemoryMcp } from '../support/in-memory-mcp.js';

interface SearchHit {
  id: number;
  title: string;
  type: string;
}

/** `redmine_search` finds a freshly created issue by a unique subject token. */
describe.skipIf(!runIntegration)('integration: search', () => {
  let mcp: InMemoryMcp;
  let token: string;
  let issueId: number;

  beforeAll(async () => {
    mcp = await connectRealMcp();

    const project = expectStructured<{ id: number; trackers?: Array<{ id: number }> }>(
      await mcp.callTool('redmine_get_project', {
        project_id: testProjectIdentifier,
        include: ['trackers'],
      }),
    );
    const tracker = project.trackers?.[0];
    if (!tracker) throw new Error('seeded project has no trackers');

    token = `mcpsearch${Date.now()}`;
    const issue = expectStructured<{ id: number }>(
      await mcp.callTool('redmine_create_issue', {
        project_id: project.id,
        tracker_id: tracker.id,
        subject: `Searchable issue ${token}`,
      }),
    );
    issueId = issue.id;
  });

  afterAll(async () => {
    await mcp?.close();
  });

  it('finds the created issue by its unique subject token', async () => {
    const page = expectStructured<{ items: SearchHit[] }>(
      await mcp.callTool('redmine_search', { q: token, issues: true }),
    );

    const hit = page.items.find((r) => r.title.includes(token));
    expect(hit).toBeDefined();
    expect(hit?.id).toBe(issueId);
  });
});
