# Architecture

The **Redmine MCP Server** exposes [Redmine](https://www.redmine.org/) to AI agents through the
[Model Context Protocol](https://modelcontextprotocol.io/). It is a thin, strictly-typed translation
layer that turns high-level, intent-shaped **MCP tools** into concrete calls against the Redmine
**REST API**.

```
┌──────────┐   MCP (stdio)   ┌─────────────────────┐   REST/JSON   ┌──────────┐
│  Agent   │ ──────────────▶ │  Redmine MCP Server │ ────────────▶ │ Redmine  │
│ (client) │ ◀────────────── │   (this project)    │ ◀──────────── │  server  │
└──────────┘   tool results  └─────────────────────┘     HTTP      └──────────┘
```

Tools are not a 1:1 wrapper of Redmine endpoints. They are designed around *user intent* — "what's
on the board", "log 3.5h on #456" — and are deliberately few, narrow, and well-documented so an
agent can discover and use them reliably.

---

## 1. Goals

- **Correctness & type-safety** — strict TypeScript; runtime validation with Zod at every boundary
  (MCP input and Redmine output).
- **Extensibility** — adding a tool, an authentication method, or a transport is a local, low-risk
  change. A new contributor can add a tool without understanding the whole codebase.
- **Clarity** — a small number of explicit abstractions; no magic, no DI container, no reflection.
- **Operability** — safe logging (never corrupts the stdio channel), predictable error messages,
  fail-fast configuration.

## 2. Design principles

1. **Hexagonal (Ports & Adapters).** The `domain` and `application` core depends only on *ports*
   (interfaces). All I/O — the MCP SDK, HTTP, the process environment — lives in *adapters* behind
   those ports. The core never imports an adapter or the SDK.
2. **Dependencies point inward.** `adapters → application → domain`; `domain` imports nothing from
   the outer rings. Enforced by an ESLint import-boundary rule.
3. **One Composition Root.** All wiring happens in `container.ts`. Objects receive their
   collaborators as constructor arguments — plain manual DI, no container library.
4. **Validate at the edges, trust the core.** Zod parses untrusted input (MCP arguments) and
   untrusted output (Redmine JSON) into typed domain values. Inside the core, data is already valid.
5. **Errors are values at the boundary.** The domain throws typed errors; the MCP adapter is the
   single place that converts them into protocol-level tool results. No raw exceptions escape.

---

## 3. The hexagon

```
                        ┌──────────────────────────────────────────────┐
     Driving side       │                 APPLICATION                  │      Driven side
   (inbound adapters)   │   (use-cases: one handler per MCP tool)      │  (outbound adapters)
                        │                                              │
 ┌───────────────┐      │   ┌───────────────┐    ┌──────────────────┐  │   ┌────────────────────┐
 │  MCP adapter  │──────┼──▶│ Tool handlers │───▶│      DOMAIN      │  │   │ RedmineHttpClient  │
 │ (McpServer +  │      │   │ registerTool  │    │  models · errors │  │   │ (fetch + mappers)  │
 │  transports)  │      │   │               │    │  ports (ifaces)  │◀─┼───│ implements         │
 └───────────────┘      │   └───────────────┘    └──────────────────┘  │   │ RedmineClient port │
        ▲               │           │  depends on ports only           │   └────────────────────┘
        │ stdio         │           ▼                                  │   ┌────────────────────┐
        │               │   ports: RedmineClient, CredentialProvider,  │   │ Credential provider│
 ┌───────────────┐      │          Logger                              │──▶│ (env / header)     │
 │    Agent      │      │                                              │   └────────────────────┘
 └───────────────┘      └──────────────────────────────────────────────┘
                                        ▲ wired by
                                  ┌───────────────────┐
                                  │  Composition Root │  container.ts
                                  └───────────────────┘
```

- **Driving (inbound) adapter** — the MCP server adapter receives tool calls over a transport and
  invokes application tool handlers.
- **Application** — one handler per tool. Handlers read validated input, call the `RedmineClient`
  port, and return a plain domain value. They contain no HTTP or SDK code.
- **Domain** — Redmine models (Zod schemas + inferred types), domain errors, and the port
  interfaces the application depends on.
- **Driven (outbound) adapters** — `RedmineHttpClient` (implements `RedmineClient` over `fetch`),
  credential providers, and the logger.

---

## 4. Directory structure

```
src/
├── domain/                         # Pure. No I/O, no SDK, no Node built-ins beyond types.
│   ├── models/                     # Zod schemas + inferred TS types for Redmine resources
│   │   ├── common.ts               #   id_name, custom fields, pagination envelope, include<>
│   │   ├── issue.ts · project.ts · time-entry.ts · user.ts · search.ts · reference-data.ts
│   │   ├── attachment.ts           #   upload result/input, download result
│   │   └── index.ts
│   ├── errors/                     # Typed domain errors
│   │   ├── redmine-errors.ts       #   RedmineError + Auth/Forbidden/NotFound/Validation/RateLimit/Transport
│   │   └── file-access-error.ts    #   FileAccessError — a refused local path (outside the hierarchy)
│   └── ports/                      # Interfaces = the hexagon boundary
│       ├── redmine-client.ts       #   RedmineClient (resource-grouped) + RedmineCredentials
│       ├── credential-provider.ts  #   CredentialProvider + RequestMeta
│       └── logger.ts               #   Logger
│
├── application/                    # Use-cases. Depends on ports only.
│   ├── tool-definition.ts          # ToolDefinition<I,O> contract + ToolContext + defineTool
│   ├── tool-registry.ts            # Aggregates ToolDefinitions; rejects duplicate names
│   ├── file-access.ts              # resolveAllowedPath — the filesystem allowlist guard
│   └── tools/
│       ├── issues/                 # list/get/create/update/delete-issue, manage-issue-watchers,
│       │                           #   list/create/delete-issue-relation
│       ├── projects/               # list-projects, get-project
│       ├── time-entries/           # list-time-entries, create-time-entry
│       ├── users/                  # get-current-user, list-users
│       ├── search/                 # search
│       ├── reference/              # list-reference-data
│       ├── attachments/            # upload-attachment, download-attachment
│       └── index.ts                # the registered tool array
│
├── adapters/
│   ├── redmine/                    # Outbound: RedmineClient implementation
│   │   ├── redmine-http-client.ts  #   composes resource clients; client factory
│   │   ├── http-requester.ts       #   fetch wrapper: base URL, headers, timeout, JSON
│   │   ├── request-builder.ts      #   query serialization (arrays, cf_x, date operators)
│   │   ├── error-mapper.ts         #   HTTP status/body → domain error
│   │   └── resources/              #   issues.ts, issue-relations.ts, projects.ts, time-entries.ts,
│   │                               #   users.ts, search.ts, reference-data.ts, attachments.ts,
│   │                               #   parse.ts
│   ├── credentials/
│   │   ├── env-credential-provider.ts     # stdio: REDMINE_API_KEY
│   │   └── header-credential-provider.ts  # http: Authorization: Bearer …
│   └── mcp/                        # Inbound: MCP server adapter
│       ├── mcp-server-factory.ts   #   builds McpServer, registers tools
│       ├── register-tool.ts        #   ToolDefinition → McpServer.registerTool bridge
│       ├── result-formatter.ts     #   ToolResult / domain error → MCP CallToolResult
│       ├── version.ts              #   server name/version (walks up to package.json)
│       └── transports/
│           ├── stdio-transport.ts
│           ├── http-transport.ts   #   placeholder (throws NotImplemented, documented seam)
│           └── transport-handle.ts #   shared shutdown handle
│
├── config/                         # Zod-validated environment config (schema + loader)
├── infrastructure/logger/          # console-logger.ts — writes to stderr (stdio-safe)
├── container.ts                    # Composition Root — the only place that `new`s adapters
├── server.ts                       # bootstrap: build container, start transport, handle signals
└── index.ts                        # bin entry → server.ts
```

**Import rule (lint-enforced):** `domain` imports nothing outward; `application` imports only
`domain`; `adapters`, `config`, `infrastructure` may import `domain` + `application`; only
`container.ts` and `server.ts` import adapters together.

---

## 5. Core abstractions (ports)

### 5.1 `RedmineClient` — the outbound gateway

A resource-grouped, fully-typed interface — the **only** way the application talks to Redmine.
Credentials and base URL are bound at construction, so methods carry no auth arguments. A
domain-facing typed port (rather than a generic `get/post` gateway) keeps handlers trivial and lets
tests supply a hand-written fake.

```ts
export interface RedmineClient {
  readonly issues: IssuesResource;
  readonly issueRelations: IssueRelationsResource;
  readonly projects: ProjectsResource;
  readonly timeEntries: TimeEntriesResource;
  readonly users: UsersResource;
  readonly search: SearchResource;
  readonly referenceData: ReferenceDataResource;
  readonly attachments: AttachmentsResource;
}

export interface IssuesResource {
  list(params: ListIssuesParams): Promise<Paginated<IssueSimple>>;
  get(id: number, include?: IssueInclude[]): Promise<Issue>;
  create(input: CreateIssueInput): Promise<IssueSimple>;
  update(id: number, input: UpdateIssueInput): Promise<void>;
}
// …ProjectsResource, TimeEntriesResource, UsersResource, SearchResource similarly
```

`IssueRelationsResource` is separate from `IssuesResource` because only listing and creating are
issue-scoped (`/issues/{id}/relations.json`); reading and deleting a single relation go through the
top-level `/relations/{id}.json`, which is also why deletion is keyed on the relation's own id.
`listForIssue` returns a plain array, not a page — the endpoint sends no `total_count`.

`ReferenceDataResource` is the one non-paginated collection: its endpoints return a bare
`{ <key>: [...] }`, so `list(kind)` resolves a `{ kind, items }` value discriminated by `kind`
rather than a `Paginated<T>` page.

`AttachmentsResource` is the one binary one: `upload` takes **bytes, not a path**, and `download`
returns bytes. Reading and writing local files is an application concern (§9.4), so the gateway —
and every fake of it — stays filesystem-free.

### 5.2 `CredentialProvider` — how a request is authenticated

Resolves the credentials to use for a given inbound request. This is the seam that makes the same
tool code work in single-user (stdio/env) and multi-user (http/header) modes.

```ts
export interface RedmineCredentials {
  readonly kind: 'apiKey' | 'bearer'; // extensible union
  readonly value: string;             // API key or bearer token
}

export interface CredentialProvider {
  resolve(meta: RequestMeta): Promise<RedmineCredentials>; // may throw AuthError
}
```

- **stdio** — `EnvCredentialProvider` returns the single `REDMINE_API_KEY` for every request.
- **http** — `HeaderCredentialProvider` reads `Authorization: Bearer <token>` per request, letting
  one server instance serve many users.

Both kinds are sent to Redmine as the `X-Redmine-API-Key` header (Redmine accepts an API key there);
`bearer` exists so the http adapter can carry a per-user token extracted from the inbound
`Authorization` header. New authentication kinds (OAuth, Basic) extend the `RedmineCredentials` union
and add a provider — tools are unaffected.

### 5.3 `Logger` — safe, structured logging

```ts
export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}
```

**Critical constraint:** in stdio mode, **stdout is the JSON-RPC channel**. All logs MUST go to
**stderr**. The console adapter enforces this, and `console.log`/`info`/`debug` are banned by lint in
`src/`.

### 5.4 `ToolDefinition` — the application/adapter contract

A transport-agnostic description of a tool. The MCP adapter translates it into
`McpServer.registerTool`; nothing in `application/` imports the SDK. Authored with the `defineTool`
helper for input-type inference.

```ts
export interface ToolContext {
  readonly redmine: RedmineClient;              // already authenticated for this request
  readonly logger: Logger;
  readonly allowedDirectories: readonly string[]; // the filesystem allowlist (§9.4)
}

export interface ToolDefinition<InputShape extends z.ZodRawShape, Output = unknown> {
  readonly name: string;                  // e.g. "redmine_list_issues"
  readonly title: string;                 // human title
  readonly description: string;           // agent-facing description
  readonly inputSchema: InputShape;       // ZodRawShape (the SDK expects a raw shape)
  readonly annotations?: ToolAnnotations; // readOnlyHint / destructiveHint / …
  handle(input: z.objectOutputType<InputShape, z.ZodTypeAny>, ctx: ToolContext): Promise<Output>;
}
```

Handlers return a **plain domain value**; the adapter serializes it into MCP `content` (JSON text)
plus `structuredContent`. Handlers never build MCP envelopes and never touch `isError` — they either
return a value or throw a domain error.

---

## 6. Request lifecycle (stdio)

```
1. Agent sends CallTool("redmine_list_issues", args) over stdio (JSON-RPC on stdout/stdin).
2. MCP SDK matches the registered tool; validates `args` against the Zod inputSchema.
   → invalid input ⇒ SDK returns a protocol validation error (never reaches the handler).
3. register-tool bridge:
     a. CredentialProvider.resolve(meta) → RedmineCredentials   (env: the single API key).
     b. Obtain a RedmineClient bound to those credentials         (stdio: cached singleton).
     c. Build ToolContext { redmine, logger.child({ tool }) }.
     d. Call definition.handle(parsedInput, ctx).
4. Handler calls ctx.redmine.issues.list(params).
5. RedmineHttpClient: request-builder serializes the query → http-requester does fetch →
   non-2xx ⇒ error-mapper throws a typed domain error; 2xx ⇒ Zod-parse the body into a domain model.
6. Handler returns Paginated<IssueSimple>.
7. result-formatter wraps it: content=[{type:"text", text: JSON}], structuredContent=value.
8. On a thrown domain error, result-formatter returns { isError: true, content:[friendly message] }.
```

Steps 3a–3b are the *only* difference between stdio and http. In http mode credentials come from the
request's `Authorization` header and a client is built per request; everything from step 4 on is
identical.

---

## 7. Authentication & transport model

The transport is selected by `MCP_TRANSPORT` (`stdio` default). **stdio is implemented; http is a
documented placeholder** — selecting it throws `NotImplemented` with a clear message, keeping the
request lifecycle transport-neutral so http is a purely additive change.

| Concern          | stdio (implemented)              | http (placeholder)                             |
| ---------------- | -------------------------------- | ---------------------------------------------- |
| Deployment       | Local, single user               | Cloud/corporate, multi-user                    |
| Redmine URL      | `REDMINE_URL` env                | `REDMINE_URL` env (shared instance)            |
| Credential in    | `REDMINE_API_KEY` env            | `Authorization: Bearer <token>` request header |
| Provider         | `EnvCredentialProvider`          | `HeaderCredentialProvider`                     |
| Client scope     | one client, whole process        | one client per request                         |
| Sent to Redmine  | `X-Redmine-API-Key: <key>`       | `X-Redmine-API-Key: <token>`                   |

The http mode deliberately uses a bearer header (a conscious deviation from the MCP spec's suggested
auth flows) so a single corporate instance can serve many Redmine users with their own tokens; TLS
termination at the transport is assumed.

---

## 8. Configuration

All configuration is environment-based, parsed once at startup by a Zod schema (`config/`). Invalid
configuration fails fast with a readable message, never a stack trace. `process.env` is read in
exactly one place; everything else receives the validated `AppConfig`.

| Variable             | Required       | Default | Purpose                                  |
| -------------------- | -------------- | ------- | ---------------------------------------- |
| `REDMINE_URL`        | yes            | —       | Base URL of the Redmine instance         |
| `REDMINE_API_KEY`    | yes (stdio)    | —       | API key for the single user (stdio mode) |
| `MCP_TRANSPORT`      | no             | `stdio` | `stdio` \| `http`                        |
| `REDMINE_TIMEOUT_MS` | no             | `30000` | Per-request timeout                      |
| `REDMINE_ALLOWED_DIRECTORIES` | no    | _empty_ | Filesystem allowlist for the attachment tools (§9.4) |
| `LOG_LEVEL`          | no             | `info`  | `debug` \| `info` \| `warn` \| `error`   |
| `HTTP_PORT`          | no (http only) | `3000`  | Reserved for the http transport          |

---

## 9. Cross-cutting concerns

### 9.1 Validation

- **Inbound** — each tool's `inputSchema` is a Zod raw shape; the SDK validates arguments before the
  handler runs. Cross-field rules a raw shape cannot express (e.g. "exactly one of A or B") are
  enforced by re-parsing inside the handler with `z.object(shape).superRefine(...)`.
- **Outbound** — every Redmine response is parsed with the resource's Zod schema in `domain/models`.
  A schema mismatch becomes a `RedmineTransportError` ("unexpected response shape") rather than a
  silent `any`, making the server robust to Redmine version drift and giving one place to update when
  the API changes. Schemas stay tolerant — only fields the tools truly depend on are required.

### 9.2 Error handling

Domain error hierarchy (`domain/errors`):

```
RedmineError (abstract)
├── RedmineAuthError          (401)  — bad/missing key
├── RedmineForbiddenError     (403)  — insufficient permission
├── RedmineNotFoundError      (404)  — missing resource
├── RedmineValidationError    (422)  — carries Redmine's `errors: string[]`
├── RedmineRateLimitError     (429)
└── RedmineTransportError     (network, timeout, 5xx, bad JSON, schema mismatch)
```

`error-mapper.ts` maps HTTP → these; `result-formatter.ts` maps these → agent-friendly `isError`
tool results. `406` (Redmine's rejection code for a refused upload) maps to `RedmineValidationError`
alongside `422`, since it carries the same `errors` envelope. Three error types sit outside this
hierarchy at the edges: `ConfigError` (in `config/`) aborts startup before any Redmine call,
`NotImplementedError` (extends `Error`, not `RedmineError`) marks the http-transport capability gap,
and `FileAccessError` reports a refused local path. The first two are handled at their own layer; the
formatter surfaces `FileAccessError`'s message verbatim, because it is written to be agent-facing and
secret-free and the agent can only correct a path if it is told why it was refused.

### 9.3 Redmine query encoding

### 9.4 Filesystem access

Only the two attachment tools touch the local disk, and only through
`application/file-access.ts`'s `resolveAllowedPath`, which validates a caller-supplied path against
the `REDMINE_ALLOWED_DIRECTORIES` allowlist carried on the `ToolContext`. The guard **fails closed**
(no configured roots ⇒ no file access), `realpath`s both the candidate and the roots *before* testing
containment (so `..` and symlinks cannot escape), and compares on path-segment boundaries (so
`/data/allowed-evil` does not satisfy `/data/allowed`). Downloads additionally reduce the
Redmine-supplied filename to a bare basename — it is uploader-controlled data — and never overwrite
an existing file. This is a security boundary, not a convenience check: without it, an agent that can
be prompt-injected can exfiltrate or clobber arbitrary local files.

### 9.5 Redmine query encoding

`request-builder.ts` centralizes Redmine's query quirks: array filters are comma-joined
(`status_id=1,2`), custom-field filters use `cf_<id>` keys, date filters accept operator prefixes
(`>=2024-01-01`, `><…|…`), `include` is a comma-joined list, and pagination uses `offset`/`limit`
with a `total_count` envelope (`total_count`/`offset`/`limit` are treated as optional, since Redmine
omits them on small responses).

---

## 10. Tool catalog

The server exposes **19 intent-shaped tools**. Full per-tool reference lives under
[`tools/`](./tools/) (generated from the tool registry); the index is [`tools.md`](./tools.md).

| Tool                        | Redmine endpoint(s)       | Kind  | Notes                                 |
| --------------------------- | ------------------------- | ----- | ------------------------------------- |
| `redmine_list_issues`       | `GET /issues.json`        | read  | Large filter surface, pagination      |
| `redmine_get_issue`         | `GET /issues/{id}.json`   | read  | `include` expansions                  |
| `redmine_create_issue`      | `POST /issues.json`       | write | Returns the created issue             |
| `redmine_update_issue`      | `PUT /issues/{id}.json`   | write | 204 → re-fetch & return updated issue |
| `redmine_delete_issue`      | `DELETE /issues/{id}.json` | write · destructive | Permanent & cascading; own tool by ADR-0023 |
| `redmine_manage_issue_watchers` | `POST`/`DELETE /issues/{id}/watchers` | write | One `action` enum over two endpoints |
| `redmine_list_issue_relations` | `GET /issues/{id}/relations.json`, `GET /relations/{id}.json` | read | Issue's links, or one by relation id |
| `redmine_create_issue_relation` | `POST /issues/{id}/relations.json` | write | Directional; Redmine derives the inverse |
| `redmine_delete_issue_relation` | `DELETE /relations/{id}.json` | write · destructive | Keyed on the relation id; reversible |
| `redmine_search`            | `GET /search.json`        | read  | Cross-entity free-text search         |
| `redmine_list_projects`     | `GET /projects.json`      | read  | Pagination, `include`                 |
| `redmine_get_project`       | `GET /projects/{id}.json` | read  | Accepts numeric id or identifier slug |
| `redmine_list_time_entries` | `GET /time_entries.json`  | read  | Timesheet queries                     |
| `redmine_create_time_entry` | `POST /time_entries.json` | write | `issue_id` xor `project_id` required  |
| `redmine_get_current_user`  | `GET /users/current.json` | read  | "Who am I" + memberships/groups       |
| `redmine_list_users`        | `GET /users.json`         | read  | Name → id lookup; admin-gated         |
| `redmine_list_reference_data` | `/issue_statuses`, `/trackers`, `/enumerations/*` | read | One `kind` switch over five lookups |
| `redmine_upload_attachment`   | `POST /uploads.json`      | write | Reads a local file (§9.4); returns a token |
| `redmine_download_attachment` | `GET /attachments/{id}` + `/download/{id}/{name}` | write | Writes a local file (§9.4) |

`redmine_update_issue` re-fetches the issue after a successful `PUT` (which returns `204 No Content`)
and returns the resulting state, so an agent can confirm the outcome. Each tool sets MCP annotations
(`readOnlyHint`, `destructiveHint`) so clients can reason about safety. Attaching a file is a
deliberate two-step flow: `redmine_upload_attachment` returns a token that does nothing until it is
passed in the `uploads` array of a create/update call. `redmine_download_attachment` changes nothing
in Redmine but is *not* annotated read-only, because it writes to the local filesystem.
`redmine_delete_issue` and `redmine_delete_issue_relation` are the tools carrying
`destructiveHint: true`, deliberately kept out of `redmine_update_issue` and
`redmine_create_issue_relation` (ADR-0023) so that hint stays meaningful; both set
`idempotentHint: false`, since a repeated call fails with a not-found rather than no-opping. Their
blast radius differs by an order of magnitude — deleting an issue is irreversible and cascading,
deleting a relation drops one link that a single `redmine_create_issue_relation` call restores — and
that nuance lives in the descriptions, not in the annotations (ADR-0024).

---

## 11. Extensibility

- **Add a tool** — create `application/tools/<area>/<name>.tool.ts` implementing `ToolDefinition`,
  add its call to the relevant `RedmineClient` resource (+ Zod model if new), and register it in
  `application/tools/index.ts`. No adapter or wiring changes. See [`adding-a-tool.md`](./adding-a-tool.md).
- **Add an auth method** — extend the `RedmineCredentials` union and add a `CredentialProvider`
  implementation; wire it in `container.ts`. Tools are unaffected.
- **Add a transport** — implement a transport in `adapters/mcp/transports/` and branch on
  `MCP_TRANSPORT` in `server.ts`. The http placeholder already marks the seam.

---

## 12. Testing strategy

- **Unit (fast, no network)** — tool handlers against a hand-written `FakeRedmineClient`;
  `request-builder`, `error-mapper`, config, and `result-formatter` in isolation; Zod models against
  captured fixtures.
- **Adapter tests** — resources and `http-requester` against a mocked `fetch` using response
  fixtures.
- **Integration (opt-in)** — end-to-end against a Dockerized Redmine (`docker-compose.yml`), driven
  through an **in-memory MCP client** so the full stdio path (register → validate → handle → format)
  is exercised without a real subprocess. Gated on `RUN_INTEGRATION=1`; the default suite needs no
  network.

Framework: **Vitest**.

---

## 13. Technology stack & conventions

- **Runtime** — Node.js 22+, ESM only (`"type": "module"`), `.js` import specifiers.
- **Language** — TypeScript `strict` (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **MCP** — `@modelcontextprotocol/sdk`, high-level **`McpServer`** / `registerTool` only (never the
  deprecated low-level `Server`).
- **Validation** — **Zod** for MCP input shapes and Redmine DTOs; domain types are `z.infer`-red
  from schemas, never cast.
- **DI** — manual Composition Root, no container library.
- **Lint/format** — ESLint (with the import-boundary rule) + Prettier.
- **Tests** — Vitest.
- **Build** — **`tsup`** (esbuild) to ESM in `dist/`, published to npm and runnable via `npx`; the
  CLI shebang is injected by the build banner.

---

## 14. Related documents

- [`../README.md`](../README.md) — install & quick start.
- [`adding-a-tool.md`](./adding-a-tool.md) — step-by-step guide to adding a tool.
- [`tools.md`](./tools.md) + [`tools/`](./tools/) — the generated tool reference.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — contribution workflow.
