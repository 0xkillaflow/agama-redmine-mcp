/**
 * Issue-relations resource client: the `IssueRelationsResource` port backed by
 * the Redmine HTTP requester.
 *
 * Two path families and two envelope keys, which is the whole subtlety here:
 * listing and creating are issue-scoped (`/issues/{id}/relations.json`) and use
 * the plural **`relations`** / singular **`relation`** keys respectively, while
 * reading and deleting one relation go through the top-level
 * `/relations/{id}.json` under the singular **`relation`** key.
 *
 * The list response carries no `total_count`/`offset`/`limit`, so it is parsed as
 * a plain array — wrapping it in a synthetic page would misreport the wire shape.
 */

import { z } from 'zod';
import {
  IssueRelationSchema,
  type CreateIssueRelationInput,
  type IssueRelation,
} from '../../../domain/models/index.js';
import type { IssueRelationsResource } from '../../../domain/ports/index.js';
import type { HttpRequester } from '../http-requester.js';
import { parseEnvelope } from './parse.js';

/** Build the `IssueRelationsResource` bound to the given requester. */
export function createIssueRelationsResource(http: HttpRequester): IssueRelationsResource {
  return {
    async listForIssue(issueId: number): Promise<readonly IssueRelation[]> {
      const body = await http.get(`/issues/${issueId}/relations.json`);
      return parseEnvelope('relations', z.array(IssueRelationSchema), body, 'list issue relations');
    },

    async get(relationId: number): Promise<IssueRelation> {
      const body = await http.get(`/relations/${relationId}.json`);
      return parseEnvelope('relation', IssueRelationSchema, body, 'get issue relation');
    },

    async create(issueId: number, input: CreateIssueRelationInput): Promise<IssueRelation> {
      // Unlike the watcher endpoint, both the request body and the `201`
      // response are wrapped in a named `{ relation }` envelope.
      const body = await http.post(`/issues/${issueId}/relations.json`, { relation: input });
      return parseEnvelope('relation', IssueRelationSchema, body, 'create issue relation');
    },

    async delete(relationId: number): Promise<void> {
      // The top-level path, not the issue-scoped one: `/issues/{id}/relations`
      // exists only for list and create. `204 No Content` on success.
      await http.del(`/relations/${relationId}.json`);
    },
  };
}
