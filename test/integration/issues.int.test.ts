import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  connectRealMcp,
  expectStructured,
  runIntegration,
  testProjectIdentifier,
} from './support.js';
import type { InMemoryMcp } from '../support/in-memory-mcp.js';

interface IssueSummary {
  id: number;
  subject: string;
  status: { id: number; name: string };
  done_ratio: number;
}

interface IssueDetail extends IssueSummary {
  journals?: Array<{ notes: string }>;
  watchers?: Array<{ id: number }>;
}

/** Join a tool result's text blocks, used to inspect a formatted error. */
function errorText(result: CallToolResult): string {
  return result.content.map((block) => (block.type === 'text' ? block.text : '')).join(' ');
}

/** Full issue lifecycle: create → get round-trip, then update (status + note). */
describe.skipIf(!runIntegration)('integration: issues', () => {
  let mcp: InMemoryMcp;
  let projectId: number;
  let trackerId: number;

  beforeAll(async () => {
    mcp = await connectRealMcp();
    // Resolve concrete ids from the seeded project (identifier → numeric ids).
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

  it('creates an issue and reads it back (round-trip)', async () => {
    const subject = `MCP round-trip ${Date.now()}`;

    const created = expectStructured<IssueSummary>(
      await mcp.callTool('redmine_create_issue', {
        project_id: projectId,
        tracker_id: trackerId,
        subject,
      }),
    );
    expect(created.id).toBeGreaterThan(0);

    const fetched = expectStructured<IssueSummary>(
      await mcp.callTool('redmine_get_issue', { issue_id: created.id }),
    );
    expect(fetched.id).toBe(created.id);
    expect(fetched.subject).toBe(subject);
  });

  it('updates status and adds a note, returning the re-fetched issue', async () => {
    const created = expectStructured<IssueSummary>(
      await mcp.callTool('redmine_create_issue', {
        project_id: projectId,
        tracker_id: trackerId,
        subject: `MCP update ${Date.now()}`,
      }),
    );

    // status_id 2 = "In Progress" in Redmine's default configuration; the Manager
    // workflow (seeded) permits New → In Progress.
    const note = 'Moving to in progress via MCP.';
    const updated = expectStructured<IssueDetail>(
      await mcp.callTool('redmine_update_issue', {
        issue_id: created.id,
        status_id: 2,
        notes: note,
      }),
    );

    // ADR-0011: the update tool re-fetches and returns the resulting state.
    expect(updated.id).toBe(created.id);
    expect(updated.status.id).toBe(2);

    // The note is journalized — verify via an explicit journals expansion.
    const withJournals = expectStructured<IssueDetail>(
      await mcp.callTool('redmine_get_issue', { issue_id: created.id, include: ['journals'] }),
    );
    const notes = (withJournals.journals ?? []).map((j) => j.notes);
    expect(notes).toContain(note);
  });

  it('deletes an issue it created, after which reading it back fails', async () => {
    // Create-then-delete is the only acceptable pattern here: the suite must
    // never delete an issue it did not make itself.
    const created = expectStructured<IssueSummary>(
      await mcp.callTool('redmine_create_issue', {
        project_id: projectId,
        tracker_id: trackerId,
        subject: `MCP delete ${Date.now()}`,
      }),
    );

    const deleted = expectStructured<{ deleted: boolean; issue_id: number }>(
      await mcp.callTool('redmine_delete_issue', { issue_id: created.id }),
    );
    expect(deleted).toEqual({ deleted: true, issue_id: created.id });

    const afterwards = await mcp.callTool('redmine_get_issue', { issue_id: created.id });
    expect(afterwards.isError).toBe(true);
    expect(errorText(afterwards)).toMatch(/not found/i);
  });

  it('adds then removes a watcher on an issue it created', async () => {
    const me = expectStructured<{ id: number }>(await mcp.callTool('redmine_get_current_user', {}));
    const created = expectStructured<IssueSummary>(
      await mcp.callTool('redmine_create_issue', {
        project_id: projectId,
        tracker_id: trackerId,
        subject: `MCP watcher ${Date.now()}`,
      }),
    );

    const added = await mcp.callTool('redmine_manage_issue_watchers', {
      issue_id: created.id,
      user_id: me.id,
      action: 'add',
    });
    // Managing watchers needs its own Redmine permission; a key without it is a
    // legitimate configuration, not a suite failure.
    if (added.isError === true) {
      expect(errorText(added)).toMatch(/permission/i);
      return;
    }

    const watching = expectStructured<IssueDetail>(
      await mcp.callTool('redmine_get_issue', { issue_id: created.id, include: ['watchers'] }),
    );
    expect((watching.watchers ?? []).map((w) => w.id)).toContain(me.id);

    expectStructured(
      await mcp.callTool('redmine_manage_issue_watchers', {
        issue_id: created.id,
        user_id: me.id,
        action: 'remove',
      }),
    );

    const notWatching = expectStructured<IssueDetail>(
      await mcp.callTool('redmine_get_issue', { issue_id: created.id, include: ['watchers'] }),
    );
    expect((notWatching.watchers ?? []).map((w) => w.id)).not.toContain(me.id);
  });
});
