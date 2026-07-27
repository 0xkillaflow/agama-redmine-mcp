import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  connectRealMcp,
  expectStructured,
  runIntegration,
  testProjectIdentifier,
} from './support.js';
import type { InMemoryMcp } from '../support/in-memory-mcp.js';

interface Relation {
  id: number;
  issue_id: number;
  issue_to_id: number;
  relation_type: string;
  delay: number | null;
}

/**
 * The full relation lifecycle against a real Redmine: create two throwaway
 * issues, relate them, read the link back from *both* issues, then delete it and
 * assert it is gone. This single sequence exercises all three relation tools.
 */
describe.skipIf(!runIntegration)('integration: issue relations', () => {
  let mcp: InMemoryMcp;
  let projectId: number;
  let trackerId: number;

  /** Create a throwaway issue in the seeded project and return its id. */
  async function createIssue(label: string): Promise<number> {
    const created = expectStructured<{ id: number }>(
      await mcp.callTool('redmine_create_issue', {
        project_id: projectId,
        tracker_id: trackerId,
        subject: `MCP relation ${label} ${Date.now()}`,
      }),
    );
    return created.id;
  }

  /** All relations attached to an issue, in either direction. */
  async function listRelations(issueId: number): Promise<Relation[]> {
    const listed = expectStructured<{ relations: Relation[] }>(
      await mcp.callTool('redmine_list_issue_relations', { issue_id: issueId }),
    );
    return listed.relations;
  }

  beforeAll(async () => {
    mcp = await connectRealMcp();
    const project = expectStructured<{ id: number; trackers?: Array<{ id: number }> }>(
      await mcp.callTool('redmine_get_project', {
        project_id: testProjectIdentifier,
        include: ['trackers'],
      }),
    );
    projectId = project.id;
    const firstTracker = project.trackers?.[0];
    if (!firstTracker) throw new Error('seeded project has no trackers');
    trackerId = firstTracker.id;
  });

  afterAll(async () => {
    await mcp?.close();
  });

  it('creates a relation, lists it from both issues, then deletes it', async () => {
    const sourceId = await createIssue('source');
    const targetId = await createIssue('target');

    const created = expectStructured<Relation>(
      await mcp.callTool('redmine_create_issue_relation', {
        issue_id: sourceId,
        issue_to_id: targetId,
        relation_type: 'blocks',
      }),
    );
    expect(created.issue_id).toBe(sourceId);
    expect(created.issue_to_id).toBe(targetId);
    expect(created.relation_type).toBe('blocks');

    // Redmine stores one record and derives the inverse: the same relation id
    // shows up under both issues.
    const fromSource = await listRelations(sourceId);
    const fromTarget = await listRelations(targetId);
    expect(fromSource.map((r) => r.id)).toContain(created.id);
    expect(fromTarget.map((r) => r.id)).toContain(created.id);

    // Single mode: the relation is addressable by its own id.
    const single = expectStructured<Relation>(
      await mcp.callTool('redmine_list_issue_relations', { issue_relation_id: created.id }),
    );
    expect(single.id).toBe(created.id);

    const deleted = expectStructured<{ deleted: boolean; issue_relation_id: number }>(
      await mcp.callTool('redmine_delete_issue_relation', { issue_relation_id: created.id }),
    );
    expect(deleted).toEqual({ deleted: true, issue_relation_id: created.id });

    // Deleting removes both directions at once.
    expect((await listRelations(sourceId)).map((r) => r.id)).not.toContain(created.id);
    expect((await listRelations(targetId)).map((r) => r.id)).not.toContain(created.id);
  });

  it("surfaces Redmine's own rejection of a self-relation as a validation error", async () => {
    const issueId = await createIssue('self');

    const result = await mcp.callTool('redmine_create_issue_relation', {
      issue_id: issueId,
      issue_to_id: issueId,
      relation_type: 'blocks',
    });

    expect(result.isError).toBe(true);
  });
});
