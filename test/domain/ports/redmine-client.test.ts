import { describe, it, expect } from 'vitest';
import type { RedmineClient } from '../../../src/domain/ports/index.js';

/**
 * Type-level sanity check (architecture §5.1): a trivial fake must satisfy the
 * `RedmineClient` port. Its value is that it *compiles* — the resource method
 * signatures line up with the task 06–09 domain models. A full behavioral
 * `FakeRedmineClient` is built in the testing-harness task.
 */
describe('RedmineClient port', () => {
  it('accepts a structurally valid fake implementation', () => {
    const fake: RedmineClient = {
      issues: {
        list: async () => ({ items: [], totalCount: 0, offset: 0, limit: 0 }),
        get: async () => {
          throw new Error('not implemented');
        },
        create: async () => {
          throw new Error('not implemented');
        },
        update: async () => undefined,
      },
      projects: {
        list: async () => ({ items: [], totalCount: 0, offset: 0, limit: 0 }),
        get: async () => {
          throw new Error('not implemented');
        },
      },
      timeEntries: {
        list: async () => ({ items: [], totalCount: 0, offset: 0, limit: 0 }),
        create: async () => {
          throw new Error('not implemented');
        },
      },
      users: {
        getCurrent: async () => ({ id: 1 }),
      },
      search: {
        search: async () => ({ items: [], totalCount: 0, offset: 0, limit: 0 }),
      },
    };

    expect(fake.issues).toBeDefined();
    expect(fake.users).toBeDefined();
  });
});
