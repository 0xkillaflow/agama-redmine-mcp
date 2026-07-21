import { describe, it, expect } from 'vitest';
import { createTimeEntriesResource } from '../../../../src/adapters/redmine/resources/time-entries.js';
import {
  RedmineTransportError,
  RedmineValidationError,
} from '../../../../src/domain/errors/index.js';
import { listEnvelope, mockHttp, timeEntryFixture } from './support.js';

describe('createTimeEntriesResource', () => {
  it('list hits GET /time_entries.json and normalizes the page', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue(listEnvelope('time_entries', [timeEntryFixture]));
    const timeEntries = createTimeEntriesResource(http);

    const page = await timeEntries.list({ user_id: '7', from: '2026-07-01' });

    expect(get).toHaveBeenCalledWith('/time_entries.json', 'user_id=7&from=2026-07-01');
    expect(page.items[0]?.id).toBe(99);
  });

  it('create POSTs the { time_entry } envelope and returns the parsed entry', async () => {
    const { http, post } = mockHttp();
    post.mockResolvedValue({ time_entry: timeEntryFixture });
    const timeEntries = createTimeEntriesResource(http);

    const created = await timeEntries.create({ issue_id: 42, hours: 1.5 });

    expect(post).toHaveBeenCalledWith('/time_entries.json', {
      time_entry: { issue_id: 42, hours: 1.5 },
    });
    expect(created.hours).toBe(1.5);
  });

  it('surfaces a validation error from the requester on a bad create', async () => {
    const { http, post } = mockHttp();
    post.mockRejectedValue(new RedmineValidationError(['Hours cannot be blank']));
    const timeEntries = createTimeEntriesResource(http);

    await expect(timeEntries.create({ issue_id: 42, hours: 0 })).rejects.toBeInstanceOf(
      RedmineValidationError,
    );
  });

  it('turns a schema-mismatched body into a transport error', async () => {
    const { http, post } = mockHttp();
    post.mockResolvedValue({ time_entry: { id: 99 } });
    const timeEntries = createTimeEntriesResource(http);

    await expect(timeEntries.create({ issue_id: 42, hours: 1 })).rejects.toBeInstanceOf(
      RedmineTransportError,
    );
  });
});
