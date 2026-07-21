# Redmine MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes
[Redmine](https://www.redmine.org/) to AI agents as a small set of intent-shaped, well-typed tools.
It is a thin, strictly-typed translation layer: high-level MCP tools in, concrete Redmine REST calls
out.

```
┌──────────┐   MCP (stdio)   ┌─────────────────────┐   REST/JSON   ┌──────────┐
│  Agent   │ ──────────────▶ │  Redmine MCP Server │ ────────────▶ │ Redmine  │
│ (client) │ ◀────────────── │   (this project)    │ ◀──────────── │  server  │
└──────────┘   tool results  └─────────────────────┘     HTTP      └──────────┘
```

Tools are designed around _intent_ ("what's on the board", "log 3.5h on #456"), not around Redmine
endpoints — deliberately few, narrow, and well-documented so an agent can discover and use them
reliably. See [`docs/architecture.md`](./docs/architecture.md) for the full design.

## Requirements

- Node.js **20+**
- A reachable Redmine instance with the **REST API enabled**
  (_Administration → Settings → API → Enable REST web service_)
- A Redmine **API key** (see [Getting a Redmine API key](#getting-a-redmine-api-key))

## Quick start

The server speaks MCP over **stdio** and is configured entirely through environment variables. Most
users never run it directly — an MCP client (e.g. Claude Desktop) launches it. To try it from a
shell:

```bash
REDMINE_URL=https://redmine.example.com \
REDMINE_API_KEY=your-redmine-api-key \
npx -y @left4dev/redmine-mcp
```

It will wait for a client on stdin; press `Ctrl+C` to exit. Logs go to **stderr** — stdout carries
the JSON-RPC protocol stream and must stay clean.

### From source

```bash
git clone https://github.com/epistax1s/redmine-mcp.git
cd redmine-mcp
npm install
npm run build
REDMINE_URL=https://redmine.example.com REDMINE_API_KEY=your-redmine-api-key node dist/index.js
```

During development, `npm run dev` watch-runs the server via `tsx` without a build step.

## Connecting from an MCP client

Add the server to your client's `mcpServers` configuration. For **Claude Desktop**, edit
`claude_desktop_config.json` (_Settings → Developer → Edit Config_):

```json
{
  "mcpServers": {
    "redmine": {
      "command": "npx",
      "args": ["-y", "@left4dev/redmine-mcp"],
      "env": {
        "REDMINE_URL": "https://redmine.example.com",
        "REDMINE_API_KEY": "your-redmine-api-key"
      }
    }
  }
}
```

The same shape works for any MCP client that spawns stdio servers. If you installed from source,
replace `command`/`args` with your built entry point:

```json
{
  "mcpServers": {
    "redmine": {
      "command": "node",
      "args": ["/absolute/path/to/redmine-mcp/dist/index.js"],
      "env": {
        "REDMINE_URL": "https://redmine.example.com",
        "REDMINE_API_KEY": "your-redmine-api-key"
      }
    }
  }
}
```

Restart the client; the Redmine tools should appear in its tool list.

## Configuration

All configuration is read from environment variables, parsed and validated once at startup — an
invalid value fails fast with a readable message. See [`.env.example`](./.env.example) for a
copy-paste template.

| Variable             | Required    | Default | Purpose                                     |
| -------------------- | ----------- | ------- | ------------------------------------------- |
| `REDMINE_URL`        | yes         | —       | Base URL of the Redmine instance            |
| `REDMINE_API_KEY`    | yes (stdio) | —       | API key for the single user (stdio mode)    |
| `MCP_TRANSPORT`      | no          | `stdio` | `stdio` \| `http` (`http` is a future stub) |
| `REDMINE_TIMEOUT_MS` | no          | `30000` | Per-request timeout in milliseconds         |
| `LOG_LEVEL`          | no          | `info`  | `debug` \| `info` \| `warn` \| `error`      |
| `HTTP_PORT`          | no (http)   | `3000`  | Reserved for the future http transport      |

This table mirrors [architecture §8](./docs/architecture.md#8-configuration); the authoritative
schema lives in [`src/config/config.schema.ts`](./src/config/config.schema.ts).

## Getting a Redmine API key

1. Sign in to Redmine.
2. Go to **My account** (top-right).
3. In the right-hand sidebar, click **Show** under **API access key**, then copy it.

If you don't see the API access key, an administrator must enable the REST API under
_Administration → Settings → API_. The key inherits your account's permissions — the server can only
do what you can do.

## Tools

Ten intent-shaped tools. Each sets MCP annotations (`readOnlyHint` / `destructiveHint`) so clients
can reason about safety. Full parameter reference: **[`docs/tools.md`](./docs/tools.md)** (generated
from the code); design rationale: [`mcp-tools-req.md`](./mcp-tools-req.md).

| Tool                        | Kind  | Description                                                                             |
| --------------------------- | ----- | --------------------------------------------------------------------------------------- |
| `redmine_list_issues`       | read  | Search/filter issues by status, assignee, tracker, dates, custom fields, saved queries. |
| `redmine_get_issue`         | read  | Full detail on one issue, optionally with journals, attachments, relations, watchers.   |
| `redmine_create_issue`      | write | Create an issue with subject, tracker, priority, assignee, dates, and custom fields.    |
| `redmine_update_issue`      | write | Edit an issue (status, assignee, notes, …); returns the re-fetched result.              |
| `redmine_search`            | read  | Free-text search across issues, wiki pages, news, and projects.                         |
| `redmine_list_projects`     | read  | List visible projects, filtered by name, status, parent, or visibility.                 |
| `redmine_get_project`       | read  | Full project detail by id or identifier slug, with trackers/categories/activities.      |
| `redmine_list_time_entries` | read  | Query logged time by user, project, issue, date range, or activity.                     |
| `redmine_create_time_entry` | write | Log hours against an issue **or** project with an activity and comment.                 |
| `redmine_get_current_user`  | read  | "Who am I" — the API key's user, plus optional memberships and groups.                  |

> **Caveat — silently-ignored ids on write.** When creating or updating an issue, Redmine validates
> `assigned_to_id` and `category_id` and returns a clear `422` for an unknown id. But for
> `tracker_id`, `status_id`, and `fixed_version_id` it **silently ignores** an unknown id (falling
> back to the default / keeping the previous value) with no error. The server sends these fields
> verbatim and does not pre-validate them, so always confirm these fields on the returned issue.
> Fetch valid ids for a project with `redmine_get_project` (`include=trackers,issue_categories`).

> **Caveat — `is_private` depends on role permission.** Setting `is_private` on create/update
> requires the "Set issues public/private" permission on your Redmine role. Without it, Redmine
> silently ignores the flag (the issue stays as-is) with no error — confirm `is_private` on the
> returned issue.

## Security notes

- **Local, single-user by design.** In the default stdio mode the API key is read from
  `REDMINE_API_KEY` and never leaves your machine except as the `X-Redmine-API-Key` header on
  requests to your own Redmine instance. It is treated as a secret and is never logged.
- **The server has exactly your permissions.** It acts as the key's user; it cannot do anything that
  user cannot.
- **Multi-user (http) mode is future work.** A documented placeholder exists for a cloud/corporate
  deployment where each request carries its own `Authorization: Bearer <token>` — see
  [architecture §7](./docs/architecture.md#7-authentication--transport-model) and the
  [roadmap](./docs/architecture.md#14-roadmap-beyond-this-iteration). It is not implemented; selecting
  `MCP_TRANSPORT=http` currently exits with a clear "not implemented" message.

## Troubleshooting

- **Client shows no tools / connection fails.** In stdio mode **stdout must carry only JSON-RPC**.
  Anything else on stdout corrupts the stream. This server logs exclusively to stderr; if you wrap or
  fork it, keep stdout clean.
- **Startup exits immediately with a config error.** A required variable is missing or malformed
  (e.g. `REDMINE_URL` not a valid URL, or `REDMINE_API_KEY` unset in stdio mode). The message names
  the offending variable — fix it and relaunch.
- **`401 Unauthorized`** — the API key is missing, wrong, or the REST API is disabled on the Redmine
  side.
- **`403 Forbidden`** — the key's user lacks permission for that project/action (e.g. logging time on
  another user's behalf).
- **`404 Not Found`** — the issue/project id or identifier doesn't exist or isn't visible to the key.
- **`422 Unprocessable Entity`** — Redmine rejected the write; the tool result includes Redmine's
  field-level validation messages (e.g. a required custom field or activity).

## Documentation

- [`docs/architecture.md`](./docs/architecture.md) — design, hexagonal layers, request lifecycle.
- [`docs/tools.md`](./docs/tools.md) — generated per-tool reference.
- [`docs/adding-a-tool.md`](./docs/adding-a-tool.md) — step-by-step recipe for a new tool.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — dev setup, standards, and Definition of Done.

## Development

```bash
npm install       # install dependencies
npm run dev       # watch-run the stdio server
npm run build     # bundle to dist/ (ESM, with CLI shebang)
npm test          # run the Vitest suite
npm run lint      # ESLint (incl. hexagonal import boundaries)
npm run format    # Prettier
npm run typecheck # tsc --noEmit
npm run gen:tools # regenerate docs/tools.md from the registry
```

## License

[MIT](./LICENSE)
