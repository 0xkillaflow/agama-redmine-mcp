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

/**
 * Issue operations backing the issue tools (`GET/POST/PUT/DELETE /issues`, plus
 * the watcher sub-resource).
 *
 * The watcher pair mirrors the API one method per endpoint; consolidating them
 * behind a single "manage watchers" intent is a tool-layer decision, so the port
 * stays a faithful description of what Redmine offers.
 */
export interface IssuesResource {
  list(params: ListIssuesParams): Promise<Paginated<IssueSimple>>;
  get(id: number, include?: IssueInclude[]): Promise<Issue>;
  create(input: CreateIssueInput): Promise<IssueSimple>;
  update(id: number, input: UpdateIssueInput): Promise<void>;
  /** Permanently delete an issue; Redmine offers no undo. */
  delete(id: number): Promise<void>;
  addWatcher(issueId: number, userId: number): Promise<void>;
  removeWatcher(issueId: number, userId: number): Promise<void>;
}

/**
 * Issue-relation operations backing the relation tools.
 *
 * Its own resource rather than three more methods on {@link IssuesResource}:
 * only the list and create endpoints are issue-scoped
 * (`/issues/{id}/relations.json`), while reading and deleting a single relation
 * go through the top-level `/relations/{id}.json` — which is also why deletion
 * is keyed on the *relation's* id, never on a pair of issue ids.
 */
export interface IssueRelationsResource {
  /**
   * All relations attached to an issue, in either direction — the issue may be
   * the source or the target of any of them. A plain array, not a
   * {@link Paginated} page: the endpoint returns no `total_count`/`offset`/`limit`.
   */
  listForIssue(issueId: number): Promise<readonly IssueRelation[]>;
  /** One relation by its own id. */
  get(relationId: number): Promise<IssueRelation>;
  /** Link `issueId` (the source) to `input.issue_to_id` (the target). */
  create(issueId: number, input: CreateIssueRelationInput): Promise<IssueRelation>;
  /** Remove a relation by its own id; Redmine drops both directions at once. */
  delete(relationId: number): Promise<void>;
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

/** User lookups backing the user tools (`GET /users`, `GET /users/current`). */
export interface UsersResource {
  getCurrent(include?: CurrentUserInclude[]): Promise<User>;
  list(params: ListUsersParams): Promise<Paginated<UserSimple>>;
}

/** Cross-entity free-text search backing `redmine_search` (`GET /search`). */
export interface SearchResource {
  search(params: SearchParams): Promise<Paginated<SearchResult>>;
}

/**
 * Instance-wide enumeration lookups backing `redmine_list_reference_data`
 * (`GET /issue_statuses`, `/trackers`, `/enumerations/*`). One `kind`-switched
 * call: the result is discriminated by `kind`, so the item type follows from it.
 */
export interface ReferenceDataResource {
  list(kind: ReferenceDataKind): Promise<ReferenceData>;
}

/**
 * Attachment transfer backing the attachment tools (`POST /uploads`,
 * `GET /attachments/{id}`, `GET /attachments/download/{id}/{filename}`).
 *
 * Every method deals in **bytes, never paths**: reading and writing local files
 * is an application concern, guarded by the `REDMINE_ALLOWED_DIRECTORIES`
 * allowlist, so the gateway (and every fake of it) stays filesystem-free.
 */
export interface AttachmentsResource {
  upload(input: UploadFileInput): Promise<UploadResult>;
  get(id: number): Promise<AttachmentRef>;
  download(id: number, filename: string): Promise<Uint8Array>;
}

/**
 * The resource-grouped Redmine gateway. Each property is a narrow interface
 * exposing exactly the operations the current tools require.
 */
export interface RedmineClient {
  readonly issues: IssuesResource;
  readonly issueRelations: IssueRelationsResource;
  readonly projects: ProjectsResource;
  readonly timeEntries: TimeEntriesResource;
  readonly users: UsersResource;
  readonly search: SearchResource;
  readonly referenceData: ReferenceDataResource;
  readonly attachments: AttachmentsResource;
}
