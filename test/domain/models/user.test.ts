import { describe, it, expect } from 'vitest';
import { UserSchema } from '../../../src/domain/models/user.js';

const currentUser = {
  id: 3,
  login: 'jdoe',
  admin: false,
  firstname: 'Jane',
  lastname: 'Doe',
  mail: 'jane@example.com',
  created_on: '2024-01-01T10:00:00Z',
  last_login_on: '2024-06-01T08:00:00Z',
};

describe('UserSchema', () => {
  it('parses a current user without includes', () => {
    expect(UserSchema.parse(currentUser)).toEqual(currentUser);
  });

  it('parses a current user with memberships and groups', () => {
    const withIncludes = {
      ...currentUser,
      memberships: [
        {
          project: { id: 1, name: 'Website' },
          roles: [{ id: 4, name: 'Developer' }],
        },
      ],
      groups: [{ id: 8, name: 'Engineering' }],
    };
    const parsed = UserSchema.parse(withIncludes);
    expect(parsed.memberships?.[0]?.roles[0]?.name).toBe('Developer');
    expect(parsed.groups?.[0]).toEqual({ id: 8, name: 'Engineering' });
  });

  it('parses a user whose permission-gated fields are absent', () => {
    const parsed = UserSchema.parse({ id: 3, login: 'jdoe' });
    expect(parsed.mail).toBeUndefined();
    expect(parsed.admin).toBeUndefined();
  });

  it('accepts a null last_login_on', () => {
    expect(UserSchema.parse({ ...currentUser, last_login_on: null }).last_login_on).toBeNull();
  });

  it('rejects a user without an id', () => {
    const { id, ...invalid } = currentUser;
    void id;
    expect(UserSchema.safeParse(invalid).success).toBe(false);
  });
});
