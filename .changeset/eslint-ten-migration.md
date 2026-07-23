---
'@0xkillaflow/agama-redmine-mcp': patch
---

Migrate ESLint from 9.39.5 to 10.7.0; replace the stalled `eslint-plugin-import`
(no ESLint 10 support) with the maintained `eslint-plugin-import-x` fork.

Dev-tooling only — no runtime or published-package changes. The hexagonal
import-boundary rule (ADR-0001) was re-verified to fail on a deliberate
cross-layer import under the new plugin. Note for contributors: ESLint 10
requires Node `^20.19.0 || ^22.13.0 || >=24` to run lint locally.
