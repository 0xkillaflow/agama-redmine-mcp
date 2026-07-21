/**
 * Search resource client: the `SearchResource` port backed
 * by the Redmine HTTP requester.
 *
 * The many boolean flags on `SearchParams` (`issues`, `open_issues`, …) are
 * converted to Redmine's `1`/omitted wire form by the request builder; the free
 * `q` term and the enum options pass through as scalars.
 */

import {
  SearchResultSchema,
  paginated,
  type Paginated,
  type SearchParams,
  type SearchResult,
} from '../../../domain/models/index.js';
import type { SearchResource } from '../../../domain/ports/index.js';
import type { HttpRequester } from '../http-requester.js';
import { toQuery } from '../request-builder.js';
import { parseBody } from './parse.js';

/** Build the `SearchResource` bound to the given requester. */
export function createSearchResource(http: HttpRequester): SearchResource {
  return {
    async search(params: SearchParams): Promise<Paginated<SearchResult>> {
      const body = await http.get('/search.json', toQuery(params));
      return parseBody(paginated('results', SearchResultSchema), body, 'search');
    },
  };
}
