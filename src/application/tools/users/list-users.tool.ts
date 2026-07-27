/**
 * `redmine_list_users` — resolve a person to a numeric user id.
 *
 * Read-only tool over {@link RedmineClient.users.list}. Every write tool takes
 * ids (`assigned_to_id`, `author_id`, `watcher_user_ids`), so this is the lookup
 * that turns "assign it to Sarah" into a number an agent can actually send.
 */

import { z } from 'zod';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_list_users`. */
const inputShape = {
  status: z
    .number()
    .int()
    .optional()
    .describe('Account status: 1 active, 2 registered, 3 locked. Defaults to active users only.'),
  name: z
    .string()
    .optional()
    .describe(
      'Filter by login, first name, last name, or email (substring match, case-insensitive).',
    ),
  group_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Only users belonging to this group id.'),
  offset: z.number().int().nonnegative().optional().describe('Pagination offset (skip N users).'),
  limit: z.number().int().nonnegative().optional().describe('Maximum number of users to return.'),
};

export const listUsersTool = defineTool({
  name: 'redmine_list_users',
  title: 'List users',
  description:
    "Find Redmine users by name, status, or group — the way to turn a person's name into the " +
    'numeric id that `assigned_to_id`, `author_id`, and `watcher_user_ids` require. Note that ' +
    'listing users requires admin permission on most Redmine instances; a non-admin API key gets ' +
    'a permission error, in which case ask the human for the id or use ' +
    '`redmine_get_current_user` for your own.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.users.list(input),
});
