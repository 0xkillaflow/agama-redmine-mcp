/**
 * Issues resource client: the `IssuesResource` port
 * backed by the Redmine HTTP requester.
 *
 * Each method builds the path/query (via the request builder), issues the call,
 * and Zod-parses the 2xx body into a domain model. Non-2xx responses are turned
 * into typed domain errors by the requester's injected error mapper — including
 * a `422` create/update surfacing as `RedmineValidationError` — so this layer
 * only handles the success path.
 *
 * Wire mapping: `CreateIssueInput` / `UpdateIssueInput` already use Redmine's
 * snake_case field names, so no renaming is needed — inputs are wrapped verbatim
 * in the `{ issue }` envelope Redmine expects.
 */

import {
  IssueSchema,
  IssueSimpleSchema,
  paginated,
  type Issue,
  type IssueInclude,
  type IssueSimple,
  type CreateIssueInput,
  type ListIssuesParams,
  type Paginated,
  type UpdateIssueInput,
} from '../../../domain/models/index.js';
import type { IssuesResource } from '../../../domain/ports/index.js';
import type { HttpRequester } from '../http-requester.js';
import { textContains, toQuery } from '../request-builder.js';
import { parseBody, parseEnvelope } from './parse.js';

/** Build the `IssuesResource` bound to the given requester. */
export function createIssuesResource(http: HttpRequester): IssuesResource {
  return {
    async list(params: ListIssuesParams): Promise<Paginated<IssueSimple>> {
      // Redmine treats a bare `subject` value as an exact match; normalize it to
      // the `~` (contains) operator so the documented substring behavior holds.
      const normalized =
        params.subject === undefined
          ? params
          : { ...params, subject: textContains(params.subject) };
      const body = await http.get('/issues.json', toQuery(normalized));
      return parseBody(paginated('issues', IssueSimpleSchema), body, 'list issues');
    },

    async get(id: number, include?: IssueInclude[]): Promise<Issue> {
      const body = await http.get(`/issues/${id}.json`, toQuery({ include }));
      return parseEnvelope('issue', IssueSchema, body, 'get issue');
    },

    async create(input: CreateIssueInput): Promise<IssueSimple> {
      const body = await http.post('/issues.json', { issue: input });
      return parseEnvelope('issue', IssueSimpleSchema, body, 'create issue');
    },

    async update(id: number, input: UpdateIssueInput): Promise<void> {
      // Redmine answers a successful update with `204 No Content`; the tool
      // re-fetches the issue when it needs the updated representation.
      await http.put(`/issues/${id}.json`, { issue: input });
    },

    async delete(id: number): Promise<void> {
      // Redmine answers a successful delete with `204 No Content`. A missing
      // issue is a `404` and a permission failure a `403`, both already turned
      // into domain errors by the requester's mapper.
      await http.del(`/issues/${id}.json`);
    },

    async addWatcher(issueId: number, userId: number): Promise<void> {
      // The watcher endpoint takes a *bare* `{ user_id }` — unlike issues or
      // time entries, there is no named envelope here. `204 No Content` on success.
      await http.post(`/issues/${issueId}/watchers.json`, { user_id: userId });
    },

    async removeWatcher(issueId: number, userId: number): Promise<void> {
      // The user id travels in the path, not a body. `204 No Content` on success.
      await http.del(`/issues/${issueId}/watchers/${userId}.json`);
    },
  };
}
