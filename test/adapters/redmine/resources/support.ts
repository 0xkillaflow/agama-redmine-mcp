import { vi } from 'vitest';
import type { HttpRequester } from '../../../../src/adapters/redmine/http-requester.js';

/** A fully-mocked {@link HttpRequester} with the four verbs as spies. */
export interface MockHttp {
  readonly http: HttpRequester;
  readonly get: ReturnType<typeof vi.fn>;
  readonly post: ReturnType<typeof vi.fn>;
  readonly put: ReturnType<typeof vi.fn>;
  readonly del: ReturnType<typeof vi.fn>;
}

/** Build a mocked requester; each verb resolves `undefined` until configured. */
export function mockHttp(): MockHttp {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const del = vi.fn();
  return { http: { get, post, put, del }, get, post, put, del };
}

/** A minimal, schema-valid `issue.simple` fixture (OpenAPI-derived shape). */
export const issueSimpleFixture = {
  id: 42,
  project: { id: 1, name: 'Website' },
  tracker: { id: 2, name: 'Bug' },
  status: { id: 1, name: 'New', is_closed: false },
  priority: { id: 4, name: 'Normal' },
  author: { id: 7, name: 'Jane Dev' },
  subject: 'Login button misaligned',
  description: 'On mobile the button overflows.',
  start_date: null,
  due_date: null,
  done_ratio: 0,
  is_private: false,
  estimated_hours: null,
  total_estimated_hours: null,
  created_on: '2026-07-01T10:00:00Z',
  updated_on: '2026-07-02T11:00:00Z',
  closed_on: null,
} as const;

/** A `project.simple` fixture. */
export const projectSimpleFixture = {
  id: 1,
  name: 'Website',
  identifier: 'website',
  description: 'The public site.',
  status: 1,
  is_public: true,
  created_on: '2026-01-01T00:00:00Z',
  updated_on: '2026-06-01T00:00:00Z',
} as const;

/** A `time_entry` fixture booked against an issue. */
export const timeEntryFixture = {
  id: 99,
  project: { id: 1, name: 'Website' },
  issue: { id: 42 },
  user: { id: 7, name: 'Jane Dev' },
  activity: { id: 8, name: 'Development' },
  hours: 1.5,
  comments: 'Fixed the alignment.',
  spent_on: '2026-07-02',
  created_on: '2026-07-02T12:00:00Z',
  updated_on: '2026-07-02T12:00:00Z',
} as const;

/** A `user` (current user) fixture. */
export const userFixture = {
  id: 7,
  login: 'jane',
  firstname: 'Jane',
  lastname: 'Dev',
  mail: 'jane@example.com',
  admin: false,
  created_on: '2025-01-01T00:00:00Z',
  last_login_on: '2026-07-15T08:00:00Z',
} as const;

/** A `search` result fixture. */
export const searchResultFixture = {
  id: 42,
  title: 'Bug #42: Login button misaligned',
  type: 'issue',
  url: 'https://redmine.example.com/issues/42',
  description: 'On mobile the button overflows.',
  datetime: '2026-07-02T11:00:00Z',
} as const;

/** Wrap items into Redmine's paginated list envelope. */
export function listEnvelope(
  key: string,
  items: readonly unknown[],
  extra: Record<string, number> = { total_count: items.length, offset: 0, limit: 25 },
): Record<string, unknown> {
  return { [key]: items, ...extra };
}
