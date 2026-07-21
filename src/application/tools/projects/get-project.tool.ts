/**
 * `redmine_get_project` — full detail for one project.
 *
 * Read-only tool over {@link RedmineClient.projects.get}. `project_id` accepts a
 * numeric id or the project's identifier slug (Redmine resolves both). The
 * `include` set surfaces the reference data agents need before creating issues or
 * time entries — notably `trackers` and `time_entry_activities`.
 */

import { z } from 'zod';
import { ProjectIncludeSchema } from '../../../domain/models/index.js';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_get_project`. */
const inputShape = {
  project_id: z
    .union([z.number().int().positive(), z.string().min(1)])
    .describe('Project id (number) or identifier slug (string), e.g. 42 or "website" (required).'),
  include: z
    .array(ProjectIncludeSchema)
    .optional()
    .describe(
      'Associations to expand: "trackers", "issue_categories", "time_entry_activities", ' +
        '"enabled_modules", "issue_custom_fields".',
    ),
};

export const getProjectTool = defineTool({
  name: 'redmine_get_project',
  title: 'Get project',
  description:
    'Show full detail for one project, optionally including its trackers, issue categories, ' +
    'time-entry activities, enabled modules, and issue custom fields — needed before creating ' +
    'issues or time entries in an unfamiliar project.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.projects.get(input.project_id, input.include),
});
