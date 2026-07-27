/**
 * Typed test fixtures, parsed from the JSON payloads in this directory against
 * the domain Zod schemas.
 *
 * The JSON files are faithful Redmine wire payloads (snake_case, the same shapes
 * the OpenAPI examples describe). Loading them *through* the schemas has two
 * benefits: callers get already-typed domain values, and any drift between a
 * fixture and its schema fails loudly at import time rather than as a confusing
 * `undefined` deep in a test.
 *
 * Keep these payloads faithful to real Redmine responses; update them alongside
 * the domain models.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
  type ReferenceData,
} from '../../../src/domain/models/index.js';

/** Read and JSON-parse a fixture file from this directory (untyped). */
export function readFixture(name: string): unknown {
  const path = fileURLToPath(new URL(`./${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/** The page schema for `GET /search.json` (results under the `results` key). */
const SearchPageSchema = paginated('results', SearchResultSchema);

/** A list/create result item (`issue.simple`). */
export const issueSimpleFixture = IssueSimpleSchema.parse(readFixture('issue.simple.json'));
/** A full issue with `include`-gated collections (`issue`). */
export const issueFixture = IssueSchema.parse(readFixture('issue.json'));
/**
 * A relation between two issues (`relation`): #17 blocks #42, so an issue asking
 * for its relations sees itself as the source in one direction and the target in
 * the other. `delay` is `null` because it only applies to `precedes`/`follows`.
 */
export const issueRelationFixture = IssueRelationSchema.parse(readFixture('issue-relation.json'));
/** A list result item (`project.simple`). */
export const projectSimpleFixture = ProjectSimpleSchema.parse(readFixture('project.simple.json'));
/** A full project with `include`-gated collections (`project`). */
export const projectFixture = ProjectSchema.parse(readFixture('project.json'));
/** A time entry booked against an issue (`time_entry`). */
export const timeEntryFixture = TimeEntrySchema.parse(readFixture('time_entry.json'));
/** The current user with memberships and groups (`user`). */
export const userFixture = UserSchema.parse(readFixture('user.json'));
/** A list result item (`user.simple`). */
export const userSimpleFixture = UserSimpleSchema.parse(readFixture('user.simple.json'));
/** A normalized page of search results (`Paginated<SearchResult>`). */
export const searchResultsPage = SearchPageSchema.parse(readFixture('search.json'));
/** An attachment reference (`attachment`); its filename contains a space on purpose. */
export const attachmentFixture = AttachmentRefSchema.parse(readFixture('attachment.json'));
/** Redmine's 422 error envelope (`{ errors: string[] }`). */
export const validationErrorsBody = RedmineErrorsBodySchema.parse(readFixture('errors.422.json'));

/**
 * Parse one reference-data payload into the `{ kind, items }` value the port
 * returns. The envelope key differs from the kind (`priorities` →
 * `issue_priorities`), so both are given explicitly.
 */
function referenceFixture<Kind extends ReferenceData['kind'], Item extends z.ZodTypeAny>(
  kind: Kind,
  key: string,
  itemSchema: Item,
  file: string,
): { kind: Kind; items: z.infer<Item>[] } {
  const parsed = z.object({ [key]: z.array(itemSchema) }).parse(readFixture(file));
  const items = (parsed as Record<string, z.infer<Item>[]>)[key] as z.infer<Item>[];
  return { kind, items };
}

/** The instance-wide issue statuses (`{ kind: 'statuses' }`). */
export const referenceStatusesFixture = referenceFixture(
  'statuses',
  'issue_statuses',
  IssueStatusRefSchema,
  'reference-data.statuses.json',
);
/** The instance-wide trackers (`{ kind: 'trackers' }`). */
export const referenceTrackersFixture = referenceFixture(
  'trackers',
  'trackers',
  TrackerSchema,
  'reference-data.trackers.json',
);
/** The instance-wide issue priorities (`{ kind: 'priorities' }`). */
export const referencePrioritiesFixture = referenceFixture(
  'priorities',
  'issue_priorities',
  EnumerationSchema,
  'reference-data.priorities.json',
);
