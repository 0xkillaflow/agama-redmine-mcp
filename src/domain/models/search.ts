import { z } from 'zod';

/**
 * Wire models for Redmine's cross-entity search (schemas + inferred types).
 * A search response is a `Paginated<SearchResult>` under the resource key
 * `results` (built with `paginated('results', SearchResultSchema)`).
 * Conventions are documented in {@link ./common.ts}.
 */

/** A single search hit (`search`). `type` names the matched entity (issue, wiki-page, …). */
export const SearchResultSchema = z.object({
  id: z.number(),
  title: z.string(),
  type: z.string(),
  url: z.string(),
  description: z.string(),
  datetime: z.string(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Parameters for `GET /search.json`. `q` is required. The boolean flags are
 * modeled as booleans here and converted to Redmine's `1`/absent wire form by
 * the request builder. `attachments` selects how attachment content is matched.
 */
export const SearchParamsSchema = z.object({
  q: z.string(),
  scope: z.enum(['all', 'my_project', 'subprojects']).optional(),
  issues: z.boolean().optional(),
  news: z.boolean().optional(),
  wiki_pages: z.boolean().optional(),
  projects: z.boolean().optional(),
  documents: z.boolean().optional(),
  changesets: z.boolean().optional(),
  messages: z.boolean().optional(),
  open_issues: z.boolean().optional(),
  all_words: z.boolean().optional(),
  titles_only: z.boolean().optional(),
  attachments: z.enum(['0', '1', 'only']).optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().nonnegative().optional(),
});
export type SearchParams = z.infer<typeof SearchParamsSchema>;
