import { z } from 'zod';

/**
 * Wire models for Redmine issue relations (schemas + inferred types).
 *
 * A relation is a directed link between two issues: `issue_id` is the **source**
 * and `issue_to_id` the **target**, read as "source <relation_type> target"
 * (`blocks`, `precedes`, …). Redmine stores one record per link and derives the
 * inverse, so a relation listed under an issue may well name it as the *target*.
 *
 * Naming / optionality conventions are documented in {@link ./common.ts}.
 */

/**
 * The relation types Redmine documents. Used on the **write** side only: sending
 * a typo'd type should fail here with a clear message instead of as a remote
 * `422`. The read side stays deliberately tolerant (see
 * {@link IssueRelationSchema}).
 */
export const RelationTypeSchema = z.enum([
  'relates',
  'duplicates',
  'duplicated',
  'blocks',
  'blocked',
  'precedes',
  'follows',
  'copied_to',
  'copied_from',
]);
export type RelationType = z.infer<typeof RelationTypeSchema>;

/**
 * A relation as returned by Redmine (`relation`), also embedded in an issue under
 * `include=relations`.
 *
 * `relation_type` is a plain string rather than {@link RelationTypeSchema}: a
 * plugin can introduce a type this enum does not know, and rejecting it here
 * would break reading the *issue* that carries it. `delay` is the number of days
 * between the two issues and is only meaningful for `precedes`/`follows`; it is
 * `null` for every other type.
 */
export const IssueRelationSchema = z.object({
  id: z.number(),
  issue_id: z.number(),
  issue_to_id: z.number(),
  relation_type: z.string(),
  delay: z.number().nullable(),
});
export type IssueRelation = z.infer<typeof IssueRelationSchema>;

/**
 * Body for `POST /issues/{issue_id}/relations.json`. The source issue id travels
 * in the path, so it is not part of the body.
 */
export const CreateIssueRelationInputSchema = z.object({
  issue_to_id: z.number().int().positive(),
  relation_type: RelationTypeSchema,
  delay: z.number().int().nullable().optional(),
});
export type CreateIssueRelationInput = z.infer<typeof CreateIssueRelationInputSchema>;
