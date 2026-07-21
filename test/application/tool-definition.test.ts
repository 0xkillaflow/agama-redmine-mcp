import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineTool, type ToolContext } from '../../src/application/tool-definition.js';

describe('defineTool', () => {
  it('infers the handler input type from inputSchema and passes it through', async () => {
    const sum = defineTool({
      name: 'sum',
      title: 'Sum',
      description: 'Adds two numbers.',
      inputSchema: { a: z.number(), b: z.number() },
      handle: async (input) => {
        // Type-level assertion: `input.a` / `input.b` are inferred as `number`.
        const total: number = input.a + input.b;
        return { total };
      },
    });

    // A fake context is enough — this tool does not touch it.
    const ctx = {} as unknown as ToolContext;
    const result = await sum.handle({ a: 2, b: 3 }, ctx);
    expect(result).toEqual({ total: 5 });
  });

  it('returns the definition unchanged (identity helper)', () => {
    const def = {
      name: 'noop',
      title: 'No-op',
      description: 'Does nothing.',
      inputSchema: {},
      handle: async () => undefined,
    };
    expect(defineTool(def)).toBe(def);
  });
});
