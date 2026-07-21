/**
 * `redmine_list_projects` — browse visible projects.
 *
 * Read-only tool over {@link RedmineClient.projects.list}. Exposes a friendly
 * `status` enum (`active`/`closed`/`archived`) and maps it to the integer codes
 * Redmine expects (1/5/9) so agents never deal with the magic numbers.
 */

import { z } from 'zod';
import { ProjectIncludeSchema, type ListProjectsParams } from '../../../domain/models/index.js';
import { defineTool } from '../../tool-definition.js';

/** Friendly lifecycle names → Redmine's integer status codes. */
const PROJECT_STATUS = { active: 1, closed: 5, archived: 9 } as const;

/** Agent-facing input shape for `redmine_list_projects`. */
const inputShape = {
  status: z
    .enum(['active', 'closed', 'archived'])
    .optional()
    .describe('Lifecycle filter: "active" (default), "closed", or "archived".'),
  name: z.string().optional().describe('Filter by project name (substring match).'),
  parent_id: z.string().optional().describe('Only projects under this parent project id.'),
  is_public: z
    .boolean()
    .optional()
    .describe('Filter by public (true) vs private (false) projects.'),
  include: z
    .array(ProjectIncludeSchema)
    .optional()
    .describe(
      'Associations to expand: "trackers", "issue_categories", "time_entry_activities", ' +
        '"enabled_modules", "issue_custom_fields".',
    ),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Pagination offset (skip N projects).'),
  limit: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Maximum number of projects to return.'),
};

export const listProjectsTool = defineTool({
  name: 'redmine_list_projects',
  title: 'List projects',
  description:
    'List the projects the API key can see, optionally filtered by name, status, parent, or ' +
    'visibility — the standard "what projects exist" orientation call.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => {
    const { status, ...rest } = input;
    const params: ListProjectsParams =
      status === undefined ? rest : { ...rest, status: PROJECT_STATUS[status] };
    return redmine.projects.list(params);
  },
});
