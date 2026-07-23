---
'@0xkillaflow/agama-redmine-mcp': patch
---

Migrate TypeScript from 5.9.3 to 6.0.3 (the bridge major before the 7.x native
compiler, which stays blocked on `typescript-eslint` peer support).

Dev-tooling only — emitted `dist/` output is byte-identical to the 5.9.3 build.
One migration nuance: tsup's dts worker injects the now-deprecated `baseUrl`
option, so `ignoreDeprecations: "6.0"` is scoped to the dts build in
`tsup.config.ts` (not the project tsconfig — `npm run typecheck` stays strict).
