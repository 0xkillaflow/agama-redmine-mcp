/**
 * A hand-written {@link RedmineClient} fake for fast, isolated unit tests.
 *
 * Every resource method is a {@link RecordingFn}: it records each call's
 * arguments (`fake.issues.list.calls[0]`) and returns a schema-valid fixture by
 * default, so a handler under test sees realistic data with no HTTP and no SDK.
 * Responses and errors are programmable per method (`fake.issues.get.reject(err)`,
 * `fake.projects.get.resolve(project)`), which keeps assertions ergonomic.
 *
 * This is deliberately not `vi.fn`-based: the recording is explicit and typed to
 * the port, so the fake stays a faithful stand-in for the real client.
 */

import type {
  CreateIssueInput,
  CreateTimeEntryInput,
  CurrentUserInclude,
  Issue,
  IssueInclude,
  IssueSimple,
  ListIssuesParams,
  ListProjectsParams,
  ListTimeEntriesParams,
  Paginated,
  Project,
  ProjectInclude,
  ProjectRef,
  ProjectSimple,
  SearchParams,
  SearchResult,
  TimeEntry,
  UpdateIssueInput,
  User,
} from '../../src/domain/models/index.js';
import type { RedmineClient } from '../../src/domain/ports/index.js';
import {
  issueFixture,
  issueSimpleFixture,
  projectFixture,
  projectSimpleFixture,
  searchResultsPage,
  timeEntryFixture,
  userFixture,
} from './fixtures/index.js';

/**
 * A recording stand-in for one async method. Callable like the real method, it
 * appends each call's arguments to {@link RecordingFn.calls} and delegates to the
 * currently-programmed behaviour (a fixture by default).
 */
export interface RecordingFn<Args extends readonly unknown[], Result> {
  (...args: Args): Promise<Result>;
  /** Arguments of every call, in order. `calls[0]` is the first call's tuple. */
  readonly calls: Args[];
  /** Make all subsequent calls resolve with `value`. */
  resolve(value: Result): void;
  /** Make all subsequent calls reject with `error`. */
  reject(error: unknown): void;
  /** Replace the behaviour with a custom implementation. */
  implement(fn: (...args: Args) => Result | Promise<Result>): void;
  /** Clear recorded calls and restore the default (fixture) behaviour. */
  reset(): void;
}

/** Build a {@link RecordingFn} with the given default behaviour. */
function recording<Args extends readonly unknown[], Result>(
  defaultImpl: (...args: Args) => Result | Promise<Result>,
): RecordingFn<Args, Result> {
  let impl = defaultImpl;
  const calls: Args[] = [];

  const fn = ((...args: Args): Promise<Result> => {
    calls.push(args);
    return Promise.resolve(impl(...args));
  }) as RecordingFn<Args, Result>;

  Object.assign(fn, {
    calls,
    resolve(value: Result): void {
      impl = () => value;
    },
    reject(error: unknown): void {
      impl = () => {
        throw error;
      };
    },
    implement(next: (...args: Args) => Result | Promise<Result>): void {
      impl = next;
    },
    reset(): void {
      calls.length = 0;
      impl = defaultImpl;
    },
  });

  return fn;
}

/** Wrap items into a normalized {@link Paginated} page (defaults mirror Redmine's). */
function page<T>(items: readonly T[]): Paginated<T> {
  return { items, totalCount: items.length, offset: 0, limit: 25 };
}

/**
 * The {@link RedmineClient} port with each method exposed as a {@link RecordingFn}
 * so tests can both program behaviour and assert on recorded calls.
 */
export interface FakeRedmineClient extends RedmineClient {
  readonly issues: {
    list: RecordingFn<[ListIssuesParams], Paginated<IssueSimple>>;
    get: RecordingFn<[number, IssueInclude[]?], Issue>;
    create: RecordingFn<[CreateIssueInput], IssueSimple>;
    update: RecordingFn<[number, UpdateIssueInput], void>;
  };
  readonly projects: {
    list: RecordingFn<[ListProjectsParams], Paginated<ProjectSimple>>;
    get: RecordingFn<[ProjectRef, ProjectInclude[]?], Project>;
  };
  readonly timeEntries: {
    list: RecordingFn<[ListTimeEntriesParams], Paginated<TimeEntry>>;
    create: RecordingFn<[CreateTimeEntryInput], TimeEntry>;
  };
  readonly users: {
    getCurrent: RecordingFn<[CurrentUserInclude[]?], User>;
  };
  readonly search: {
    search: RecordingFn<[SearchParams], Paginated<SearchResult>>;
  };
}

/**
 * Build a fresh {@link FakeRedmineClient}. Every method resolves a schema-valid
 * fixture by default; tests override individual methods as needed.
 */
export function fakeRedmineClient(): FakeRedmineClient {
  // Explicit type arguments: the default impls ignore their inputs, so inference
  // alone would collapse each `Args` tuple to `[]` and break assignability to the
  // port's method signatures.
  return {
    issues: {
      list: recording<[ListIssuesParams], Paginated<IssueSimple>>(() => page([issueSimpleFixture])),
      get: recording<[number, IssueInclude[]?], Issue>(() => issueFixture),
      create: recording<[CreateIssueInput], IssueSimple>(() => issueSimpleFixture),
      update: recording<[number, UpdateIssueInput], void>(() => undefined),
    },
    projects: {
      list: recording<[ListProjectsParams], Paginated<ProjectSimple>>(() =>
        page([projectSimpleFixture]),
      ),
      get: recording<[ProjectRef, ProjectInclude[]?], Project>(() => projectFixture),
    },
    timeEntries: {
      list: recording<[ListTimeEntriesParams], Paginated<TimeEntry>>(() =>
        page([timeEntryFixture]),
      ),
      create: recording<[CreateTimeEntryInput], TimeEntry>(() => timeEntryFixture),
    },
    users: {
      getCurrent: recording<[CurrentUserInclude[]?], User>(() => userFixture),
    },
    search: {
      search: recording<[SearchParams], Paginated<SearchResult>>(() => searchResultsPage),
    },
  };
}
