# Integration tests (opt-in)

End-to-end tests that run the **real** `RedmineHttpClient` against a Dockerized
Redmine, driven through the in-memory MCP client (so the full
register → validate → handle → format path is exercised against a live server).

They are **excluded from the default suite** — they need Docker and network — and
run only when `RUN_INTEGRATION=1` is set. Without it, every suite here is skipped
and `npm test` needs nothing but Node.

## One-command local run

```sh
# 1. Boot Redmine + Postgres, wait for health, load defaults, enable the REST API,
#    mint an admin key, and seed a scoped test project. Writes redmine.env here.
bash scripts/redmine-up.sh

# 2. Load the generated credentials and run only the integration suite.
set -a && source test/integration/redmine.env && set +a
RUN_INTEGRATION=1 npx vitest run test/integration
```

`scripts/redmine-up.sh` is idempotent — re-run it any time. Tear down with
`docker compose down` (add `-v` to also drop the database and start fresh).

## What the setup does

`docker-compose.yml` pins `redmine:6-alpine` on `:3000` with `postgres:16-alpine`.
The script performs the first-run admin steps for you:

- **Load default configuration** (trackers, statuses, priorities, roles,
  workflows, activities) if the database is empty.
- **Enable the REST API** (`Setting.rest_api_enabled`).
- **Mint/read the admin API key** (idempotent).
- **Seed a test project** (identifier `mcp-int-test`, overridable via
  `REDMINE_TEST_PROJECT`) with issue tracking + time tracking enabled and the
  admin added as **Manager** (so workflow-gated status changes are allowed).

The credentials land in `test/integration/redmine.env` (git-ignored):

| Variable               | Meaning                                  |
| ---------------------- | ---------------------------------------- |
| `REDMINE_URL`          | Base URL of the local Redmine (`:3000`). |
| `REDMINE_API_KEY`      | The seeded admin's API key.              |
| `REDMINE_TEST_PROJECT` | Identifier of the scoped test project.   |

## What the tests cover

| File                         | Behaviour                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `users.int.test.ts`          | `get_current_user` returns the seeded admin; `list_users` finds it (tolerating a 403).             |
| `reference-data.int.test.ts` | `list_reference_data` returns each of the five kinds.                                              |
| `issues.int.test.ts`         | `create_issue` → `get_issue` round-trip; `update_issue` changes status + adds a note (ADR-0011).   |
| `time-entries.int.test.ts`   | `create_time_entry` on a created issue; `list_time_entries` finds it.                              |
| `projects.int.test.ts`       | `list_projects` / `get_project` on the seeded project.                                             |
| `search.int.test.ts`         | `search` finds a created issue by a unique subject token.                                          |
| `attachments.int.test.ts`    | Upload → attach to an issue → download round-trip (byte-for-byte); allowlist and overwrite guards. |

Tests scope their data to the seeded project and use unique subjects/comments per
run, so re-runs don't collide.
