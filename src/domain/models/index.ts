// Public API of the domain models (Zod schemas + inferred types).
export {
  IdNameSchema,
  IssueStatusRefSchema,
  CustomFieldValueSchema,
  CustomFieldWriteSchema,
  AttachmentRefSchema,
  RedmineErrorsBodySchema,
  paginated,
  includeSchema,
} from './common.js';
export type {
  IdName,
  IssueStatusRef,
  CustomFieldValue,
  CustomFieldWrite,
  AttachmentRef,
  RedmineErrorsBody,
  Paginated,
  Include,
} from './common.js';

// Issues
export {
  IssueSimpleSchema,
  IssueSchema,
  IssueIncludeSchema,
  ListIssuesParamsSchema,
  CreateIssueInputSchema,
  UpdateIssueInputSchema,
  UploadTokenSchema,
} from './issue.js';
export type {
  IssueSimple,
  Issue,
  IssueInclude,
  ListIssuesParams,
  CreateIssueInput,
  UpdateIssueInput,
  UploadToken,
} from './issue.js';

// Projects
export {
  ProjectSimpleSchema,
  ProjectSchema,
  ProjectIncludeSchema,
  ProjectRefSchema,
  ListProjectsParamsSchema,
} from './project.js';
export type {
  ProjectSimple,
  Project,
  ProjectInclude,
  ProjectRef,
  ListProjectsParams,
} from './project.js';

// Time entries
export {
  TimeEntrySchema,
  ListTimeEntriesParamsSchema,
  CreateTimeEntryInputSchema,
} from './time-entry.js';
export type { TimeEntry, ListTimeEntriesParams, CreateTimeEntryInput } from './time-entry.js';

// Users
export { UserSchema, UserSimpleSchema, CurrentUserIncludeSchema } from './user.js';
export type { User, UserSimple, CurrentUserInclude } from './user.js';

// Search
export { SearchResultSchema, SearchParamsSchema } from './search.js';
export type { SearchResult, SearchParams } from './search.js';
