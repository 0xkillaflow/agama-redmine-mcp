import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineTool } from '../../src/application/tool-definition.js';
import { createToolRegistry, type AnyToolDefinition } from '../../src/application/tool-registry.js';

function makeTool(name: string): AnyToolDefinition {
  return defineTool({
    name,
    title: name,
    description: `Tool ${name}.`,
    inputSchema: { q: z.string() },
    handle: async (input) => ({ echoed: input.q }),
  });
}

describe('createToolRegistry', () => {
  it('lists all registered tools in insertion order', () => {
    const a = makeTool('redmine_a');
    const b = makeTool('redmine_b');
    const registry = createToolRegistry([a, b]);
    expect(registry.list()).toEqual([a, b]);
  });

  it('throws on a duplicate tool name', () => {
    const a = makeTool('redmine_dup');
    const b = makeTool('redmine_dup');
    expect(() => createToolRegistry([a, b])).toThrow(/redmine_dup/);
  });

  it('accepts an empty tool set', () => {
    expect(createToolRegistry([]).list()).toEqual([]);
  });
});
