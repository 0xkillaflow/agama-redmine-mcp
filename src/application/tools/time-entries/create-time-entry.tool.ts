/**
 * `redmine_create_time_entry` — log hours.
 *
 * Write tool over {@link RedmineClient.timeEntries.create}. Time is booked either
 * against an issue *or* against a project — exactly one of `issue_id` /
 * `project_id` is required. That XOR is enforced at the tool boundary (via a
 * `superRefine` re-parse in the handler) so the agent gets an immediate, clear
 * error before any HTTP call is made.
 */

import { z } from 'zod';
import { CustomFieldWriteSchema } from '../../../domain/models/index.js';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_create_time_entry`. */
const inputShape = {
  hours: z
    .number()
    .positive()
    .describe('Hours to log, must be positive, e.g. 3.5 for "log 3.5 hours on issue #456".'),
  issue_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Issue to book against. Provide exactly one of issue_id or project_id.'),
  project_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Project to book against. Provide exactly one of issue_id or project_id.'),
  spent_on: z
    .string()
    .optional()
    .describe('Date the time was spent, ISO "YYYY-MM-DD". Defaults to today.'),
  activity_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Activity id (e.g. Development, Design); required by some Redmine instances.'),
  comments: z
    .string()
    .optional()
    .describe('Short note describing the work, e.g. "implemented auth".'),
  user_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Log on behalf of another user id. Requires elevated permission — Redmine returns 403 ' +
        'otherwise.',
    ),
  custom_fields: z
    .array(CustomFieldWriteSchema)
    .optional()
    .describe('Custom-field values as { id, value } entries.'),
};

/**
 * Full-object view of the input used for the exactly-one-of check. The SDK
 * validates fields against `inputShape`; this re-parse adds the cross-field XOR
 * that a raw shape cannot express, throwing before the client is called.
 */
const validatedInput = z.object(inputShape).superRefine((value, ctx) => {
  const hasIssue = value.issue_id !== undefined;
  const hasProject = value.project_id !== undefined;
  if (hasIssue === hasProject) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one of issue_id or project_id.',
      path: ['issue_id'],
    });
  }
});

export const createTimeEntryTool = defineTool({
  name: 'redmine_create_time_entry',
  title: 'Create time entry',
  description:
    'Log hours against an issue or project with an activity type and comment — e.g. "log 3.5 ' +
    'hours on #456 for implementing auth". Exactly one of issue_id or project_id is required.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: false, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.timeEntries.create(validatedInput.parse(input)),
});
