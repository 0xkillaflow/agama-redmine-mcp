/**
 * The outbound gateway port.
 *
 * `RedmineClient` is the *only* way the application talks to Redmine. It is a
 * resource-grouped, fully-typed interface: methods take already-parsed domain
 * params/inputs and return domain models, so tool handlers stay thin and a
 * hand-written fake is trivial to supply in tests.
 *
 * Credentials and base URL are bound when the concrete client is constructed,
 * so no method carries auth arguments. Serialization and HTTP
 * details live in the outbound adapter, never here.
 *
 * The port depends only on `domain/models` — no SDK, no Node HTTP. It grows one
 * resource interface at a time as tools are added.
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
} from '../models/index.js';

/**
 * Credentials bound to a {@link RedmineClient}. An extensible union: new
 * authentication kinds (OAuth, Basic) add a `kind` and a matching provider
 * without touching tools. Both current kinds are sent to Redmine as the
 * `X-Redmine-API-Key` header; `bearer` exists so the future
 * http adapter can carry a per-user token from an inbound `Authorization` header.
 */
export interface RedmineCredentials {
  readonly kind: 'apiKey' | 'bearer';
  /** The API key or bearer token. */
  readonly value: string;
}

/** Issue operations backing the issue tools (`GET/POST/PUT /issues`). */
export interface IssuesResource {
  list(params: ListIssuesParams): Promise<Paginated<IssueSimple>>;
  get(id: number, include?: IssueInclude[]): Promise<Issue>;
  create(input: CreateIssueInput): Promise<IssueSimple>;
  update(id: number, input: UpdateIssueInput): Promise<void>;
}

/** Project operations backing the project tools (`GET /projects`). */
export interface ProjectsResource {
  list(params: ListProjectsParams): Promise<Paginated<ProjectSimple>>;
  get(ref: ProjectRef, include?: ProjectInclude[]): Promise<Project>;
}

/** Time-entry operations backing the timesheet tools (`GET/POST /time_entries`). */
export interface TimeEntriesResource {
  list(params: ListTimeEntriesParams): Promise<Paginated<TimeEntry>>;
  create(input: CreateTimeEntryInput): Promise<TimeEntry>;
}

/** Current-user lookup backing `redmine_get_current_user` (`GET /users/current`). */
export interface UsersResource {
  getCurrent(include?: CurrentUserInclude[]): Promise<User>;
}

/** Cross-entity free-text search backing `redmine_search` (`GET /search`). */
export interface SearchResource {
  search(params: SearchParams): Promise<Paginated<SearchResult>>;
}

/**
 * The resource-grouped Redmine gateway. Each property is a narrow interface
 * exposing exactly the operations the current tools require.
 */
export interface RedmineClient {
  readonly issues: IssuesResource;
  readonly projects: ProjectsResource;
  readonly timeEntries: TimeEntriesResource;
  readonly users: UsersResource;
  readonly search: SearchResource;
}
