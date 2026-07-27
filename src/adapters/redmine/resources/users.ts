/**
 * Users resource client: the `UsersResource` port backed by
 * the Redmine HTTP requester.
 *
 * `getCurrent` answers "who am I"; `list` is the name → id lookup the write
 * tools need for `assigned_to_id`. The requested `include` expansions (e.g.
 * `memberships`, `groups`) are serialized as they are passed; choosing which to
 * request is a tool-layer decision.
 */

import {
  UserSchema,
  UserSimpleSchema,
  paginated,
  type CurrentUserInclude,
  type ListUsersParams,
  type Paginated,
  type User,
  type UserSimple,
} from '../../../domain/models/index.js';
import type { UsersResource } from '../../../domain/ports/index.js';
import type { HttpRequester } from '../http-requester.js';
import { toQuery } from '../request-builder.js';
import { parseBody, parseEnvelope } from './parse.js';

/** Build the `UsersResource` bound to the given requester. */
export function createUsersResource(http: HttpRequester): UsersResource {
  return {
    async getCurrent(include?: CurrentUserInclude[]): Promise<User> {
      const body = await http.get('/users/current.json', toQuery({ include }));
      return parseEnvelope('user', UserSchema, body, 'get current user');
    },

    async list(params: ListUsersParams): Promise<Paginated<UserSimple>> {
      // Fields are listed explicitly (rather than spreading `params`) because
      // `ListUsersParams` is an interface and so lacks the implicit index
      // signature `toQuery` expects. `name` is passed through verbatim: Redmine's
      // `/users.json?name=` is already a substring match across login, first/last
      // name, and mail — it does not use the issue-filter grammar, so the `~`
      // prefix `textContains` adds would be searched for literally.
      const query = toQuery({
        status: params.status,
        name: params.name,
        group_id: params.group_id,
        offset: params.offset,
        limit: params.limit,
      });
      const body = await http.get('/users.json', query);
      return parseBody(paginated('users', UserSimpleSchema), body, 'list users');
    },
  };
}
