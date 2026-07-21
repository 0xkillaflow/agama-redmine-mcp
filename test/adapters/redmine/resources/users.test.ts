import { describe, it, expect } from 'vitest';
import { createUsersResource } from '../../../../src/adapters/redmine/resources/users.js';
import { RedmineTransportError } from '../../../../src/domain/errors/index.js';
import { mockHttp, userFixture } from './support.js';

describe('createUsersResource', () => {
  it('getCurrent hits GET /users/current.json with the requested include and unwraps the user', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ user: userFixture });
    const users = createUsersResource(http);

    const user = await users.getCurrent(['memberships', 'groups']);

    expect(get).toHaveBeenCalledWith('/users/current.json', 'include=memberships%2Cgroups');
    expect(user.id).toBe(7);
  });

  it('getCurrent without include sends no query string', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ user: userFixture });
    const users = createUsersResource(http);

    await users.getCurrent();

    expect(get).toHaveBeenCalledWith('/users/current.json', '');
  });

  it('turns a schema-mismatched body into a transport error', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ user: { id: 'nope' } });
    const users = createUsersResource(http);

    await expect(users.getCurrent()).rejects.toBeInstanceOf(RedmineTransportError);
  });
});
