import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectRealMcp, expectStructured, runIntegration } from './support.js';
import type { InMemoryMcp } from '../support/in-memory-mcp.js';

interface ReferencePage {
  kind: string;
  items: Array<{ id: number; name: string }>;
}

/**
 * `redmine_list_reference_data` against the seeded instance. `scripts/redmine-up.sh`
 * loads Redmine's default configuration, so every enumeration is populated.
 */
describe.skipIf(!runIntegration)('integration: reference data', () => {
  let mcp: InMemoryMcp;

  beforeAll(async () => {
    mcp = await connectRealMcp();
  });

  afterAll(async () => {
    await mcp?.close();
  });

  const kinds = ['statuses', 'trackers', 'priorities', 'activities', 'document_categories'];

  it.each(kinds)('returns the %s collection', async (kind) => {
    const result = expectStructured<ReferencePage>(
      await mcp.callTool('redmine_list_reference_data', { kind }),
    );

    expect(result.kind).toBe(kind);
    expect(Array.isArray(result.items)).toBe(true);
    for (const item of result.items) {
      expect(item.id).toBeGreaterThan(0);
      expect(typeof item.name).toBe('string');
    }
  });

  it('exposes the default statuses an agent needs for status_id', async () => {
    const result = expectStructured<ReferencePage>(
      await mcp.callTool('redmine_list_reference_data', { kind: 'statuses' }),
    );

    expect(result.items.map((status) => status.name)).toContain('New');
  });

  it('rejects an unknown kind before reaching Redmine', async () => {
    const result = await mcp.callTool('redmine_list_reference_data', { kind: 'roles' });

    expect(result.isError).toBe(true);
  });
});
