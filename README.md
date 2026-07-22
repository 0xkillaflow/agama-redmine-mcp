# 🦎 Agama — Redmine MCP Server

[MCP server](https://modelcontextprotocol.io/) for Redmine. Enables AI agents to work with issues using simple natural language commands.

Works just as well as a personal tool for a single developer — or deployed once and shared by the
whole team.

```plaintxt
┌──────────┐   MCP (stdio)   ┌─────────────────────┐   REST/JSON   ┌──────────┐
│  Agent   │ ──────────────▶ │  Redmine MCP Server │ ────────────▶ │ Redmine  │
│ (client) │ ◀────────────── │   (this project)    │ ◀──────────── │  server  │
└──────────┘   tool results  └─────────────────────┘     HTTP      └──────────┘
```

## 💬 Just ask

> "What issues are assigned to me? Sort them by priority."

> "Create a bug in the Web project: login button doesn't respond on mobile, mark it urgent."

> "Summarize issue #456 and all its subtasks."

> "How many hours did I log this week, broken down by project?"

## Requirements

- Node.js 20+
- A Redmine instance with the REST API enabled (_Administration → Settings → API_)
- A Redmine API key — go to **My account → API access key** while signed in

## Quick start

Most MCP clients (e.g. Claude Desktop) launch the server for you — configure it once and forget it:

```json
{
  "mcpServers": {
    "redmine": {
      "command": "npx",
      "args": ["-y", "@0xkillaflow/agama-redmine-mcp"],
      "env": {
        "REDMINE_URL": "https://redmine.example.com",
        "REDMINE_API_KEY": "your-redmine-api-key"
      }
    }
  }
}
```

For Claude Desktop, this goes in `claude_desktop_config.json` (**Settings → Developer → Edit
Config**). Restart the client and the Redmine tools will appear in its tool list.

To run it standalone from a shell instead:

```bash
REDMINE_URL=https://redmine.example.com REDMINE_API_KEY=your-redmine-api-key \
  npx -y @0xkillaflow/agama-redmine-mcp
```

The server speaks MCP over stdio and logs to stderr, so stdout stays clean for the protocol.

## Configuration

Set via environment variables, validated at startup. See [`.env.example`](./.env.example) for a
template.

| Variable             | Required | Default | Purpose                                |
| -------------------- | -------- | ------- | -------------------------------------- |
| `REDMINE_URL`        | yes      | —       | Base URL of the Redmine instance       |
| `REDMINE_API_KEY`    | yes      | —       | API key for the acting user            |
| `REDMINE_TIMEOUT_MS` | no       | `30000` | Per-request timeout in milliseconds    |
| `LOG_LEVEL`          | no       | `info`  | `debug` \| `info` \| `warn` \| `error` |
| `MCP_TRANSPORT`      | no       | `stdio` | `stdio` (only supported mode today)    |

## Tools

Ten intent-shaped tools, each tagged with MCP safety annotations. Full reference:
[`docs/tools.md`](./docs/tools.md).

| Tool                        | Kind  | Description                                                 |
| --------------------------- | ----- | ----------------------------------------------------------- |
| `redmine_list_issues`       | read  | Search/filter issues by status, assignee, tracker, dates…   |
| `redmine_get_issue`         | read  | Full issue detail, optionally with journals and attachments |
| `redmine_create_issue`      | write | Create an issue                                             |
| `redmine_update_issue`      | write | Edit an issue's status, assignee, notes…                    |
| `redmine_search`            | read  | Free-text search across issues, wiki, news, projects        |
| `redmine_list_projects`     | read  | List visible projects                                       |
| `redmine_get_project`       | read  | Full project detail, trackers/categories/activities         |
| `redmine_list_time_entries` | read  | Query logged time                                           |
| `redmine_create_time_entry` | write | Log hours against an issue or project                       |
| `redmine_get_current_user`  | read  | "Who am I" — the API key's user, memberships, groups        |

> **Heads up:** on write, Redmine silently ignores an unknown `tracker_id`, `status_id`, or
> `fixed_version_id` instead of erroring — always check the returned issue. The same applies to
> `is_private`, which is silently dropped if your role lacks the "set public/private" permission.

## Security

The server runs locally and acts as a single user: your `REDMINE_API_KEY` never leaves your
machine except as a request header to your own Redmine instance, and the server can do nothing
your account couldn't already do. Multi-user HTTP transport is planned but not yet implemented —
selecting `MCP_TRANSPORT=http` exits with a clear error.

## Troubleshooting

| Symptom                      | Likely cause                                                         |
| ---------------------------- | -------------------------------------------------------------------- |
| Client shows no tools        | Something besides JSON-RPC is writing to stdout — check any wrapper  |
| Exits immediately on startup | A required env var is missing or invalid; the error names it         |
| `401 Unauthorized`           | API key missing/wrong, or REST API disabled on the Redmine side      |
| `403 Forbidden`              | The key's user lacks permission for that action                      |
| `404 Not Found`              | The id doesn't exist or isn't visible to the key                     |
| `422 Unprocessable Entity`   | Redmine rejected the write — check the field-level messages returned |

## Documentation

- [`docs/architecture.md`](./docs/architecture.md) — design and request lifecycle
- [`docs/tools.md`](./docs/tools.md) — generated per-tool reference
- [`docs/adding-a-tool.md`](./docs/adding-a-tool.md) — recipe for adding a new tool
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — dev setup and contribution guide

## Development

```bash
npm install       # install dependencies
npm run dev       # watch-run the stdio server
npm test          # run the test suite
npm run build     # bundle to dist/
```

## License

[MIT](./LICENSE)
