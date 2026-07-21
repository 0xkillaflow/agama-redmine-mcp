/**
 * `redmine_search` — cross-entity free-text search.
 *
 * Read-only tool over {@link RedmineClient.search}. The best first move for vague
 * natural-language requests ("find that ticket about the login bug") where the
 * user knows neither the issue id nor the project — prefer this over
 * `redmine_list_issues`, which needs concrete filter values. The boolean flags
 * scope the search to entity types; the request builder converts them to
 * Redmine's `1`/absent wire form.
 */

import { z } from 'zod';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_search`. */
const inputShape = {
  q: z.string().min(1).describe('Free-text query, e.g. "login button bug" (required).'),
  scope: z
    .enum(['all', 'my_project', 'subprojects'])
    .optional()
    .describe('Search scope: "all", "my_project", or "subprojects".'),
  issues: z.boolean().optional().describe('Include issues in the results.'),
  news: z.boolean().optional().describe('Include news in the results.'),
  wiki_pages: z.boolean().optional().describe('Include wiki pages in the results.'),
  projects: z.boolean().optional().describe('Include projects in the results.'),
  open_issues: z.boolean().optional().describe('Restrict issue matches to open issues only.'),
  all_words: z.boolean().optional().describe('Require all query words to match (AND vs OR).'),
  titles_only: z.boolean().optional().describe('Match only titles, not body text.'),
  offset: z.number().int().nonnegative().optional().describe('Pagination offset (skip N results).'),
  limit: z.number().int().nonnegative().optional().describe('Maximum number of results to return.'),
};

export const searchTool = defineTool({
  name: 'redmine_search',
  title: 'Search',
  description:
    'Free-text search across issues, wiki pages, news, and projects in one call. Best first move ' +
    'for vague requests where the issue id or project is unknown; prefer redmine_list_issues when ' +
    'you already have concrete filter values.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.search.search(input),
});
