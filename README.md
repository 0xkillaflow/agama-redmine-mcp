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

- Node.js 22+
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

| Variable                      | Required | Default | Purpose                                  |
| ----------------------------- | -------- | ------- | ---------------------------------------- |
| `REDMINE_URL`                 | yes      | —       | Base URL of the Redmine instance         |
| `REDMINE_API_KEY`             | yes      | —       | API key for the acting user              |
| `REDMINE_TIMEOUT_MS`          | no       | `30000` | Per-request timeout in milliseconds      |
| `REDMINE_ALLOWED_DIRECTORIES` | no       | _empty_ | Directories the attachment tools may use |
| `LOG_LEVEL`                   | no       | `info`  | `debug` \| `info` \| `warn` \| `error`   |
| `MCP_TRANSPORT`               | no       | `stdio` | `stdio` (only supported mode today)      |

### File access (`REDMINE_ALLOWED_DIRECTORIES`)

The attachment tools are the only ones that touch your filesystem, and they may
only touch it inside this allowlist — a `:`-separated list of absolute directories
(`;` on Windows). It governs **both** directions: reads for
`redmine_upload_attachment` and writes for `redmine_download_attachment`.

```bash
REDMINE_ALLOWED_DIRECTORIES=/Users/you/redmine-files:/tmp/redmine-downloads
```

**It defaults to empty, which means no local file access at all** — both tools
refuse every path until you opt in. That default is deliberate: an agent that can
be talked into uploading a file is an agent that can be talked into uploading
`~/.ssh/id_rsa` or the `.env` holding your API key. Allowlist the narrowest
directory that does the job. Paths are fully resolved (`..` segments and symlinks
included) before the check, so a symlink inside an allowed directory cannot point
out of it, and downloads never overwrite an existing file.

## Tools

Nineteen intent-shaped tools, each tagged with MCP safety annotations. Full reference:
[`docs/tools.md`](./docs/tools.md).

| Tool                            | Kind                | Description                                                 |
| ------------------------------- | ------------------- | ----------------------------------------------------------- |
| `redmine_list_issues`           | read                | Search/filter issues by status, assignee, tracker, dates…   |
| `redmine_get_issue`             | read                | Full issue detail, optionally with journals and attachments |
| `redmine_create_issue`          | write               | Create an issue                                             |
| `redmine_update_issue`          | write               | Edit an issue's status, assignee, notes…                    |
| `redmine_delete_issue`          | write · destructive | Permanently delete an issue — no undo, cascades             |
| `redmine_manage_issue_watchers` | write               | Add/remove a watcher (notification subscription)            |
| `redmine_list_issue_relations`  | read                | Dependency links of an issue, or one relation by its id     |
| `redmine_create_issue_relation` | write               | Link two issues (blocks, precedes, duplicates, relates…)    |
| `redmine_delete_issue_relation` | write · destructive | Remove one link — narrow in scope and reversible            |
| `redmine_search`                | read                | Free-text search across issues, wiki, news, projects        |
| `redmine_list_projects`         | read                | List visible projects                                       |
| `redmine_get_project`           | read                | Full project detail, trackers/categories/activities         |
| `redmine_list_time_entries`     | read                | Query logged time                                           |
| `redmine_create_time_entry`     | write               | Log hours against an issue or project                       |
| `redmine_get_current_user`      | read                | "Who am I" — the API key's user, memberships, groups        |
| `redmine_list_users`            | read                | Find users by name/status/group — admin-gated on most sites |
| `redmine_list_reference_data`   | read                | Statuses, trackers, priorities, activities, doc categories  |
| `redmine_upload_attachment`     | write               | Upload a local file → token for an issue's `uploads` array  |
| `redmine_download_attachment`   | write               | Save an attachment to a local directory (writes to disk)    |

> **Heads up:** `redmine_delete_issue` is the tool that destroys data — Redmine has no trash, and
> the delete takes the issue's comments, time entries, attachments, and relations with it. It is
> annotated `destructiveHint: true` so an MCP client can require confirmation; if your client does
> not gate on that, treat every call as final. `redmine_delete_issue_relation` carries the same
> annotation but is far narrower: it removes one link between two issues, and
> `redmine_create_issue_relation` puts it back in a single call.

> **Heads up:** on write, Redmine silently ignores an unknown `tracker_id`, `status_id`, or
> `fixed_version_id` instead of erroring — always check the returned issue. The same applies to
> `is_private`, which is silently dropped if your role lacks the "set public/private" permission.

## Security

The server runs locally and acts as a single user: your `REDMINE_API_KEY` never leaves your
machine except as a request header to your own Redmine instance, and the server can do nothing
your account couldn't already do. Multi-user HTTP transport is planned but not yet implemented —
selecting `MCP_TRANSPORT=http` exits with a clear error.

Local file access is off by default and confined to
[`REDMINE_ALLOWED_DIRECTORIES`](#file-access-redmine_allowed_directories) when you enable it. Nothing
else in the server reads or writes your filesystem.

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
