import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serverInfo } from '../../../src/adapters/mcp/version.js';

/** The project's own manifest, read directly for comparison. */
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'),
) as { name: string; version: string };

describe('serverInfo', () => {
  it('sources name and version from package.json', () => {
    expect(serverInfo.name).toBe(pkg.name);
    expect(serverInfo.version).toBe(pkg.version);
  });
});
