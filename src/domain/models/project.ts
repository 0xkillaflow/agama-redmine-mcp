import { z } from 'zod';
import { CustomFieldValueSchema, IdNameSchema } from './common.js';

/**
 * Wire models for Redmine projects (schemas + inferred types). Conventions are
 * documented in {@link ./common.ts}.
 */

/** The set of `include` expansions Redmine understands for projects. */
export const ProjectIncludeSchema = z.enum([
  'trackers',
  'issue_categories',
  'time_entry_activities',
  'enabled_modules',
  'issue_custom_fields',
]);
export type ProjectInclude = z.infer<typeof ProjectIncludeSchema>;

/**
 * A project's lifecycle state, encoded by Redmine as an integer code:
 * `1` = active, `5` = closed, `9` = archived.
 */
const ProjectStatusSchema = z.number().int();

/**
 * The `include`-gated association collections. Redmine expands these on **both**
 * the collection endpoint (`GET /projects.json?include=...`) and the single
 * endpoint (`GET /projects/{id}.json?include=...`), so they belong on the list
 * item too — otherwise the parser would silently drop them from `list_projects`.
 */
const projectIncludeFields = {
  trackers: z.array(IdNameSchema).optional(),
  issue_categories: z.array(IdNameSchema).optional(),
  time_entry_activities: z.array(IdNameSchema).optional(),
  enabled_modules: z.array(IdNameSchema).optional(),
  issue_custom_fields: z.array(IdNameSchema).optional(),
} as const;

/** List result item (`project.simple`), including any `include`-expanded associations. */
export const ProjectSimpleSchema = z.object({
  id: z.number(),
  name: z.string(),
  identifier: z.string(),
  description: z.string().nullable().optional(),
  status: ProjectStatusSchema,
  is_public: z.boolean().optional(),
  parent: IdNameSchema.optional(),
  custom_fields: z.array(CustomFieldValueSchema).optional(),
  created_on: z.string().optional(),
  updated_on: z.string().optional(),
  ...projectIncludeFields,
});
export type ProjectSimple = z.infer<typeof ProjectSimpleSchema>;

/**
 * A single project (`project`) as returned by `GET /projects/{id}.json`. Extends
 * the simple form with the optional `default_assignee` / `default_version`
 * references returned only on the single-project endpoint.
 */
export const ProjectSchema = ProjectSimpleSchema.extend({
  default_assignee: IdNameSchema.optional(),
  default_version: IdNameSchema.optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

/**
 * A project reference accepted by `get_project`: either a numeric id or the
 * project's identifier slug (Redmine resolves both on `/projects/{id}.json`).
 */
export const ProjectRefSchema = z.union([z.number(), z.string()]);
export type ProjectRef = z.infer<typeof ProjectRefSchema>;

/** Filters for `GET /projects.json`. */
export const ListProjectsParamsSchema = z.object({
  status: ProjectStatusSchema.optional(),
  name: z.string().optional(),
  parent_id: z.string().optional(),
  is_public: z.boolean().optional(),
  include: z.array(ProjectIncludeSchema).optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().nonnegative().optional(),
});
export type ListProjectsParams = z.infer<typeof ListProjectsParamsSchema>;
