/**
 * `redmine_update_issue` — edit an issue and confirm the result.
 *
 * Write tool over {@link RedmineClient.issues.update}. Redmine answers a
 * successful `PUT` with `204 No Content`, so — for verifiable agent ergonomics —
 * the handler re-fetches the issue after the update and returns the fresh
 * representation. The common workflow "change status and leave a note" is a
 * single call: `status_id` + `notes` map to one PUT.
 */

import { z } from 'zod';
import {
  CustomFieldWriteSchema,
  UploadTokenSchema,
  type UpdateIssueInput,
} from '../../../domain/models/index.js';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_update_issue`. */
const inputShape = {
  issue_id: z
    .number()
    .int()
    .positive()
    .describe('The numeric id of the issue to update (required).'),
  subject: z.string().min(1).optional().describe('New one-line summary.'),
  tracker_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'New tracker id. NOTE: Redmine silently ignores an unknown id (keeps the current tracker) ' +
        'instead of returning a 422 — verify the tracker on the re-fetched issue.',
    ),
  status_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'New status id (see allowed_statuses). NOTE: Redmine silently ignores an unknown id (keeps ' +
        'the current status) instead of returning a 422 — verify the status on the re-fetched issue.',
    ),
  priority_id: z.number().int().positive().optional().describe('New priority id.'),
  description: z.string().optional().describe('New description.'),
  assigned_to_id: z.number().int().positive().optional().describe('Reassign to this user id.'),
  parent_issue_id: z.number().int().positive().optional().describe('New parent issue id.'),
  start_date: z.string().optional().describe('New start date, ISO "YYYY-MM-DD".'),
  due_date: z.string().optional().describe('New due date, ISO "YYYY-MM-DD".'),
  done_ratio: z
    .number()
    .int()
    .min(0)
    .max(100)
    .multipleOf(10)
    .optional()
    .describe('Percent done, 0–100 in steps of 10.'),
  estimated_hours: z.number().nonnegative().optional().describe('Estimated effort in hours.'),
  category_id: z.number().int().positive().optional().describe('New issue category id.'),
  fixed_version_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'New target version id. NOTE: Redmine silently ignores an unknown id (or any id when the ' +
        'project has no versions), keeping the current value, instead of returning a 422 — verify ' +
        'the version on the re-fetched issue.',
    ),
  is_private: z
    .boolean()
    .optional()
    .describe(
      'Toggle issue privacy. NOTE: applying this depends on your Redmine role permission ' +
        '("Set issues public/private"). Without it, Redmine silently ignores the flag (privacy ' +
        'unchanged) instead of returning an error — verify is_private on the re-fetched issue.',
    ),
  custom_fields: z
    .array(CustomFieldWriteSchema)
    .optional()
    .describe('Custom-field values as { id, value } entries.'),
  watcher_user_ids: z
    .array(z.number().int().positive())
    .optional()
    .describe('Replacement set of watcher user ids.'),
  uploads: z.array(UploadTokenSchema).optional().describe('Attachment upload tokens to link.'),
  notes: z.string().optional().describe('Comment/journal note to record with this change.'),
  private_notes: z.boolean().optional().describe('Mark the note as private.'),
};

export const updateIssueTool = defineTool({
  name: 'redmine_update_issue',
  title: 'Update issue',
  description:
    'Edit an issue: change status, reassign, reprioritize, adjust dates/done_ratio, and add a ' +
    'comment (notes) in the same call. Returns the re-fetched, updated issue for confirmation.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: false, openWorldHint: true },
  handle: async (input, { redmine }) => {
    // Separate the routing id from the mutable fields; the rest is the update body.
    const { issue_id, ...fields } = input;
    const update: UpdateIssueInput = fields;
    await redmine.issues.update(issue_id, update);
    // 204 No Content on success — re-fetch so the agent sees the resulting state.
    return redmine.issues.get(issue_id);
  },
});
