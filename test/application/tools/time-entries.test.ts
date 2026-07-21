import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { listTimeEntriesTool } from '../../../src/application/tools/time-entries/list-time-entries.tool.js';
import { createTimeEntryTool } from '../../../src/application/tools/time-entries/create-time-entry.tool.js';
import { timeEntryFixture } from '../../adapters/redmine/resources/support.js';
import { fakeRedmineClient, toolContext, emptyPage } from './support.js';

describe('redmine_list_time_entries', () => {
  it('is read-only', () => {
    expect(listTimeEntriesTool.annotations?.readOnlyHint).toBe(true);
  });

  it('passes filters through to timeEntries.list', async () => {
    const client = fakeRedmineClient();
    client.timeEntries.list.mockResolvedValue(emptyPage());
    const input = { user_id: 'me', from: '2026-07-01', to: '2026-07-07' };

    await listTimeEntriesTool.handle(input, toolContext(client));

    expect(client.timeEntries.list).toHaveBeenCalledWith(input);
  });
});

describe('redmine_create_time_entry', () => {
  it('is not read-only', () => {
    expect(createTimeEntryTool.annotations?.readOnlyHint).toBe(false);
  });

  it('logs time against an issue (happy path)', async () => {
    const client = fakeRedmineClient();
    client.timeEntries.create.mockResolvedValue(timeEntryFixture);
    const input = { hours: 3.5, issue_id: 456, comments: 'implemented auth' };

    const result = await createTimeEntryTool.handle(input, toolContext(client));

    expect(client.timeEntries.create).toHaveBeenCalledWith(input);
    expect(result).toBe(timeEntryFixture);
  });

  it('rejects when neither issue_id nor project_id is given', async () => {
    const client = fakeRedmineClient();

    await expect(createTimeEntryTool.handle({ hours: 2 }, toolContext(client))).rejects.toThrow(
      /exactly one of issue_id or project_id/,
    );
    expect(client.timeEntries.create).not.toHaveBeenCalled();
  });

  it('rejects when both issue_id and project_id are given', async () => {
    const client = fakeRedmineClient();

    await expect(
      createTimeEntryTool.handle({ hours: 2, issue_id: 1, project_id: 2 }, toolContext(client)),
    ).rejects.toThrow(/exactly one of issue_id or project_id/);
    expect(client.timeEntries.create).not.toHaveBeenCalled();
  });

  it('rejects non-positive hours', async () => {
    const client = fakeRedmineClient();

    await expect(
      createTimeEntryTool.handle({ hours: -1, issue_id: 1 }, toolContext(client)),
    ).rejects.toBeInstanceOf(ZodError);
    expect(client.timeEntries.create).not.toHaveBeenCalled();
  });
});
