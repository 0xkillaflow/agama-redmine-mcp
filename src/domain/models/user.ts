import { z } from 'zod';
import { IdNameSchema } from './common.js';

/**
 * Wire models for Redmine users (schemas + inferred types). Conventions are
 * documented in {@link ./common.ts}.
 *
 * The current user's `admin` / `mail` visibility depends on Redmine
 * permissions, so those fields are kept optional.
 */

/** The set of `include` expansions Redmine understands for the current user. */
export const CurrentUserIncludeSchema = z.enum(['memberships', 'groups']);
export type CurrentUserInclude = z.infer<typeof CurrentUserIncludeSchema>;

/** One of the current user's project memberships (returned under `include=memberships`). */
const MembershipSchema = z.object({
  project: IdNameSchema,
  roles: z.array(IdNameSchema),
});

/**
 * The current user (`GET /users/current.json`). Identity fields are optional
 * because Redmine may withhold them depending on the caller's permissions;
 * `memberships` and `groups` are present only when requested via `include`.
 */
export const UserSchema = z.object({
  id: z.number(),
  login: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  mail: z.string().optional(),
  admin: z.boolean().optional(),
  created_on: z.string().optional(),
  last_login_on: z.string().nullable().optional(),
  memberships: z.array(MembershipSchema).optional(),
  groups: z.array(IdNameSchema).optional(),
});
export type User = z.infer<typeof UserSchema>;

/**
 * A list result item (`user.simple`, `GET /users.json`). Identity fields stay
 * optional for the same permission reason as {@link UserSchema}: Redmine hides
 * `mail`/`admin` from non-admin callers, and newer versions add fields
 * (`updated_on`, `passwd_changed_on`, `twofa_scheme`) we deliberately leave
 * unmodelled rather than require.
 */
export const UserSimpleSchema = z.object({
  id: z.number(),
  login: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  mail: z.string().optional(),
  admin: z.boolean().optional(),
  created_on: z.string().optional(),
  last_login_on: z.string().nullable().optional(),
});
export type UserSimple = z.infer<typeof UserSimpleSchema>;

/**
 * Filters for `GET /users.json`.
 *
 * `status` is Redmine's account-state code (`1` active, `2` registered,
 * `3` locked); omitting it returns active users only. `name` is a plain
 * substring matched by Redmine across login, first/last name, and mail — it is
 * *not* an issue-filter expression, so it carries no operator prefix.
 */
export interface ListUsersParams {
  readonly status?: number | undefined;
  readonly name?: string | undefined;
  readonly group_id?: number | undefined;
  readonly offset?: number | undefined;
  readonly limit?: number | undefined;
}
