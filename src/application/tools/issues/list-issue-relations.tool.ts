/**
 * `redmine_list_issue_relations` — read the dependency links around an issue.
 *
 * Two modes over one tool, because they answer the same question at different
 * zoom levels: "what is linked to this issue?" (`issue_id`) and "what is this
 * link?" (`issue_relation_id`). Exactly one is required — a constraint a Zod raw
 * shape cannot express, so the handler re-parses with a `superRefine`, the same
 * pattern `create-time-entry.tool.ts` uses for its issue/project XOR, which keeps
 * the failure a readable input error instead of a generic fault.
 *
 * The single-relation mode exists mainly to look up a relation by its own id —
 * the id `redmine_delete_issue_relation` deletes on, and the only way to confirm
 * a link before removing it.
 */

import { z } from 'zod';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_list_issue_relations`. */
const inputShape = {
  issue_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Issue whose relations should be listed. Returns every relation the issue takes part in, ' +
        'in either direction. Provide exactly one of issue_id or issue_relation_id.',
    ),
  issue_relation_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Numeric id of a single relation (the relation's own id, not an issue id) to read back. " +
        'Provide exactly one of issue_id or issue_relation_id.',
    ),
};

/**
 * Full-object view of the input used for the exactly-one-of check. The SDK
 * validates fields against `inputShape`; this re-parse adds the cross-field XOR
 * that a raw shape cannot express, throwing before the client is called.
 */
const validatedInput = z.object(inputShape).superRefine((value, ctx) => {
  const hasIssue = value.issue_id !== undefined;
  const hasRelation = value.issue_relation_id !== undefined;
  if (hasIssue === hasRelation) {
    ctx.addIssue({
      code: 'custom',
      message: 'Provide exactly one of issue_id or issue_relation_id.',
      path: ['issue_id'],
    });
  }
});

export const listIssueRelationsTool = defineTool({
  name: 'redmine_list_issue_relations',
  title: 'List issue relations',
  description:
    'Read the relations (dependency links) between issues — use it before reporting blockers or ' +
    'sequencing work. Pass exactly one of issue_id (all relations of that issue, returned as ' +
    '{ relations: [...] }) or issue_relation_id (one relation by its own id). Each relation reads ' +
    'as "issue_id <relation_type> issue_to_id": issue_id is the SOURCE and issue_to_id the ' +
    'TARGET. Directions: "blocks" — the source blocks the target, so the target cannot be ' +
    'finished first; "blocked" — the source is blocked by the target; "precedes" — the source ' +
    'must finish before the target starts (with an optional `delay` in days); "follows" — the ' +
    'source starts after the target finishes; "duplicates"/"duplicated", ' +
    '"copied_to"/"copied_from" mirror each other the same way; "relates" is a plain, ' +
    'non-directional link. Redmine stores one record per link and derives the inverse, so an ' +
    'issue is listed as the source of some of its relations and the target of others — never ' +
    'assume issue_id equals the id you queried; compare both ids to work out which way the ' +
    'dependency points. The `id` of a relation is what `redmine_delete_issue_relation` takes.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => {
    const { issue_id, issue_relation_id } = validatedInput.parse(input);
    if (issue_id === undefined) {
      // Single mode: the refinement above guarantees the relation id is present
      // whenever `issue_id` is absent.
      return redmine.issueRelations.get(issue_relation_id as number);
    }
    // List mode: wrapped in an object so clients that consume structured output
    // (which must be a JSON object, never a bare array) still receive it.
    return { relations: await redmine.issueRelations.listForIssue(issue_id) };
  },
});
