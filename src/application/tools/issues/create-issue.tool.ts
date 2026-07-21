/**
 * `redmine_create_issue` — create a new issue.
 *
 * Write tool over {@link RedmineClient.issues.create}. The input shape mirrors
 * `CreateIssueInput`: `project_id` and `subject` are required; everything else is
 * an optional refinement. Field ids (tracker, status, priority, …) come from
 * `redmine_get_project` / `redmine_list_reference_data`; `uploads` tokens come
 * from a prior attachment upload.
 */

import { z } from 'zod';
import { CustomFieldWriteSchema, UploadTokenSchema } from '../../../domain/models/index.js';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_create_issue`. */
const inputShape = {
  project_id: z.number().int().positive().describe('Target project id (required).'),
  subject: z.string().min(1).describe('One-line issue summary (required).'),
  tracker_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Tracker id, e.g. Bug/Feature/Task. NOTE: Redmine silently ignores an unknown id ' +
        '(falls back to the project default) instead of returning a 422 — verify the tracker on ' +
        'the returned issue.',
    ),
  status_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Initial status id. NOTE: Redmine silently ignores an unknown id (falls back to the ' +
        'default status) instead of returning a 422 — verify the status on the returned issue.',
    ),
  priority_id: z.number().int().positive().optional().describe('Priority id.'),
  description: z.string().optional().describe('Full description (Textile/Markdown per instance).'),
  assigned_to_id: z.number().int().positive().optional().describe('Assignee user id.'),
  parent_issue_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Parent issue id, to create this as a sub-task.'),
  start_date: z.string().optional().describe('Start date, ISO "YYYY-MM-DD".'),
  due_date: z.string().optional().describe('Due date, ISO "YYYY-MM-DD".'),
  done_ratio: z
    .number()
    .int()
    .min(0)
    .max(100)
    .multipleOf(10)
    .optional()
    .describe('Percent done, 0–100 in steps of 10.'),
  estimated_hours: z.number().nonnegative().optional().describe('Estimated effort in hours.'),
  category_id: z.number().int().positive().optional().describe('Issue category id.'),
  fixed_version_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Target version (milestone) id. NOTE: Redmine silently ignores an unknown id (or any id ' +
        'when the project has no versions) instead of returning a 422 — verify the version on the ' +
        'returned issue.',
    ),
  is_private: z
    .boolean()
    .optional()
    .describe(
      'Mark the issue private. NOTE: applying this depends on your Redmine role permission ' +
        '("Set issues public/private"). Without it, Redmine silently ignores the flag (the issue ' +
        'stays public) instead of returning an error — verify is_private on the returned issue.',
    ),
  custom_fields: z
    .array(CustomFieldWriteSchema)
    .optional()
    .describe('Custom-field values as { id, value } entries; value may be a string or string[].'),
  watcher_user_ids: z
    .array(z.number().int().positive())
    .optional()
    .describe('User ids to add as watchers.'),
  uploads: z
    .array(UploadTokenSchema)
    .optional()
    .describe('Attachment upload tokens to link to the new issue.'),
};

export const createIssueTool = defineTool({
  name: 'redmine_create_issue',
  title: 'Create issue',
  description:
    'Create a new issue (bug, feature, task) in a project with subject, description, tracker, ' +
    'priority, assignee, dates, and custom fields. Returns the created issue with its id.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: false, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.issues.create(input),
});
