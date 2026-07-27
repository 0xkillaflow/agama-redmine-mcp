---
'@0xkillaflow/agama-redmine-mcp': minor
---

**Added**

- 9 new Redmine MCP tools, expanding the catalog from 10 to 19:
- **Issues**: `redmine_delete_issue`, `redmine_manage_issue_watchers`
- **Issue relations**: `redmine_list_issue_relations`, `redmine_create_issue_relation`, `redmine_delete_issue_relation`
- **Users**: `redmine_list_users`
- **Reference data**: `redmine_list_reference_data` (statuses/trackers/priorities/activities/document categories)
- **Attachments**: `redmine_upload_attachment`, `redmine_download_attachment`
- `REDMINE_ALLOWED_DIRECTORIES` filesystem allowlist controlling which directories the upload/download attachment tools may access. Defaults to empty (fail-closed: no local file access at all until explicitly configured).
- Documentation for each new tool under `docs/tools/*.md`.

**Changed**

- Updated README and `docs/tools.md` for the new tool catalog and the file-access section.
- Extended domain models (`Issue`, `User`, plus new `Attachment`, `IssueRelation`, `ReferenceData`) and the `RedmineClient` port to support the new operations.

**Security**

- `redmine_delete_issue` and `redmine_delete_issue_relation` are tagged with the MCP `destructiveHint: true` annotation.
- Attachment upload/download paths are canonically resolved (following symlinks and `..` segments) before the allowlist check, and downloads never overwrite an existing file.
