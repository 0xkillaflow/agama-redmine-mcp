import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  connectRealMcp,
  expectStructured,
  runIntegration,
  testProjectIdentifier,
} from './support.js';
import type { InMemoryMcp } from '../support/in-memory-mcp.js';

interface TimeEntrySummary {
  id: number;
  hours: number;
  comments: string | null;
  issue?: { id: number };
}

/** `redmine_create_time_entry` on a fresh issue; `redmine_list_time_entries` finds it. */
describe.skipIf(!runIntegration)('integration: time entries', () => {
  let mcp: InMemoryMcp;
  let issueId: number;
  let activityId: number;

  beforeAll(async () => {
    mcp = await connectRealMcp();

    const project = expectStructured<{
      id: number;
      trackers?: Array<{ id: number }>;
      time_entry_activities?: Array<{ id: number }>;
    }>(
      await mcp.callTool('redmine_get_project', {
        project_id: testProjectIdentifier,
        include: ['trackers', 'time_entry_activities'],
      }),
    );

    const tracker = project.trackers?.[0];
    const activity = project.time_entry_activities?.[0];
    if (!tracker) throw new Error('seeded project has no trackers');
    if (!activity) throw new Error('seeded project has no time-entry activities');
    activityId = activity.id;

    const issue = expectStructured<{ id: number }>(
      await mcp.callTool('redmine_create_issue', {
        project_id: project.id,
        tracker_id: tracker.id,
        subject: `MCP time-entry host ${Date.now()}`,
      }),
    );
    issueId = issue.id;
  });

  afterAll(async () => {
    await mcp?.close();
  });

  it('logs time on the issue and finds it in the list', async () => {
    const comment = `Logged via MCP ${Date.now()}`;

    const entry = expectStructured<TimeEntrySummary>(
      await mcp.callTool('redmine_create_time_entry', {
        issue_id: issueId,
        hours: 1.5,
        activity_id: activityId,
        comments: comment,
      }),
    );
    expect(entry.id).toBeGreaterThan(0);
    expect(entry.hours).toBe(1.5);

    const page = expectStructured<{ items: TimeEntrySummary[] }>(
      await mcp.callTool('redmine_list_time_entries', { issue_id: String(issueId) }),
    );
    const ids = page.items.map((e) => e.id);
    expect(ids).toContain(entry.id);
  });
});
