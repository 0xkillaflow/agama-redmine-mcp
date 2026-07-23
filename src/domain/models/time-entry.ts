import { z } from 'zod';
import { CustomFieldValueSchema, CustomFieldWriteSchema, IdNameSchema } from './common.js';

/**
 * Wire models for Redmine time entries (schemas + inferred types). Conventions
 * are documented in {@link ./common.ts}.
 */

/** A logged time entry (`time_entry`). */
export const TimeEntrySchema = z.object({
  id: z.number(),
  project: IdNameSchema.optional(),
  // Present when the entry is booked against an issue rather than a project.
  issue: z.object({ id: z.number() }).optional(),
  user: IdNameSchema,
  activity: IdNameSchema,
  // Some Redmine setups return `hours` as a numeric string; coerce defensively.
  hours: z.coerce.number(),
  comments: z.string().nullable(),
  spent_on: z.string(),
  created_on: z.string(),
  updated_on: z.string(),
  custom_fields: z.array(CustomFieldValueSchema).optional(),
});
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

/** Filters for `GET /time_entries.json`. */
export const ListTimeEntriesParamsSchema = z.object({
  user_id: z.string().optional(),
  project_id: z.string().optional(),
  issue_id: z.string().optional(),
  spent_on: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  activity_id: z.string().optional(),
  sort: z.string().optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().nonnegative().optional(),
});
export type ListTimeEntriesParams = z.infer<typeof ListTimeEntriesParamsSchema>;

/**
 * Body for `POST /time_entries.json`. `hours` is required, and exactly one of
 * `issue_id` / `project_id` must be supplied — the time is booked either
 * against an issue or against a project, never both and never neither.
 */
export const CreateTimeEntryInputSchema = z
  .object({
    hours: z.number(),
    issue_id: z.number().optional(),
    project_id: z.number().optional(),
    spent_on: z.string().optional(),
    activity_id: z.number().optional(),
    comments: z.string().optional(),
    user_id: z.number().optional(),
    custom_fields: z.array(CustomFieldWriteSchema).optional(),
  })
  .superRefine((input, ctx) => {
    const hasIssue = input.issue_id !== undefined;
    const hasProject = input.project_id !== undefined;
    if (hasIssue === hasProject) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide exactly one of issue_id or project_id.',
        path: ['issue_id'],
      });
    }
  });
export type CreateTimeEntryInput = z.infer<typeof CreateTimeEntryInputSchema>;
