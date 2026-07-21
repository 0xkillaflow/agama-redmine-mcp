import { describe, it, expect } from 'vitest';
import {
  TimeEntrySchema,
  CreateTimeEntryInputSchema,
} from '../../../src/domain/models/time-entry.js';

const entry = {
  id: 1,
  project: { id: 1, name: 'Website' },
  issue: { id: 456 },
  user: { id: 3, name: 'Jane Doe' },
  activity: { id: 9, name: 'Development' },
  hours: 3.5,
  comments: 'Implemented dark mode',
  spent_on: '2024-01-01',
  created_on: '2024-01-01T10:00:00Z',
  updated_on: '2024-01-01T10:00:00Z',
};

describe('TimeEntrySchema', () => {
  it('parses a time_entry payload', () => {
    expect(TimeEntrySchema.parse(entry)).toEqual(entry);
  });

  it('coerces a numeric-string hours value', () => {
    const parsed = TimeEntrySchema.parse({ ...entry, hours: '2.25' });
    expect(parsed.hours).toBe(2.25);
  });

  it('accepts a null comments and an entry without an issue', () => {
    const { issue, ...withoutIssue } = entry;
    void issue;
    const parsed = TimeEntrySchema.parse({ ...withoutIssue, comments: null });
    expect(parsed.comments).toBeNull();
    expect(parsed.issue).toBeUndefined();
  });
});

describe('CreateTimeEntryInputSchema', () => {
  it('accepts hours with issue_id only', () => {
    expect(CreateTimeEntryInputSchema.safeParse({ hours: 2, issue_id: 456 }).success).toBe(true);
  });

  it('accepts hours with project_id only', () => {
    expect(CreateTimeEntryInputSchema.safeParse({ hours: 2, project_id: 1 }).success).toBe(true);
  });

  it('rejects neither issue_id nor project_id', () => {
    expect(CreateTimeEntryInputSchema.safeParse({ hours: 2 }).success).toBe(false);
  });

  it('rejects both issue_id and project_id', () => {
    expect(
      CreateTimeEntryInputSchema.safeParse({ hours: 2, issue_id: 456, project_id: 1 }).success,
    ).toBe(false);
  });

  it('rejects a missing hours value', () => {
    expect(CreateTimeEntryInputSchema.safeParse({ issue_id: 456 }).success).toBe(false);
  });
});
