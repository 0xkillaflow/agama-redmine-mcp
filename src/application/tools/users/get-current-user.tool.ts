/**
 * `redmine_get_current_user` — identify the API key's user.
 *
 * Read-only tool over {@link RedmineClient.users.getCurrent}. Typically the first
 * call an agent makes in a session to answer "who am I" — driving default-assignee
 * logic and permission-aware suggestions. `include` expands memberships (project +
 * roles) and groups.
 */

import { z } from 'zod';
import { CurrentUserIncludeSchema } from '../../../domain/models/index.js';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_get_current_user`. */
const inputShape = {
  include: z
    .array(CurrentUserIncludeSchema)
    .optional()
    .describe(
      'Associations to expand: "memberships" (the user\'s projects and roles) and/or "groups".',
    ),
};

export const getCurrentUserTool = defineTool({
  name: 'redmine_get_current_user',
  title: 'Get current user',
  description:
    'Identify who the API key belongs to, plus optional memberships and groups — the "who am I" ' +
    'call to make at the start of a session for default-assignee logic and permission-aware ' +
    'suggestions.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.users.getCurrent(input.include),
});
