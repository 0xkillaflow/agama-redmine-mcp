/**
 * `redmine_list_issues` — search and filter issues.
 *
 * A thin, read-only tool over {@link RedmineClient.issues.list}. The input shape
 * is a curated slice of Redmine's ~30-filter grammar: the fields agents reach for
 * most, each documented with `.describe()` so the model knows the accepted forms
 * (ID lists, the `open`/`closed`/`*` status shortcuts, `me`, date operators).
 * Values pass through to Redmine's filter grammar verbatim — the request builder
 * serializes them — so advanced filters remain expressible as raw strings.
 */

import { z } from 'zod';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_list_issues`. */
const inputShape = {
  project_id: z
    .string()
    .optional()
    .describe('Project id or identifier slug to scope to, e.g. "42" or "website".'),
  status_id: z
    .string()
    .optional()
    .describe(
      'Status filter. A status id, or a shortcut: "open" (any open status), ' +
        '"closed" (any closed status), or "*" (any status). Defaults to open issues.',
    ),
  assigned_to_id: z
    .string()
    .optional()
    .describe('Assignee user id, or "me" for the API key\'s own user.'),
  tracker_id: z.string().optional().describe('Tracker id, e.g. "1" for Bug.'),
  author_id: z.string().optional().describe('Author (reporter) user id, or "me".'),
  fixed_version_id: z.string().optional().describe('Target version (milestone) id.'),
  category_id: z.string().optional().describe('Issue category id.'),
  subject: z.string().optional().describe('Filter by subject text (substring match).'),
  created_on: z
    .string()
    .optional()
    .describe(
      'Creation-date filter. Accepts Redmine operators, e.g. ">=2024-01-01", ' +
        '"<=2024-12-31", or "><2024-01-01|2024-06-30" for a range.',
    ),
  updated_on: z
    .string()
    .optional()
    .describe('Last-updated-date filter; same operator grammar as created_on.'),
  due_date: z.string().optional().describe('Due-date filter; same operator grammar as created_on.'),
  query_id: z.number().int().optional().describe('Run a saved query by its numeric id.'),
  custom_fields: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Custom-field filters keyed by field id, e.g. { "5": "urgent" } (exact match). ' +
        'Only fields enabled as a filter in Redmine apply; others are silently ignored.',
    ),
  sort: z
    .string()
    .optional()
    .describe('Sort column, optionally with ":desc", e.g. "priority:desc,updated_on".'),
  include: z
    .array(z.enum(['attachments', 'relations']))
    .optional()
    .describe('Associations to expand on each issue: "attachments" and/or "relations".'),
  offset: z.number().int().nonnegative().optional().describe('Pagination offset (skip N issues).'),
  limit: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Maximum number of issues to return (Redmine caps at 100).'),
};

export const listIssuesTool = defineTool({
  name: 'redmine_list_issues',
  title: 'List issues',
  description:
    'Search and filter issues across one or all projects — the primary entry point for ' +
    '"what\'s on the board". Supports status/assignee/tracker/date/custom-field filters, ' +
    'saved queries, sorting, and pagination.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.issues.list(input),
});
