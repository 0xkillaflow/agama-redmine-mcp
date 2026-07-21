# Redmine OpenAPI Spec

The Redmine REST API described in OpenAPI 3.0.3, organized into one file per domain. Each domain file
references shared components (parameters and cross-domain schemas) from `redmine-core.yaml` via
relative external `$ref` (e.g. `./redmine-core.yaml#/components/schemas/errors`), so `redmine-core.yaml`
must be kept alongside the others.

## Files

| File | Contents |
| --- | --- |
| `redmine-core.yaml` | Shared components only, no paths: `info`, `servers`, `security`, the `tags` list, `securitySchemes`, all reusable `parameters` (e.g. `format`, `issue_id`, `project_id`, `x_redmine_switch_user`), and schemas used by more than one domain (`id_name`, `errors`, `custom_fields`, `custom_field_values`, `custom_field_value`, `issue_status`, `role`, `attachment`). |
| `redmine-issues.yaml` | Issue CRUD, watchers, issue relations, and journal updates. Schemas: `issue`, `issue.simple`, `issue_relation`, `uploads`. |
| `redmine-projects.yaml` | Project CRUD, archive/unarchive/close/reopen, and project versions. Schemas: `project`, `project.simple`, `version`, `version.simple`. |
| `redmine-memberships.yaml` | Project membership CRUD. Schema: `membership`. |
| `redmine-users.yaml` | Users, groups, and "my account". Schemas: `user`, `user.simple`, `group`, `group.simple`, `pref`, `my_account`. |
| `redmine-time-entries.yaml` | Time entry CRUD. Schema: `time_entry`. |
| `redmine-wiki.yaml` | Wiki page index, show, update, delete, and version history. Schemas: `wiki_page`, `wiki_pages`. |
| `redmine-attachments.yaml` | Attachment show/update/delete/download/thumbnail, upload token creation, and project file listing/upload. Schema: `file`. |
| `redmine-queries.yaml` | List saved queries. Schema: `query`. |
| `redmine-trackers.yaml` | Reference/enumeration endpoints: issue statuses, trackers, enumerations (priorities, time entry activities, document categories), issue categories, and roles. Schemas: `tracker`, `issue_category`, `issue_priority`, `time_entry_activity`, `document_category`. |
| `redmine-custom-fields.yaml` | List custom fields. Schema: `custom_field`. |
| `redmine-other.yaml` | News (global and per-project), global search, and repositories. Schemas: `news`, `news_comment`, `search`. |

## Usage

- **Editing** — add shared parameters or cross-domain schemas to `redmine-core.yaml`; keep
  domain-specific schemas in their owning file.
- **Bundling** — for tools that don't resolve multi-file `$ref`s, bundle a domain file into a single
  document first, e.g. `npx @redocly/cli bundle redmine-issues.yaml -o dist/redmine-issues.yaml`.
- **Linting** — `npx @redocly/cli lint redmine-issues.yaml` validates a file and resolves its
  references into `redmine-core.yaml`.
