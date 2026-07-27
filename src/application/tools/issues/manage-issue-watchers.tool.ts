/**
 * `redmine_manage_issue_watchers` — subscribe or unsubscribe a user from an
 * issue's notifications.
 *
 * Redmine expresses this as two endpoints with different shapes (`POST
 * /issues/{id}/watchers.json` with a body, `DELETE
 * /issues/{id}/watchers/{user_id}.json` with the id in the path), but for an
 * agent it is one intent — "change who is watching this" — so a single tool with
 * an `action` enum keeps the catalog intent-shaped instead of spending two
 * low-frequency entries on one decision. The port keeps both methods, so the
 * branch is one `if` in the handler.
 *
 * Watchers can also be set through `watcher_user_ids` on create/update, but only
 * at that moment and only with the right permission; this is the supported way to
 * change them afterwards.
 */

import { z } from 'zod';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_manage_issue_watchers`. */
const inputShape = {
  issue_id: z
    .number()
    .int()
    .positive()
    .describe('Numeric id of the issue whose watcher list is being changed (required).'),
  user_id: z
    .number()
    .int()
    .positive()
    .describe(
      'Numeric id of the user to add or remove. Resolve a name to an id with ' +
        '`redmine_list_users`; for "me"/"myself" use `redmine_get_current_user`. Group ids are ' +
        'not accepted on most Redmine versions — pass a user.',
    ),
  action: z
    .enum(['add', 'remove'])
    .describe(
      '"add" — start notifying this user about the issue; "remove" — stop notifying them. ' +
        'Removing only ends the subscription; it changes nothing else on the issue and is undone ' +
        'by calling again with "add".',
    ),
};

export const manageIssueWatchersTool = defineTool({
  name: 'redmine_manage_issue_watchers',
  title: 'Manage issue watchers',
  description:
    'Add or remove a watcher on an existing issue — the notification subscription, e.g. "watch ' +
    'this bug for me" or "stop notifying John about #42". Pass the issue id, the user id, and ' +
    '`action` ("add" or "remove"). Get the user id from `redmine_list_users` (by name) or ' +
    '`redmine_get_current_user` (for yourself); read the current watchers with `redmine_get_issue` ' +
    'and `include: ["watchers"]`. Nothing is destroyed: removing a watcher only stops ' +
    'notifications and is reversed by adding them back. NOTE: managing watchers needs the ' +
    'separate "Manage watchers" Redmine permission, which an otherwise-capable API key often ' +
    'lacks — a permission error here means exactly that and does not mean the issue or user is ' +
    'missing, so do not retry with different ids.',
  inputSchema: inputShape,
  // A write, but nothing is lost: a removed watcher is re-added by one call.
  // `idempotentHint: true` because Redmine tolerates adding an existing watcher
  // and removing an absent one, answering `204` either way.
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handle: async (input, { redmine }) => {
    const { issue_id, user_id, action } = input;
    if (action === 'add') {
      await redmine.issues.addWatcher(issue_id, user_id);
    } else {
      await redmine.issues.removeWatcher(issue_id, user_id);
    }
    // `204 No Content` on success — echo what was done so the agent can report it.
    return { issue_id, user_id, action, ok: true };
  },
});
