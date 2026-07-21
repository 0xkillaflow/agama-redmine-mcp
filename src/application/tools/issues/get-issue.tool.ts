/**
 * `redmine_get_issue` — fetch full detail on a single issue.
 *
 * Read-only tool over {@link RedmineClient.issues.get}. The `include` set covers
 * every expansion Redmine supports for an issue; agents typically request
 * `journals` (comment history) and `allowed_statuses` before an edit.
 */

import { z } from 'zod';
import { IssueIncludeSchema } from '../../../domain/models/index.js';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_get_issue`. */
const inputShape = {
  issue_id: z.number().int().positive().describe('The numeric id of the issue to fetch.'),
  include: z
    .array(IssueIncludeSchema)
    .optional()
    .describe(
      'Associations to expand: "children", "attachments", "relations", "changesets", ' +
        '"journals" (notes/history), "watchers", "allowed_statuses" (legal next statuses). ' +
        'NOTE: "watchers" is permission-gated — Redmine omits the field entirely (not an empty ' +
        'array) unless your role has "View issue watchers", so its absence does not mean the issue ' +
        'has no watchers.',
    ),
};

export const getIssueTool = defineTool({
  name: 'redmine_get_issue',
  title: 'Get issue',
  description:
    'Fetch full detail on a single issue, optionally expanded with journals, attachments, ' +
    'relations, children, watchers, and allowed status transitions. Reach for this before ' +
    'editing an issue to see current state and what is legal to change it to.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.issues.get(input.issue_id, input.include),
});
