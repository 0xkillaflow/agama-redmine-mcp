/**
 * Server identity — the `name`/`version` the MCP handshake advertises to clients.
 *
 * Both are sourced from the package manifest so there is a single source of truth
 * and no version string to keep in sync by hand. The manifest is located by
 * walking up from this module, which works both when running from source
 * (`src/…` in dev/test) and from the bundled CLI (`dist/index.js`), where the
 * manifest sits one directory above. If it cannot be read, we fall back to stable
 * defaults rather than aborting startup — the identity is informational.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The minimal server identity passed to `new McpServer(...)`. */
export interface ServerInfo {
  readonly name: string;
  readonly version: string;
}

/** Defaults used only if the package manifest cannot be located or parsed. */
const FALLBACK: ServerInfo = { name: 'redmine-mcp', version: '0.0.0' };

/** Walk up from `startDir` until a `package.json` is found; `undefined` if none. */
function findPackageJson(startDir: string): string | undefined {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined; // reached the filesystem root
    dir = parent;
  }
}

/** Read `name`/`version` from the nearest ancestor `package.json`. */
function readServerInfo(): ServerInfo {
  try {
    const path = findPackageJson(dirname(fileURLToPath(import.meta.url)));
    if (path === undefined) return FALLBACK;
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as Partial<ServerInfo>;
    return {
      name: typeof pkg.name === 'string' ? pkg.name : FALLBACK.name,
      version: typeof pkg.version === 'string' ? pkg.version : FALLBACK.version,
    };
  } catch {
    return FALLBACK;
  }
}

/** The resolved server identity, read once at module load. */
export const serverInfo: ServerInfo = readServerInfo();
