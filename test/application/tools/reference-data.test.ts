import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { listReferenceDataTool } from '../../../src/application/tools/reference/list-reference-data.tool.js';
import { fakeRedmineClient, toolContext } from './support.js';

const statuses = {
  kind: 'statuses' as const,
  items: [{ id: 1, name: 'New', is_closed: false }],
};

describe('redmine_list_reference_data', () => {
  it('is read-only', () => {
    expect(listReferenceDataTool.annotations?.readOnlyHint).toBe(true);
  });

  it('points at get_project for the project-scoped view', () => {
    expect(listReferenceDataTool.description).toContain('redmine_get_project');
  });

  it.each(['statuses', 'trackers', 'priorities', 'activities', 'document_categories'] as const)(
    'passes kind "%s" through to referenceData.list',
    async (kind) => {
      const client = fakeRedmineClient();
      client.referenceData.list.mockResolvedValue({ kind, items: [] });

      await listReferenceDataTool.handle({ kind }, toolContext(client));

      expect(client.referenceData.list).toHaveBeenCalledWith(kind);
    },
  );

  it('returns the collection verbatim', async () => {
    const client = fakeRedmineClient();
    client.referenceData.list.mockResolvedValue(statuses);

    const result = await listReferenceDataTool.handle({ kind: 'statuses' }, toolContext(client));

    expect(result).toBe(statuses);
  });

  it('rejects an unknown kind via the schema', () => {
    // `kind` is required and closed; the SDK validates arguments against
    // inputSchema before the handler runs.
    expect(() => listReferenceDataTool.inputSchema.kind.parse('roles')).toThrow(ZodError);
    expect(() => listReferenceDataTool.inputSchema.kind.parse(undefined)).toThrow(ZodError);
  });
});
