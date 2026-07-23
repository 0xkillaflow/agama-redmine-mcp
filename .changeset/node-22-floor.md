---
'@0xkillaflow/agama-redmine-mcp': major
---

**BREAKING:** raise the minimum supported Node.js version from 20 to 22
(`engines.node: ">=22"`).

Node.js 20 reached end-of-life on 2026-04-30 and no longer receives security
patches; Node.js 22 is the current active LTS (supported until 2027-04-30).
Consumers still on Node 20 must upgrade their runtime before taking this
release. No API or behavior changes — `@types/node` now tracks the 22.x line
and CI tests Node 22 and 24.
