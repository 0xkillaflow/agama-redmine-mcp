import { z } from 'zod';
import { CustomFieldValueSchema, IdNameSchema, type IssueStatusRef } from './common.js';

/**
 * Wire models for Redmine's small, instance-wide reference enumerations —
 * the legal values behind the ids every write tool takes (`status_id`,
 * `tracker_id`, `priority_id`, `activity_id`). Conventions are documented in
 * {@link ./common.ts}.
 *
 * The five endpoints are parameterless, unpaginated GETs returning
 * `{ <key>: [...] }`, so a single `kind`-switched lookup covers them all. Note
 * that a kind does *not* always match its envelope key (`priorities` is served
 * under `issue_priorities`); the mapping lives in the resource client.
 *
 * Issue statuses reuse `IssueStatusRefSchema` from `common.ts` — the same shape
 * issues already embed — rather than a second copy.
 */

/** The reference collections `redmine_list_reference_data` can return. */
export const ReferenceDataKindSchema = z.enum([
  'statuses',
  'trackers',
  'priorities',
  'activities',
  'document_categories',
]);
export type ReferenceDataKind = z.infer<typeof ReferenceDataKindSchema>;

/**
 * An issue tracker (`tracker`). `enabled_standard_fields` is Redmine 5.0+ and
 * `default_status` is absent on trackers that have no default, so both stay
 * optional.
 */
export const TrackerSchema = z.object({
  id: z.number(),
  name: z.string(),
  default_status: IdNameSchema.optional(),
  description: z.string().nullable().optional(),
  enabled_standard_fields: z.array(z.string()).optional(),
});
export type Tracker = z.infer<typeof TrackerSchema>;

/**
 * A Redmine enumeration entry — one shape shared by issue priorities, time-entry
 * activities, and document categories, which are structurally identical.
 * `is_default` marks the value Redmine preselects; `active` marks whether it may
 * still be chosen.
 */
export const EnumerationSchema = z.object({
  id: z.number(),
  name: z.string(),
  is_default: z.boolean(),
  active: z.boolean(),
  custom_fields: z.array(CustomFieldValueSchema).optional(),
});
export type Enumeration = z.infer<typeof EnumerationSchema>;

/** The item type each {@link ReferenceDataKind} yields. */
interface ReferenceItemByKind {
  statuses: IssueStatusRef;
  trackers: Tracker;
  priorities: Enumeration;
  activities: Enumeration;
  document_categories: Enumeration;
}

/**
 * One reference collection, discriminated by the `kind` that produced it — so a
 * caller narrowing on `kind` gets the precise item type instead of a union.
 * Deliberately *not* a {@link Paginated} page: these endpoints return no
 * `total_count`/`offset`/`limit`, and inventing them would misdescribe the wire
 * shape.
 */
export type ReferenceData = {
  [Kind in ReferenceDataKind]: {
    readonly kind: Kind;
    readonly items: readonly ReferenceItemByKind[Kind][];
  };
}[ReferenceDataKind];
