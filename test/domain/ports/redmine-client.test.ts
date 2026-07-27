import { describe, it, expect } from 'vitest';
import type { RedmineClient } from '../../../src/domain/ports/index.js';

/**
 * Type-level sanity check (architecture §5.1): a trivial fake must satisfy the
 * `RedmineClient` port. Its value is that it *compiles* — the resource method
 * signatures line up with the domain models. A full behavioral
 * `FakeRedmineClient` lives in `test/support/fake-redmine-client.ts`.
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
        delete: async () => undefined,
        addWatcher: async () => undefined,
        removeWatcher: async () => undefined,
      },
      issueRelations: {
        listForIssue: async () => [],
        get: async () => {
          throw new Error('not implemented');
        },
        create: async () => {
          throw new Error('not implemented');
        },
        delete: async () => undefined,
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
        list: async () => ({ items: [], totalCount: 0, offset: 0, limit: 0 }),
      },
      search: {
        search: async () => ({ items: [], totalCount: 0, offset: 0, limit: 0 }),
      },
      referenceData: {
        list: async () => ({ kind: 'statuses', items: [] }),
      },
      attachments: {
        upload: async () => ({ id: 1, token: 'token' }),
        get: async () => {
          throw new Error('not implemented');
        },
        // Bytes, never a path: the port keeps the filesystem out of the gateway.
        download: async () => new Uint8Array(),
      },
    };

    expect(fake.issues).toBeDefined();
    expect(fake.users).toBeDefined();
  });
});
