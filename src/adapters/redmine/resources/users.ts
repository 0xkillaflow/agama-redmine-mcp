/**
 * Users resource client: the `UsersResource` port backed by
 * the Redmine HTTP requester.
 *
 * Only the current-user lookup is exposed today. The requested `include`
 * expansions (e.g. `memberships`, `groups`) are serialized as they are passed;
 * choosing which to request is a tool-layer decision.
 */

import { UserSchema, type CurrentUserInclude, type User } from '../../../domain/models/index.js';
import type { UsersResource } from '../../../domain/ports/index.js';
import type { HttpRequester } from '../http-requester.js';
import { toQuery } from '../request-builder.js';
import { parseEnvelope } from './parse.js';

/** Build the `UsersResource` bound to the given requester. */
export function createUsersResource(http: HttpRequester): UsersResource {
  return {
    async getCurrent(include?: CurrentUserInclude[]): Promise<User> {
      const body = await http.get('/users/current.json', toQuery({ include }));
      return parseEnvelope('user', UserSchema, body, 'get current user');
    },
  };
}
