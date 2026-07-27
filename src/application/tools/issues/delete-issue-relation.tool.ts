/**
 * `redmine_delete_issue_relation` — remove a link between two issues.
 *
 * Keyed on the relation's own id, because that is the only key Redmine offers:
 * there is no "delete the link between #17 and #42" endpoint. A convenience mode
 * taking a pair of issue ids is deliberately absent — with several links between
 * the same two issues it would have to guess which one was meant, and a guessing
 * delete is exactly the shape of tool that erases the wrong thing.
 *
 * `destructiveHint: true` keeps the annotation honest (a record is removed), while
 * the description carries the nuance a boolean cannot: the blast radius is two
 * integers and one call to `redmine_create_issue_relation` puts it back.
 */

import { z } from 'zod';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_delete_issue_relation`. */
const inputShape = {
  issue_relation_id: z
    .number()
    .int()
    .positive()
    .describe(
      'Numeric id of the RELATION to delete — the `id` field of a relation, NOT an issue id. ' +
        'Get it from `redmine_list_issue_relations` (call it with the issue_id first and pick the ' +
        'relation you mean). Passing an issue id here usually deletes a real but unrelated link ' +
        'rather than failing, so never guess this value.',
    ),
};

export const deleteIssueRelationTool = defineTool({
  name: 'redmine_delete_issue_relation',
  title: 'Delete issue relation',
  description:
    'Remove a relation (dependency link) between two issues — the cleanup path for a wrong link, ' +
    'e.g. a false "duplicates" or an inverted "blocks". Takes the RELATION id, not an issue id: ' +
    'call `redmine_list_issue_relations` with the issue_id first to find the relation and its ' +
    '`id`. Deleting removes the link in both directions at once (Redmine stores one record and ' +
    'derives the inverse), so there is no second side to clean up. Nothing but the link is ' +
    'touched — both issues, their history, and their other relations are untouched — and the ' +
    'link is restored by a single `redmine_create_issue_relation` call, so this is far less ' +
    'consequential than deleting an issue. A repeated call fails with a not-found error rather ' +
    'than succeeding quietly.',
  inputSchema: inputShape,
  // Destructive because a record is removed, but reversible in one call; the
  // description carries that nuance. `idempotentHint: false`: a second delete on
  // the same id is a 404, not a safe retry.
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  },
  handle: async (input, { redmine }) => {
    await redmine.issueRelations.delete(input.issue_relation_id);
    // `204 No Content` on success — return a concrete confirmation so the agent
    // has something to report rather than an empty result.
    return { deleted: true, issue_relation_id: input.issue_relation_id };
  },
});
