import { describe, it, expect } from 'vitest';
import {
  IssueSimpleSchema,
  IssueSchema,
  CreateIssueInputSchema,
  UpdateIssueInputSchema,
} from '../../../src/domain/models/issue.js';

/** A minimal `issue.simple`, as returned by list/create. */
const minimalSimple = {
  id: 1,
  project: { id: 1, name: 'Website' },
  tracker: { id: 2, name: 'Feature' },
  status: { id: 1, name: 'New', is_closed: false },
  priority: { id: 4, name: 'Normal' },
  author: { id: 3, name: 'Jane Doe' },
  subject: 'Add dark mode',
  description: null,
  start_date: null,
  due_date: null,
  done_ratio: 0,
  is_private: false,
  estimated_hours: null,
  total_estimated_hours: null,
  created_on: '2024-01-01T10:00:00Z',
  updated_on: '2024-01-02T10:00:00Z',
  closed_on: null,
};

describe('IssueSimpleSchema', () => {
  it('parses a minimal issue.simple', () => {
    expect(IssueSimpleSchema.parse(minimalSimple)).toEqual(minimalSimple);
  });

  it('parses optional/gated scalar fields when present', () => {
    const withOptionals = {
      ...minimalSimple,
      assigned_to: { id: 5, name: 'John Roe' },
      category: { id: 7, name: 'UI' },
      spent_hours: 3.5,
      total_spent_hours: 3.5,
      custom_fields: [{ id: 1, name: 'Severity', value: 'High' }],
    };
    expect(IssueSimpleSchema.parse(withOptionals)).toEqual(withOptionals);
  });

  it('rejects an issue.simple missing a required field', () => {
    const { subject, ...invalid } = minimalSimple;
    void subject;
    expect(IssueSimpleSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('IssueSchema', () => {
  it('parses a full issue with journals, attachments and relations', () => {
    const full = {
      ...minimalSimple,
      children: [{ id: 2, tracker: { id: 2, name: 'Feature' }, subject: 'Child' }],
      attachments: [
        {
          id: 10,
          filename: 'diagram.png',
          filesize: 2048,
          content_type: 'image/png',
          description: 'architecture',
          content_url: 'https://redmine.example.com/attachments/download/10/diagram.png',
          author: { id: 3, name: 'Jane Doe' },
          created_on: '2024-01-01T10:00:00Z',
        },
      ],
      relations: [{ id: 100, issue_id: 1, issue_to_id: 2, relation_type: 'relates', delay: null }],
      changesets: [],
      journals: [
        {
          id: 500,
          user: { id: 3, name: 'Jane Doe' },
          notes: 'Reassigned',
          created_on: '2024-01-03T10:00:00Z',
          private_notes: false,
          details: [
            {
              property: 'attr',
              name: 'status_id',
              old_value: '1',
              new_value: '2',
            },
          ],
        },
      ],
      watchers: [{ id: 5, name: 'John Roe' }],
      allowed_statuses: [{ id: 2, name: 'In Progress', is_closed: false }],
    };
    expect(IssueSchema.parse(full)).toEqual(full);
  });

  it('parses a full issue without any include-gated collections', () => {
    const parsed = IssueSchema.parse(minimalSimple);
    expect(parsed.journals).toBeUndefined();
    expect(parsed.attachments).toBeUndefined();
  });
});

describe('CreateIssueInputSchema', () => {
  it('accepts a minimal valid create input', () => {
    expect(CreateIssueInputSchema.parse({ project_id: 1, subject: 'New issue' })).toEqual({
      project_id: 1,
      subject: 'New issue',
    });
  });

  it('rejects a create input missing subject', () => {
    expect(CreateIssueInputSchema.safeParse({ project_id: 1 }).success).toBe(false);
  });

  it('rejects a create input missing project_id', () => {
    expect(CreateIssueInputSchema.safeParse({ subject: 'x' }).success).toBe(false);
  });

  it.each([0, 10, 50, 100])('accepts done_ratio %i', (done_ratio) => {
    expect(
      CreateIssueInputSchema.safeParse({ project_id: 1, subject: 'x', done_ratio }).success,
    ).toBe(true);
  });

  it.each([5, 15, -10, 110, 33])('rejects done_ratio %i', (done_ratio) => {
    expect(
      CreateIssueInputSchema.safeParse({ project_id: 1, subject: 'x', done_ratio }).success,
    ).toBe(false);
  });

  it('accepts custom_fields (array form) and uploads', () => {
    const parsed = CreateIssueInputSchema.parse({
      project_id: 1,
      subject: 'x',
      custom_fields: [{ id: 1, value: 'High' }],
      uploads: [{ token: 'abc', filename: 'f.txt' }],
    });
    expect(parsed.custom_fields).toEqual([{ id: 1, value: 'High' }]);
    expect(parsed.uploads?.[0]?.token).toBe('abc');
  });
});

describe('UpdateIssueInputSchema', () => {
  it('accepts an empty (no-op) update', () => {
    expect(UpdateIssueInputSchema.parse({})).toEqual({});
  });

  it('accepts notes and private_notes', () => {
    const parsed = UpdateIssueInputSchema.parse({ notes: 'done', private_notes: true });
    expect(parsed).toEqual({ notes: 'done', private_notes: true });
  });

  it('enforces the done_ratio constraint', () => {
    expect(UpdateIssueInputSchema.safeParse({ done_ratio: 25 }).success).toBe(false);
  });
});
