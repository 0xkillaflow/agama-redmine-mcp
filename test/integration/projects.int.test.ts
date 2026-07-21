import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  connectRealMcp,
  expectStructured,
  runIntegration,
  testProjectIdentifier,
} from './support.js';
import type { InMemoryMcp } from '../support/in-memory-mcp.js';

interface ProjectSummary {
  id: number;
  identifier: string;
  name: string;
}

/** `redmine_list_projects` / `redmine_get_project` over the seeded test project. */
describe.skipIf(!runIntegration)('integration: projects', () => {
  let mcp: InMemoryMcp;

  beforeAll(async () => {
    mcp = await connectRealMcp();
  });

  afterAll(async () => {
    await mcp?.close();
  });

  it('gets the seeded project by identifier', async () => {
    const project = expectStructured<ProjectSummary>(
      await mcp.callTool('redmine_get_project', { project_id: testProjectIdentifier }),
    );

    expect(project.identifier).toBe(testProjectIdentifier);
    expect(project.id).toBeGreaterThan(0);
  });

  it('finds the seeded project in the list', async () => {
    const page = expectStructured<{ items: ProjectSummary[] }>(
      await mcp.callTool('redmine_list_projects', {}),
    );

    const identifiers = page.items.map((p) => p.identifier);
    expect(identifiers).toContain(testProjectIdentifier);
  });
});
