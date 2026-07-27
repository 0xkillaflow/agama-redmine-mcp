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
  AttachmentRef,
  CreateIssueInput,
  CreateIssueRelationInput,
  CreateTimeEntryInput,
  CurrentUserInclude,
  Issue,
  IssueInclude,
  IssueRelation,
  IssueSimple,
  ListIssuesParams,
  ListProjectsParams,
  ListTimeEntriesParams,
  ListUsersParams,
  Paginated,
  Project,
  ProjectInclude,
  ProjectRef,
  ProjectSimple,
  ReferenceData,
  ReferenceDataKind,
  SearchParams,
  SearchResult,
  TimeEntry,
  UpdateIssueInput,
  UploadFileInput,
  UploadResult,
  User,
  UserSimple,
} from '../../src/domain/models/index.js';
import type { RedmineClient } from '../../src/domain/ports/index.js';
import {
  attachmentFixture,
  issueFixture,
  issueRelationFixture,
  issueSimpleFixture,
  projectFixture,
  projectSimpleFixture,
  referenceStatusesFixture,
  searchResultsPage,
  timeEntryFixture,
  userFixture,
  userSimpleFixture,
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
    delete: RecordingFn<[number], void>;
    addWatcher: RecordingFn<[number, number], void>;
    removeWatcher: RecordingFn<[number, number], void>;
  };
  readonly issueRelations: {
    listForIssue: RecordingFn<[number], readonly IssueRelation[]>;
    get: RecordingFn<[number], IssueRelation>;
    create: RecordingFn<[number, CreateIssueRelationInput], IssueRelation>;
    delete: RecordingFn<[number], void>;
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
    list: RecordingFn<[ListUsersParams], Paginated<UserSimple>>;
  };
  readonly search: {
    search: RecordingFn<[SearchParams], Paginated<SearchResult>>;
  };
  readonly referenceData: {
    list: RecordingFn<[ReferenceDataKind], ReferenceData>;
  };
  readonly attachments: {
    upload: RecordingFn<[UploadFileInput], UploadResult>;
    get: RecordingFn<[number], AttachmentRef>;
    download: RecordingFn<[number, string], Uint8Array>;
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
      delete: recording<[number], void>(() => undefined),
      addWatcher: recording<[number, number], void>(() => undefined),
      removeWatcher: recording<[number, number], void>(() => undefined),
    },
    issueRelations: {
      listForIssue: recording<[number], readonly IssueRelation[]>(() => [issueRelationFixture]),
      get: recording<[number], IssueRelation>(() => issueRelationFixture),
      create: recording<[number, CreateIssueRelationInput], IssueRelation>(
        () => issueRelationFixture,
      ),
      delete: recording<[number], void>(() => undefined),
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
      list: recording<[ListUsersParams], Paginated<UserSimple>>(() => page([userSimpleFixture])),
    },
    search: {
      search: recording<[SearchParams], Paginated<SearchResult>>(() => searchResultsPage),
    },
    referenceData: {
      list: recording<[ReferenceDataKind], ReferenceData>(() => referenceStatusesFixture),
    },
    attachments: {
      // Bytes in, bytes out: the fake never touches the filesystem, mirroring the
      // port's contract.
      upload: recording<[UploadFileInput], UploadResult>(() => ({
        id: 7,
        token: '7.ec9b1f0e3d5a8e4c',
      })),
      get: recording<[number], AttachmentRef>(() => attachmentFixture),
      download: recording<[number, string], Uint8Array>(() =>
        new TextEncoder().encode('attachment contents'),
      ),
    },
  };
}
