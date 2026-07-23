---
'@0xkillaflow/agama-redmine-mcp': minor
---

Migrate `zod` from 3.25.76 to 4.4.3.

Internal changes only — every tool schema, domain model, and the config loader
now target the zod v4 API; the generated tool reference (`docs/tools`) is
byte-identical.

**Behavioral note (agent-facing):** default validation messages produced by zod
changed wording in v4. A missing/mistyped tool argument that was previously
reported as e.g. `Required` is now reported as
`Invalid input: expected number, received undefined`. Custom messages (config
validation, the create-time-entry issue/project XOR) are unchanged.
