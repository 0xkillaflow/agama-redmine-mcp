/**
 * Time-entries resource client: the `TimeEntriesResource`
 * port backed by the Redmine HTTP requester.
 *
 * The issue/project XOR on create is enforced upstream by the input model
 * (`CreateTimeEntryInput`) and the tool; this layer only serializes. A `422`
 * from Redmine surfaces as `RedmineValidationError` via the requester's error
 * mapper. Inputs already use Redmine's snake_case field names, so they are
 * wrapped verbatim in the `{ time_entry }` envelope.
 */

import {
  TimeEntrySchema,
  paginated,
  type CreateTimeEntryInput,
  type ListTimeEntriesParams,
  type Paginated,
  type TimeEntry,
} from '../../../domain/models/index.js';
import type { TimeEntriesResource } from '../../../domain/ports/index.js';
import type { HttpRequester } from '../http-requester.js';
import { toQuery } from '../request-builder.js';
import { parseBody, parseEnvelope } from './parse.js';

/** Build the `TimeEntriesResource` bound to the given requester. */
export function createTimeEntriesResource(http: HttpRequester): TimeEntriesResource {
  return {
    async list(params: ListTimeEntriesParams): Promise<Paginated<TimeEntry>> {
      const body = await http.get('/time_entries.json', toQuery(params));
      return parseBody(paginated('time_entries', TimeEntrySchema), body, 'list time entries');
    },

    async create(input: CreateTimeEntryInput): Promise<TimeEntry> {
      const body = await http.post('/time_entries.json', { time_entry: input });
      return parseEnvelope('time_entry', TimeEntrySchema, body, 'create time entry');
    },
  };
}
