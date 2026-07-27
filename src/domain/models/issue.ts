import { z } from 'zod';
import {
  AttachmentRefSchema,
  CustomFieldValueSchema,
  CustomFieldWriteSchema,
  IdNameSchema,
  IssueStatusRefSchema,
} from './common.js';
import { IssueRelationSchema } from './issue-relation.js';

/**
 * Wire models for Redmine issues (schemas + inferred types). These mirror what
 * Redmine returns and accepts (snake_case); the tool-facing naming and the
 * wire↔tool mapping live in the outbound adapter and tool layers.
 *
 * Naming / optionality conventions are documented in {@link ./common.ts}.
 */

/** The set of `include` expansions Redmine understands for issues. */
export const IssueIncludeSchema = z.enum([
  'children',
  'attachments',
  'relations',
  'changesets',
  'journals',
  'watchers',
  'allowed_statuses',
]);
export type IssueInclude = z.infer<typeof IssueIncludeSchema>;

/**
 * List/create result item (`issue.simple`). Fields that Redmine returns as an
 * explicit `null` (e.g. an unset `due_date`) are `.nullable()`; fields that may
 * simply be absent (e.g. an unassigned issue's `assigned_to`, or the
 * permission-gated `spent_hours`) are `.optional()`.
 */
export const IssueSimpleSchema = z.object({
  id: z.number(),
  project: IdNameSchema,
  tracker: IdNameSchema,
  status: IssueStatusRefSchema,
  priority: IdNameSchema,
  author: IdNameSchema,
  assigned_to: IdNameSchema.optional(),
  category: IdNameSchema.optional(),
  subject: z.string(),
  description: z.string().nullable(),
  start_date: z.string().nullable(),
  due_date: z.string().nullable(),
  done_ratio: z.number().int(),
  is_private: z.boolean(),
  estimated_hours: z.number().nullable(),
  total_estimated_hours: z.number().nullable(),
  spent_hours: z.number().optional(),
  total_spent_hours: z.number().optional(),
  custom_fields: z.array(CustomFieldValueSchema).optional(),
  created_on: z.string(),
  updated_on: z.string(),
  closed_on: z.string().nullable(),
});
export type IssueSimple = z.infer<typeof IssueSimpleSchema>;

/** A parent issue's child reference (returned under `include=children`). */
const IssueChildSchema = z.object({
  id: z.number(),
  tracker: IdNameSchema,
  subject: z.string(),
});

/** A single change recorded in a journal entry's `details` array. */
const JournalDetailSchema = z.object({
  property: z.string(),
  name: z.string(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
});

/** A journal (note + field changes) entry (returned under `include=journals`). */
const JournalSchema = z.object({
  id: z.number(),
  user: IdNameSchema,
  notes: z.string(),
  created_on: z.string(),
  private_notes: z.boolean(),
  details: z.array(JournalDetailSchema),
});

/**
 * A single issue (`issue`) as returned by `GET /issues/{id}.json`. Extends the
 * simple form with the `include`-gated collections, each optional because it is
 * present only when requested.
 */
export const IssueSchema = IssueSimpleSchema.extend({
  children: z.array(IssueChildSchema).optional(),
  attachments: z.array(AttachmentRefSchema).optional(),
  relations: z.array(IssueRelationSchema).optional(),
  changesets: z.array(z.string()).optional(),
  journals: z.array(JournalSchema).optional(),
  watchers: z.array(IdNameSchema).optional(),
  allowed_statuses: z.array(IssueStatusRefSchema).optional(),
});
export type Issue = z.infer<typeof IssueSchema>;

/**
 * `done_ratio` constraint shared by create/update: an integer percentage in
 * `[0, 100]` in steps of 10, per the Redmine spec.
 */
const doneRatioSchema = z.number().int().min(0).max(100).multipleOf(10);

/**
 * An upload token, as returned by `POST /uploads.json` and referenced from an
 * issue's `uploads` array to attach previously uploaded files.
 */
export const UploadTokenSchema = z.object({
  token: z.string(),
  filename: z.string().optional(),
  content_type: z.string().optional(),
  description: z.string().optional(),
});
export type UploadToken = z.infer<typeof UploadTokenSchema>;

/**
 * The full filter surface for `GET /issues.json`. All fields are optional; ID
 * and date filters are kept as strings so they can carry Redmine's filter
 * grammar (comma-joined lists, operator prefixes like `>=2024-01-01`) — the
 * request builder serializes them. `custom_fields` maps `cf_<id>` keys to
 * filter values.
 */
export const ListIssuesParamsSchema = z.object({
  project_id: z.string().optional(),
  status_id: z.string().optional(),
  assigned_to_id: z.string().optional(),
  tracker_id: z.string().optional(),
  author_id: z.string().optional(),
  fixed_version_id: z.string().optional(),
  category_id: z.string().optional(),
  subject: z.string().optional(),
  created_on: z.string().optional(),
  updated_on: z.string().optional(),
  due_date: z.string().optional(),
  query_id: z.number().optional(),
  sort: z.string().optional(),
  include: z.array(IssueIncludeSchema).optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().nonnegative().optional(),
  custom_fields: z.record(z.string(), z.string()).optional(),
});
export type ListIssuesParams = z.infer<typeof ListIssuesParamsSchema>;

/** Body for `POST /issues.json`. `project_id` and `subject` are required. */
export const CreateIssueInputSchema = z.object({
  project_id: z.number(),
  subject: z.string(),
  tracker_id: z.number().optional(),
  status_id: z.number().optional(),
  priority_id: z.number().optional(),
  description: z.string().optional(),
  assigned_to_id: z.number().optional(),
  parent_issue_id: z.number().optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  done_ratio: doneRatioSchema.optional(),
  estimated_hours: z.number().optional(),
  category_id: z.number().optional(),
  fixed_version_id: z.number().optional(),
  is_private: z.boolean().optional(),
  custom_fields: z.array(CustomFieldWriteSchema).optional(),
  watcher_user_ids: z.array(z.number()).optional(),
  uploads: z.array(UploadTokenSchema).optional(),
});
export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;

/**
 * Body for `PUT /issues/{id}.json`. Every field is optional (a partial update);
 * adds `notes` and `private_notes` for journalized comments.
 */
export const UpdateIssueInputSchema = z.object({
  project_id: z.number().optional(),
  subject: z.string().optional(),
  tracker_id: z.number().optional(),
  status_id: z.number().optional(),
  priority_id: z.number().optional(),
  description: z.string().optional(),
  assigned_to_id: z.number().optional(),
  parent_issue_id: z.number().optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  done_ratio: doneRatioSchema.optional(),
  estimated_hours: z.number().optional(),
  category_id: z.number().optional(),
  fixed_version_id: z.number().optional(),
  is_private: z.boolean().optional(),
  custom_fields: z.array(CustomFieldWriteSchema).optional(),
  watcher_user_ids: z.array(z.number()).optional(),
  uploads: z.array(UploadTokenSchema).optional(),
  notes: z.string().optional(),
  private_notes: z.boolean().optional(),
});
export type UpdateIssueInput = z.infer<typeof UpdateIssueInputSchema>;
