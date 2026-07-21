import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  IssueSchema,
  IssueSimpleSchema,
  ProjectSchema,
  ProjectSimpleSchema,
  RedmineErrorsBodySchema,
  SearchResultSchema,
  TimeEntrySchema,
  UserSchema,
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
    ['project.simple.json', ProjectSimpleSchema],
    ['project.json', ProjectSchema],
    ['time_entry.json', TimeEntrySchema],
    ['user.json', UserSchema],
    ['search.json', paginated('results', SearchResultSchema)],
    ['errors.422.json', RedmineErrorsBodySchema],
  ];

  it.each(cases)('%s parses against its domain schema', (file, schema) => {
    const result = schema.safeParse(readFixture(file));
    expect(result.success).toBe(true);
  });
});
