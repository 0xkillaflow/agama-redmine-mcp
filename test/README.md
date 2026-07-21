# Tests

Fast, isolated tests for the Redmine MCP server. Framework: **Vitest** (ADR-0012).
See [`../docs/architecture.md`](../docs/architecture.md) §12 for the overall strategy.

## Layout & naming

- Test files are named `*.test.ts`. The suite lives under `test/`, mirroring the
  `src/` tree (`src/adapters/mcp/…` → `test/adapters/mcp/…`). The Vitest config also
  picks up co-located `src/**/*.test.ts`, so a test may sit next to its subject when
  that reads better — either location is valid, the name is what matters.
- Shared helpers live in `test/support/` (see below). Suite-local helpers live in a
  `support.ts` next to the tests that use them.
- Opt-in integration tests are `test/integration/*.int.test.ts` — see
  [`integration/README.md`](./integration/README.md).

## Conventions

- **AAA.** Structure each test as Arrange → Act → Assert, with a blank line between
  the phases. Keep one behaviour per test.
- **No network in unit tests.** Unit and e2e tests never touch a real server. Tool
  handlers run against the `FakeRedmineClient`; the outbound HTTP adapters run against
  a mocked `fetch`/requester. Real HTTP happens only in the gated integration suite.
- **Fixtures over inline literals.** Prefer the shared fixtures in
  `test/support/fixtures/` over ad-hoc object literals, so payloads stay faithful to
  real Redmine responses and update in one place when a model changes.

## Shared harness (`test/support/`)

- **`fixtures/`** — faithful Redmine wire payloads as JSON (issue, issue.simple,
  project, project.simple, time_entry, user, search results, 422 errors). `index.ts`
  loads them _through_ the domain Zod schemas, so they are typed and any drift from a
  schema fails at import.
- **`fake-redmine-client.ts`** — a hand-written `RedmineClient` implementing all five
  resources, backed by the fixtures. Every method records its calls
  (`fake.issues.list.calls[0]`) and is programmable (`.resolve(value)`, `.reject(err)`,
  `.implement(fn)`). Use it for tool-handler unit tests.
- **`in-memory-mcp.ts`** — `connectInMemoryMcp()` builds the real `McpServer` and
  connects it to an MCP `Client` over the SDK's linked in-memory transport pair,
  returning `{ client, callTool, close }`. This exercises the full
  register → validate → handle → format path in-process, with no subprocess. Pass a
  `redmine` client to serve (a fake for e2e, the real HTTP client for integration).
- **`silent-logger.ts`** — a no-op `Logger`.

Templates to copy:
[`example-tool.test.ts`](./support/example-tool.test.ts) (handler + fake) and
[`example-e2e.test.ts`](./support/example-e2e.test.ts) (in-memory client).

## Running

```sh
npm test            # run the whole default suite once (no Docker/network)
npm run test:watch  # watch mode
npm run coverage    # with the core coverage gate (domain/application/adapters)
```
