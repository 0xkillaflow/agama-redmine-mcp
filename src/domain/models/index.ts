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

// Issue relations (also embedded in an issue under `include=relations`)
export {
  IssueRelationSchema,
  RelationTypeSchema,
  CreateIssueRelationInputSchema,
} from './issue-relation.js';
export type { IssueRelation, RelationType, CreateIssueRelationInput } from './issue-relation.js';

// Attachments (the upload/download side; `AttachmentRefSchema` lives in common,
// `UploadTokenSchema` in issue — both re-exported above/below for discoverability)
export { UploadResultSchema } from './attachment.js';
export type { UploadResult, UploadFileInput, DownloadResult } from './attachment.js';

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
export type { User, UserSimple, CurrentUserInclude, ListUsersParams } from './user.js';

// Search
export { SearchResultSchema, SearchParamsSchema } from './search.js';
export type { SearchResult, SearchParams } from './search.js';

// Reference data (statuses, trackers, priorities, activities, document categories)
export { ReferenceDataKindSchema, TrackerSchema, EnumerationSchema } from './reference-data.js';
export type { ReferenceDataKind, Tracker, Enumeration, ReferenceData } from './reference-data.js';
