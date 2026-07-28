# @0xkillaflow/agama-redmine-mcp

## 2.1.0

### Minor Changes

- f4695ae: **Added**

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

## 2.0.0

### Major Changes

- c7a5139: **BREAKING:** raise the minimum supported Node.js version from 20 to 22
  (`engines.node: ">=22"`).

  Node.js 20 reached end-of-life on 2026-04-30 and no longer receives security
  patches; Node.js 22 is the current active LTS (supported until 2027-04-30).
  Consumers still on Node 20 must upgrade their runtime before taking this
  release. No API or behavior changes — `@types/node` now tracks the 22.x line
  and CI tests Node 22 and 24.

### Minor Changes

- ff070a2: Migrate `zod` from 3.25.76 to 4.4.3.

  Internal changes only — every tool schema, domain model, and the config loader
  now target the zod v4 API; the generated tool reference (`docs/tools`) is
  byte-identical.

  **Behavioral note (agent-facing):** default validation messages produced by zod
  changed wording in v4. A missing/mistyped tool argument that was previously
  reported as e.g. `Required` is now reported as
  `Invalid input: expected number, received undefined`. Custom messages (config
  validation, the create-time-entry issue/project XOR) are unchanged.

- 8abc489: Final CI/CD configuration.

### Patch Changes

- b5542cd: Migrate ESLint from 9.39.5 to 10.7.0; replace the stalled `eslint-plugin-import`
  (no ESLint 10 support) with the maintained `eslint-plugin-import-x` fork.

  Dev-tooling only — no runtime or published-package changes. The hexagonal
  import-boundary rule (ADR-0001) was re-verified to fail on a deliberate
  cross-layer import under the new plugin. Note for contributors: ESLint 10
  requires Node `^20.19.0 || ^22.13.0 || >=24` to run lint locally.

- b5568e2: Migrate TypeScript from 5.9.3 to 6.0.3 (the bridge major before the 7.x native
  compiler, which stays blocked on `typescript-eslint` peer support).

  Dev-tooling only — emitted `dist/` output is byte-identical to the 5.9.3 build.
  One migration nuance: tsup's dts worker injects the now-deprecated `baseUrl`
  option, so `ignoreDeprecations: "6.0"` is scoped to the dts build in
  `tsup.config.ts` (not the project tsconfig — `npm run typecheck` stays strict).
