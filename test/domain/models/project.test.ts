import { describe, it, expect } from 'vitest';
import {
  ProjectSimpleSchema,
  ProjectSchema,
  ProjectRefSchema,
} from '../../../src/domain/models/project.js';

const simple = {
  id: 1,
  name: 'Website',
  identifier: 'website',
  description: 'The public website',
  status: 1,
  is_public: true,
  created_on: '2024-01-01T10:00:00Z',
  updated_on: '2024-01-02T10:00:00Z',
};

describe('ProjectSimpleSchema', () => {
  it('parses a project.simple', () => {
    expect(ProjectSimpleSchema.parse(simple)).toEqual(simple);
  });

  it('parses a project.simple with a null description and a parent', () => {
    const parsed = ProjectSimpleSchema.parse({
      ...simple,
      description: null,
      parent: { id: 9, name: 'Parent' },
    });
    expect(parsed.description).toBeNull();
    expect(parsed.parent).toEqual({ id: 9, name: 'Parent' });
  });

  it('rejects a project missing its identifier', () => {
    const { identifier, ...invalid } = simple;
    void identifier;
    expect(ProjectSimpleSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('ProjectSchema', () => {
  it('parses a full project including include-gated fields', () => {
    const full = {
      ...simple,
      trackers: [{ id: 1, name: 'Bug' }],
      issue_categories: [{ id: 2, name: 'UI' }],
      time_entry_activities: [{ id: 3, name: 'Development' }],
      enabled_modules: [{ id: 4, name: 'issue_tracking' }],
      issue_custom_fields: [{ id: 5, name: 'Severity' }],
      default_assignee: { id: 6, name: 'Jane Doe' },
      default_version: { id: 7, name: 'v1.0' },
    };
    expect(ProjectSchema.parse(full)).toEqual(full);
  });
});

describe('ProjectRefSchema', () => {
  it('accepts a numeric id', () => {
    expect(ProjectRefSchema.parse(42)).toBe(42);
  });

  it('accepts an identifier slug', () => {
    expect(ProjectRefSchema.parse('my-project')).toBe('my-project');
  });
});
