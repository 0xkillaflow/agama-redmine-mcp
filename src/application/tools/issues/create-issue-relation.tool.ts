/**
 * `redmine_create_issue_relation` — link two issues with a typed relation.
 *
 * The code is one enveloped POST; the descriptions are the real work. Relation
 * direction is trivially inverted by a model reasoning in a hurry, and an
 * inverted `blocks` yields a dependency graph that is confidently wrong — which
 * downstream planning then reads as fact. So every enum value states its meaning
 * from the perspective of `issue_id`, in the same wording
 * `redmine_list_issue_relations` uses on the way back out.
 *
 * The `delay`-only-for-`precedes`/`follows` rule is enforced locally with a
 * `superRefine` (as in `create-time-entry.tool.ts`): it is a fixed property of
 * the model, so a clear message beats a version-dependent server-side outcome.
 * Everything Redmine alone can judge — self-relations, duplicates, circular
 * `precedes` chains, cross-project links — is deliberately left to Redmine, whose
 * own message travels back in a `RedmineValidationError`.
 */

import { z } from 'zod';
import { RelationTypeSchema } from '../../../domain/models/index.js';
import { defineTool } from '../../tool-definition.js';

/** Relation types for which Redmine gives `delay` a meaning. */
const DELAY_TYPES = ['precedes', 'follows'] as const;

/** Agent-facing input shape for `redmine_create_issue_relation`. */
const inputShape = {
  issue_id: z
    .number()
    .int()
    .positive()
    .describe('Numeric id of the SOURCE issue — the one the relation is stated from.'),
  issue_to_id: z
    .number()
    .int()
    .positive()
    .describe('Numeric id of the TARGET issue — the one the relation points at.'),
  relation_type: RelationTypeSchema.describe(
    'How the source relates to the target, read as "issue_id <relation_type> issue_to_id": ' +
      '"relates" — a plain, non-directional link, and the right default when unsure; ' +
      '"blocks" — this issue blocks the target, so the target cannot be finished until this one ' +
      'is; "blocked" — this issue is blocked by the target; ' +
      '"precedes" — this issue must finish before the target starts; ' +
      '"follows" — this issue starts only after the target finishes; ' +
      '"duplicates" — this issue is a duplicate of the target; ' +
      '"duplicated" — the target is a duplicate of this issue; ' +
      '"copied_to" — the target was copied from this issue; ' +
      '"copied_from" — this issue was copied from the target (Redmine normally creates the copy ' +
      'pair itself when an issue is copied).',
  ),
  delay: z
    .number()
    .int()
    .optional()
    .describe(
      'Days between the predecessor finishing and the successor starting. Meaningful ONLY for ' +
        '"precedes" and "follows"; passing it with any other relation type is rejected.',
    ),
};

/**
 * Full-object view of the input used for the cross-field `delay` check. The SDK
 * validates fields against `inputShape`; this re-parse adds the rule a raw shape
 * cannot express, throwing before the client is called.
 */
const validatedInput = z.object(inputShape).superRefine((value, ctx) => {
  const allowsDelay = (DELAY_TYPES as readonly string[]).includes(value.relation_type);
  if (value.delay !== undefined && !allowsDelay) {
    ctx.addIssue({
      code: 'custom',
      message: 'Provide delay only with relation_type "precedes" or "follows".',
      path: ['delay'],
    });
  }
});

export const createIssueRelationTool = defineTool({
  name: 'redmine_create_issue_relation',
  title: 'Create issue relation',
  description:
    'Link two issues with a typed relation — how dependencies are recorded when planning, e.g. ' +
    '"#42 cannot start until #17 ships". The relation is directional and reads as "issue_id ' +
    '<relation_type> issue_to_id", so state it once from the source issue: Redmine stores a ' +
    'single record and presents the inverse automatically on the other issue. Do NOT call this ' +
    'tool again with the ids swapped to "complete the pair" — that is either rejected as a ' +
    'duplicate or creates a second, redundant link. Use "relates" when no ordering is implied. ' +
    '`delay` (in days) applies only to "precedes"/"follows". Redmine rejects some relations on ' +
    'purpose — relating an issue to itself, a duplicate of an existing link, a circular ' +
    '"precedes" chain, or a cross-project link when the "cross_project_issue_relations" setting ' +
    'is off — and its message is passed back verbatim, so read it rather than retrying blindly. ' +
    'Read existing links first with `redmine_list_issue_relations`; undo one with ' +
    '`redmine_delete_issue_relation`.',
  inputSchema: inputShape,
  // `idempotentHint: false`: repeating an identical call is either a 422
  // (duplicate) or a second relation, depending on the Redmine version.
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  handle: async (input, { redmine }) => {
    // The source issue id routes the request (it is a path parameter); the rest
    // is the relation body.
    const { issue_id, ...relation } = validatedInput.parse(input);
    return redmine.issueRelations.create(issue_id, relation);
  },
});
