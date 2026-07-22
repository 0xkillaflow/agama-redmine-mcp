# Contributing

Thanks for helping improve the Redmine MCP Server. This guide covers local setup, project
standards, and what "done" means. The single most common contribution — **adding a new tool** — has
its own step-by-step recipe in [`docs/adding-a-tool.md`](./docs/adding-a-tool.md).

## Development setup

```bash
git clone https://github.com/0xkillaflow/agama-redmine-mcp.git
cd agama-redmine-mcp
npm install
npm test          # everything should be green on a clean checkout
```

Node **20+** is required. No network or Redmine instance is needed for the default test suite —
integration tests are opt-in (see below).

### Scripts

| Script                 | What it does                                                                      |
| ---------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`          | Watch-run the stdio server via `tsx`                                              |
| `npm run build`        | Bundle to `dist/` (ESM + shebang) with `tsup`                                     |
| `npm test`             | Run the Vitest suite once                                                         |
| `npm run test:watch`   | Vitest in watch mode                                                              |
| `npm run coverage`     | Run tests with coverage (thresholds enforced)                                     |
| `npm run typecheck`    | `tsc --noEmit` (strict)                                                           |
| `npm run lint`         | ESLint, including hexagonal import boundaries                                     |
| `npm run format`       | Prettier write                                                                    |
| `npm run format:check` | Prettier check (what CI runs)                                                     |
| `npm run gen:tools`    | Regenerate the tool reference (`docs/tools.md` + `docs/tools/`) from the registry |
| `npm run changeset`    | Record a changeset for your change (see below)                                    |

### Integration tests (optional)

End-to-end tests run the full MCP path against a Dockerized Redmine. They are skipped by default and
gated on `RUN_INTEGRATION=1`:

```bash
bash scripts/redmine-up.sh                       # start & seed Redmine, write test/integration/redmine.env
set -a && source test/integration/redmine.env && set +a
RUN_INTEGRATION=1 npm test
```

## Project standards

### Architecture

This project follows **Hexagonal Architecture (Ports & Adapters)**; read
[`docs/architecture.md`](./docs/architecture.md) before making structural changes, and note the
rationale for any trade-off there.

**Layer import rules** (enforced by ESLint via `import/no-restricted-paths`):

- `domain/` imports **nothing** from outer layers — it is pure (Zod models, errors, port interfaces).
- `application/` imports **`domain/` only** — tool handlers depend on ports, never on the SDK or HTTP.
- `adapters/`, `config/`, `infrastructure/` may import `domain/` + `application/`.
- Only `container.ts` (the Composition Root) and `server.ts` wire adapters together.

Dependencies always point inward. A layer violation fails `npm run lint`.

### Code style

- **Strict TypeScript** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …). No
  `any`; validate untrusted data with **Zod** at every boundary and infer types from the schema.
- **ESM only** (`"type": "module"`) with `.js` import specifiers, even from `.ts` sources.
- **Logs go to stderr.** `console.log`/`info`/`debug` are banned by lint (stdout is the JSON-RPC
  channel in stdio mode); use the injected `Logger`.
- Formatting is **Prettier** — run `npm run format` before pushing. Keep the public surface of each
  module narrow via its `index.ts` barrel.

### Branches, commits, and PRs

- Branch off `master` with a descriptive name: `feat/list-users`, `fix/error-mapper-429`,
  `docs/troubleshooting`.
- **Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).** The
  subject is `type(optional-scope): description`, with the description in the imperative mood and
  lower case, no trailing period:

  ```
  feat(issues): add redmine_list_users tool
  fix(request-builder): map 429 to RedmineRateLimitError
  docs: document the http transport seam
  ```

  - **Allowed types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`,
    `revert`.
  - **Scope** (optional) names the affected area — e.g. `issues`, `projects`, `request-builder`,
    `mcp`, `config`.
  - **Breaking changes** add a `!` before the colon (`feat!: …`) and/or a `BREAKING CHANGE:` footer.
  - The version bump and changelog come from your **changeset** (see below), not from the commit
    type — Conventional Commits keep the history readable and reviewable.

- Keep PRs focused and small. Describe the change, link any related issue, and note anything
  reviewers should scrutinize.

## Definition of Done

A change is ready to merge when **all** of the following hold:

- [ ] **Tests** — new/changed behavior is covered by unit tests (handlers against a fake client,
      resources against a mocked `fetch`), and integration tests where applicable. Coverage
      thresholds hold.
- [ ] **Docs** — user-facing docs are updated. For a new/changed tool, regenerate the reference with
      `npm run gen:tools` and commit `docs/tools.md` + `docs/tools/`. Update `docs/architecture.md`
      for structural or trade-off changes.
- [ ] **Changeset** — run `npm run changeset` and commit the generated file so the release picks up
      a version bump and changelog entry (see below).
- [ ] **Green CI** — `typecheck`, `lint`, `format:check`, `test`, and `build` all pass, along with
      the tool-catalog drift check.

## Releases (Changesets)

Versioning and changelogs are managed with [Changesets](https://github.com/changesets/changesets).
When your change affects the published package, add a changeset:

```bash
npm run changeset      # pick a bump (patch/minor/major) and write a summary
```

Commit the generated `.changeset/*.md` file with your PR. On merge, the release workflow opens (or
updates) a "Version Packages" PR; merging **that** publishes to npm with provenance. You never bump
`version` or edit `CHANGELOG.md` by hand.
