/**
 * `redmine_delete_issue` — permanently remove an issue.
 *
 * Deliberately its own tool rather than a branch of `redmine_update_issue`: MCP
 * annotations are per-tool, so a separate entry is the only way a client can tell
 * "this call may destroy data" apart from "this call edits a field". Folding the
 * delete into the update tool would force `destructiveHint: true` onto every
 * ordinary edit and drain the signal of meaning.
 *
 * The code here is trivial — the description is the real artefact. It is the one
 * thing standing between an agent and an unrecoverable action, so it states the
 * blast radius plainly and points at the reversible alternative.
 */

import { z } from 'zod';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_delete_issue`. */
const inputShape = {
  issue_id: z
    .number()
    .int()
    .positive()
    .describe(
      'Numeric id of the issue to delete permanently. Deletion is irreversible and cascades: the ' +
        "issue's journals (comments), logged time entries, attachments, and relations go with it, " +
        'and sub-issues may be deleted along with their parent. Confirm the id — and the intent — ' +
        'with the user before calling.',
    ),
};

export const deleteIssueTool = defineTool({
  name: 'redmine_delete_issue',
  title: 'Delete issue',
  description:
    'Permanently delete an issue. THIS CANNOT BE UNDONE: Redmine has no trash and no restore, and ' +
    "the delete cascades — the issue's journals (comments), logged time entries, attachments, and " +
    'relations are destroyed with it, and on many configurations its sub-issues are deleted too. ' +
    'Always confirm with the user before calling, quoting the issue id and subject (use ' +
    '`redmine_get_issue` to read them back first). In most situations the right tool is ' +
    '`redmine_update_issue` instead: setting a closed or rejected `status_id` takes the issue out ' +
    'of the way while keeping its history and staying reversible. Reserve this tool for genuine ' +
    'mistakes — duplicates, spam, or an issue filed in the wrong place. Requires the "Delete ' +
    'issues" permission; without it Redmine answers with a permission error.',
  inputSchema: inputShape,
  // `idempotentHint: false` is deliberate and the counter-intuitive part: a second
  // call against the same id does not quietly succeed, it fails with a not-found
  // error, so a client must not treat a repeat as a safe retry.
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  },
  handle: async (input, { redmine }) => {
    await redmine.issues.delete(input.issue_id);
    // `204 No Content` on success — return a concrete confirmation so the agent
    // has something to report rather than an empty result.
    return { deleted: true, issue_id: input.issue_id };
  },
});
