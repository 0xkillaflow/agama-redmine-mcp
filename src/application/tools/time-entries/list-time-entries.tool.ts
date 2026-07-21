/**
 * `redmine_list_time_entries` — query logged time.
 *
 * Read-only tool over {@link RedmineClient.timeEntries.list}. Filters map through
 * to Redmine's time-entry query grammar; `user_id` accepts "me" for the API
 * key's own user. Used for timesheet review and billing/reporting workflows.
 */

import { z } from 'zod';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_list_time_entries`. */
const inputShape = {
  user_id: z.string().optional().describe('User id whose entries to list, or "me".'),
  project_id: z.string().optional().describe('Scope to a project id or identifier slug.'),
  issue_id: z.string().optional().describe('Scope to a single issue id.'),
  spent_on: z
    .string()
    .optional()
    .describe('Exact spent-on date, ISO "YYYY-MM-DD". Use from/to for ranges.'),
  from: z.string().optional().describe('Start of a spent-on date range, ISO "YYYY-MM-DD".'),
  to: z.string().optional().describe('End of a spent-on date range, ISO "YYYY-MM-DD".'),
  activity_id: z.string().optional().describe('Filter by activity id (e.g. Development, Design).'),
  sort: z
    .string()
    .optional()
    .describe('Sort column, optionally with ":desc", e.g. "spent_on:desc".'),
  offset: z.number().int().nonnegative().optional().describe('Pagination offset (skip N entries).'),
  limit: z.number().int().nonnegative().optional().describe('Maximum number of entries to return.'),
};

export const listTimeEntriesTool = defineTool({
  name: 'redmine_list_time_entries',
  title: 'List time entries',
  description:
    'Query logged time by user, project, issue, date range, or activity — used for timesheet ' +
    'review ("what did I log this week") and billing/reporting.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.timeEntries.list(input),
});
