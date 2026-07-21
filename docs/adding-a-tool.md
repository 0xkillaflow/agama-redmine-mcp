# Adding a tool

A worked, copy-pasteable recipe for adding one MCP tool end-to-end. The layers are small and each
step touches one place, so you should not need to read the whole codebase. The running example is
**`redmine_list_users`** (`GET /users.json`).

Before you start, skim [architecture §5](./architecture.md#5-core-abstractions-ports) (the ports) and
[§9](./architecture.md#9-cross-cutting-concerns) (validation, error handling, query encoding). The
golden rule is the layer boundary: **`domain/` imports nothing outward; `application/` imports
`domain/` only** — lint enforces it.

---

## Overview

A tool spans four layers, always in the same order:

```
domain/models     →  Zod schema + inferred type for the Redmine resource     (+ fixture)
domain/ports      →  add the method to the RedmineClient resource interface
adapters/redmine  →  implement that method against the HTTP requester         (+ unit test)
application/tools →  the ToolDefinition (defineTool) + register it            (+ handler test)
docs              →  regenerate the tool reference
```

## Step 1 — Confirm the endpoint

Find the operation in [`../openapi/`](../openapi/) (grouped by area, e.g.
`redmine-other.yaml` for users) and confirm the request parameters and response shape. Note the JSON
envelope key — Redmine wraps collections as `{ "users": [...], "total_count": N, "offset": …,
"limit": … }` and singletons as `{ "user": {...} }` — you need it when parsing.

## Step 2 — Model the resource (`domain/models/*`)

Add or extend a Zod schema and infer its type. Reuse the building blocks in
[`src/domain/models/common.ts`](../src/domain/models/common.ts) (`IdName`, custom fields,
`paginated()`, the `include<>` helper). Keep the schema tolerant of Redmine version drift — a parse
failure surfaces as a `RedmineTransportError`, so only require fields you truly depend on.

```ts
// src/domain/models/user.ts (extend the existing file)
export const UserSimpleSchema = z.object({
  id: z.number().int(),
  login: z.string(),
  firstname: z.string(),
  lastname: z.string(),
});
export type UserSimple = z.infer<typeof UserSimpleSchema>;

// params object the tool passes down (mirror the filters you expose)
export interface ListUsersParams {
  status?: number;
  name?: string;
  group_id?: number;
  offset?: number;
  limit?: number;
}
```

Add a **fixture** under [`test/support/fixtures/`](../test/support/fixtures/) (a captured JSON
response) and export it from `fixtures/index.ts`, so both the resource test and the fake client can
use realistic data.

## Step 3 — Extend the port + implement the resource

**Port** — add the method to the resource interface in
[`src/domain/ports/redmine-client.ts`](../src/domain/ports/redmine-client.ts):

```ts
export interface UsersResource {
  getCurrent(include?: CurrentUserInclude[]): Promise<User>;
  list(params: ListUsersParams): Promise<Paginated<UserSimple>>; // new
}
```

**Implementation** — in the matching resource file under
[`src/adapters/redmine/resources/`](../src/adapters/redmine/resources/). Serialize the query with
`toQuery(...)` (it handles arrays, `cf_<id>`, date operators, `include`) and parse the response with
the resource's schema — never cast. Collections use `parseBody(paginated(key, schema), …)`; single
objects use `parseEnvelope(key, schema, …)` (see
[`resources/parse.ts`](../src/adapters/redmine/resources/parse.ts)).

```ts
// src/adapters/redmine/resources/users.ts
async list(params: ListUsersParams): Promise<Paginated<UserSimple>> {
  const body = await http.get('/users.json', toQuery(params));
  return parseBody(paginated('users', UserSimpleSchema), body, 'list users');
}
```

Add a **resource unit test** against a mocked `fetch` (see the existing
[`test/adapters/redmine/resources/`](../test/adapters/redmine/resources/) tests and the shared
`support.ts` helper): assert the URL/query it builds and that a fixture body parses. Then teach the
**fake client** the new method so handler tests can use it —
[`test/support/fake-redmine-client.ts`](../test/support/fake-redmine-client.ts).

## Step 4 — Define the tool (`application/tools/<area>/<name>.tool.ts`)

Create the `ToolDefinition` with `defineTool`. The input is a **Zod raw shape** (a plain object of
Zod types, not a `z.object(...)`). **`.describe()` every field** — descriptions are the agent's UX
and the single biggest factor in whether a model uses the tool correctly. Set the MCP annotations
truthfully (`readOnlyHint: true` for reads; `readOnlyHint: false` for writes, plus
`destructiveHint: true` for deletes).

```ts
// src/application/tools/users/list-users.tool.ts
import { z } from 'zod';
import { defineTool } from '../../tool-definition.js';

const inputShape = {
  status: z
    .number()
    .int()
    .optional()
    .describe('Account status: 1 active, 2 registered, 3 locked. Defaults to active.'),
  name: z.string().optional().describe('Filter by login, name, or email (substring match).'),
  group_id: z.number().int().positive().optional().describe('Only users in this group id.'),
  offset: z.number().int().nonnegative().optional().describe('Pagination offset (skip N users).'),
  limit: z.number().int().nonnegative().optional().describe('Maximum number of users to return.'),
};

export const listUsersTool = defineTool({
  name: 'redmine_list_users',
  title: 'List users',
  description:
    'List Redmine users, optionally filtered by status, name, or group — for resolving an ' +
    'assignee or auditing membership. Requires admin permission on most instances.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.users.list(input),
});
```

Handlers stay thin: read validated input, call the port, return a plain domain value. **Never** build
MCP envelopes or touch `isError` — throw a domain error and the MCP adapter formats it. For
cross-field rules a raw shape can't express (e.g. "exactly one of A or B"), re-parse inside the
handler with `z.object(inputShape).superRefine(...)` — see
[`create-time-entry.tool.ts`](../src/application/tools/time-entries/create-time-entry.tool.ts).

## Step 5 — Register the tool

Add it to the array in
[`src/application/tools/index.ts`](../src/application/tools/index.ts). That is the only wiring
needed — the registry rejects duplicate names, and the MCP adapter picks it up at startup.

```ts
import { listUsersTool } from './users/list-users.tool.js';

export const tools: AnyToolDefinition[] = [
  // …existing tools…
  listUsersTool,
];
```

## Step 6 — Test the handler (and integration, if applicable)

Add a **handler unit test** using the fake client (see
[`test/application/tools/`](../test/application/tools/) and its `support.ts`): assert the handler
passes the right params to the port and returns its result. If you have a Dockerized Redmine, add an
**integration test** under [`test/integration/`](../test/integration/) gated on `RUN_INTEGRATION=1`.

## Step 7 — Regenerate the tool reference

```bash
npm run gen:tools     # rewrites docs/tools.md (index) + docs/tools/<name>.md from the registry
```

Commit the regenerated files. CI fails (`npm run gen:tools:check`) if they are stale — the reference
is derived entirely from the registry, so it can never drift from the code.

---

## Final checklist

- [ ] Endpoint confirmed against `openapi/` (params + response envelope key).
- [ ] Zod model added/extended in `domain/models/*`; type inferred; fixture added and exported.
- [ ] Method added to the `RedmineClient` resource interface in `domain/ports`.
- [ ] Resource method implemented in `adapters/redmine/resources/*` (query via `toQuery`, response
      parsed — no casts).
- [ ] Resource unit test (mocked `fetch`) passes; fake client updated with the new method.
- [ ] `ToolDefinition` created with a fully `.describe()`d input shape and correct annotations.
- [ ] Tool registered in `application/tools/index.ts`.
- [ ] Handler unit test (fake client) passes; integration test added if applicable.
- [ ] `npm run gen:tools` run and the reference committed.
- [ ] `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build` all
      green.

## Copy-paste tool skeleton

```ts
import { z } from 'zod';
import { defineTool } from '../../tool-definition.js';

const inputShape = {
  // field: z.<type>().optional().describe('What it is and the accepted forms.'),
};

export const myTool = defineTool({
  name: 'redmine_<verb>_<noun>',
  title: 'Human title',
  description: 'One or two sentences: what it does and when an agent should reach for it.',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true }, // writes: readOnlyHint: false
  handle: async (input, { redmine }) => {
    // call a RedmineClient resource method and return its plain value
    throw new Error('not implemented');
  },
});
```
