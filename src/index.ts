/**
 * CLI entry point — the `redmine-mcp` bin (see package.json `bin`).
 *
 * Kept intentionally tiny: it only starts the bootstrap. All logic — config,
 * wiring, transport, signals — lives in `server.ts` so the entry stays trivial.
 * The `#!/usr/bin/env node` shebang that makes `dist/index.js` directly runnable
 * is injected by the build banner, so it is deliberately absent here —
 * duplicating it would break the bundle (a shebang is only valid on line 1).
 */

import { main } from './server.js';

void main();
