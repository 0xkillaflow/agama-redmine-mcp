import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  AttachmentRefSchema,
  EnumerationSchema,
  IssueRelationSchema,
  IssueSchema,
  IssueSimpleSchema,
  IssueStatusRefSchema,
  ProjectSchema,
  ProjectSimpleSchema,
  RedmineErrorsBodySchema,
  SearchResultSchema,
  TimeEntrySchema,
  TrackerSchema,
  UserSchema,
  UserSimpleSchema,
  paginated,
} from '../../src/domain/models/index.js';
import { readFixture } from './fixtures/index.js';

/**
 * Guards the acceptance criterion that every fixture is a faithful Redmine
 * payload: each raw JSON file must parse against its domain schema. If a model
 * changes and a fixture drifts, this is the test that catches it.
 */
describe('support fixtures', () => {
  const cases: ReadonlyArray<[string, z.ZodTypeAny]> = [
    ['issue.simple.json', IssueSimpleSchema],
    ['issue.json', IssueSchema],
    ['issue-relation.json', IssueRelationSchema],
    ['project.simple.json', ProjectSimpleSchema],
    ['project.json', ProjectSchema],
    ['time_entry.json', TimeEntrySchema],
    ['user.json', UserSchema],
    ['user.simple.json', UserSimpleSchema],
    ['search.json', paginated('results', SearchResultSchema)],
    ['attachment.json', AttachmentRefSchema],
    ['errors.422.json', RedmineErrorsBodySchema],
    ['reference-data.statuses.json', z.object({ issue_statuses: z.array(IssueStatusRefSchema) })],
    ['reference-data.trackers.json', z.object({ trackers: z.array(TrackerSchema) })],
    ['reference-data.priorities.json', z.object({ issue_priorities: z.array(EnumerationSchema) })],
  ];

  it.each(cases)('%s parses against its domain schema', (file, schema) => {
    const result = schema.safeParse(readFixture(file));
    expect(result.success).toBe(true);
  });
});
